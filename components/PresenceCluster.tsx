"use client";
import { useEffect, useRef, useState } from "react";
import { usePresence } from "@/components/usePresence";
import type { PresenceEntry } from "@/lib/types";

const ONLINE = "#22c55e"; // emerald — reads on light and dark reader backgrounds

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function Avatar({ reader, surface }: { reader: PresenceEntry; surface: string }) {
  const ring = reader.sameBook ? { boxShadow: `0 0 0 2px ${ONLINE}` } : undefined;
  return (
    <span
      className="relative inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
      style={{ backgroundColor: "color-mix(in oklab, currentColor 16%, transparent)", ...ring }}
      title={
        reader.bookTitle
          ? `${reader.name} — ${reader.bookTitle}${
              reader.chapterNumber ? ` · ch ${reader.chapterNumber}` : ""
            }`
          : `${reader.name} — online`
      }
    >
      {initial(reader.name)}
      {reader.sameBook && reader.chapterNumber ? (
        // Same book as you: chapter-number status dot beside the icon.
        <span
          className="absolute -bottom-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
          style={{ backgroundColor: ONLINE, boxShadow: `0 0 0 2px ${surface}` }}
        >
          {reader.chapterNumber}
        </span>
      ) : (
        // Online, elsewhere: a plain green dot.
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: ONLINE, boxShadow: `0 0 0 2px ${surface}` }}
        />
      )}
    </span>
  );
}

/**
 * Reader top-bar cluster of readers online right now. A green dot marks online;
 * readers in the *same* book get a green ring and a chapter-number status dot.
 * Tapping opens a popover showing what each person is reading. Renders nothing
 * when nobody else is online, so it stays out of the way.
 *
 * `surface` is the reader's background colour, used to punch the status dots out
 * cleanly against whatever theme the reader has chosen.
 */
export default function PresenceCluster({
  bookId,
  surface,
  initial: initialData = [],
}: {
  bookId: string;
  surface: string;
  initial?: PresenceEntry[];
}) {
  const online = usePresence(bookId, initialData);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (online.length === 0) return null;

  const shown = online.slice(0, 3);
  const extra = online.length - shown.length;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className="flex items-center -space-x-2 rounded-full p-0.5"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${online.length} reader${online.length > 1 ? "s" : ""} online`}
        aria-expanded={open}
      >
        {shown.map((r) => (
          <Avatar key={r.userId} reader={r} surface={surface} />
        ))}
        {extra > 0 && (
          <span
            className="relative inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold"
            style={{ backgroundColor: "color-mix(in oklab, currentColor 16%, transparent)" }}
          >
            +{extra}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border p-1.5 text-sm shadow-lg"
          style={{
            backgroundColor: surface,
            borderColor: "color-mix(in oklab, currentColor 18%, transparent)",
          }}
        >
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide opacity-60">
            Online now
          </p>
          <ul>
            {online.map((r) => (
              <li key={r.userId} className="flex items-center gap-2.5 rounded px-2 py-1.5">
                <Avatar reader={r} surface={surface} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-xs opacity-60">
                    {r.bookTitle
                      ? `${r.sameBook ? "Reading here" : r.bookTitle}${
                          r.chapterNumber ? ` · ch ${r.chapterNumber}` : ""
                        }`
                      : "Browsing"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
