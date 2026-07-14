import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

export default function ReaderNav({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto max-w-3xl px-4 h-14 flex items-center gap-4">
        {backHref ? (
          <Link href={backHref} className="text-sm hover:underline">
            ← {backLabel ?? "Back"}
          </Link>
        ) : (
          <Link href="/read" className="font-bold text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            📖 BeadReader
          </Link>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Link href="/read" className="hover:underline">Library</Link>
          <Link href="/read/account" className="hover:underline">Account</Link>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
