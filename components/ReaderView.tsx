"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownView from "@/components/MarkdownView";
import ChapterComments from "@/components/ChapterComments";
import NavProgress from "@/components/NavProgress";
import PresenceCluster from "@/components/PresenceCluster";
import type { Layout } from "@/lib/types";

interface NavChapter {
  id: string;
  title: string;
}
interface Settings {
  bg_color: string;
  text_color: string;
  font_size: number;
  layout: Layout;
}

const BG_PRESETS = [
  { name: "Paper", bg: "#faf8f4", text: "#1a1a1a" },
  { name: "White", bg: "#ffffff", text: "#111111" },
  { name: "Sepia", bg: "#f4ecd8", text: "#4b3a24" },
  { name: "Dark", bg: "#17171a", text: "#d7d5cf" },
  { name: "Black", bg: "#000000", text: "#c8c8c8" },
];

const IDLE_MS = 120_000; // 2 min without any interaction => reader is idle, stop counting
const FLUSH_MS = 15_000; // push accumulated reading time this often
const PAGE_GAP = 48; // px gap between "pages" in paginated mode (also prevents column bleed)

function postJSON(url: string, data: unknown, beacon = false) {
  const body = JSON.stringify(data);
  if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
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

export default function ReaderView({
  bookId,
  bookTitle,
  chapter,
  prev,
  next,
  index,
  total,
  toc,
  readIds,
  initialSettings,
  initialScrollFraction,
  initialPage,
  currentUserId,
  isAdmin,
}: {
  bookId: string;
  bookTitle: string;
  chapter: { id: string; title: string; content: string; recap: string };
  prev: NavChapter | null;
  next: NavChapter | null;
  index: number;
  total: number;
  toc: { id: string; title: string; spicy: boolean }[];
  readIds: string[];
  initialSettings: Settings;
  initialScrollFraction: number;
  initialPage: number;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [chrome, setChrome] = useState(true); // show top/bottom bars

  // Chapter navigation is a server round-trip; useTransition gives us a pending
  // flag (for the top loading bar) and pendingId marks which control was clicked
  // (for a localized spinner), so a tap feels acknowledged immediately.
  const [isNavigating, startNav] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Live reading progress through the current chapter (0-100), shown as a thin
  // bar and a percentage. In scroll mode it tracks scroll position; in page mode
  // it's derived from the current page.
  const [scrollPct, setScrollPct] = useState(() =>
    Math.round(Math.min(1, Math.max(0, initialScrollFraction)) * 100)
  );

  const readSet = new Set(readIds);

  // Page mode
  const [page, setPage] = useState(initialPage);
  const [pageCount, setPageCount] = useState(1);
  const [colWidth, setColWidth] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);

  // Mark this chapter as read once the reader actually lands on it. Done from
  // the client (not the server page) so Next.js prefetching a chapter link
  // doesn't mark it read before the reader opens it.
  useEffect(() => {
    postJSON("/api/read", { bookId, chapterId: chapter.id });
  }, [bookId, chapter.id]);

  // Warm the client cache for the neighbouring chapters so moving on is instant
  // and doesn't refetch.
  useEffect(() => {
    if (next) router.prefetch(`/read/${bookId}/${next.id}`);
    if (prev) router.prefetch(`/read/${bookId}/${prev.id}`);
  }, [bookId, next, prev, router]);

  // ---- reading-time tracking (active seconds) ----
  const activeSecondsRef = useRef(0);
  const lastActiveRef = useRef(0); // stamped to now() when the ticker effect mounts

  // Flush accumulated reading time AND a presence beat in one request — presence
  // rides this same ~15s cadence rather than a second heartbeat. Always posts
  // (even with 0 seconds) so presence stays fresh; addReadingTime ignores a
  // 0-second beat while upsertPresence treats it as a heartbeat. `activeOverride`
  // lets the hide handlers force an inactive beat so the reader drops offline.
  const flushTime = useCallback(
    (beacon = false, activeOverride?: boolean) => {
      const secs = activeSecondsRef.current;
      activeSecondsRef.current = 0;
      const active =
        activeOverride ??
        (document.visibilityState === "visible" &&
          document.hasFocus() &&
          Date.now() - lastActiveRef.current < IDLE_MS);
      const el = scrollRef.current;
      const max = el ? el.scrollHeight - el.clientHeight : 0;
      const scrollFraction = el && max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
      const now = new Date();
      const localDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
      postJSON(
        "/api/reading-time",
        {
          bookId,
          seconds: secs,
          chapterId: chapter.id,
          scrollFraction,
          active,
          hourOfDay: now.getHours(),
          localDay,
        },
        beacon
      );
    },
    [bookId, chapter.id]
  );

  useEffect(() => {
    lastActiveRef.current = Date.now();
    const bump = () => (lastActiveRef.current = Date.now());
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const tick = setInterval(() => {
      const active =
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        Date.now() - lastActiveRef.current < IDLE_MS;
      if (active) activeSecondsRef.current += 1;
    }, 1000);

    // Beat immediately so the reader shows up online on open (and on each
    // chapter change, since flushTime changes with chapter.id).
    flushTime(false);
    const flush = setInterval(() => flushTime(false), FLUSH_MS);

    // Force an inactive beat on hide so the reader drops offline promptly.
    const onHide = () => flushTime(true, false);
    const onVis = () => {
      if (document.visibilityState === "hidden") flushTime(true, false);
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(tick);
      clearInterval(flush);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      flushTime(true);
    };
  }, [flushTime]);

  // ---- persist settings (debounced) ----
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prevS) => {
      const nextS = { ...prevS, ...patch };
      if (settingsTimer.current) clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(() => postJSON("/api/settings", nextS), 400);
      return nextS;
    });
  }, []);

  // ---- persist progress (debounced) ----
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveProgress = useCallback(
    (scrollFraction: number, pageNum: number, beacon = false) => {
      const send = () =>
        postJSON(
          "/api/progress",
          { bookId, chapterId: chapter.id, scrollFraction, page: pageNum },
          beacon
        );
      if (beacon) return send();
      if (progressTimer.current) clearTimeout(progressTimer.current);
      progressTimer.current = setTimeout(send, 600);
    },
    [bookId, chapter.id]
  );

  // ---- SCROLL MODE: restore + track ----
  useEffect(() => {
    if (settings.layout !== "scroll") return;
    const el = scrollRef.current;
    if (!el) return;

    // Restore saved position for this chapter after content lays out.
    const restore = requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = Math.max(0, initialScrollFraction * max);
    });

    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const frac = max > 0 ? el.scrollTop / max : 0;
      setScrollPct(Math.round(Math.min(1, Math.max(0, frac)) * 100));
      saveProgress(frac, 1);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(restore);
      el.removeEventListener("scroll", onScroll);
    };
    // Re-run when switching into scroll mode or font size changes layout height.
  }, [settings.layout, settings.font_size, initialScrollFraction, saveProgress]);

  // ---- PAGE MODE: measure + paginate ----
  // The column width is the wrapper's content width; each page shows exactly one
  // column and we translate by that width. We set the width first, then measure
  // scrollWidth on the next frame (once the browser has re-laid-out the columns).
  const recomputePages = useCallback(() => {
    const cols = colsRef.current;
    if (!cols) return;
    const w = cols.clientWidth;
    if (w <= 0) return;
    setColWidth(w);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = colsRef.current;
        if (!el) return;
        // scrollWidth = n*w + (n-1)*gap  =>  n = (scrollWidth + gap) / (w + gap)
        const count = Math.max(1, Math.round((el.scrollWidth + PAGE_GAP) / (w + PAGE_GAP)));
        setPageCount(count);
        setPage((p) => Math.min(Math.max(1, p), count));
      });
    });
  }, []);

  useEffect(() => {
    if (settings.layout !== "page") return;
    const raf = requestAnimationFrame(recomputePages);
    const ro = new ResizeObserver(recomputePages);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", recomputePages);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", recomputePages);
    };
  }, [settings.layout, settings.font_size, chapter.content, recomputePages]);

  // Save page changes.
  useEffect(() => {
    if (settings.layout === "page") saveProgress(0, page);
  }, [page, settings.layout, saveProgress]);

  // Progress shown in the bar/label: derived from the page in page mode, or the
  // tracked scroll position in scroll mode.
  const progressPct =
    settings.layout === "page"
      ? pageCount <= 1
        ? 100
        : Math.min(100, Math.max(0, Math.round(((page - 1) / (pageCount - 1)) * 100)))
      : scrollPct;

  // ---- chapter navigation ----
  // Persist position + reading time before we leave the chapter so nothing is lost.
  const flushBeforeLeave = useCallback(() => {
    const el = scrollRef.current;
    if (settings.layout === "scroll" && el) {
      const max = el.scrollHeight - el.clientHeight;
      saveProgress(max > 0 ? el.scrollTop / max : 0, 1, true);
    } else {
      saveProgress(0, page, true);
    }
    flushTime(true);
  }, [page, saveProgress, flushTime, settings.layout]);

  const goTo = useCallback(
    (id: string | null) => {
      if (!id) return;
      flushBeforeLeave();
      // Mark the target as pending and run the navigation inside a transition so
      // isNavigating drives the loading bar until the new chapter commits.
      setPendingId(id);
      startNav(() => router.push(`/read/${bookId}/${id}`));
    },
    [bookId, router, flushBeforeLeave]
  );

  // Back to the book's contents. Routed through the same transition as chapter
  // nav so the reader's loading bar shows — a plain <Link> here bypasses it (the
  // global bar steps aside on reader pages), making back-navigation feel hung.
  const goBack = useCallback(() => {
    flushBeforeLeave();
    startNav(() => router.push(`/read/${bookId}`));
  }, [bookId, router, flushBeforeLeave]);

  const nextPage = useCallback(() => {
    setPage((p) => {
      if (p >= pageCount) {
        goTo(next?.id ?? null);
        return p;
      }
      return p + 1;
    });
  }, [pageCount, next, goTo]);

  const prevPage = useCallback(() => {
    setPage((p) => {
      if (p <= 1) {
        goTo(prev?.id ?? null);
        return p;
      }
      return p - 1;
    });
  }, [prev, goTo]);

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSettings || showToc) return;
      if (settings.layout === "page") {
        if (e.key === "ArrowRight") nextPage();
        else if (e.key === "ArrowLeft") prevPage();
      } else {
        if (e.key === "ArrowRight") goTo(next?.id ?? null);
        else if (e.key === "ArrowLeft") goTo(prev?.id ?? null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings.layout, nextPage, prevPage, goTo, next, prev, showSettings, showToc]);

  const barStyle: React.CSSProperties = {
    backgroundColor: settings.bg_color,
    color: settings.text_color,
    borderColor: "color-mix(in oklab, currentColor 18%, transparent)",
  };

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={
        {
          backgroundColor: settings.bg_color,
          color: settings.text_color,
          // Lets the spicy-reveal teaser fade out to the reader's own background.
          "--reader-bg": settings.bg_color,
        } as React.CSSProperties
      }
    >
      <NavProgress active={isNavigating} />

      {/* Top bar */}
      <div
        className={`flex items-center gap-3 px-4 h-12 border-b text-sm shrink-0 transition-opacity ${
          chrome ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={barStyle}
      >
        <Link
          href={`/read/${bookId}`}
          className="hover:underline min-w-0 truncate shrink"
          title="Back to contents"
          onClick={(e) => {
            e.preventDefault();
            goBack();
          }}
        >
          ← {bookTitle}
        </Link>
        <span className="opacity-60 truncate hidden sm:inline">/ {chapter.title}</span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {!isAdmin && <PresenceCluster surface={settings.bg_color} />}
          <button className="reader-icon" onClick={() => setShowToc(true)} title="Contents">
            ☰
          </button>
          {settings.layout === "page" && (
            <button className="reader-icon" onClick={() => setShowComments(true)} title="Comments">
              💬
            </button>
          )}
          <button className="reader-icon" onClick={() => setShowSettings(true)} title="Display settings">
            Aa
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0" onClick={() => setChrome((c) => !c)}>
        {/* Thin live-progress bar — always visible, even with chrome hidden */}
        <div
          className="absolute inset-x-0 top-0 z-10 h-0.5 pointer-events-none"
          style={{ backgroundColor: "color-mix(in oklab, currentColor 12%, transparent)" }}
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        >
          <div
            className="h-full transition-[width] duration-200"
            style={{
              width: `${progressPct}%`,
              backgroundColor: "color-mix(in oklab, currentColor 55%, transparent)",
            }}
          />
        </div>

        {settings.layout === "scroll" ? (
          <div ref={scrollRef} className="absolute inset-0 overflow-y-auto">
            <article
              className="reader-content mx-auto px-6 py-10"
              style={{
                maxWidth: "42rem",
                fontFamily: "var(--font-serif)",
                fontSize: `${settings.font_size}px`,
              }}
            >
              <h1 style={{ marginTop: 0 }}>{chapter.title}</h1>
              <MarkdownView source={chapter.content} />
              <RecapPanel recap={chapter.recap} onClick={(e) => e.stopPropagation()} />
              <div className="mt-12 pt-6 border-t" style={{ borderColor: "color-mix(in oklab, currentColor 18%, transparent)" }}>
                {next ? (
                  <button
                    className="btn max-w-full text-left"
                    style={{ ...barStyle, whiteSpace: "normal", height: "auto" }}
                    disabled={isNavigating}
                    onClick={(e) => {
                      e.stopPropagation();
                      goTo(next.id);
                    }}
                  >
                    {isNavigating && pendingId === next.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="spinner" aria-label="Loading" /> Loading…
                      </span>
                    ) : (
                      <>Next: {next.title} →</>
                    )}
                  </button>
                ) : (
                  <p className="opacity-60 text-sm">You&apos;ve reached the end of this book.</p>
                )}
              </div>

              <div
                className="mt-10 pt-8 border-t"
                style={{ borderColor: "color-mix(in oklab, currentColor 18%, transparent)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <ChapterComments
                  chapterId={chapter.id}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              </div>
            </article>
          </div>
        ) : (
          <div ref={viewportRef} className="absolute inset-0 overflow-hidden py-10">
            {/* Clip box is exactly one column wide and centered; the gap between
                columns keeps the next page fully off-screen (no bleed). */}
            <div
              ref={wrapRef}
              className="h-full mx-auto overflow-hidden"
              style={{ width: "calc(100% - 3rem)", maxWidth: "40rem" }}
            >
              <div
                ref={colsRef}
                className="reader-content h-full"
                style={{
                  columnWidth: colWidth ? `${colWidth}px` : undefined,
                  columnGap: `${PAGE_GAP}px`,
                  columnFill: "auto",
                  fontFamily: "var(--font-serif)",
                  fontSize: `${settings.font_size}px`,
                  transform: `translateX(-${(page - 1) * (colWidth + PAGE_GAP)}px)`,
                  transition: "transform 0.2s ease",
                }}
              >
                <h1 style={{ marginTop: 0 }}>{chapter.title}</h1>
                <MarkdownView source={chapter.content} />
                <RecapPanel recap={chapter.recap} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className={`flex items-center gap-3 px-4 h-12 border-t text-sm shrink-0 transition-opacity ${
          chrome ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={barStyle}
      >
        <button
          className="btn btn-sm"
          style={barStyle}
          disabled={!prev || isNavigating}
          onClick={() => goTo(prev?.id ?? null)}
        >
          {isNavigating && pendingId === prev?.id ? (
            <span className="spinner" aria-label="Loading" />
          ) : (
            "← Prev"
          )}
        </button>

        <div className="mx-auto text-center opacity-70">
          <div>
            Chapter {index} of {total}
            <span className="ml-2 tabular-nums opacity-80">· {progressPct}%</span>
          </div>
          {settings.layout === "page" && (
            <div className="text-xs">
              Page {page} / {pageCount}
            </div>
          )}
        </div>

        {settings.layout === "page" ? (
          <button className="btn btn-sm" style={barStyle} onClick={nextPage}>
            {page >= pageCount ? (next ? "Next ch →" : "End") : "Page →"}
          </button>
        ) : (
          <button
            className="btn btn-sm"
            style={barStyle}
            disabled={!next || isNavigating}
            onClick={() => goTo(next?.id ?? null)}
          >
            {isNavigating && pendingId === next?.id ? (
              <span className="spinner" aria-label="Loading" />
            ) : (
              "Next →"
            )}
          </button>
        )}
      </div>

      {/* Settings drawer */}
      {showSettings && (
        <Drawer title="Display" onClose={() => setShowSettings(false)}>
          <div className="space-y-5 text-ink">
            <div>
              <div className="label">Theme</div>
              <div className="flex flex-wrap gap-2">
                {BG_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    className="w-11 h-11 rounded-lg border-2 text-xs flex items-center justify-center"
                    style={{
                      backgroundColor: p.bg,
                      color: p.text,
                      borderColor:
                        settings.bg_color.toLowerCase() === p.bg.toLowerCase()
                          ? "var(--accent)"
                          : "var(--line)",
                    }}
                    title={p.name}
                    onClick={() => updateSettings({ bg_color: p.bg, text_color: p.text })}
                  >
                    Aa
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex-1">
                <span className="label">Background</span>
                <input
                  type="color"
                  className="w-full h-9 rounded border border-line"
                  value={settings.bg_color}
                  onChange={(e) => updateSettings({ bg_color: e.target.value })}
                />
              </label>
              <label className="flex-1">
                <span className="label">Text</span>
                <input
                  type="color"
                  className="w-full h-9 rounded border border-line"
                  value={settings.text_color}
                  onChange={(e) => updateSettings({ text_color: e.target.value })}
                />
              </label>
            </div>

            <div>
              <div className="label">Font size — {settings.font_size}px</div>
              <div className="flex items-center gap-3">
                <button
                  className="btn btn-sm"
                  onClick={() => updateSettings({ font_size: Math.max(12, settings.font_size - 1) })}
                >
                  A−
                </button>
                <input
                  type="range"
                  min={12}
                  max={40}
                  value={settings.font_size}
                  onChange={(e) => updateSettings({ font_size: Number(e.target.value) })}
                  className="flex-1"
                />
                <button
                  className="btn btn-sm"
                  onClick={() => updateSettings({ font_size: Math.min(40, settings.font_size + 1) })}
                >
                  A+
                </button>
              </div>
            </div>

            <div>
              <div className="label">Layout</div>
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm flex-1 ${settings.layout === "scroll" ? "btn-primary" : ""}`}
                  onClick={() => updateSettings({ layout: "scroll" })}
                >
                  Scroll
                </button>
                <button
                  className={`btn btn-sm flex-1 ${settings.layout === "page" ? "btn-primary" : ""}`}
                  onClick={() => updateSettings({ layout: "page" })}
                >
                  Page view
                </button>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* Contents drawer */}
      {showToc && (
        <Drawer title="Contents" onClose={() => setShowToc(false)}>
          <ol className="space-y-1 text-ink">
            {toc.map((c, i) => {
              const isCurrent = c.id === chapter.id;
              const isRead = readSet.has(c.id);
              const dimmed = isRead && !isCurrent;
              return (
                <li key={c.id}>
                  <button
                    className={`w-full text-left px-2 py-2 rounded hover:bg-line/60 flex items-start gap-2 ${
                      isCurrent ? "font-semibold" : ""
                    } ${dimmed ? "opacity-55" : ""}`}
                    aria-current={isCurrent ? "true" : undefined}
                    disabled={isNavigating}
                    onClick={() => {
                      // Keep the drawer open so the row's spinner shows while the
                      // next chapter loads; tapping the current one just closes it.
                      if (isCurrent) setShowToc(false);
                      else goTo(c.id);
                    }}
                  >
                    <span className="w-6 shrink-0 text-right tabular-nums text-muted">
                      {isNavigating && pendingId === c.id ? (
                        <span className="spinner" aria-label="Loading" />
                      ) : isRead && !isCurrent ? (
                        <span className="text-accent" aria-label="Read" title="Read">
                          ✓
                        </span>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{c.title}</span>
                    {c.spicy && <span className="shrink-0">🌶</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </Drawer>
      )}

      {/* Comments drawer (used in page mode) */}
      {showComments && (
        <Drawer title="Comments" onClose={() => setShowComments(false)}>
          <div className="text-ink">
            <ChapterComments chapterId={chapter.id} currentUserId={currentUserId} isAdmin={isAdmin} />
          </div>
        </Drawer>
      )}
    </div>
  );
}

/** Collapsible chapter recap shown at the end of the chapter (collapsed by
 *  default). Renders nothing when there's no recap. Uses a native <details> so
 *  it works without any extra state and inherits the reader's theme colours. */
function RecapPanel({
  recap,
  onClick,
}: {
  recap: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  if (!recap.trim()) return null;
  const line = "color-mix(in oklab, currentColor 18%, transparent)";
  return (
    <details
      className="reader-recap mt-10 pt-2 rounded-lg border"
      style={{ borderColor: line }}
      onClick={onClick}
    >
      <summary
        className="cursor-pointer select-none list-none px-4 py-3 text-sm font-semibold opacity-80 flex items-center gap-2"
        style={{ fontFamily: "var(--font-sans, inherit)" }}
      >
        <span aria-hidden>📝</span> Chapter recap
      </summary>
      <div
        className="px-4 pb-4 pt-1 border-t"
        style={{ borderColor: line, fontSize: "0.92em", opacity: 0.92 }}
      >
        <MarkdownView source={recap} />
      </div>
    </details>
  );
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-80 max-w-[85vw] h-full bg-panel border-l border-line p-5 overflow-y-auto text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{title}</h2>
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
