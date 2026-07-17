/**
 * Spicy-span redaction.
 *
 * A chapter body holds the *full* text, with explicit passages wrapped in
 * `[[spicy]] … [[/spicy]]` markers. From that single source we derive two views:
 *
 *  - reveal  (admins & readers WITH access): drop the markers, keep the text.
 *  - redact  (readers WITHOUT access): replace each span with a placeholder; the
 *            inner text is removed entirely.
 *
 * These are pure string functions with no side effects, so they can run on the
 * server (the data layer, where redaction MUST happen before content is sent to a
 * reader without access) and on the client (the admin editor preview). The
 * security guarantee comes from *calling redact on the server* for readers without
 * access — not from the functions themselves.
 */

/** The placeholder a redacted span is replaced with. MarkdownView renders it. */
export const SPICY_REDACTED = "[[spicy-redacted]]";

/**
 * Sentinels wrapping a revealed spicy span for readers WITH access. Unlike
 * `revealSpicy` (which drops the markers and inlines the text), the reader path
 * keeps each span demarcated so the client can render it as a hidden,
 * click-to-reveal block. The enclosed text is the real, full spicy content — this
 * is only ever produced for readers who are allowed to see it.
 */
export const SPICY_REVEAL_OPEN = "[[spicy-reveal]]";
export const SPICY_REVEAL_CLOSE = "[[/spicy-reveal]]";

const OPEN = "[[spicy]]";
const CLOSE = "[[/spicy]]";

// A balanced span: [[spicy]] … [[/spicy]] (non-greedy, across newlines).
const SPAN = /\[\[spicy\]\]([\s\S]*?)\[\[\/spicy\]\]/g;

/** True if the text contains any spicy markers. */
export function hasSpicy(md: string): boolean {
  return md.includes(OPEN);
}

/**
 * Full view: remove the markers, keep the enclosed text. Any stray/unbalanced
 * marker tokens are stripped too, so a typo never shows raw `[[spicy]]` to a
 * reader who is allowed to see everything.
 */
export function revealSpicy(md: string): string {
  return md
    .replace(SPAN, "$1")
    .split(OPEN).join("")
    .split(CLOSE).join("");
}

/**
 * Redacted view: replace each spicy span with a standalone placeholder block; the
 * enclosed text is dropped. Defensive against unbalanced markers so explicit text
 * can never leak:
 *  - a lone (unclosed) `[[spicy]]` redacts everything from it to end-of-string;
 *  - a lone `[[/spicy]]` token is simply removed.
 */
export function redactSpicy(md: string): string {
  const block = `\n\n${SPICY_REDACTED}\n\n`;
  let out = md.replace(SPAN, block);

  const openIdx = out.indexOf(OPEN);
  if (openIdx !== -1) {
    // Unclosed marker: redact from here to the end rather than risk a leak.
    out = out.slice(0, openIdx) + block;
  }
  out = out.split(CLOSE).join("");

  // Collapse runs of adjacent placeholders (e.g. back-to-back spans) into one.
  out = out.replace(
    new RegExp(`(?:\\s*\\[\\[spicy-redacted\\]\\]\\s*){2,}`, "g"),
    block
  );
  return out;
}

/**
 * Reveal view for the READER path (readers with access + admins): keep the full
 * spicy text, but wrap each span in `[[spicy-reveal]] … [[/spicy-reveal]]`
 * sentinels so MarkdownView can render it as a hidden, click-to-reveal block
 * instead of dumping the explicit passage straight into the page. Stray/unbalanced
 * markers are handled defensively (an unclosed `[[spicy]]` wraps to end-of-string).
 *
 * This differs from `revealSpicy`, which inlines the text with no markers — that
 * one is used for the admin editor's "Full" proofreading preview.
 */
export function revealSpicyCollapsible(md: string): string {
  const wrap = (inner: string) =>
    `\n\n${SPICY_REVEAL_OPEN}\n\n${inner.trim()}\n\n${SPICY_REVEAL_CLOSE}\n\n`;

  let out = md.replace(SPAN, (_m, inner: string) => wrap(inner));

  const openIdx = out.indexOf(OPEN);
  if (openIdx !== -1) {
    // Unclosed marker: wrap everything from here to the end as one reveal block.
    out = out.slice(0, openIdx) + wrap(out.slice(openIdx + OPEN.length));
  }
  // Drop any stray close tokens so they never render as literal text.
  out = out.split(CLOSE).join("");
  return out;
}

/** Reveal or redact depending on whether the reader may see spicy content. */
export function processChapterContent(md: string, canSeeSpicy: boolean): string {
  return canSeeSpicy ? revealSpicyCollapsible(md) : redactSpicy(md);
}
