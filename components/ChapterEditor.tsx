"use client";
import { useRef, useState } from "react";
import MarkdownView from "@/components/MarkdownView";
import SubmitButton from "@/components/SubmitButton";
import { revealSpicy, redactSpicy, hasSpicy } from "@/lib/redact";
import type { Chapter } from "@/lib/types";

export default function ChapterEditor({
  action,
  chapter,
}: {
  action: (formData: FormData) => Promise<void>;
  chapter?: Chapter;
}) {
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [content, setContent] = useState(chapter?.content ?? "");
  const [status, setStatus] = useState(chapter?.status ?? "draft");
  const [spicy, setSpicy] = useState(chapter?.is_explicit ?? false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [previewAs, setPreviewAs] = useState<"full" | "redacted">("full");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const previewSource = previewAs === "full" ? revealSpicy(content) : redactSpicy(content);
  const anySpicy = hasSpicy(content);

  /** Wrap the current textarea selection in [[spicy]] … [[/spicy]] markers. */
  function markSpicy() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const next = `${content.slice(0, start)}[[spicy]]${selected}[[/spicy]]${content.slice(end)}`;
    setContent(next);
    // Restore focus and place the caret just inside the closing marker.
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + "[[spicy]]".length + selected.length;
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <form action={action} className="space-y-4">
      <input
        name="title"
        className="field text-lg font-semibold"
        placeholder="Chapter title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 card px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Status:</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="draft"
              checked={status === "draft"}
              onChange={() => setStatus("draft")}
            />
            Draft
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="published"
              checked={status === "published"}
              onChange={() => setStatus("published")}
            />
            Published
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="is_explicit"
            checked={spicy}
            onChange={(e) => setSpicy(e.target.checked)}
          />
          🌶 Hide entire chapter from readers without access
        </label>

        <div className="ml-auto">
          <SubmitButton>{chapter ? "Save chapter" : "Create chapter"}</SubmitButton>
        </div>
      </div>

      {/* Inline-redaction helper */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
        <button type="button" className="btn btn-sm" onClick={markSpicy}>
          🌶 Mark selection spicy
        </button>
        <span>
          Wraps the selected text in{" "}
          <code className="bg-line/60 px-1 rounded">[[spicy]]…[[/spicy]]</code>. Readers
          without access see a redaction block in its place; the chapter stays readable.
        </span>
      </div>

      {/* Mobile tab switch */}
      <div className="flex gap-2 md:hidden">
        <button
          type="button"
          className={`btn btn-sm ${tab === "write" ? "btn-primary" : ""}`}
          onClick={() => setTab("write")}
        >
          Write
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === "preview" ? "btn-primary" : ""}`}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>

      {/* Split editor / preview */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className={tab === "preview" ? "hidden md:block" : ""}>
          <div className="label">Markdown</div>
          <textarea
            ref={textareaRef}
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck
            className="field font-mono text-sm leading-relaxed"
            style={{ minHeight: "60vh", resize: "vertical", fontFamily: "ui-monospace, Menlo, monospace" }}
            placeholder="Write your chapter in Markdown…"
          />
        </div>
        <div className={tab === "write" ? "hidden md:block" : ""}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="label mb-0">Preview</div>
            {anySpicy && (
              <div className="flex gap-1" role="group" aria-label="Preview audience">
                <button
                  type="button"
                  className={`btn btn-sm ${previewAs === "full" ? "btn-primary" : ""}`}
                  onClick={() => setPreviewAs("full")}
                >
                  Full
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${previewAs === "redacted" ? "btn-primary" : ""}`}
                  onClick={() => setPreviewAs("redacted")}
                >
                  Redacted
                </button>
              </div>
            )}
          </div>
          <div
            className="card p-5 overflow-auto"
            style={{ minHeight: "60vh", maxHeight: "70vh", fontFamily: "var(--font-serif)" }}
          >
            {content.trim() ? (
              <MarkdownView source={previewSource} />
            ) : (
              <p className="text-muted text-sm">Nothing to preview yet.</p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
