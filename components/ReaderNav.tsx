import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";

// Icon-only on phones (keeps the bar on one line); icon + label from `sm` up.
const navItem =
  "flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 sm:px-2.5 text-sm text-muted hover:bg-line/60 hover:text-ink transition-colors";
// Square icon-only button (the theme toggle, which has no sensible label).
const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-line/60 hover:text-ink transition-colors";

const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 20,
  height: 20,
};

function NavIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={navItem} title={label} aria-label={label}>
      {children}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export default function ReaderNav({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto max-w-3xl px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
        {backHref ? (
          <Link href={backHref} className="text-sm hover:underline min-w-0 truncate">
            ← {backLabel ?? "Back"}
          </Link>
        ) : (
          <Link
            href="/read"
            className="font-bold text-lg shrink-0 flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            <Logo size={22} />
            BeadReader
          </Link>
        )}
        <nav className="ml-auto flex items-center gap-0.5 sm:gap-1 shrink-0">
          <NavIcon href="/read" label="Library">
            <svg {...svg} aria-hidden>
              <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5z" />
              <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5A1.5 1.5 0 0 0 20 15.5z" />
            </svg>
          </NavIcon>
          <NavIcon href="/read/stats" label="Stats">
            <svg {...svg} aria-hidden>
              <path d="M3.5 20h17" />
              <path d="M7 20v-6" />
              <path d="M12 20v-11" />
              <path d="M17 20v-4" />
            </svg>
          </NavIcon>
          <NavIcon href="/read/account" label="Account">
            <svg {...svg} aria-hidden>
              <circle cx="12" cy="8" r="3.4" />
              <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
            </svg>
          </NavIcon>
          <ThemeToggle className={iconBtn} />
          <LogoutButton className={navItem}>
            <svg {...svg} aria-hidden>
              <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
              <path d="M14 12H21" />
              <path d="M18 9l3 3-3 3" />
            </svg>
            <span className="hidden sm:inline">Log out</span>
          </LogoutButton>
        </nav>
      </div>
    </header>
  );
}
