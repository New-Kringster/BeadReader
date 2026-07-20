import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  listPublishedBooks,
  resolveResumeChapter,
  getReadingTime,
} from "@/lib/data";
import { formatDuration } from "@/lib/format";
import ReaderNav from "@/components/ReaderNav";
import OnlineNowStrip from "@/components/OnlineNowStrip";
import VersionFooter from "@/components/VersionFooter";
import WhatsNewPopup from "@/components/WhatsNewPopup";
import Logo from "@/components/Logo";

export default async function LibraryPage() {
  const user = (await getCurrentUser())!;
  const books = await listPublishedBooks();

  const enriched = await Promise.all(
    books.map(async (b) => {
      const [resume, seconds] = await Promise.all([
        resolveResumeChapter(user, b.id, user.id),
        getReadingTime(user.id, b.id),
      ]);
      return { book: b, resume, seconds };
    })
  );

  // Hide books that have no chapters this reader is allowed to see.
  const visible = enriched.filter((e) => e.resume !== null);

  return (
    <>
      <ReaderNav />
      <main className="mx-auto max-w-3xl w-full px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-serif)" }}>
          Your library
        </h1>

        {user.role === "reader" && <OnlineNowStrip />}

        {visible.length === 0 ? (
          <div className="card p-10 text-center text-muted">
            <Logo size={48} className="mx-auto mb-3 opacity-60" />
            <p>Nothing to read yet. Check back once the library owner publishes a book.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map(({ book, resume, seconds }) => (
              <Link
                key={book.id}
                href={`/read/${book.id}/${resume!.chapterId}`}
                className="card p-4 flex gap-4 min-w-0 hover:border-accent active:scale-[0.99] active:border-accent transition-[transform,border-color] duration-100"
              >
                <div className="w-16 h-24 rounded bg-line shrink-0 overflow-hidden flex items-center justify-center">
                  {book.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Logo size={30} className="opacity-40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
                    {book.title}
                  </div>
                  <div className="text-sm text-muted">{book.author || "Unknown author"}</div>
                  {book.description && (
                    <p className="text-sm text-muted mt-1 line-clamp-2">{book.description}</p>
                  )}
                  <div className="text-xs mt-2 font-medium text-accent">
                    {resume!.resuming ? "Continue reading →" : "Start reading →"}
                    {seconds > 0 && (
                      <span className="text-muted font-normal"> · {formatDuration(seconds)} read</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <VersionFooter className="mt-10" />
      </main>
      <WhatsNewPopup />
    </>
  );
}
