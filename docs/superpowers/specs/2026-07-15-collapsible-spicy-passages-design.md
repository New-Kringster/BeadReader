# Collapsible spicy passages

**Date:** 2026-07-15
**Status:** Approved
**Builds on:** [2026-07-14 In-place redaction for spicy chapters](2026-07-14-spicy-chapter-redaction-design.md)

## Problem

Inline redaction gave readers *without* access a graceful in-place placeholder. But
readers *with* access get the opposite problem: spicy passages render inline with
no warning at all. Someone reading in a public place, or simply not in the mood,
has no way to skip past a scene without having already read the first line of it.

We want the passage present but folded away by default, with the reader choosing
when to open it.

## Approach

For readers who may see spicy content, each `[[spicy]]` span renders as a
collapsed block: the first few lines are visible and fade out, with a button that
expands the passage in place.

This lives entirely on the **reveal** path. The redact path is untouched — a
reader without access still never receives the explicit text. See Security below.

### Non-goals

- No persistence. Expansion is per-passage component state and resets on reload
  or chapter change. No new storage, no new columns, no user setting.
- No global "always show spicy" preference.
- Inline-pill (mid-sentence) spans remain out of scope, as in the prior spec.
  Markers wrap whole passages.

## Behavior

| Reader | Sees |
|---|---|
| Admin / reader with access | passage collapsed to a fading peek; click to expand; click to re-hide |
| Reader without access | `🌶 spicy content hidden` block (unchanged) |
| Reader without access, whole-chapter `is_explicit` | chapter absent entirely (unchanged) |

Expansion state is `useState` in the passage component:

- open chapter → every passage collapsed
- click **🌶 Show passage** → that passage expands
- click **🌶 Hide** → collapses again
- navigate or reload → back to collapsed

## Rendering strategy

`revealSpicy` currently strips the markers, so the browser cannot tell where a
spicy passage began or ended. The boundaries must survive to the renderer.

**Chosen: segment the source, render one `ReactMarkdown` per segment.**
`splitSpicy()` cuts the revealed string into alternating plain/spicy segments;
`MarkdownView` renders each, wrapping spicy segments in a collapsible.

Trade-off: a Markdown construct cannot span a marker boundary — a list may not
open outside a spicy span and close inside it. The prior spec already scopes
markers to whole passages, so this costs nothing in practice.

Rejected alternatives:

- **A remark plugin** folding the marked region into a container node. One
  `ReactMarkdown`, no boundary restriction, cleanest in the abstract — but a
  fiddly plugin to write and debug, buying only a restriction we don't want.
- **Sentinel paragraphs + regrouping rendered output**, mirroring
  `[[spicy-redacted]]`. react-markdown offers no clean hook for grouping sibling
  nodes after render.

## Components

### `lib/redact.ts`

`revealSpicy(md)` changes meaning: it **keeps** balanced `[[spicy]] … [[/spicy]]`
markers rather than dropping them. Defensive handling now mirrors `redactSpicy`:

- a stray `[[/spicy]]` token is removed;
- an unclosed `[[spicy]]` marks spicy-to-end-of-string, exactly as `redactSpicy`
  redacts-to-end. Both views then agree on the spicy region, and a marker typo
  surfaces as one conspicuously large collapsed passage an admin will notice.

New `splitSpicy(md): { spicy: boolean; text: string }[]` — segments a *revealed*
string for the renderer. Plain and spicy segments alternate; empty segments are
dropped.

`redactSpicy`, `hasSpicy`, and `processChapterContent` are unchanged. The module
stays pure and importable from server and client.

### `components/SpicyPassage.tsx` (new, client)

Owns one passage's open/closed `useState` and renders `children` inside it.

Structure: an inner region holding the passage content, and the toggle button as
its **sibling below** — never inside the masked region, or the mask would fade
out its own control.

Collapsed, the inner region gets `max-height: 7em`, `overflow: hidden`, and
`mask-image: linear-gradient(to bottom, #000 45%, transparent)`. Expanded, all
three are dropped and the region renders at natural height.

The mask is load-bearing. A gradient *overlay* would have to paint the reader's
background color, and readers choose their own `bg_color` in settings — an
overlay would need that value threaded through. A mask fades to real
transparency and works against any background without knowing it.

Control: a `<button>` with `aria-expanded` and `aria-controls` pointing at the
passage region — `🌶 Show passage` collapsed, a quieter `🌶 Hide` expanded.

### `components/MarkdownView.tsx`

Gains `"use client"`. Both callers (`ReaderView`, `ChapterEditor`) are already
client components, so no server-component caller breaks.

Maps `splitSpicy(source)` to a `ReactMarkdown` per segment, wrapping spicy
segments in `SpicyPassage`. The existing `[[spicy-redacted]]` paragraph override
is unchanged and still applies to every segment.

### `app/globals.css`

`.spicy-passage` styles beside the existing `.spicy-redacted`, using the same
`currentColor` mixes so they inherit reader-custom colors.

### Unchanged

`lib/data.ts` needs no change — `processChapterContent` keeps its signature and
role. `components/ChapterEditor.tsx` needs no change: its Full preview already
calls `revealSpicy`, so it picks up the collapsed treatment automatically, which
is the intended editor behavior (Full previews what a reader *with* access sees;
Redacted previews what a reader without access sees).

## Security

Unchanged from the prior spec, and worth restating since `revealSpicy` is being
modified:

- Readers without access are still served by `redactSpicy` **server-side** in the
  data layer. The explicit text never enters their payload. Collapsing is not a
  security mechanism and is not relied on as one.
- Markers now ship to clients on the reveal path. That is fine — those readers
  are already permitted to see the text the markers wrap.
- The whole-chapter `is_explicit` SQL gate is untouched.

## Known trade-offs

Both were accepted during design rather than solved:

1. **Short passages.** A passage under 7em renders fully visible but fading —
   the mask clips its last line, and "Show passage" reveals only that line. It
   reads as a slight rendering oddity, not a leak. Fixing it properly means
   measuring `scrollHeight` in a layout effect; ship without it and revisit only
   if it looks wrong in practice.
2. **Paginated mode.** Expanding a passage reflows the CSS columns, shifting
   subsequent text across pages. Inherent to expanding content in a column
   layout.

## Testing

The prior spec promised `lib/redact.ts` unit tests, but no test runner was ever
added and those tests do not exist. `redact.ts` is pure, is the security-critical
piece, and is having its semantics changed here — so this is the moment to add
one.

Add `node --test` (no new dependencies) with `lib/redact.test.ts`, and a
`test` script in `package.json`. Coverage:

- `revealSpicy` keeps balanced markers; strips a stray `[[/spicy]]`; treats an
  unclosed `[[spicy]]` as spicy-to-end.
- `redactSpicy` unchanged behavior, including unbalanced markers and adjacent-span
  collapsing.
- **No-leak property:** redacted output contains none of the inner text.
- `splitSpicy` on: no markers, one span, multiple spans, adjacent spans,
  multi-paragraph spans, a span at start-of-string and at end-of-string.
- `revealSpicy` → `splitSpicy` round-trip: concatenating segment text reproduces
  the source minus markers.

### Visual verification (screenshot loop)

Unit tests cover `redact.ts`, but the substance of this feature is a *fade* — no
assertion tells us whether it looks right. Drive the running app with Playwright
and screenshot each state, iterating on the CSS against the images rather than
declaring it done from the code:

- Reader with access: passage collapsed (peek + fade), then expanded, then
  re-hidden.
- The fade against a **custom `bg_color`** (e.g. the Dark and Sepia presets) —
  this is what would expose a color seam if the mask were wrong.
- A short passage (under 7em) and a long multi-paragraph one, to see trade-off #1
  in reality and decide whether it actually needs the `scrollHeight` fix.
- Paginated layout: expanding a passage mid-column.
- Reader without access: redaction blocks unchanged.
- Admin editor: Full preview collapses, Redacted preview unchanged.

Screenshots are the gate for the CSS work — do not call the fade done without
looking at it in the Dark and Sepia presets.
