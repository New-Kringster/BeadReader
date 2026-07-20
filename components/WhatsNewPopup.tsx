"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";
import { changelogFor } from "@/lib/changelog";
import ChangelogVisual from "@/components/ChangelogVisual";

const SEEN_KEY = "br_seen_version";

/**
 * Shows the current version's highlights once, the first time a reader loads a
 * new version. "Seen" is remembered in the browser (localStorage) — nothing is
 * stored server-side — so it never nags and doesn't depend on the database.
 */
export default function WhatsNewPopup() {
  const [open, setOpen] = useState(false);
  const entry = changelogFor(APP_VERSION);

  useEffect(() => {
    if (!entry) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(SEEN_KEY);
    } catch {
      /* storage blocked — just don't show */
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only; reading it after mount avoids a hydration mismatch
    if (seen !== APP_VERSION) setOpen(true);
  }, [entry]);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open || !entry) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="What's new"
      onClick={dismiss}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            New in v{entry.version}
          </p>
          <h2 className="text-lg font-bold">{entry.title}</h2>
          {entry.intro && <p className="mt-1 text-sm text-muted">{entry.intro}</p>}
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {entry.items.map((item) => (
            <div key={item.title}>
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
              {item.how && (
                <p className="mt-2 rounded-md bg-accent/10 px-2.5 py-1.5 text-sm text-accent">
                  <span className="font-semibold">How to use:</span> {item.how}
                </p>
              )}
              {(item.image || item.art) && (
                <div className="mt-2.5">
                  <ChangelogVisual item={item} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <Link href="/changelog" className="text-sm text-muted underline hover:text-accent">
            Full changelog
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
