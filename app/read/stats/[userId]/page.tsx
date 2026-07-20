import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getReaderStats } from "@/lib/data";
import { formatDuration, formatDate } from "@/lib/format";
import ReaderNav from "@/components/ReaderNav";
import HourlyHistogram from "@/components/HourlyHistogram";

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-xl font-semibold text-accent">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initial(name)
      )}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export default async function ReaderStatsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const viewer = (await getCurrentUser())!;
  const result = await getReaderStats(viewer.id, userId);

  if (result.kind === "notfound") notFound();

  if (result.kind === "private") {
    return (
      <>
        <ReaderNav backHref="/read/stats" backLabel="Stats" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <div className="flex items-center gap-3">
            <Avatar name={result.name} url={result.avatarUrl} />
            <h1 className="text-xl font-bold">{result.name}</h1>
          </div>
          <p className="mt-6 text-muted">This reader keeps their activity private.</p>
        </main>
      </>
    );
  }

  const { summary, books, hourlyByDay } = result.stats;
  const isYou = userId === viewer.id;

  return (
    <>
      <ReaderNav backHref="/read/stats" backLabel="Stats" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Avatar name={summary.name} url={summary.avatarUrl} />
          <div>
            <h1 className="text-xl font-bold">
              {summary.name}
              {isYou && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">you</span>}
            </h1>
            {summary.lastReadAt && (
              <p className="text-sm text-muted">Last read {formatDate(summary.lastReadAt)}</p>
            )}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total time" value={formatDuration(summary.totalSeconds)} />
          <Stat label="Books started" value={String(summary.booksStarted)} />
          <Stat label="Books finished" value={String(summary.booksFinished)} />
          <Stat
            label="Current streak"
            value={summary.currentStreak > 0 ? `🔥 ${summary.currentStreak}d` : "—"}
          />
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            When they read
          </h2>
          <div className="card p-4">
            <HourlyHistogram days={hourlyByDay} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Books &amp; chapters
          </h2>
          {books.length === 0 ? (
            <p className="text-sm text-muted">No books started yet.</p>
          ) : (
            <div className="space-y-4">
              {books.map((b) => {
                const maxCh = Math.max(1, ...b.chapters.map((c) => c.seconds));
                return (
                  <div key={b.bookId} className="card p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold">{b.title}</h3>
                      <span className="shrink-0 text-xs text-muted">{formatDuration(b.totalSeconds)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {b.readCount}/{b.total} chapters ({b.pct}%)
                      {b.currentChapterNumber && ` · on chapter ${b.currentChapterNumber}`}
                      {b.estRemainingSeconds != null &&
                        ` · ~${formatDuration(b.estRemainingSeconds)} to finish`}
                    </div>

                    {b.chapters.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {b.chapters.map((c) => (
                          <li key={c.chapterId} className="flex items-center gap-2 text-sm">
                            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">
                              {c.number}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="mb-0.5 block truncate text-xs">{c.title}</span>
                              <span className="block h-1.5 overflow-hidden rounded-full bg-line">
                                <span
                                  className="block h-full rounded-full bg-accent"
                                  style={{ width: `${Math.max(3, (c.seconds / maxCh) * 100)}%` }}
                                />
                              </span>
                            </span>
                            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">
                              {formatDuration(c.seconds)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
