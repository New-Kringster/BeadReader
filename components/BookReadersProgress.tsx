"use client";
import type { ReaderBookProgress } from "@/lib/data";
import { usePresence } from "@/components/PresenceProvider";

/** "2h 15m", "43m", "<1m" — total time spent reading. */
function formatDuration(secs: number): string {
  if (secs < 60) return "<1m";
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function BookReadersProgress({
  readers,
  currentUserId,
}: {
  readers: ReaderBookProgress[];
  currentUserId: string;
}) {
  // Live presence for this book (the provider knows the book from the route):
  // readers online here right now get a green dot.
  const online = usePresence();
  const onlineHere = new Set(online.filter((r) => r.sameBook).map((r) => r.userId));

  if (readers.length === 0) return null;

  return (
    <section aria-label="Who's reading" className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        Who&apos;s reading
      </h2>
      <ul className="card divide-y divide-line">
        {readers.map((r) => {
          const isYou = r.userId === currentUserId;
          const isOnline = onlineHere.has(r.userId);
          return (
            <li key={r.userId} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-sm font-semibold text-accent"
              >
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initial(r.name)
                )}
                {isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-panel" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{r.name}</span>
                  {isOnline && (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      reading now
                    </span>
                  )}
                  {isYou && (
                    <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">
                      you
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(r.pct, 2)}%` }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">
                    {r.pct}%
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  {r.currentChapterNumber
                    ? `On chapter ${r.currentChapterNumber} of ${r.total}`
                    : `${r.readCount}/${r.total} chapters`}
                  {r.totalSeconds >= 60 && (
                    <span className="opacity-70"> · read {formatDuration(r.totalSeconds)}</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
