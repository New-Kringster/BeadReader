"use client";
import { useState } from "react";

/**
 * Wipes ALL data this app has saved on the device — the cached covers/artwork,
 * plus browser-stored preferences (theme, and the "what's new" seen state) — then
 * reloads fresh. Books, progress and settings live on the server and are untouched.
 */
export default function ClearCacheButton() {
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    if (
      !window.confirm(
        "Clear all saved data on this device? This removes cached covers and artwork, your theme choice, and resets the “what's new” popup. Your books, reading progress and settings are safe — they're stored on the server."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      navigator.serviceWorker?.controller?.postMessage("clear-cache");
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore — still clear storage + reload */
    }
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  return (
    <button type="button" className="btn btn-sm" disabled={busy} onClick={clear}>
      {busy ? "Clearing…" : "Clear all saved data"}
    </button>
  );
}
