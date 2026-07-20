import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";

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
        <div className="ml-auto flex items-center gap-2 sm:gap-3 text-sm shrink-0">
          <Link href="/read" className="hover:underline">Library</Link>
          <Link href="/read/stats" className="hover:underline">Stats</Link>
          <Link href="/read/account" className="hover:underline">Account</Link>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
