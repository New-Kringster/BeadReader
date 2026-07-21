import { memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SPICY_REDACTED, SPICY_REVEAL_OPEN, SPICY_PREVIEW_OPEN } from "@/lib/redact";
import SpicyReveal from "@/components/SpicyReveal";
import SpicyPreview from "@/components/SpicyPreview";

/** Flatten react-markdown children down to their plain text. */
function toText(children: ReactNode): string {
  if (children == null || children === false) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(toText).join("");
  return "";
}

/** Matches a spicy `reveal` (full-access) or `preview` (no-access) block, capturing
 *  the kind and the inner text. Built fresh per call so no shared `lastIndex` state
 *  leaks between renders. */
const spicyBlockPattern = () =>
  /\[\[spicy-(reveal|preview)\]\]([\s\S]*?)\[\[\/spicy-\1\]\]/g;

/**
 * Render one run of Markdown. react-markdown does NOT render raw HTML embedded in
 * the source unless you add rehype-raw, so admin-authored Markdown is safe by
 * default. GFM adds tables, strikethrough, task lists, autolinks.
 *
 * A paragraph that is only the `[[spicy-redacted]]` sentinel is rendered as a
 * labeled redaction block instead of literal text (a defensive fallback).
 */
function Markdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
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
      }}
    >
      {source || ""}
    </ReactMarkdown>
  );
}

/**
 * Renders a chapter body to HTML.
 *
 * For readers WITHOUT access, redacted spans arrive as `[[spicy-redacted]]`
 * sentinels and render as labeled hidden blocks (see `Markdown`).
 *
 * For readers WITH access (and admins), each spicy span arrives wrapped in
 * `[[spicy-reveal]] … [[/spicy-reveal]]` sentinels: we render the enclosed passage
 * inside a `SpicyReveal` control so it stays hidden until the reader reveals it.
 *
 * For readers WITHOUT access, each span arrives as a short `[[spicy-preview]] …
 * [[/spicy-preview]]` excerpt, rendered blurred inside a `SpicyPreview` note that
 * can't be opened.
 */
// Memoized: the reader re-renders on every scroll tick, chrome toggle and
// font-size change, but the parsed body only depends on `source`. Without this,
// each of those re-renders would re-parse the entire chapter through
// react-markdown — expensive on long chapters.
function MarkdownView({ source }: { source: string }) {
  const text = source || "";

  // Fast path: no spicy blocks — render the whole body in one pass.
  if (!text.includes(SPICY_REVEAL_OPEN) && !text.includes(SPICY_PREVIEW_OPEN)) {
    return (
      <div className="reader-content">
        <Markdown source={text} />
      </div>
    );
  }

  // Split into alternating plain / spicy segments, each rendered independently.
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(spicyBlockPattern())) {
    const start = match.index ?? 0;
    const before = text.slice(last, start);
    if (before.trim()) parts.push(<Markdown key={`p${i}`} source={before} />);
    const [, kind, inner] = match;
    if (kind === "reveal") {
      parts.push(
        <SpicyReveal key={`s${i}`}>
          <Markdown source={inner} />
        </SpicyReveal>
      );
    } else {
      parts.push(<SpicyPreview key={`s${i}`} text={inner.trim()} />);
    }
    last = start + match[0].length;
    i++;
  }
  const after = text.slice(last);
  if (after.trim()) parts.push(<Markdown key={`p${i}`} source={after} />);

  return <div className="reader-content">{parts}</div>;
}

export default memo(MarkdownView);
