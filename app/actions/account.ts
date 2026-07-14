"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { setCustomAccessCode, regenerateCode } from "@/lib/data";

export type CodeState = { error?: string; success?: string };

/** The signed-in user sets their own access code. */
export async function setMyCodeAction(
  _prev: CodeState,
  formData: FormData
): Promise<CodeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You're not signed in." };

  const code = String(formData.get("code") ?? "").trim();
  if (code.length < 4) return { error: "Use at least 4 characters." };
  if (code.length > 40) return { error: "That's too long (40 characters max)." };
  if (/\s/.test(code)) return { error: "No spaces in the code, please." };
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
