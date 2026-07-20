"use client";
import { useEffect, useRef, useState } from "react";
import type { PresenceEntry } from "@/lib/types";

// Poll cadence for reading presence. Matches the ~15s write flush so "who's
// online" feels live without a second, faster channel. At this scale (a handful
// of readers) the request volume is negligible; polling pauses while the tab is
// hidden.
const POLL_MS = 15_000;

/**
 * Live list of readers online right now. Pass the current `bookId` in the reader
 * so same-book readers come back flagged. Polling stops when the tab is hidden
 * and fires once immediately when it becomes visible again.
 */
export function usePresence(
  bookId?: string | null,
  initial: PresenceEntry[] = []
): PresenceEntry[] {
  const [online, setOnline] = useState<PresenceEntry[]>(initial);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const url = bookId ? `/api/presence?bookId=${encodeURIComponent(bookId)}` : "/api/presence";

    const poll = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { online?: PresenceEntry[] };
        if (!cancelled.current && Array.isArray(json.online)) setOnline(json.online);
      } catch {
        /* transient network error — keep the last known list */
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled.current = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [bookId]);

  return online;
}
