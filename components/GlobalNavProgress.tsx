"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavProgress from "@/components/NavProgress";

/**
 * App-wide navigation loading bar. Every in-app navigation — a <Link> click (a
 * book cover, a nav link, an admin action) or a programmatic router.push — goes
 * through history.pushState/replaceState, so patching those lets one component
 * catch them all and show the top bar until the new route commits.
 *
 * The immersive reader (/read/<book>/<chapter>) paints its own bar in the
 * reader's custom colours, so this global one steps aside there to avoid a
 * colour-mismatched double bar.
 */
function isReaderChapter(pathname: string): boolean {
  return /^\/read\/[^/]+\/[^/]+/.test(pathname);
}

export default function GlobalNavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  // Start the bar when a navigation to a different path begins.
  useEffect(() => {
    const patch = (orig: History["pushState"]): History["pushState"] =>
      function (this: History, ...args) {
        const dest = args[2];
        try {
          if (dest != null) {
            const url = new URL(dest.toString(), location.href);
            if (url.pathname !== location.pathname) setActive(true);
          }
        } catch {
          /* ignore malformed URLs */
        }
        return orig.apply(this, args);
      };
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = patch(origPush);
    history.replaceState = patch(origReplace);
    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  // The navigation has committed once the pathname updates — clear the bar.
  useEffect(() => {
    setActive(false);
  }, [pathname]);

  if (isReaderChapter(pathname)) return null;
  return <NavProgress active={active} />;
}
