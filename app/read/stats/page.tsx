import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getReadingStatsOverview } from "@/lib/data";
import { formatDuration, formatDate } from "@/lib/format";
import ReaderNav from "@/components/ReaderNav";

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default async function StatsOverviewPage() {
  const user = (await getCurrentUser())!;
  const rows = await getReadingStatsOverview(user.id);

  return (
    <>
      <ReaderNav backHref="/read" backLabel="Library" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>
          Reading stats
        </h1>
        <p className="mb-6 text-sm text-muted">
          How everyone&apos;s reading is going. Tap a reader to see their chapters, hours and streaks.
        </p>

        {rows.length === 0 ? (
          <p className="text-muted">No reading activity yet.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((r) => {
              const isYou = r.userId === user.id;
              return (
                <li key={r.userId}>
                  <Link
                    href={`/read/stats/${r.userId}`}
                    className="card flex items-center gap-3 p-4 hover:border-accent active:scale-[0.99] transition-[transform,border-color]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-sm font-semibold text-accent">
                      {r.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initial(r.name)
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.name}</span>
                        {isYou && (
                          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">you</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {formatDuration(r.totalSeconds)} read
                        {r.booksFinished > 0 && ` · ${r.booksFinished} finished`}
                        {r.currentStreak > 0 && ` · 🔥 ${r.currentStreak}-day streak`}
                        {r.lastReadAt && ` · last ${formatDate(r.lastReadAt)}`}
                      </div>
                    </div>
                    <span aria-hidden className="text-muted">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
