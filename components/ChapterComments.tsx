"use client";
import { useCallback, useEffect, useState } from "react";

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  author_name: string;
  author_is_admin: boolean;
}

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

export default function ChapterComments({
  chapterId,
  currentUserId,
  isAdmin,
}: {
  chapterId: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?chapterId=${chapterId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments as CommentRow[]);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    }
  }, [chapterId]);

  useEffect(() => {
    setComments(null);
    load();
  }, [load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, body: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((c) => [...(c ?? []), data.comment as CommentRow]);
        setBody("");
      }
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    if (res.ok) setComments((c) => (c ?? []).filter((x) => x.id !== id));
  }

  const count = comments?.length ?? 0;

  return (
    <section aria-label="Comments">
      <h2 className="text-lg font-semibold mb-3" style={{ fontFamily: "var(--font-sans)" }}>
        Comments{comments ? ` (${count})` : ""}
      </h2>

      {comments === null ? (
        <p className="text-sm opacity-60">Loading…</p>
      ) : count === 0 ? (
        <p className="text-sm opacity-60 mb-4">No comments yet. Be the first to say something.</p>
      ) : (
        <ul className="space-y-3 mb-5" style={{ listStyle: "none", paddingLeft: 0 }}>
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-lg p-3"
              style={{
                border: "1px solid color-mix(in oklab, currentColor 15%, transparent)",
                background: "color-mix(in oklab, currentColor 4%, transparent)",
              }}
            >
              <div className="flex items-center gap-2 text-sm mb-1">
                <span className="font-semibold">{c.author_name}</span>
                {c.author_is_admin && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: "color-mix(in oklab, currentColor 15%, transparent)" }}
                  >
                    admin
                  </span>
                )}
                <span className="opacity-50 text-xs">{timeAgo(c.created_at)}</span>
                {(isAdmin || c.user_id === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="ml-auto text-xs opacity-60 hover:opacity-100 underline"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words" style={{ fontFamily: "var(--font-sans)" }}>
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={post} className="space-y-2">
        <textarea
          className="reader-field"
          rows={3}
          placeholder="Add a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
        />
        <div className="flex justify-end">
          <button type="submit" className="reader-btn" disabled={posting || !body.trim()}>
            {posting ? "Posting…" : "Post comment"}
          </button>
        </div>
      </form>
    </section>
  );
}
