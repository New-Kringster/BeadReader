import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/data";
import ChapterEditor from "@/components/ChapterEditor";
import WebtoonChapterSetup from "@/components/WebtoonChapterSetup";
import { createChapterAction } from "@/app/actions/chapters";

export default async function NewChapterPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getBook(bookId);
  if (!book) notFound();

  return (
    <div>
      <Link href={`/admin/books/${bookId}`} className="text-sm text-muted hover:underline">
        ← {book.title}
      </Link>
      <h1 className="text-2xl font-bold my-4">New chapter</h1>
      {book.format === "webtoon" ? (
        <WebtoonChapterSetup action={createChapterAction.bind(null, bookId)} />
      ) : (
        <ChapterEditor action={createChapterAction.bind(null, bookId)} />
      )}
    </div>
  );
}
