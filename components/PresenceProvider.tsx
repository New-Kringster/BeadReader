"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { PresenceEntry, IncomingNudge } from "@/lib/types";

// One poll for the whole /read area. Matches the ~15s write flush so presence
// (and nudge delivery) feels live. A single poller — rather than one per widget
// — keeps request volume down and, crucially, means nudges (delete-on-deliver)
// are consumed exactly once instead of raced between multiple widgets.
const POLL_MS = 15_000;

interface PresenceCtx {
  online: PresenceEntry[];
  nudges: IncomingNudge[];
  dismissNudge: (id: string) => void;
}

const Context = createContext<PresenceCtx>({
  online: [],
  nudges: [],
  dismissNudge: () => {},
});

/** The current book id from the path, or null on the library / account / stats. */
function bookIdFromPath(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean); // ["read", <bookId?>, <chapterId?>]
  if (seg[0] !== "read") return null;
  const id = seg[1];
  if (!id || id === "account" || id === "stats") return null;
  return id;
}

export default function PresenceProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bookId = bookIdFromPath(pathname);
  const [online, setOnline] = useState<PresenceEntry[]>([]);
  const [nudges, setNudges] = useState<IncomingNudge[]>([]);
  const seen = useRef<Set<string>>(new Set());

  const dismissNudge = useCallback((id: string) => {
    setNudges((list) => list.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const url = bookId
      ? `/api/presence?bookId=${encodeURIComponent(bookId)}`
      : "/api/presence";

    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          online?: PresenceEntry[];
          nudges?: IncomingNudge[];
        };
        if (cancelled) return;
        if (Array.isArray(json.online)) setOnline(json.online);
        if (Array.isArray(json.nudges) && json.nudges.length) {
          const fresh = json.nudges.filter((n) => !seen.current.has(n.id));
          if (fresh.length) {
            fresh.forEach((n) => seen.current.add(n.id));
            setNudges((list) => [...list, ...fresh]);
          }
        }
      } catch {
        /* transient — keep the last known state */
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, bookId]);

  return (
    <Context.Provider value={{ online, nudges, dismissNudge }}>{children}</Context.Provider>
  );
}

/** Readers who are online right now (same-book flagged relative to the route). */
export function usePresence(): PresenceEntry[] {
  return useContext(Context).online;
}

/** Incoming ephemeral nudges + a dismisser, for the toaster. */
export function useNudges(): { nudges: IncomingNudge[]; dismissNudge: (id: string) => void } {
  const { nudges, dismissNudge } = useContext(Context);
  return { nudges, dismissNudge };
}
