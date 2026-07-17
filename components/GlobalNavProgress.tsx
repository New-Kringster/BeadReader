"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import NavProgress from "@/components/NavProgress";

/**
 * App-wide navigation loading bar. In the App Router the URL only updates when a
 * navigation *commits*, so we can't detect the start from history — we start the
 * bar on the link click itself (capture phase, before the router takes over) and
 * clear it once the pathname commits to the new route.
 *
 * The immersive reader (/read/<book>/<chapter>) paints its own bar in the
 * reader's custom colours and its own controls show spinners, so this global one
 * steps aside there to avoid a colour-mismatched double bar.
 */
function isReaderChapter(pathname: string): boolean {
  return /^\/read\/[^/]+\/[^/]+/.test(pathname);
}

export default function GlobalNavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearSafety = () => {
      if (safety.current) {
        clearTimeout(safety.current);
        safety.current = null;
      }
    };

    function onClick(e: MouseEvent) {
      // Only plain left-clicks that actually navigate this tab.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const target = anchor.getAttribute("target");
      if ((target && target !== "_self") || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      let url: URL;
      try {
        url = new URL(href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return; // external
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash

      setActive(true);
      // Safety net: if the navigation never commits (e.g. it was cancelled), don't
      // leave the bar spinning forever.
      clearSafety();
      safety.current = setTimeout(() => setActive(false), 10000);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearSafety();
    };
  }, []);

  // The navigation has committed once the pathname changes — clear the bar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync the bar to the route commit
    setActive(false);
    if (safety.current) {
      clearTimeout(safety.current);
      safety.current = null;
    }
  }, [pathname]);

  if (isReaderChapter(pathname)) return null;
  return <NavProgress active={active} />;
}
