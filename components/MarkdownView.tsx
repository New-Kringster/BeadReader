"use client";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { SPICY_REDACTED, splitSpicy } from "@/lib/redact";
import SpicyPassage from "@/components/SpicyPassage";

/** Flatten react-markdown children down to their plain text. */
function toText(children: ReactNode): string {
  if (children == null || children === false) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(toText).join("");
  return "";
}

const COMPONENTS: Components = {
  p({ children }) {
    if (toText(children).trim() === SPICY_REDACTED) {
      return (
        <div className="spicy-redacted" role="note" aria-label="Spicy content hidden">
          🌶 spicy content hidden
        </div>
      );
    }
    return <p>{children}</p>;
  },
};

function Segment({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
}

/**
 * Renders Markdown to HTML. react-markdown does NOT render raw HTML embedded in
 * the source unless you add rehype-raw, so admin-authored Markdown is safe by
 * default. GFM adds tables, strikethrough, task lists, autolinks.
 *
 * The body arrives in one of two shapes, decided server-side in lib/data.ts:
 *
 *  - reader WITH access: `[[spicy]]` markers intact. splitSpicy cuts them out
 *    into their own segments, each folded behind a click by SpicyPassage.
 *  - reader WITHOUT access: no explicit text at all, just `[[spicy-redacted]]`
 *    sentinel paragraphs, rendered below as a labeled block.
 *
 * Each segment gets its own ReactMarkdown, so a Markdown construct cannot span a
 * marker boundary (a list may not open outside a span and close inside it).
 * Markers are scoped to whole passages, so this costs nothing in practice.
 */
export default function MarkdownView({ source }: { source: string }) {
  const segments = splitSpicy(source || "");
  return (
    <div className="reader-content">
      {segments.map((seg, i) =>
        seg.spicy ? (
          <SpicyPassage key={i}>
            <Segment text={seg.text} />
          </SpicyPassage>
        ) : (
          <Segment key={i} text={seg.text} />
        )
      )}
    </div>
  );
}
