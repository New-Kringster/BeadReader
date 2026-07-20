import type { ChangelogArt as ArtKey } from "@/lib/changelog";

// Small illustrative mock-ups that show what a feature looks like, built from the
// app's own styles (not screenshots, so they stay correct across themes and don't
// need a seeded instance to capture). If you later drop real screenshots into
// /public, swap these for <img> — the changelog and popup both render whatever
// this returns.

function Dot() {
  return (
    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-panel" />
  );
}

function Avatar({ letter, ring, badge }: { letter: string; ring?: boolean; badge?: number }) {
  return (
    <span
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent"
      style={ring ? { boxShadow: "0 0 0 2px #22c55e" } : undefined}
    >
      {letter}
      {badge ? (
        <span className="absolute -bottom-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white ring-2 ring-panel">
          {badge}
        </span>
      ) : (
        <Dot />
      )}
    </span>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">{children}</div>
  );
}

export default function ChangelogArt({ art }: { art: ArtKey }) {
  switch (art) {
    case "presence":
      return (
        <Frame>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">← A Study in Scarlet</span>
            <span className="ml-auto flex items-center -space-x-2">
              <Avatar letter="M" ring badge={12} />
              <Avatar letter="J" />
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Green dot = online · green ring + number = same book, on that chapter
          </p>
        </Frame>
      );
    case "nudge":
      return (
        <Frame>
          <div className="mx-auto flex w-full max-w-[15rem] flex-col gap-2">
            <div className="flex items-start gap-2 rounded-lg border border-line bg-bg px-3 py-2 shadow-sm">
              <span aria-hidden>👋</span>
              <span className="text-sm">
                <span className="font-semibold">Mara</span> bumped you
              </span>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-line bg-bg px-3 py-2 shadow-sm">
              <span aria-hidden>💬</span>
              <span className="text-sm">
                <span className="font-semibold">Jae</span>
                <span className="mt-0.5 block text-muted">this chapter 😭</span>
              </span>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">
            Pops up for a few seconds, then disappears
          </p>
        </Frame>
      );
    case "avatar":
      return (
        <Frame>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-lg font-semibold text-accent">
              A
            </span>
            <span aria-hidden className="text-muted">
              →
            </span>
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent/40 to-accent/10 text-lg">
              📷
            </span>
            <span className="text-xs text-muted">Account → Profile photo</span>
          </div>
        </Frame>
      );
    case "webtoon":
      return (
        <Frame>
          <div className="mx-auto flex w-24 flex-col gap-1">
            <span className="h-8 rounded bg-accent/20" />
            <span className="h-10 rounded bg-accent/15" />
            <span className="h-6 rounded bg-accent/10" />
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">Scroll top to bottom</p>
        </Frame>
      );
    case "spicy":
      return (
        <Frame>
          <div className="rounded-md border border-dashed border-line px-3 py-4 text-center">
            <span className="text-sm text-muted blur-[2px] select-none">
              a marked passage
            </span>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              🌶 tap to reveal
            </div>
          </div>
        </Frame>
      );
    default:
      return null;
  }
}
