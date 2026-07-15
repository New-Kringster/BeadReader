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

const OPEN = "[[spicy]]";
const CLOSE = "[[/spicy]]";

// A balanced span: [[spicy]] … [[/spicy]] (non-greedy, across newlines).
const SPAN = /\[\[spicy\]\]([\s\S]*?)\[\[\/spicy\]\]/g;

/** True if the text contains any spicy markers. */
export function hasSpicy(md: string): boolean {
  return md.includes(OPEN);
}

/** One run of the body: either ordinary prose or the inside of a spicy span. */
export type SpicySegment = { spicy: boolean; text: string };

/**
 * Cut a body into alternating plain/spicy runs so the renderer can fold the
 * spicy ones away. Segment text is preserved exactly (no trimming); only truly
 * empty segments are dropped, so adjacent spans don't emit a phantom plain run.
 *
 * Defensive in the same direction as redactSpicy, so both views agree on where
 * a span is: an unclosed `[[spicy]]` runs spicy to end-of-string, and a stray
 * `[[/spicy]]` is dropped from the surrounding prose.
 *
 * Idempotent with respect to revealSpicy: splitting a revealed string sees the
 * same spans as splitting the raw one.
 */
export function splitSpicy(md: string): SpicySegment[] {
  const out: SpicySegment[] = [];
  const push = (spicy: boolean, text: string) => {
    if (text) out.push({ spicy, text });
  };

  let rest = md;
  for (;;) {
    const open = rest.indexOf(OPEN);
    if (open === -1) break;

    push(false, rest.slice(0, open).split(CLOSE).join(""));

    const after = rest.slice(open + OPEN.length);
    const close = after.indexOf(CLOSE);
    if (close === -1) {
      // Unclosed marker: treat the remainder as spicy rather than leak it into
      // the prose. redactSpicy makes the mirror-image choice.
      push(true, after);
      return out;
    }
    push(true, after.slice(0, close));
    rest = after.slice(close + CLOSE.length);
  }
  push(false, rest.split(CLOSE).join(""));
  return out;
}

/**
 * Full view (admins & readers WITH access): the text, with balanced
 * `[[spicy]] … [[/spicy]]` markers KEPT so the client can fold each passage
 * behind a click. Strays are normalized — an unclosed `[[spicy]]` gets closed
 * at end-of-string, a lone `[[/spicy]]` is removed — so a typo can never render
 * as raw marker text.
 *
 * Keeping the markers is safe: this view is only ever built for readers already
 * permitted to see the text it wraps. Readers without access get redactSpicy,
 * server-side.
 */
export function revealSpicy(md: string): string {
  return splitSpicy(md)
    .map((s) => (s.spicy ? `${OPEN}${s.text}${CLOSE}` : s.text))
    .join("");
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

/** Reveal or redact depending on whether the reader may see spicy content. */
export function processChapterContent(md: string, canSeeSpicy: boolean): string {
  return canSeeSpicy ? revealSpicy(md) : redactSpicy(md);
}
