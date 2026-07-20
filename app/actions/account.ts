"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { validateAccessCode } from "@/lib/codes";
import {
  setCustomAccessCode,
  regenerateCode,
  saveSettings,
  setAvatar,
  deleteAvatar,
} from "@/lib/data";

export type CodeState = { error?: string; success?: string };

/** The signed-in reader opts in/out of the social presence & stats layer. */
export async function setShareActivityAction(on: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await saveSettings(user.id, { share_activity: on });
  revalidatePath("/read/account");
}

// Avatars are compressed client-side to a small square; this is the size ceiling
// the server enforces on the resulting data URI (a generous ~64KB of base64).
const MAX_AVATAR_CHARS = 90_000;

/** Save the signed-in user's compressed profile photo (a data URI). */
export async function setAvatarAction(dataUri: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You're not signed in." };
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUri)) {
    return { error: "That doesn't look like an image." };
  }
  if (dataUri.length > MAX_AVATAR_CHARS) {
    return { error: "Image is too large even after compression — try a smaller one." };
  }
  await setAvatar(user.id, dataUri);
  revalidatePath("/read/account");
  return {};
}

/** Remove the signed-in user's profile photo. */
export async function removeAvatarAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await deleteAvatar(user.id);
  revalidatePath("/read/account");
}

/** The signed-in user sets their own access code. */
export async function setMyCodeAction(
  _prev: CodeState,
  formData: FormData
): Promise<CodeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You're not signed in." };

  const code = String(formData.get("code") ?? "").trim();
  const invalid = validateAccessCode(code);
  if (invalid) return { error: invalid };
  if (code === user.access_code) return { error: "That's already your code." };

  const res = await setCustomAccessCode(user.id, code);
  if (!res.ok) return { error: res.error ?? "Could not update the code." };

  revalidatePath("/read/account");
  return { success: "Your access code was updated." };
}

/** The signed-in user generates a fresh random access code. */
export async function regenerateMyCodeAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await regenerateCode(user.id);
  revalidatePath("/read/account");
}
