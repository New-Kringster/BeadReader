import type { Book } from "@/lib/types";
import CoverField from "@/components/CoverField";

/** Server-rendered book form. `action` is a (bound) Server Action. */
export default function BookForm({
  action,
  book,
  submitLabel,
  webtoonEnabled = false,
}: {
  action: (formData: FormData) => Promise<void>;
  book?: Book;
  submitLabel: string;
  webtoonEnabled?: boolean;
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

      <CoverField currentUrl={book?.cover_url} />

      <div>
        <label htmlFor="format" className="label">Book format</label>
        {book ? (
          <div className="field bg-line/20" aria-label="Book format">
            {book.format === "webtoon" ? "Webtoon — ordered images" : "Text — Markdown chapters"}
          </div>
        ) : (
          <>
            <select id="format" name="format" className="field" defaultValue="text">
              <option value="text">Text — Markdown chapters</option>
              <option value="webtoon" disabled={!webtoonEnabled}>
                Webtoon — ordered images{webtoonEnabled ? "" : " (R2 setup required)"}
              </option>
            </select>
            <p className="text-xs text-muted mt-2">
              This choice is permanent for the book. Text publishing always works; webtoons are
              available when optional Cloudflare R2 storage is configured.
            </p>
          </>
        )}
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
