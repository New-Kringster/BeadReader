/**
 * Spicy-span processing.
 *
 * A chapter body holds the *full* text, with explicit passages wrapped in
 * `[[spicy]] … [[/spicy]]` markers. From that single source we derive one of three
 * views, depending on the reader:
 *
 *  - full     (admins & readers WITH access): keep the text, but wrap each span in
 *             reveal sentinels so the client renders a hidden, click-to-reveal block.
 *  - preview  (readers WITHOUT access): replace each span with a *very short* plain
 *             excerpt plus a "request access" note — a teaser they can't open.
 *  - clean    ("cal mode" readers): remove each span entirely, no placeholder, so
 *             the book reads as if the spicy content never existed.
 *
 * These are pure string functions with no side effects, so they can run on the
 * server (the data layer, where processing MUST happen before content is sent to a
 * reader) and on the client (the admin editor preview). The security guarantee
 * comes from *calling the right view on the server* — not from the functions
 * themselves. Note the preview view intentionally leaks a small excerpt; the full
 * explicit passage is still never sent to a reader without access.
 */

/** Which view of the spicy spans a given reader receives. */
export type SpicyView = "full" | "preview" | "clean";

/** The placeholder a fully-redacted span is replaced with (kept for reference). */
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

/**
 * Sentinels wrapping a *preview* of a spicy span for readers WITHOUT access. The
 * enclosed text is only a short, plain excerpt (see `previewExcerpt`) — never the
 * full passage — which the client renders blurred, with a request-access note.
 */
export const SPICY_PREVIEW_OPEN = "[[spicy-preview]]";
export const SPICY_PREVIEW_CLOSE = "[[/spicy-preview]]";

const OPEN = "[[spicy]]";
const CLOSE = "[[/spicy]]";

// A balanced span: [[spicy]] … [[/spicy]] (non-greedy, across newlines).
const SPAN = /\[\[spicy\]\]([\s\S]*?)\[\[\/spicy\]\]/g;

/** How many characters of a spicy span leak into a no-access reader's preview. */
const PREVIEW_CHARS = 90;

/** True if the text contains any spicy markers. */
export function hasSpicy(md: string): boolean {
  return md.includes(OPEN);
}

/**
 * Full view: remove the markers, keep the enclosed text. Any stray/unbalanced
 * marker tokens are stripped too, so a typo never shows raw `[[spicy]]` to a
 * reader who is allowed to see everything. Used for the admin editor's "Full"
 * proofreading preview (the reader path uses `revealSpicyCollapsible`).
 */
export function revealSpicy(md: string): string {
  return md
    .replace(SPAN, "$1")
    .split(OPEN).join("")
    .split(CLOSE).join("");
}

/**
 * Redacted view: replace each spicy span with a standalone placeholder block; the
 * enclosed text is dropped entirely. Kept for reference / the strongest no-leak
 * guarantee, though the reader paths now use preview/clean instead.
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
 * Full reader view: keep the spicy text, but wrap each span in
 * `[[spicy-reveal]] … [[/spicy-reveal]]` sentinels so MarkdownView renders it as a
 * hidden, click-to-reveal block instead of dumping the passage into the page.
 * Stray/unbalanced markers are handled defensively (an unclosed `[[spicy]]` wraps
 * to end-of-string).
 */
export function revealSpicyCollapsible(md: string): string {
  const wrap = (inner: string) =>
    `\n\n${SPICY_REVEAL_OPEN}\n\n${inner.trim()}\n\n${SPICY_REVEAL_CLOSE}\n\n`;

  let out = md.replace(SPAN, (_m, inner: string) => wrap(inner));

  const openIdx = out.indexOf(OPEN);
  if (openIdx !== -1) {
    out = out.slice(0, openIdx) + wrap(out.slice(openIdx + OPEN.length));
  }
  out = out.split(CLOSE).join("");
  return out;
}

/**
 * A short, plain-text teaser of a spicy span. Inline markdown is stripped and the
 * text is cut to `PREVIEW_CHARS` at a word boundary so only a taste — never the
 * full passage — reaches a reader without access.
 */
function previewExcerpt(inner: string): string {
  const flat = inner
    .replace(/\s+/g, " ")
    .replace(/[*_`>#~[\]]/g, "") // drop inline markdown so the teaser reads cleanly
    .trim();
  if (!flat) return "…";
  if (flat.length <= PREVIEW_CHARS) return flat;

  const slice = flat.slice(0, PREVIEW_CHARS);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > PREVIEW_CHARS * 0.5 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s.,;:!?—-]+$/, "") + "…";
}

/**
 * Preview view for readers WITHOUT access: replace each span with a short excerpt
 * wrapped in `[[spicy-preview]]` sentinels. MarkdownView renders it blurred with a
 * request-access note; the reader cannot expand it. Only the excerpt is emitted —
 * the rest of the passage is never included.
 */
export function previewSpicy(md: string): string {
  const wrap = (inner: string) =>
    `\n\n${SPICY_PREVIEW_OPEN}\n\n${previewExcerpt(inner)}\n\n${SPICY_PREVIEW_CLOSE}\n\n`;

  let out = md.replace(SPAN, (_m, inner: string) => wrap(inner));

  const openIdx = out.indexOf(OPEN);
  if (openIdx !== -1) {
    // Unclosed marker: preview from here to end (never emit the full remainder).
    out = out.slice(0, openIdx) + wrap(out.slice(openIdx + OPEN.length));
  }
  out = out.split(CLOSE).join("");
  return out;
}

/**
 * Clean view for "cal mode" readers: remove every spicy span (markers and text)
 * so nothing is left behind — no placeholder, no gap, no marker. The surrounding
 * narrative closes up as if the passage never existed. Defensive against
 * unbalanced markers (an unclosed `[[spicy]]` drops everything to end-of-string).
 */
export function cleanSpicy(md: string): string {
  let out = md.replace(SPAN, "");

  const openIdx = out.indexOf(OPEN);
  if (openIdx !== -1) out = out.slice(0, openIdx);
  out = out.split(CLOSE).join("");

  // Close up the blank-line gaps the removed passages leave behind.
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

/** Derive the reader-facing content for a given spicy view. */
export function processChapterContent(md: string, view: SpicyView): string {
  switch (view) {
    case "full":
      return revealSpicyCollapsible(md);
    case "preview":
      return previewSpicy(md);
    case "clean":
      return cleanSpicy(md);
  }
}
