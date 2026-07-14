"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createChapter,
  updateChapter,
  deleteChapter,
  reorderChapters,
  getChapter,
} from "@/lib/data";
import type { PublishStatus } from "@/lib/types";

function readChapterFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim() || "Untitled chapter",
    content: String(formData.get("content") ?? ""),
    is_explicit: formData.get("is_explicit") === "on" || formData.get("is_explicit") === "true",
    status: (formData.get("status") === "published" ? "published" : "draft") as PublishStatus,
  };
}

export async function createChapterAction(bookId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const chapter = await createChapter(bookId, readChapterFields(formData));
  revalidatePath(`/admin/books/${bookId}`);
  redirect(`/admin/books/${bookId}/chapters/${chapter.id}`);
}

export async function updateChapterAction(chapterId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const chapter = await getChapter(chapterId);
  if (!chapter) redirect("/admin");
  await updateChapter(chapterId, readChapterFields(formData));
  revalidatePath(`/admin/books/${chapter.book_id}`);
  revalidatePath(`/admin/books/${chapter.book_id}/chapters/${chapterId}`);
}

export async function deleteChapterAction(chapterId: string): Promise<void> {
  await requireAdmin();
  const chapter = await getChapter(chapterId);
  if (!chapter) return;
  await deleteChapter(chapterId);
  revalidatePath(`/admin/books/${chapter.book_id}`);
  redirect(`/admin/books/${chapter.book_id}`);
}

export async function reorderChaptersAction(
  bookId: string,
  orderedIds: string[]
): Promise<void> {
  await requireAdmin();
  await reorderChapters(bookId, orderedIds);
  revalidatePath(`/admin/books/${bookId}`);
}
