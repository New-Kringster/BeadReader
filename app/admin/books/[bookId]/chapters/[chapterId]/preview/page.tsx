import Link from "next/link";
import { notFound } from "next/navigation";
import WebtoonReaderView from "@/components/WebtoonReaderView";
import { requireAdmin } from "@/lib/auth";
import {
  getBook,
  getChapter,
  getProgress,
  listChapterImages,
  listChapters,
  listReadChapterIds,
} from "@/lib/data";
import { getR2PublicUrl, hasR2PublicBaseUrl } from "@/lib/r2";

export default async function AdminWebtoonPreviewPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  const admin = await requireAdmin();
  const { bookId, chapterId } = await params;
  const [book, current, chapters] = await Promise.all([
    getBook(bookId),
    getChapter(chapterId),
    listChapters(bookId),
  ]);

  if (!book || book.format !== "webtoon" || !current || current.book_id !== bookId) {
    notFound();
  }

  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index === -1) notFound();

  if (!hasR2PublicBaseUrl()) {
    return (
      <main className="min-h-screen grid place-items-center bg-black text-white p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Webtoon preview unavailable</h1>
          <p className="text-white/60 mt-2">Add the optional R2 public base URL and redeploy.</p>
          <Link href={`/admin/books/${bookId}`} className="reader-btn mt-5">
            Back to book
          </Link>
        </div>
      </main>
    );
  }

  const [progress, readIds, images] = await Promise.all([
    getProgress(admin.id, bookId),
    listReadChapterIds(admin.id, bookId),
    listChapterImages(current.id),
  ]);
  const previous = index > 0 ? chapters[index - 1] : null;
  const next = index < chapters.length - 1 ? chapters[index + 1] : null;
  const isCurrentProgress = progress?.chapter_id === chapterId;

  return (
    <WebtoonReaderView
      bookId={bookId}
      bookTitle={book.title}
      chapter={{ id: current.id, title: current.title }}
      images={images.map((image) => ({
        id: image.id,
        url: getR2PublicUrl(image.object_key),
        width: image.width,
        height: image.height,
        originalFilename: image.original_filename,
      }))}
      prev={previous ? { id: previous.id, title: previous.title } : null}
      next={next ? { id: next.id, title: next.title } : null}
      index={index + 1}
      total={chapters.length}
      toc={chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        spicy: chapter.is_explicit,
      }))}
      readIds={readIds}
      initialScrollFraction={isCurrentProgress ? Number(progress?.scroll_fraction ?? 0) : 0}
      currentUserId={admin.id}
      isAdmin
      adminPreview
    />
  );
}
