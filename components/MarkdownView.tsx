import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Markdown to HTML. react-markdown does NOT render raw HTML embedded in
 * the source unless you add rehype-raw, so admin-authored Markdown is safe by
 * default. GFM adds tables, strikethrough, task lists, autolinks.
 */
export default function MarkdownView({ source }: { source: string }) {
  return (
    <div className="reader-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source || ""}</ReactMarkdown>
    </div>
  );
}
