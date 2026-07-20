"use client";
import { useEffect, useState } from "react";
import { BUILD_ID } from "@/lib/version";

// How often to check whether a newer version has been deployed.
const POLL_MS = 60_000;

/**
 * Notices when a newer version has been deployed and prompts a refresh. It
 * compares this tab's baked-in build id against what /api/version reports — both
 * come from Vercel's build, never the database — so using the live DB for
 * prototyping can't trigger a false "please refresh".
 */
export default function VersionWatcher() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // No meaningful build id locally — nothing to watch.
    if (!BUILD_ID || BUILD_ID === "dev") return;
    let cancelled = false;
    let stopped = false;

    const check = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { buildId?: string };
        if (json.buildId && json.buildId !== BUILD_ID) {
          setStale(true);
          stopped = true; // once we know it's stale, stop polling
        }
      } catch {
        /* offline / transient — try again next tick */
      }
    };

    check();
    const timer = setInterval(check, POLL_MS);
    const onFocus = () => check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!stale) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-panel px-4 py-2 shadow-lg">
        <span className="text-sm">A new version is available.</span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
