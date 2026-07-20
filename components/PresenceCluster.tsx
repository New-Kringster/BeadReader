"use client";
import { useEffect, useRef, useState } from "react";
import { usePresence } from "@/components/PresenceProvider";
import type { PresenceEntry } from "@/lib/types";

const ONLINE = "#22c55e"; // emerald — reads on light and dark reader backgrounds

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function Avatar({ reader, surface }: { reader: PresenceEntry; surface: string }) {
  const ring = reader.sameBook ? { boxShadow: `0 0 0 2px ${ONLINE}` } : undefined;
  return (
    <span
      className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold"
      style={{ backgroundColor: "color-mix(in oklab, currentColor 16%, transparent)", ...ring }}
      title={
        reader.bookTitle
          ? `${reader.name} — ${reader.bookTitle}${
              reader.chapterNumber ? ` · ch ${reader.chapterNumber}` : ""
            }`
          : `${reader.name} — online`
      }
    >
      {reader.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={reader.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial(reader.name)
      )}
      {reader.sameBook && reader.chapterNumber ? (
        <span
          className="absolute -bottom-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
          style={{ backgroundColor: ONLINE, boxShadow: `0 0 0 2px ${surface}` }}
        >
          {reader.chapterNumber}
        </span>
      ) : (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: ONLINE, boxShadow: `0 0 0 2px ${surface}` }}
        />
      )}
    </span>
  );
}

function ReaderRow({ reader, surface }: { reader: PresenceEntry; surface: string }) {
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const send = async (kind: "bump" | "text") => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: reader.userId,
          kind,
          body: kind === "text" ? text : undefined,
        }),
      });
      if (res.ok) {
        setNote(kind === "bump" ? "Bumped ✓" : "Sent ✓");
        setText("");
        setShowText(false);
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setNote(j.error ?? "Couldn't send.");
      }
    } catch {
      setNote("Couldn't send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded px-2 py-1.5">
      <div className="flex items-center gap-2.5">
        <Avatar reader={reader} surface={surface} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{reader.name}</span>
          <span className="block truncate text-xs opacity-60">
            {reader.bookTitle
              ? `${reader.sameBook ? "Reading here" : reader.bookTitle}${
                  reader.chapterNumber ? ` · ch ${reader.chapterNumber}` : ""
                }`
              : "Browsing"}
          </span>
        </span>
        <button
          type="button"
          className="reader-icon shrink-0"
          title="Bump"
          disabled={busy}
          onClick={() => send("bump")}
        >
          👋
        </button>
        <button
          type="button"
          className="reader-icon shrink-0"
          title="Quick message"
          aria-pressed={showText}
          onClick={() => {
            setShowText((v) => !v);
            setNote(null);
          }}
        >
          💬
        </button>
      </div>

      {showText && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            autoFocus
            value={text}
            maxLength={140}
            placeholder="Say something…"
            className="min-w-0 flex-1 rounded border bg-transparent px-2 py-1 text-sm outline-none"
            style={{ borderColor: "color-mix(in oklab, currentColor 25%, transparent)" }}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim() && !busy) send("text");
            }}
          />
          <button
            type="button"
            className="reader-icon shrink-0"
            title="Send"
            disabled={busy || !text.trim()}
            onClick={() => send("text")}
          >
            ➤
          </button>
        </div>
      )}
      {note && <p className="mt-1 px-0.5 text-xs opacity-70">{note}</p>}
    </li>
  );
}

/**
 * Reader top-bar cluster of readers online right now. A green dot marks online;
 * readers in the *same* book get a green ring and a chapter-number status dot.
 * Tapping opens a popover showing what each person is reading, with a bump and a
 * quick ephemeral text. Renders nothing when nobody else is online.
 *
 * `surface` is the reader's background colour, used to punch the status dots out
 * cleanly against whatever theme the reader has chosen.
 */
export default function PresenceCluster({ surface }: { surface: string }) {
  const online = usePresence();
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
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border p-1.5 text-sm shadow-lg"
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
              <ReaderRow key={r.userId} reader={r} surface={surface} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
