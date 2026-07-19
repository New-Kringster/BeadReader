import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook, listChapters } from "@/lib/data";
import BookForm from "@/components/BookForm";
import ChapterList from "@/components/ChapterList";
import ActionButton from "@/components/ActionButton";
import { updateBookAction, deleteBookAction, removeCoverAction } from "@/app/actions/books";

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getBook(bookId);
  if (!book) notFound();

  const chapters = await listChapters(bookId);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:underline">← Books</Link>
        <h1 className="text-2xl font-bold mt-2">{book.title}</h1>
        <p className="text-sm text-muted mt-1">
          {book.format === "webtoon" ? "Webtoon book" : "Text book"}
        </p>
      </div>

      {/* Chapters */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Chapters</h2>
          <Link href={`/admin/books/${bookId}/chapters/new`} className="btn btn-primary btn-sm">
            + Add chapter
          </Link>
        </div>
        <p className="text-xs text-muted mb-2">Use ▲ ▼ to reorder. Order is saved automatically.</p>
        <ChapterList
          bookId={bookId}
          chapters={chapters.map((c) => ({
            id: c.id,
            title: c.title,
            status: c.status,
            is_explicit: c.is_explicit,
          }))}
        />
      </section>

      {/* Book details */}
      <section className="card p-6">
        <h2 className="font-semibold text-lg mb-4">Book details</h2>
        <BookForm action={updateBookAction.bind(null, bookId)} book={book} submitLabel="Save changes" />
        {book.cover_url && (
          <div className="mt-3">
            <ActionButton
              action={removeCoverAction.bind(null, bookId)}
              className="btn btn-sm btn-danger"
              confirm="Remove the cover image?"
            >
              Remove cover
            </ActionButton>
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="card p-6 border-line">
        <h2 className="font-semibold text-lg mb-1">Delete book</h2>
        <p className="text-sm text-muted mb-3">
          Permanently deletes the book, all its chapters, and readers&apos; progress for it.
        </p>
        <ActionButton
          action={deleteBookAction.bind(null, bookId)}
          className="btn btn-danger"
          confirm={`Delete "${book.title}" and all its chapters? This can't be undone.`}
        >
          Delete this book
        </ActionButton>
      </section>
    </div>
  );
}
