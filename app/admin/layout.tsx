import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-5">
          <Link href="/admin" className="font-bold text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            📖 BeadReader
          </Link>
          <span className="badge badge-published">Admin</span>
          <nav className="flex items-center gap-4 text-sm ml-2">
            <Link href="/admin" className="hover:underline">Books</Link>
            <Link href="/admin/readers" className="hover:underline">Readers</Link>
            <Link href="/read" className="hover:underline text-muted">View as reader ↗</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted hidden sm:inline">{admin.name}</span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl w-full px-4 py-8 flex-1">{children}</main>
    </div>
  );
}
