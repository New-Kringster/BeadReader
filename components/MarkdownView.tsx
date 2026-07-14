import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SPICY_REDACTED } from "@/lib/redact";

/** Flatten react-markdown children down to their plain text. */
function toText(children: ReactNode): string {
  if (children == null || children === false) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(toText).join("");
  return "";
}

/**
 * Renders Markdown to HTML. react-markdown does NOT render raw HTML embedded in
 * the source unless you add rehype-raw, so admin-authored Markdown is safe by
 * default. GFM adds tables, strikethrough, task lists, autolinks.
 *
 * A paragraph that is only the `[[spicy-redacted]]` sentinel (inserted server-side
 * by redactSpicy for readers without explicit access) is rendered as a labeled
 * redaction block instead of literal text.
 */
export default function MarkdownView({ source }: { source: string }) {
  return (
    <div className="reader-content">
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
    </div>
  );
}
