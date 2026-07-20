"use client";
import { usePresence } from "@/components/PresenceProvider";

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/**
 * Library strip of readers online right now, with what they're reading. Reads
 * live presence from the provider and renders nothing when nobody else is
 * online, so it only appears when there's something to see.
 */
export default function OnlineNowStrip() {
  const online = usePresence();
  if (online.length === 0) return null;

  return (
    <section aria-label="Readers online now" className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Online now</h2>
      <ul className="flex flex-wrap gap-2">
        {online.map((r) => (
          <li
            key={r.userId}
            className="flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3"
          >
            <span className="relative inline-block h-7 w-7 shrink-0">
              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-accent/15 text-xs font-semibold text-accent">
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initial(r.name)
                )}
              </span>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-panel" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{r.name}</span>
              <span className="block truncate text-xs text-muted leading-tight">
                {r.bookTitle
                  ? `${r.bookTitle}${r.chapterNumber ? ` · ch ${r.chapterNumber}` : ""}`
                  : "Browsing"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
