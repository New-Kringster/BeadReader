import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-3 sm:gap-5">
          <Link
            href="/admin"
            className="font-bold text-lg shrink-0 flex items-center gap-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            <Logo size={24} />
            BeadReader
          </Link>
          <span className="badge badge-published hidden sm:inline-flex">Admin</span>
          {/* Desktop inline nav */}
          <nav className="hidden sm:flex items-center gap-4 text-sm ml-2">
            <Link href="/admin" className="hover:underline">Books</Link>
            <Link href="/admin/readers" className="hover:underline">People</Link>
            <Link href="/read" className="hover:underline text-muted">View as reader ↗</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-sm text-muted hidden md:inline">{admin.name}</span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
        {/* Mobile nav row */}
        <nav className="sm:hidden flex items-center gap-5 px-4 pb-2 -mt-1 text-sm border-t border-line pt-2">
          <Link href="/admin" className="hover:underline">Books</Link>
          <Link href="/admin/readers" className="hover:underline">People</Link>
          <Link href="/read" className="hover:underline text-muted">View as reader ↗</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl w-full px-4 py-8 flex-1">{children}</main>
    </div>
  );
}
