import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

export default function ReaderNav({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto max-w-3xl px-4 h-14 flex items-center gap-3">
        {backHref ? (
          <Link href={backHref} className="text-sm hover:underline min-w-0 truncate">
            ← {backLabel ?? "Back"}
          </Link>
        ) : (
          <Link href="/read" className="font-bold text-lg shrink-0" style={{ fontFamily: "var(--font-serif)" }}>
            📖 BeadReader
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2 sm:gap-3 text-sm shrink-0">
          <Link href="/read" className="hover:underline">Library</Link>
          <Link href="/read/account" className="hover:underline">Account</Link>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
