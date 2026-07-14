"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { unmarkChapterRead } from "@/lib/data";

/** Reader-initiated: clear a chapter's "read" mark for the current reader. */
export async function resetChapterReadAction(bookId: string, chapterId: string): Promise<void> {
  const user = await requireUser();
  await unmarkChapterRead(user.id, chapterId);
  revalidatePath(`/read/${bookId}`);
}
