import type { Book } from "@/lib/types";

/** Server-rendered book form. `action` is a (bound) Server Action. */
export default function BookForm({
  action,
  book,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  book?: Book;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="title" className="label">Title</label>
        <input id="title" name="title" className="field" defaultValue={book?.title ?? ""} required />
      </div>

      <div>
        <label htmlFor="author" className="label">Author</label>
        <input id="author" name="author" className="field" defaultValue={book?.author ?? ""} />
      </div>

      <div>
        <label htmlFor="description" className="label">Description</label>
        <textarea
          id="description"
          name="description"
          className="field"
          rows={4}
          defaultValue={book?.description ?? ""}
        />
      </div>

      <div>
        <label htmlFor="cover" className="label">Cover image {book ? "(leave empty to keep current)" : "(optional)"}</label>
        {book?.cover_url && (
          <div className="mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={book.cover_url} alt="Current cover" className="w-24 h-32 object-cover rounded border border-line" />
          </div>
        )}
        <input id="cover" name="cover" type="file" accept="image/*" className="field" />
      </div>

      <div>
        <label htmlFor="status" className="label">Status</label>
        <select id="status" name="status" className="field" defaultValue={book?.status ?? "draft"}>
          <option value="draft">Draft — hidden from readers</option>
          <option value="published">Published — visible in the library</option>
        </select>
      </div>

      <button type="submit" className="btn btn-primary">{submitLabel}</button>
    </form>
  );
}
