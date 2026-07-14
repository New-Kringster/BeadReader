import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook, getChapter } from "@/lib/data";
import ChapterEditor from "@/components/ChapterEditor";
import ActionButton from "@/components/ActionButton";
import { updateChapterAction, deleteChapterAction } from "@/app/actions/chapters";

export default async function EditChapterPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  const { bookId, chapterId } = await params;
  const [book, chapter] = await Promise.all([getBook(bookId), getChapter(chapterId)]);
  if (!book || !chapter || chapter.book_id !== bookId) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link href={`/admin/books/${bookId}`} className="text-sm text-muted hover:underline">
          ← {book.title}
        </Link>
        <ActionButton
          action={deleteChapterAction.bind(null, chapterId)}
          className="btn btn-sm btn-danger"
          confirm="Delete this chapter? This can't be undone."
        >
          Delete chapter
        </ActionButton>
      </div>
      <ChapterEditor action={updateChapterAction.bind(null, chapterId)} chapter={chapter} />
    </div>
  );
}
