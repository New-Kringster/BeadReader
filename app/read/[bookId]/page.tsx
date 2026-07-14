import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
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
  const resume = await resolveResumeChapter(user, bookId, user.id);

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
            {chapters.map((ch, i) => (
              <li key={ch.id}>
                <Link
                  href={`/read/${bookId}/${ch.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-line/40"
                >
                  <span className="text-muted text-sm w-6 text-right tabular-nums">{i + 1}</span>
                  <span className="flex-1" style={{ fontFamily: "var(--font-serif)" }}>
                    {ch.title}
                  </span>
                  {ch.is_explicit && <span className="badge badge-spicy">🌶</span>}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>
    </>
  );
}
