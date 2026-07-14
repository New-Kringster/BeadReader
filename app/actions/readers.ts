"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createReader,
  regenerateCode,
  setReaderRevoked,
  setReaderExplicit,
  deleteReader,
} from "@/lib/data";

export async function createReaderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  await createReader(name || "Reader");
  revalidatePath("/admin/readers");
}

export async function regenerateCodeAction(userId: string): Promise<void> {
  await requireAdmin();
  await regenerateCode(userId);
  revalidatePath("/admin/readers");
}

export async function toggleRevokedAction(userId: string, revoked: boolean): Promise<void> {
  await requireAdmin();
  await setReaderRevoked(userId, revoked);
  revalidatePath("/admin/readers");
}

export async function toggleExplicitAction(userId: string, hasAccess: boolean): Promise<void> {
  await requireAdmin();
  await setReaderExplicit(userId, hasAccess);
  revalidatePath("/admin/readers");
}

export async function deleteReaderAction(userId: string): Promise<void> {
  await requireAdmin();
  await deleteReader(userId);
  revalidatePath("/admin/readers");
}
