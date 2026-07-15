"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Collapsed height ceiling, in em. Must match the max-height in globals.css. */
const CLAMP_EM = 7;

/**
 * One `[[spicy]]` passage, folded to a fading peek until the reader opens it.
 *
 * Only ever rendered for readers who may see the text — readers without access
 * never receive it (lib/data.ts redacts server-side). So this is a
 * reading-comfort control, not a security boundary: the text really is in the
 * DOM, just clipped.
 *
 * Expansion is per-passage component state by design: every passage starts
 * folded again on reload or chapter change.
 *
 * Folded height is `min(7em, half the passage)`. The halving matters: a passage
 * shorter than the clamp isn't clipped at all, so with a flat 7em it would sit
 * there fully readable with only its last line faded — hiding nothing. Halving
 * keeps one rule at every length and always leaves something to open.
 */
export default function SpicyPassage({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<number | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyId = useId();

  // Measure the passage's natural height — which is why the content sits in an
  // inner wrapper: the outer box is clipped, so it can't report it. Re-measures
  // on reflow (font-size and width both change how tall the prose runs).
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => {
      const em = parseFloat(getComputedStyle(el).fontSize) || 16;
      const full = el.getBoundingClientRect().height;
      setPeek(Math.min(CLAMP_EM * em, full / 2));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Until measured, the CSS max-height (7em) already holds the passage folded,
  // so there's no frame where unopened spicy text is visible.
  const style = !open && peek != null ? { maxHeight: `${peek}px` } : undefined;

  return (
    <div className="spicy-passage" data-open={open}>
      <div className="spicy-passage-body" id={bodyId} style={style}>
        <div className="spicy-passage-inner" ref={innerRef}>
          {children}
        </div>
      </div>
      <button
        type="button"
        className="reader-btn spicy-passage-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "🌶 Hide" : "🌶 Show passage"}
      </button>
    </div>
  );
}
