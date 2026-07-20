"use client";
import { useEffect, useState } from "react";

interface Detail {
  usageMB: number | null;
  total: number;
  covers: number;
  artworkImages: number;
  artworkChapters: number;
  appFiles: number;
  fonts: number;
  other: number;
  prefs: { label: string; value: string }[];
  files: string[];
  supported: boolean;
}

function prefLabel(key: string): string {
  if (key === "theme") return "Theme preference";
  if (key === "br_seen_version") return "“What's new” seen";
  return key;
}

function fileName(u: string): string {
  try {
    const p = new URL(u).pathname;
    return decodeURIComponent(p.slice(p.lastIndexOf("/") + 1)) || p;
  } catch {
    return u;
  }
}

/**
 * Read-only view of everything the app has stored on this device: cached covers
 * and book artwork (grouped by chapter), app files, fonts, and the browser-saved
 * preferences. All read client-side from the Cache API and localStorage.
 */
export default function StorageDetails() {
  const [d, setD] = useState<Detail | null>(null);
  const [showFiles, setShowFiles] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = typeof window !== "undefined" && "caches" in window;
      const detail: Detail = {
        usageMB: null,
        total: 0,
        covers: 0,
        artworkImages: 0,
        artworkChapters: 0,
        appFiles: 0,
        fonts: 0,
        other: 0,
        prefs: [],
        files: [],
        supported,
      };

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          detail.prefs.push({ label: prefLabel(k), value: (localStorage.getItem(k) ?? "").slice(0, 60) });
        }
      } catch {
        /* storage blocked */
      }

      try {
        const est = await navigator.storage?.estimate?.();
        if (est?.usage != null) detail.usageMB = est.usage / 1_048_576;
      } catch {
        /* not supported */
      }

      try {
        if (supported) {
          const chapters = new Set<string>();
          for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            for (const req of await cache.keys()) {
              detail.total++;
              detail.files.push(req.url);
              let url: URL | null = null;
              try {
                url = new URL(req.url);
              } catch {
                detail.other++;
                continue;
              }
              const isFont = /\.(woff2?|ttf|otf)(\?|$)/i.test(url.pathname);
              if (isFont) detail.fonts++;
              else if (url.origin === location.origin) detail.appFiles++;
              else if (url.pathname.includes("/covers/")) detail.covers++;
              else {
                // Cross-origin non-cover image = book artwork; group by its
                // directory (…/bookId/chapterId/…) to count chapters.
                detail.artworkImages++;
                const dir = url.pathname.slice(0, url.pathname.lastIndexOf("/"));
                if (dir) chapters.add(url.origin + dir);
              }
            }
          }
          detail.artworkChapters = chapters.size;
        }
      } catch {
        /* Cache API blocked */
      }

      if (!cancelled) setD(detail);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!d) return <p className="mt-4 text-xs text-muted">Reading storage…</p>;
  if (!d.supported)
    return <p className="mt-4 text-xs text-muted">This browser doesn&apos;t expose on-device storage details.</p>;

  const rows = [
    { label: "Book covers", n: d.covers },
    {
      label: `Book artwork${d.artworkChapters ? ` · ${d.artworkChapters} chapter${d.artworkChapters > 1 ? "s" : ""}` : ""}`,
      n: d.artworkImages,
    },
    { label: "App files", n: d.appFiles },
    { label: "Fonts", n: d.fonts },
    { label: "Other", n: d.other },
  ].filter((r) => r.n > 0);

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Saved on this device</span>
        {d.usageMB != null && (
          <span className="text-xs text-muted">
            ~{d.usageMB < 0.1 ? "<0.1" : d.usageMB.toFixed(1)} MB
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Nothing cached yet — it fills in as you read.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3">
              <span className="text-muted">{r.label}</span>
              <span className="tabular-nums">{r.n}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 border-t border-line pt-1 font-medium">
            <span>Total items</span>
            <span className="tabular-nums">{d.total}</span>
          </li>
        </ul>
      )}

      {d.prefs.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Saved preferences</div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {d.prefs.map((p) => (
              <li key={p.label} className="flex items-center justify-between gap-3">
                <span className="text-muted">{p.label}</span>
                <span className="min-w-0 truncate">{p.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.files.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            className="text-xs text-muted underline hover:text-accent"
            onClick={() => setShowFiles((v) => !v)}
          >
            {showFiles ? "Hide cached files" : `Show all ${d.files.length} cached files`}
          </button>
          {showFiles && (
            <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded border border-line bg-bg p-2 text-xs text-muted">
              {d.files.map((f, i) => (
                <li key={i} className="truncate" title={f}>
                  {fileName(f)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
