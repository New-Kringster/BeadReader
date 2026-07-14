import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getProgress,
  getPublishedBook,
  listReadableChapters,
  listReadChapterIds,
  resolveResumeChapter,
} from "@/lib/data";
import ReaderNav from "@/components/ReaderNav";
import ReaderChapterList from "@/components/ReaderChapterList";
import Logo from "@/components/Logo";

export default async function BookTocPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const user = (await getCurrentUser())!;
  const book = await getPublishedBook(bookId);
  if (!book) notFound();

  const chapters = await listReadableChapters(bookId, user);
  const [progress, resume, readIds] = await Promise.all([
    getProgress(user.id, bookId),
    resolveResumeChapter(user, bookId, user.id),
    listReadChapterIds(user.id, bookId),
  ]);

  // Read chapters are tracked per-chapter (any chapter the reader has opened),
  // so out-of-order reading is reflected too. The single stored position marks
  // the "current" chapter and how far into it the reader is.
  const currentChapterId = progress?.chapter_id ?? null;
  const currentPct = Math.round(
    Math.min(1, Math.max(0, progress?.scroll_fraction ?? 0)) * 100
  );

  return (
    <>
      <ReaderNav backHref="/read" backLabel="Library" />
      <main className="mx-auto max-w-3xl w-full px-4 py-8 flex-1">
        <div className="flex gap-5 mb-6">
          <div className="w-24 h-36 rounded bg-line shrink-0 overflow-hidden flex items-center justify-center">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Logo size={40} className="opacity-40" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>
              {book.title}
            </h1>
            <p className="text-muted">{book.author || "Unknown author"}</p>
            {book.description && <p className="text-sm mt-2">{book.description}</p>}
            {resume && (
              <Link href={`/read/${bookId}/${resume.chapterId}`} className="btn btn-primary btn-sm mt-3">
                {resume.resuming ? "Continue reading" : "Start reading"}
              </Link>
            )}
          </div>
        </div>

        <h2 className="font-semibold text-sm text-muted uppercase tracking-wide mb-2">Chapters</h2>
        {chapters.length === 0 ? (
          <p className="text-muted text-sm">No chapters available yet.</p>
        ) : (
          <ReaderChapterList
            bookId={bookId}
            chapters={chapters.map((c) => ({
              id: c.id,
              title: c.title,
              is_explicit: c.is_explicit,
            }))}
            readIds={readIds}
            currentChapterId={currentChapterId}
            currentPct={currentPct}
          />
        )}
      </main>
    </>
  );
}
