import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SPICY_REDACTED, SPICY_REVEAL_OPEN } from "@/lib/redact";
import SpicyReveal from "@/components/SpicyReveal";

/** Flatten react-markdown children down to their plain text. */
function toText(children: ReactNode): string {
  if (children == null || children === false) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(toText).join("");
  return "";
}

/** Matches a revealed spicy span (readers WITH access); captures the inner text.
 *  Built fresh per call so no shared `lastIndex` state leaks between renders. */
const revealPattern = () => /\[\[spicy-reveal\]\]([\s\S]*?)\[\[\/spicy-reveal\]\]/g;

/**
 * Render one run of Markdown. react-markdown does NOT render raw HTML embedded in
 * the source unless you add rehype-raw, so admin-authored Markdown is safe by
 * default. GFM adds tables, strikethrough, task lists, autolinks.
 *
 * A paragraph that is only the `[[spicy-redacted]]` sentinel (inserted server-side
 * by redactSpicy for readers without explicit access) is rendered as a labeled
 * redaction block instead of literal text.
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
 * `[[spicy-reveal]] … [[/spicy-reveal]]` sentinels: we split those out and render
 * the enclosed passage inside a `SpicyReveal` control so it stays hidden until the
 * reader chooses to reveal it.
 */
export default function MarkdownView({ source }: { source: string }) {
  const text = source || "";

  // Fast path: nothing to reveal — render the whole body in one pass.
  if (!text.includes(SPICY_REVEAL_OPEN)) {
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
  for (const match of text.matchAll(revealPattern())) {
    const start = match.index ?? 0;
    const before = text.slice(last, start);
    if (before.trim()) parts.push(<Markdown key={`p${i}`} source={before} />);
    parts.push(
      <SpicyReveal key={`s${i}`}>
        <Markdown source={match[1]} />
      </SpicyReveal>
    );
    last = start + match[0].length;
    i++;
  }
  const after = text.slice(last);
  if (after.trim()) parts.push(<Markdown key={`p${i}`} source={after} />);

  return <div className="reader-content">{parts}</div>;
}
