import type { ReaderBookProgress } from "@/lib/data";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  if (readers.length === 0) return null;

  return (
    <section aria-label="Who's reading" className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        Who&apos;s reading
      </h2>
      <ul className="card divide-y divide-line">
        {readers.map((r) => {
          const isYou = r.userId === currentUserId;
          return (
            <li key={r.userId} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent"
              >
                {initial(r.name)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{r.name}</span>
                  {isYou && (
                    <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">
                      you
                    </span>
                  )}
                  {r.isAdmin && (
                    <span className="shrink-0 rounded bg-line px-1.5 py-0.5 text-xs text-muted">
                      admin
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
                {(r.currentChapterTitle || r.updatedAt) && (
                  <p className="mt-1 truncate text-xs text-muted">
                    {r.currentChapterTitle ? `On “${r.currentChapterTitle}”` : `${r.readCount}/${r.total} chapters`}
                    {r.updatedAt && <span className="opacity-70"> · {timeAgo(r.updatedAt)}</span>}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
