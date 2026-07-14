import Link from "next/link";
import { listAllBooks, listChapters } from "@/lib/data";
import Logo from "@/components/Logo";

export default async function AdminDashboard() {
  const books = await listAllBooks();
  const counts = await Promise.all(books.map((b) => listChapters(b.id).then((c) => c.length)));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Books</h1>
        <Link href="/admin/books/new" className="btn btn-primary">
          + New book
        </Link>
      </div>

      {books.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          <p className="mb-4">No books yet.</p>
          <Link href="/admin/books/new" className="btn btn-primary">
            Create your first book
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {books.map((book, i) => (
            <Link
              key={book.id}
              href={`/admin/books/${book.id}`}
              className="card p-4 flex items-center gap-4 min-w-0 hover:border-accent transition-colors"
            >
              <div className="w-12 h-16 rounded bg-line shrink-0 overflow-hidden flex items-center justify-center text-muted">
                {book.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Logo size={26} className="opacity-40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold truncate">{book.title}</span>
                  <span className={`badge badge-${book.status} shrink-0`}>{book.status}</span>
                </div>
                <div className="text-sm text-muted truncate">
                  {book.author || "Unknown author"} · {counts[i]} chapter
                  {counts[i] === 1 ? "" : "s"}
                </div>
              </div>
              <span className="text-muted text-sm shrink-0 hidden sm:inline">Edit →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
