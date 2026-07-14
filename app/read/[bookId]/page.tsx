import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getProgress,
  getPublishedBook,
  listReadableChapters,
  resolveResumeChapter,
} from "@/lib/data";
import ReaderNav from "@/components/ReaderNav";
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
  const [progress, resume] = await Promise.all([
    getProgress(user.id, bookId),
    resolveResumeChapter(user, bookId, user.id),
  ]);

  // The reader has a single stored position per book (current chapter + how far
  // into it). Since chapters are ordered by position, everything before the
  // current chapter is "read", the current chapter is in progress, and the rest
  // are unread.
  const currentIndex = progress?.chapter_id
    ? chapters.findIndex((c) => c.id === progress.chapter_id)
    : -1;
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
          <ol className="card divide-y divide-line">
            {chapters.map((ch, i) => {
              const isRead = currentIndex >= 0 && i < currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <li key={ch.id}>
                  <Link
                    href={`/read/${bookId}/${ch.id}`}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-line/40 ${
                      isRead ? "opacity-55" : ""
                    } ${isCurrent ? "bg-accent/8" : ""}`}
                  >
                    <span className="w-6 shrink-0 text-right text-sm text-muted tabular-nums">
                      {isRead ? (
                        <span className="text-accent" aria-label="Read" title="Read">
                          ✓
                        </span>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate ${isCurrent ? "font-semibold" : ""}`}
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {ch.title}
                      </span>
                      {isCurrent && (
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                            <span
                              className="block h-full rounded-full bg-accent"
                              style={{ width: `${Math.max(currentPct, 4)}%` }}
                            />
                          </span>
                          <span className="text-xs text-muted tabular-nums">
                            {currentPct}%
                          </span>
                        </span>
                      )}
                    </span>
                    {isCurrent && (
                      <span className="badge badge-published shrink-0">Reading</span>
                    )}
                    {ch.is_explicit && (
                      <span className="badge badge-spicy shrink-0" title="Spicy">
                        🌶
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </>
  );
}
