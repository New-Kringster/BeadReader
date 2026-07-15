import Link from "next/link";
import type { BookCommentRow } from "@/lib/data";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function BookComments({
  bookId,
  comments,
}: {
  bookId: string;
  comments: BookCommentRow[];
}) {
  return (
    <section aria-label="Comments" className="mt-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Comments{comments.length ? ` (${comments.length})` : ""}
      </h2>

      {comments.length === 0 ? (
        <p className="text-sm text-muted">No comments on this book yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="card p-3">
              <Link
                href={`/read/${bookId}/${c.chapter_id}`}
                className="inline-flex max-w-full items-center gap-1 rounded bg-accent/10 px-2 py-0.5 text-xs text-accent hover:bg-accent/20"
                title={`Go to “${c.chapter_title}”`}
              >
                <span className="tabular-nums">Ch. {c.chapter_number}</span>
                <span aria-hidden>·</span>
                <span className="min-w-0 truncate">{c.chapter_title}</span>
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{c.author_name}</span>
                {c.author_is_admin && (
                  <span className="rounded bg-line px-1.5 py-0.5 text-xs text-muted">admin</span>
                )}
                <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
