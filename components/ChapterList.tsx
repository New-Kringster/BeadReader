"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Chapter } from "@/lib/types";
import { reorderChaptersAction, deleteChapterAction } from "@/app/actions/chapters";

type Row = Pick<Chapter, "id" | "title" | "status" | "is_explicit">;

export default function ChapterList({ bookId, chapters }: { bookId: string; chapters: Row[] }) {
  const [rows, setRows] = useState<Row[]>(chapters);
  const [pending, start] = useTransition();

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = rows.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    start(async () => {
      await reorderChaptersAction(
        bookId,
        next.map((r) => r.id)
      );
    });
  }

  function remove(id: string) {
    if (!window.confirm("Delete this chapter? This can't be undone.")) return;
    setRows((r) => r.filter((x) => x.id !== id));
    start(async () => {
      await deleteChapterAction(id);
    });
  }

  if (rows.length === 0) {
    return <p className="text-muted text-sm py-4">No chapters yet. Add the first one.</p>;
  }

  return (
    <ol className={`divide-y divide-line ${pending ? "opacity-70" : ""}`}>
      {rows.map((ch, i) => (
        <li
          key={ch.id}
          className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
          <span className="text-muted text-sm w-6 text-right tabular-nums shrink-0">{i + 1}</span>
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              type="button"
              className="btn btn-sm !px-1.5 !py-0.5 leading-none"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              className="btn btn-sm !px-1.5 !py-0.5 leading-none"
              onClick={() => move(i, 1)}
              disabled={i === rows.length - 1}
              aria-label="Move down"
            >
              ▼
            </button>
          </div>
          <Link
            href={`/admin/books/${bookId}/chapters/${ch.id}`}
            className="min-w-0 truncate hover:underline"
          >
            {ch.title}
          </Link>
          </div>
          <div className="flex items-center gap-2 flex-wrap pl-9 sm:pl-0 sm:ml-auto">
            <span className={`badge badge-${ch.status}`}>{ch.status}</span>
            {ch.is_explicit && <span className="badge badge-spicy">🌶 spicy</span>}
            <Link href={`/admin/books/${bookId}/chapters/${ch.id}`} className="btn btn-sm">
              Edit
            </Link>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(ch.id)}>
              Delete
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
