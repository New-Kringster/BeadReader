"use client";
import { useId, useState, type ReactNode } from "react";

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
 */
export default function SpicyPassage({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <div className="spicy-passage" data-open={open}>
      <div className="spicy-passage-body" id={bodyId}>
        {children}
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
