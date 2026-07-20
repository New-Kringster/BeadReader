"use client";
import { useEffect } from "react";
import { BUILD_ID } from "@/lib/version";

/**
 * Registers the asset-caching service worker (see public/sw.js). Skipped in
 * local dev so it never caches dev assets.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (BUILD_ID === "dev") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failures are non-fatal — the app works without caching */
    });
  }, []);
  return null;
}
