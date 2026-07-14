"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin, COVERS_BUCKET } from "@/lib/supabase";
import { createBook, updateBook, deleteBook, getBook } from "@/lib/data";
import type { PublishStatus } from "@/lib/types";

async function uploadCover(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(COVERS_BUCKET)
    .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from(COVERS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function readBookFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim() || "Untitled",
    author: String(formData.get("author") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    status: (formData.get("status") === "published" ? "published" : "draft") as PublishStatus,
  };
}

export async function createBookAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const fields = readBookFields(formData);
  const cover_url = await uploadCover(formData.get("cover") as File);
  const book = await createBook({ ...fields, cover_url });
  revalidatePath("/admin");
  redirect(`/admin/books/${book.id}`);
}

export async function updateBookAction(bookId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const fields = readBookFields(formData);
  const cover = formData.get("cover") as File;
  const cover_url = await uploadCover(cover);
  await updateBook(bookId, cover_url ? { ...fields, cover_url } : fields);
  revalidatePath("/admin");
  revalidatePath(`/admin/books/${bookId}`);
}

export async function removeCoverAction(bookId: string): Promise<void> {
  await requireAdmin();
  await updateBook(bookId, { cover_url: null });
  revalidatePath(`/admin/books/${bookId}`);
}

export async function deleteBookAction(bookId: string): Promise<void> {
  await requireAdmin();
  const book = await getBook(bookId);
  await deleteBook(bookId);
  if (book?.cover_url) {
    const file = book.cover_url.split(`${COVERS_BUCKET}/`).pop();
    if (file) await supabaseAdmin.storage.from(COVERS_BUCKET).remove([file]);
  }
  revalidatePath("/admin");
  redirect("/admin");
}
