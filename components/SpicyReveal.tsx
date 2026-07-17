"use client";
import { useState, type ReactNode } from "react";

/**
 * A single spicy passage, hidden behind a click-to-reveal control for readers who
 * DO have access. Collapsed by default; pressing the toggle reveals the full block
 * of spicy paragraphs (and it can be hidden again).
 *
 * `stopPropagation` keeps taps on the control from bubbling to the reader's
 * tap-to-toggle-chrome handler. After a toggle we fire a synthetic `resize` so the
 * paginated reader re-measures its columns around the changed content height.
 */
export default function SpicyReveal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen((v) => !v);
    // Let layout settle, then nudge the reader to re-paginate.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    });
  }

  return (
    <div className="spicy-reveal" data-open={open || undefined}>
      {open ? (
        <>
          <button
            type="button"
            className="spicy-reveal-toggle"
            onClick={toggle}
            aria-expanded
          >
            🌶 Hide spicy content
          </button>
          <div className="spicy-reveal-body">{children}</div>
        </>
      ) : (
        <button
          type="button"
          className="spicy-reveal-toggle"
          onClick={toggle}
          aria-expanded={false}
        >
          🌶 Reveal spicy content
        </button>
      )}
    </div>
  );
}
