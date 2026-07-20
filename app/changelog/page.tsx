import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { CHANGELOG } from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";
import Logo from "@/components/Logo";
import ChangelogArt from "@/components/ChangelogArt";

export const metadata: Metadata = { title: "What's new · BeadReader" };

// Public: reachable from the login page too, so it isn't behind the auth gate.
export default async function ChangelogPage() {
  const user = await getCurrentUser();
  const backHref = user ? "/read" : "/login";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href={backHref} className="text-sm text-muted hover:underline">
          ← Back
        </Link>
        <span className="ml-auto flex items-center gap-1.5 text-sm text-muted">
          <Logo size={18} /> v{APP_VERSION}
        </span>
      </div>

      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>
        What&apos;s new
      </h1>
      <p className="mb-8 text-sm text-muted">
        The latest features and how to use them, newest first.
      </p>

      <div className="space-y-10">
        {CHANGELOG.map((entry) => (
          <section key={entry.version}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold">{entry.title}</h2>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                v{entry.version}
              </span>
              <span className="text-xs text-muted">{entry.date}</span>
            </div>
            {entry.intro && <p className="mb-4 text-sm text-muted">{entry.intro}</p>}

            <ul className="space-y-5">
              {entry.items.map((item) => (
                <li key={item.title} className="card p-4">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm">{item.body}</p>
                  {item.how && (
                    <p className="mt-2 text-sm text-accent">
                      <span className="font-medium">How:</span> {item.how}
                    </p>
                  )}
                  {item.art && (
                    <div className="mt-3">
                      <ChangelogArt art={item.art} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
