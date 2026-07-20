"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChapterComments from "@/components/ChapterComments";
import NavProgress from "@/components/NavProgress";
import PresenceCluster from "@/components/PresenceCluster";

interface NavChapter {
  id: string;
  title: string;
}

interface WebtoonImage {
  id: string;
  url: string;
  width: number;
  height: number;
  originalFilename: string;
}

const IDLE_MS = 120_000;
const FLUSH_MS = 15_000;

function postJSON(url: string, data: unknown, beacon = false) {
  const body = JSON.stringify(data);
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export default function WebtoonReaderView({
  bookId,
  bookTitle,
  chapter,
  images,
  prev,
  next,
  index,
  total,
  toc,
  readIds,
  initialScrollFraction,
  currentUserId,
  isAdmin,
  adminPreview = false,
}: {
  bookId: string;
  bookTitle: string;
  chapter: { id: string; title: string };
  images: WebtoonImage[];
  prev: NavChapter | null;
  next: NavChapter | null;
  index: number;
  total: number;
  toc: Array<{ id: string; title: string; spicy: boolean }>;
  readIds: string[];
  initialScrollFraction: number;
  currentUserId: string;
  isAdmin: boolean;
  adminPreview?: boolean;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chrome, setChrome] = useState(true);
  const [showToc, setShowToc] = useState(false);
  const [scrollPct, setScrollPct] = useState(() =>
    Math.round(Math.min(1, Math.max(0, initialScrollFraction)) * 100)
  );
  const [isNavigating, startNav] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const readSet = new Set(readIds);
  const bookHref = adminPreview ? `/admin/books/${bookId}` : `/read/${bookId}`;
  const chapterHref = useCallback(
    (chapterId: string) =>
      adminPreview
        ? `/admin/books/${bookId}/chapters/${chapterId}/preview`
        : `/read/${bookId}/${chapterId}`,
    [adminPreview, bookId]
  );

  useEffect(() => {
    postJSON("/api/read", { bookId, chapterId: chapter.id });
  }, [bookId, chapter.id]);

  const activeSecondsRef = useRef(0);
  const lastActiveRef = useRef(0);
  // Reading time + presence in one flush (see ReaderView for the rationale).
  // Always posts so presence stays fresh; `activeOverride` forces an inactive
  // beat on hide so the reader drops offline promptly.
  const flushTime = useCallback(
    (beacon = false, activeOverride?: boolean) => {
      const seconds = activeSecondsRef.current;
      activeSecondsRef.current = 0;
      const active =
        activeOverride ??
        (document.visibilityState === "visible" &&
          document.hasFocus() &&
          Date.now() - lastActiveRef.current < IDLE_MS);
      const el = scrollRef.current;
      const max = el ? el.scrollHeight - el.clientHeight : 0;
      const scrollFraction = el && max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
      postJSON(
        "/api/reading-time",
        { bookId, seconds, chapterId: chapter.id, scrollFraction, active },
        beacon
      );
    },
    [bookId, chapter.id]
  );

  useEffect(() => {
    lastActiveRef.current = Date.now();
    const bump = () => (lastActiveRef.current = Date.now());
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((event) => window.addEventListener(event, bump, { passive: true }));
    const tick = window.setInterval(() => {
      const active =
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        Date.now() - lastActiveRef.current < IDLE_MS;
      if (active) activeSecondsRef.current += 1;
    }, 1000);
    // Beat immediately so the reader shows up online on open / chapter change.
    flushTime(false);
    const flush = window.setInterval(() => flushTime(false), FLUSH_MS);
    const onHide = () => flushTime(true, false);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushTime(true, false);
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      events.forEach((event) => window.removeEventListener(event, bump));
      window.clearInterval(tick);
      window.clearInterval(flush);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flushTime(true);
    };
  }, [flushTime]);

  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveProgress = useCallback(
    (fraction: number, beacon = false) => {
      const send = () =>
        postJSON(
          "/api/progress",
          { bookId, chapterId: chapter.id, scrollFraction: fraction, page: 1 },
          beacon
        );
      if (beacon) return send();
      if (progressTimer.current) clearTimeout(progressTimer.current);
      progressTimer.current = setTimeout(send, 600);
    },
    [bookId, chapter.id]
  );

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const restore = requestAnimationFrame(() => {
      const maximum = element.scrollHeight - element.clientHeight;
      element.scrollTop = Math.max(0, initialScrollFraction * maximum);
    });
    const onScroll = () => {
      const maximum = element.scrollHeight - element.clientHeight;
      const fraction = maximum > 0 ? element.scrollTop / maximum : 0;
      setScrollPct(Math.round(Math.min(1, Math.max(0, fraction)) * 100));
      saveProgress(fraction);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(restore);
      element.removeEventListener("scroll", onScroll);
    };
  }, [initialScrollFraction, saveProgress]);

  // Persist scroll position + reading time before leaving the chapter.
  const flushBeforeLeave = useCallback(() => {
    const element = scrollRef.current;
    if (element) {
      const maximum = element.scrollHeight - element.clientHeight;
      saveProgress(maximum > 0 ? element.scrollTop / maximum : 0, true);
    }
    flushTime(true);
  }, [flushTime, saveProgress]);

  const goTo = useCallback(
    (id: string | null) => {
      if (!id) return;
      flushBeforeLeave();
      setPendingId(id);
      startNav(() => router.push(chapterHref(id)));
    },
    [chapterHref, flushBeforeLeave, router]
  );

  // Back to contents through the same transition so the loading bar shows (a
  // plain <Link> bypasses it and makes back-navigation feel hung).
  const goBack = useCallback(() => {
    flushBeforeLeave();
    startNav(() => router.push(bookHref));
  }, [bookHref, flushBeforeLeave, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (showToc) return;
      if (event.key === "ArrowRight") goTo(next?.id ?? null);
      if (event.key === "ArrowLeft") goTo(prev?.id ?? null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, next, prev, showToc]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <NavProgress active={isNavigating} />
      <header className={`h-12 shrink-0 border-b border-white/20 bg-black flex items-center gap-3 px-4 text-sm transition-opacity ${chrome ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <Link
          href={bookHref}
          className="hover:underline min-w-0 truncate"
          onClick={(e) => {
            e.preventDefault();
            goBack();
          }}
        >
          ← {bookTitle}
        </Link>
        <span className="opacity-60 truncate hidden sm:inline">/ {chapter.title}</span>
        <div className="ml-auto flex items-center gap-2">
          {!isAdmin && !adminPreview && <PresenceCluster bookId={bookId} surface="#000000" />}
          <button className="reader-icon" onClick={() => setShowToc(true)} title="Contents">☰</button>
        </div>
      </header>

      <main className="relative flex-1 min-h-0">
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-white/15 pointer-events-none" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={scrollPct}>
          <div className="h-full bg-white/70 transition-[width] duration-200" style={{ width: `${scrollPct}%` }} />
        </div>
        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto" onClick={() => setChrome((value) => !value)}>
          <article className="mx-auto w-full max-w-[1080px] bg-black">
            <h1 className="sr-only">{chapter.title}</h1>
            {images.length === 0 ? (
              <div className="min-h-[50vh] grid place-items-center p-8 text-center text-white/65">This chapter has no artwork yet.</div>
            ) : (
              images.map((image, imageIndex) => (
                // Width and height reserve the correct aspect ratio before the file loads,
                // which keeps fractional resume stable without a remote-image allowlist.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={image.id}
                  src={image.url}
                  width={image.width}
                  height={image.height}
                  alt={`${chapter.title}, image ${imageIndex + 1}`}
                  loading={imageIndex < 2 ? "eager" : "lazy"}
                  className="block w-full h-auto m-0"
                />
              ))
            )}

            <div className="px-4 py-10 text-center border-t border-white/20" onClick={(event) => event.stopPropagation()}>
              {next ? (
                <button className="reader-btn" disabled={isNavigating} onClick={() => goTo(next.id)}>
                  {isNavigating && pendingId === next.id ? <><span className="spinner" /> Loading…</> : <>Next: {next.title} →</>}
                </button>
              ) : (
                <p className="text-white/60 text-sm">You&apos;ve reached the end of this book.</p>
              )}
            </div>

            <div className="m-4 p-5 rounded-xl bg-panel text-ink" onClick={(event) => event.stopPropagation()}>
              <ChapterComments chapterId={chapter.id} currentUserId={currentUserId} isAdmin={isAdmin} />
            </div>
          </article>
        </div>
      </main>

      <footer className={`h-12 shrink-0 border-t border-white/20 bg-black flex items-center gap-3 px-4 text-sm transition-opacity ${chrome ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button className="reader-btn" disabled={!prev || isNavigating} onClick={() => goTo(prev?.id ?? null)}>
          {isNavigating && pendingId === prev?.id ? <span className="spinner" aria-label="Loading" /> : "← Prev"}
        </button>
        <div className="mx-auto text-center text-white/70">Chapter {index} of {total} <span className="tabular-nums">· {scrollPct}%</span></div>
        <button className="reader-btn" disabled={!next || isNavigating} onClick={() => goTo(next?.id ?? null)}>
          {isNavigating && pendingId === next?.id ? <span className="spinner" aria-label="Loading" /> : "Next →"}
        </button>
      </footer>

      {showToc && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowToc(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-80 max-w-[85vw] h-full bg-panel text-ink border-l border-line p-5 overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Contents</h2>
              <button className="btn btn-sm" onClick={() => setShowToc(false)}>Close</button>
            </div>
            <ol className="space-y-1">
              {toc.map((item, itemIndex) => {
                const current = item.id === chapter.id;
                const read = readSet.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      className={`w-full text-left px-2 py-2 rounded hover:bg-line/60 flex gap-2 ${current ? "font-semibold" : ""} ${read && !current ? "opacity-55" : ""}`}
                      disabled={isNavigating}
                      aria-current={current ? "true" : undefined}
                      onClick={() => current ? setShowToc(false) : goTo(item.id)}
                    >
                      <span className="w-6 shrink-0 text-right text-muted">
                        {isNavigating && pendingId === item.id ? <span className="spinner" /> : read && !current ? "✓" : itemIndex + 1}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{item.title}</span>
                      {item.spicy && <span>🌶</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
