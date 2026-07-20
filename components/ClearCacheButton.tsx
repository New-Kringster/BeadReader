"use client";
import { useState } from "react";

/**
 * Clears the on-device asset cache (book covers, artwork, static files) and
 * reloads with fresh copies. Handy if something looks out of date or you want to
 * free up space.
 */
export default function ClearCacheButton() {
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    setBusy(true);
    try {
      // Ask the service worker to purge its runtime cache…
      navigator.serviceWorker?.controller?.postMessage("clear-cache");
      // …and clear directly too, in case the SW isn't controlling this page yet.
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore — we reload regardless */
    }
    // Reload to refetch everything fresh.
    window.location.reload();
  };

  return (
    <button type="button" className="btn btn-sm" disabled={busy} onClick={clear}>
      {busy ? "Clearing…" : "Clear cached data"}
    </button>
  );
}
