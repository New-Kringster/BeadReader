# In-place redaction for spicy chapters

**Date:** 2026-07-14
**Status:** Approved

## Problem

Today an "explicit" (spicy) chapter is gated wholesale: a reader without
`has_explicit_access` never receives it at all (the exclusion lives in the SQL
query). That means a spicy chapter simply vanishes from their table of contents,
breaking the flow of the story.

We want a softer option: the chapter stays visible and readable, but the spicy
passages are redacted in place, so the narrative still flows.

## Approach

Write once, mark the spicy spans inline. A single chapter body holds both
"versions": the full text, with spicy passages wrapped in markers. The redacted
version is derived by replacing those spans with a placeholder. Redaction happens
**server-side** so the explicit text never reaches a reader without access.

### Non-goals

- No new "second body" column or separate upload. Both versions are encoded in
  the existing `content` column.
- Inline-pill redaction (mid-sentence) is out of scope for v1; redaction renders
  as a block. Markers are intended for passages/scenes.

## Data model — no migration

- Reuse the existing `chapters.content` (text) column. Spicy spans are wrapped in
  `[[spicy]] … [[/spicy]]` markers, which can span a phrase or multiple paragraphs.
- Reuse the existing `chapters.is_explicit` boolean as the **full-hide** flag:
  when set, the chapter is hidden entirely from readers without access (today's
  behavior, unchanged).

No schema change, no migration against live data. Existing spicy chapters
(is_explicit = true, no markers) keep behaving exactly as they do now.

## Components

### `lib/redact.ts` (new, pure, no side effects)

- `revealSpicy(md: string): string` — remove the markers, keep the inner text.
  Also strips any stray/unbalanced `[[spicy]]` / `[[/spicy]]` tokens.
- `redactSpicy(md: string): string` — replace each marked span with a
  block placeholder sentinel `[[spicy-redacted]]` on its own line; the inner text
  is dropped. Defensive: an unclosed `[[spicy]]` redacts to end-of-string so a
  typo can never leak.
- `hasSpicy(md: string): boolean` — whether any markers are present (labels).
- `processChapterContent(md, canSeeSpicy): string` — `canSeeSpicy ? revealSpicy :
  redactSpicy`.

Pure string functions, safe to import from both server (data layer) and client
(editor preview). Security depends on *where* they are called, not the functions.

### `lib/data.ts` (reader path)

`getReadableChapter` and `listReadableChapters` run each returned chapter's
`content` through `processChapterContent(content, canSeeSpicy)` where
`canSeeSpicy = user.role === 'admin' || user.has_explicit_access`. A reader
without access receives the redacted string only — the explicit text is stripped
before the response is built. The existing SQL full-hide gate
(`.eq('is_explicit', false)`) is untouched. The editor path (`getChapter`) stays
raw so markers are editable.

### `components/MarkdownView.tsx` (rendering)

Add a react-markdown `p` component override: a paragraph whose only content is the
`[[spicy-redacted]]` sentinel renders as the labeled block
`■■■ spicy content hidden ■■■` (class `.spicy-redacted`). No raw HTML, no new
dependencies.

### `app/globals.css`

Add a theme-aware `.spicy-redacted` block styled with `currentColor` mixes so it
reads correctly both in the admin preview (global theme) and in the reader (custom
per-user colors).

### `components/ChapterEditor.tsx`

- Keep the single markdown textarea (add a ref).
- Toolbar button **"🌶 Mark selection spicy"** wraps the current selection in
  `[[spicy]] … [[/spicy]]`.
- Preview pane gains a **Full / Redacted** segmented toggle, piping the content
  through `revealSpicy` / `redactSpicy` so the admin sees exactly what each
  audience sees.
- Relabel the checkbox to **"Hide entire chapter from readers without access"**
  with a one-line hint about the inline `[[spicy]]` option.

## Behavior matrix

| Chapter has… | Admin / access reader | Reader without access |
|---|---|---|
| `[[spicy]]` spans | full text | text with labeled redaction blocks; chapter visible |
| "Hide entire chapter" ✓ | full text | chapter not shown at all (as today) |
| both | full text | chapter not shown at all (hide wins) |

## Security

- Redaction is applied server-side in the data layer before the reader response is
  assembled; the explicit text between markers is not included in the payload sent
  to a reader without access.
- The full-hide SQL gate remains the mechanism for wall-to-wall spicy chapters.

## Testing

- `lib/redact.ts` is a pure module: cover reveal, redact, unbalanced markers,
  multi-paragraph spans, and the "no leak" property (redacted output contains none
  of the inner text).
- Manual end-to-end: admin editor Full/Redacted preview; a reader with access sees
  full text; a reader without access sees redaction blocks; a fully-hidden chapter
  stays absent for a reader without access.

## Addendum (evolved) — three views + cal mode

The single reveal/redact split has since become a **three-way view** of inline
`[[spicy]]` spans, chosen per reader in `spicyViewFor` (`lib/data.ts`):

- **full** (admins & readers with `has_explicit_access`): the passage is kept and
  wrapped in `[[spicy-reveal]]` sentinels; the client renders a bordered,
  click-to-reveal block — a blurred/faded teaser that expands to the full text
  (`revealSpicyCollapsible` + `components/SpicyReveal.tsx`).
- **preview** (readers without access): the span is replaced with a *short excerpt*
  (`PREVIEW_CHARS`, word-trimmed) wrapped in `[[spicy-preview]]` sentinels and
  rendered blurred with a "request access" note that can't be opened
  (`previewSpicy` + `components/SpicyPreview.tsx`). This intentionally leaks a small
  teaser; the rest of the passage is still never sent.
- **clean** (`cal_mode` readers): the span is removed entirely — no placeholder, no
  marker, no 🌶 in the contents list — so the book reads as if it had no spicy
  content (`cleanSpicy`). Whole-chapter `is_explicit` chapters also stay hidden for
  them (`canSeeGatedChapters`).

`cal_mode` is a per-user boolean (migration `0003_cal_mode.sql`), mutually exclusive
with `has_explicit_access` at the action layer. Spicy blocks now sit inside a light,
theme-aware border to set them apart from the surrounding story. The editor preview
toggle is Full / Preview / Clean.
