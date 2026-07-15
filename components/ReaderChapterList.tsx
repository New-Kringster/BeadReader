"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { resetChapterReadAction } from "@/app/actions/reading";

interface Row {
  id: string;
  title: string;
  spicy: boolean;
}

export default function ReaderChapterList({
  bookId,
  chapters,
  readIds,
  currentChapterId,
  currentPct,
}: {
  bookId: string;
  chapters: Row[];
  readIds: string[];
  currentChapterId: string | null;
  currentPct: number;
}) {
  const [read, setRead] = useState<Set<string>>(() => new Set(readIds));
  const [, start] = useTransition();

  function reset(chapterId: string) {
    setRead((prev) => {
      const next = new Set(prev);
      next.delete(chapterId);
      return next;
    });
    start(async () => {
      await resetChapterReadAction(bookId, chapterId);
    });
  }

  return (
    <ol className="card divide-y divide-line">
      {chapters.map((ch, i) => {
        const isCurrent = ch.id === currentChapterId;
        const isRead = read.has(ch.id);
        const dimmed = isRead && !isCurrent;
        return (
          <li key={ch.id} className="group flex items-stretch">
            <Link
              href={`/read/${bookId}/${ch.id}`}
              aria-current={isCurrent ? "true" : undefined}
              className={`flex flex-1 items-center gap-3 py-3 pl-4 pr-2 hover:bg-line/40 ${
                dimmed ? "opacity-55" : ""
              } ${isCurrent ? "bg-accent/8" : ""}`}
            >
              <span className="w-6 shrink-0 text-right text-sm text-muted tabular-nums">
                {isRead ? (
                  <span className="text-accent" aria-label="Read" title="Read">
                    ✓
                  </span>
                ) : (
                  i + 1
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate ${isCurrent ? "font-semibold" : ""}`}
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {ch.title}
                </span>
                {isCurrent && (
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(currentPct, 4)}%` }}
                      />
                    </span>
                    <span className="text-xs text-muted tabular-nums">{currentPct}%</span>
                  </span>
                )}
              </span>
              {isCurrent && <span className="badge badge-published shrink-0">Reading</span>}
              {ch.spicy && (
                <span className="badge badge-spicy shrink-0" title="Spicy">
                  🌶
                </span>
              )}
            </Link>
            {/* Subtle, deliberately low-key: clear this chapter's read mark.
                Faint by default, a little clearer on hover/focus. */}
            <span className="flex w-8 shrink-0 items-center justify-center">
              {isRead && (
                <button
                  type="button"
                  onClick={() => reset(ch.id)}
                  title="Mark as unread"
                  aria-label={`Mark "${ch.title}" as unread`}
                  className="rounded px-1 py-0.5 text-xs text-muted opacity-20 transition-opacity hover:!opacity-100 focus:opacity-100 focus:outline-none group-hover:opacity-60"
                >
                  ↺
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
