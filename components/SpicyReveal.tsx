"use client";
import { useState, type ReactNode } from "react";

/**
 * A single spicy passage for readers who DO have access. Collapsed, it shows a
 * short teaser of the opening lines that fades and blurs out toward the bottom;
 * pressing the control expands the whole passage (and it can be collapsed again).
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
    // Let the height transition begin, then nudge the reader to re-paginate.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    });
  }

  return (
    <div className="spicy-reveal" data-state={open ? "open" : "collapsed"}>
      <div className="spicy-reveal-body">{children}</div>

      {/* Progressive blur + fade over the lower part of the teaser (collapsed only). */}
      {!open && <div className="spicy-reveal-veil" aria-hidden="true" />}

      <button
        type="button"
        className="spicy-reveal-toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        {open ? "🌶 Hide spicy content" : "🌶 Reveal spicy content"}
      </button>
    </div>
  );
}
