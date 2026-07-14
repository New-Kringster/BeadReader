import Link from "next/link";
import BookForm from "@/components/BookForm";
import { createBookAction } from "@/app/actions/books";

export default function NewBookPage() {
  return (
    <div className="max-w-xl">
      <Link href="/admin" className="text-sm text-muted hover:underline">← Books</Link>
      <h1 className="text-2xl font-bold my-4">New book</h1>
      <div className="card p-6">
        <BookForm action={createBookAction} submitLabel="Create book" />
      </div>
    </div>
  );
}
