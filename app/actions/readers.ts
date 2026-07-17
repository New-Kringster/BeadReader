"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { validateAccessCode } from "@/lib/codes";
import {
  createUser,
  regenerateCode,
  setUserRevoked,
  setReaderExplicit,
  setReaderCalMode,
  setCustomAccessCode,
  deleteUser,
  getUserByAccessCode,
  countAdmins,
} from "@/lib/data";
import type { Role } from "@/lib/types";

export type UserFormState = { error?: string; success?: string };

/** Create a reader or admin, optionally with a preset access code. */
export async function createUserAction(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const role: Role = formData.get("role") === "admin" ? "admin" : "reader";
  const code = String(formData.get("code") ?? "").trim();

  if (code) {
    const invalid = validateAccessCode(code);
    if (invalid) return { error: invalid };
  }

  const { user, error } = await createUser(name, role, code || undefined);
  if (error || !user) return { error: error ?? "Could not create the account." };

  revalidatePath("/admin/readers");
  return { success: `Created ${user.name} — code ${user.access_code}` };
}

export async function regenerateCodeAction(userId: string): Promise<void> {
  await requireAdmin();
  await regenerateCode(userId);
  revalidatePath("/admin/readers");
}

/** Set a specific access code on a user. */
export async function setUserCodeAction(
  userId: string,
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();
  const code = String(formData.get("code") ?? "").trim();
  const invalid = validateAccessCode(code);
  if (invalid) return { error: invalid };

  const existing = await getUserByAccessCode(code);
  if (existing && existing.id !== userId) return { error: "That code is already taken." };

  const res = await setCustomAccessCode(userId, code);
  if (!res.ok) return { error: res.error ?? "Could not set the code." };

  revalidatePath("/admin/readers");
  return { success: "Code updated." };
}

export async function toggleRevokedAction(userId: string, revoked: boolean): Promise<void> {
  const me = await requireAdmin();
  if (userId === me.id) return; // never lock yourself out
  // Don't revoke the last remaining admin.
  if (revoked && (await countAdmins(userId)) === 0) return;
  await setUserRevoked(userId, revoked);
  revalidatePath("/admin/readers");
}

export async function toggleExplicitAction(userId: string, hasAccess: boolean): Promise<void> {
  await requireAdmin();
  await setReaderExplicit(userId, hasAccess);
  revalidatePath("/admin/readers");
}

/** Toggle "cal mode": the reader sees the book as if it had no spicy content at
 *  all. Mutually exclusive with spicy access (handled in the data layer). */
export async function toggleCalModeAction(userId: string, on: boolean): Promise<void> {
  await requireAdmin();
  await setReaderCalMode(userId, on);
  revalidatePath("/admin/readers");
}

export async function deleteUserAction(userId: string): Promise<void> {
  const me = await requireAdmin();
  if (userId === me.id) return; // can't delete yourself
  if ((await countAdmins(userId)) === 0) return; // keep at least one admin
  await deleteUser(userId);
  revalidatePath("/admin/readers");
}
