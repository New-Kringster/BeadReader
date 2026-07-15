"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownView from "@/components/MarkdownView";
import ChapterComments from "@/components/ChapterComments";
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
  initialSettings,
  initialScrollFraction,
  initialPage,
  currentUserId,
  isAdmin,
}: {
  bookId: string;
  bookTitle: string;
  chapter: { id: string; title: string; content: string };
  prev: NavChapter | null;
  next: NavChapter | null;
  index: number;
  total: number;
  toc: { id: string; title: string; spicy: boolean }[];
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

  // ---- reading-time tracking (active seconds) ----
  const activeSecondsRef = useRef(0);
  const lastActiveRef = useRef(Date.now());

  const flushTime = useCallback(
    (beacon = false) => {
      const secs = activeSecondsRef.current;
      if (secs <= 0) return;
      activeSecondsRef.current = 0;
      postJSON("/api/reading-time", { bookId, seconds: secs }, beacon);
    },
    [bookId]
  );

  useEffect(() => {
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

    const flush = setInterval(() => flushTime(false), FLUSH_MS);

    const onHide = () => flushTime(true);
    const onVis = () => {
      if (document.visibilityState === "hidden") flushTime(true);
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

    // Restore saved position for this chapter after content lays out, then record
    // it. Recording on mount matters: a chapter that fits on screen never fires a
    // scroll event, so onScroll below would never run and the reader would have no
    // progress row at all — no "Reading" tag and no progress bar in the contents.
    // Page mode already writes on mount (see the page effect below); this is the
    // scroll-mode counterpart.
    const restore = requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = Math.max(0, initialScrollFraction * max);
      saveProgress(max > 0 ? el.scrollTop / max : 0, 1);
    });

    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const frac = max > 0 ? el.scrollTop / max : 0;
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

  // ---- chapter navigation ----
  const goTo = useCallback(
    (id: string | null) => {
      if (!id) return;
      // Flush before we leave so nothing is lost.
      const el = scrollRef.current;
      if (settings.layout === "scroll" && el) {
        const max = el.scrollHeight - el.clientHeight;
        saveProgress(max > 0 ? el.scrollTop / max : 0, 1, true);
      } else {
        saveProgress(0, page, true);
      }
      flushTime(true);
      router.push(`/read/${bookId}/${id}`);
    },
    [bookId, page, router, saveProgress, flushTime, settings.layout]
  );

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
      style={{ backgroundColor: settings.bg_color, color: settings.text_color }}
    >
      {/* Top bar */}
      <div
        className={`flex items-center gap-3 px-4 h-12 border-b text-sm shrink-0 transition-opacity ${
          chrome ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={barStyle}
      >
        <Link href={`/read/${bookId}`} className="hover:underline min-w-0 truncate shrink" title="Back to contents">
          ← {bookTitle}
        </Link>
        <span className="opacity-60 truncate hidden sm:inline">/ {chapter.title}</span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
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
              <div className="mt-12 pt-6 border-t" style={{ borderColor: "color-mix(in oklab, currentColor 18%, transparent)" }}>
                {next ? (
                  <button
                    className="btn max-w-full text-left"
                    style={{ ...barStyle, whiteSpace: "normal", height: "auto" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      goTo(next.id);
                    }}
                  >
                    Next: {next.title} →
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
          disabled={!prev}
          onClick={() => goTo(prev?.id ?? null)}
        >
          ← Prev
        </button>

        <div className="mx-auto text-center opacity-70">
          <div>
            Chapter {index} of {total}
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
            disabled={!next}
            onClick={() => goTo(next?.id ?? null)}
          >
            Next →
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
            {toc.map((c, i) => (
              <li key={c.id}>
                <button
                  className={`w-full text-left px-2 py-2 rounded hover:bg-line/60 flex gap-2 ${
                    c.id === chapter.id ? "font-semibold" : ""
                  }`}
                  onClick={() => {
                    setShowToc(false);
                    if (c.id !== chapter.id) goTo(c.id);
                  }}
                >
                  <span className="text-muted w-6 text-right tabular-nums">{i + 1}</span>
                  <span className="flex-1">{c.title}</span>
                  {c.spicy && <span>🌶</span>}
                </button>
              </li>
            ))}
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
