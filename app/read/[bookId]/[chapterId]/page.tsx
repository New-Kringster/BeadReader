import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getPublishedBook,
  listReadableChapters,
  getSettings,
  getProgress,
  listReadChapterIds,
  listChapterImages,
} from "@/lib/data";
import ReaderView from "@/components/ReaderView";
import WebtoonReaderView from "@/components/WebtoonReaderView";
import { getR2PublicUrl, hasR2PublicBaseUrl } from "@/lib/r2";

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  const { bookId, chapterId } = await params;
  const user = (await getCurrentUser())!;

  const book = await getPublishedBook(bookId);
  if (!book) notFound();

  // The gate: this list already excludes drafts and (for readers without access)
  // gated chapters. If the requested chapter isn't in it, it 404s — a reader
  // can't reach gated content even by guessing the URL.
  const chapters = await listReadableChapters(bookId, user);
  const index = chapters.findIndex((c) => c.id === chapterId);
  if (index === -1) notFound();

  const current = chapters[index];
  const prev = index > 0 ? chapters[index - 1] : null;
  const next = index < chapters.length - 1 ? chapters[index + 1] : null;

  const [settings, progress, readIds, images] = await Promise.all([
    getSettings(user.id),
    getProgress(user.id, bookId),
    listReadChapterIds(user.id, bookId),
    book.format === "webtoon" ? listChapterImages(current.id) : Promise.resolve([]),
  ]);

  const isThisChapter = progress?.chapter_id === chapterId;

  if (book.format === "webtoon") {
    if (!hasR2PublicBaseUrl()) {
      return (
        <main className="min-h-screen grid place-items-center bg-black text-white p-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">Artwork temporarily unavailable</h1>
            <p className="text-white/60 mt-2">The owner needs to reconnect this book&apos;s image storage.</p>
            <Link href={`/read/${bookId}`} className="reader-btn mt-5">Back to contents</Link>
          </div>
        </main>
      );
    }
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
        prev={prev ? { id: prev.id, title: prev.title } : null}
        next={next ? { id: next.id, title: next.title } : null}
        index={index + 1}
        total={chapters.length}
        toc={chapters.map((chapterItem) => ({ id: chapterItem.id, title: chapterItem.title, spicy: chapterItem.has_spicy }))}
        readIds={readIds}
        initialScrollFraction={isThisChapter ? Number(progress?.scroll_fraction ?? 0) : 0}
        currentUserId={user.id}
        isAdmin={user.role === "admin"}
      />
    );
  }

  return (
    <ReaderView
      bookId={bookId}
      bookTitle={book.title}
      chapter={{ id: current.id, title: current.title, content: current.content }}
      prev={prev ? { id: prev.id, title: prev.title } : null}
      next={next ? { id: next.id, title: next.title } : null}
      index={index + 1}
      total={chapters.length}
      toc={chapters.map((c) => ({ id: c.id, title: c.title, spicy: c.has_spicy }))}
      readIds={readIds}
      initialSettings={{
        bg_color: settings.bg_color,
        text_color: settings.text_color,
        font_size: settings.font_size,
        layout: settings.layout,
      }}
      initialScrollFraction={isThisChapter ? Number(progress?.scroll_fraction ?? 0) : 0}
      initialPage={isThisChapter ? progress?.page ?? 1 : 1}
      currentUserId={user.id}
      isAdmin={user.role === "admin"}
    />
  );
}
