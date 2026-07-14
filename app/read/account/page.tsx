import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { formatDuration } from "@/lib/format";
import ReaderNav from "@/components/ReaderNav";

export default async function AccountPage() {
  const user = (await getCurrentUser())!;

  const { data: times } = await supabaseAdmin
    .from("reading_time")
    .select("total_seconds")
    .eq("user_id", user.id);
  const totalSeconds = (times ?? []).reduce((s, t) => s + (t.total_seconds ?? 0), 0);

  return (
    <>
      <ReaderNav backHref="/read" backLabel="Library" />
      <main className="mx-auto max-w-3xl w-full px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-serif)" }}>
          Account
        </h1>

        <div className="card p-6 space-y-4 max-w-md">
          <div>
            <div className="label">Name</div>
            <div className="font-medium">{user.name}</div>
          </div>

          <div>
            <div className="label">Access</div>
            {user.has_explicit_access ? (
              <span className="badge badge-spicy">🌶 Spicy access enabled</span>
            ) : (
              <span className="badge badge-draft">Standard access</span>
            )}
            <p className="text-xs text-muted mt-2">
              {user.has_explicit_access
                ? "Explicit (spicy) chapters are visible to you across the library."
                : "Explicit chapters are hidden. Ask the library owner if you need access."}
            </p>
          </div>

          <div>
            <div className="label">Total reading time</div>
            <div className="font-medium">{formatDuration(totalSeconds)}</div>
          </div>
        </div>

        <p className="text-sm text-muted mt-6">
          Reading colors, font size, and scroll/page layout are adjustable from the{" "}
          <span className="font-medium">Aa</span> button while reading — your choices are saved
          automatically. <Link href="/read" className="underline">Back to library</Link>.
        </p>
      </main>
    </>
  );
}
