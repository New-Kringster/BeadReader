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
  getBook,
  listChapterImages,
} from "@/lib/data";
import { deleteR2Objects } from "@/lib/r2";
import type { PublishStatus } from "@/lib/types";

function readChapterFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim() || "Untitled chapter",
    content: String(formData.get("content") ?? ""),
    recap: String(formData.get("recap") ?? ""),
    is_explicit: formData.get("is_explicit") === "on" || formData.get("is_explicit") === "true",
    status: (formData.get("status") === "published" ? "published" : "draft") as PublishStatus,
  };
}

export async function createChapterAction(bookId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const book = await getBook(bookId);
  if (!book) redirect("/admin");
  const fields = readChapterFields(formData);
  if (book.format === "webtoon") {
    fields.content = "";
    fields.status = "draft";
  }
  const chapter = await createChapter(bookId, fields);
  revalidatePath(`/admin/books/${bookId}`);
  redirect(`/admin/books/${bookId}/chapters/${chapter.id}`);
}

export async function updateChapterAction(chapterId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const chapter = await getChapter(chapterId);
  if (!chapter) redirect("/admin");
  const book = await getBook(chapter.book_id);
  if (!book) redirect("/admin");
  const fields = readChapterFields(formData);
  if (book.format === "webtoon") {
    fields.content = "";
    if (fields.status === "published" && (await listChapterImages(chapterId)).length === 0) {
      throw new Error("Upload at least one image before publishing this webtoon chapter.");
    }
  }
  await updateChapter(chapterId, fields);
  revalidatePath(`/admin/books/${chapter.book_id}`);
  revalidatePath(`/admin/books/${chapter.book_id}/chapters/${chapterId}`);
}

export async function deleteChapterAction(chapterId: string): Promise<void> {
  await requireAdmin();
  const chapter = await getChapter(chapterId);
  if (!chapter) return;
  const images = await listChapterImages(chapterId);
  await deleteR2Objects(images.map((image) => image.object_key));
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
