# Collapsible Spicy Passages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For readers allowed to see spicy content, fold each `[[spicy]]` passage into a fading peek that expands on click.

**Architecture:** `revealSpicy` stops stripping the `[[spicy]] … [[/spicy]]` markers and starts normalizing-and-keeping them, so span boundaries survive to the browser. A new pure `splitSpicy()` cuts that string into alternating plain/spicy segments. `MarkdownView` renders one `<ReactMarkdown>` per segment and wraps spicy ones in a new client `SpicyPassage` component that owns the collapsed/expanded state. The redaction path for readers *without* access is untouched.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, react-markdown v10 + remark-gfm, Tailwind v4 + `app/globals.css`, Supabase. Tests: `node --test` (built in, no new dependencies).

**Spec:** `docs/superpowers/specs/2026-07-15-collapsible-spicy-passages-design.md`

## Global Constraints

- **No new dependencies.** Not for the collapse, not for the tests.
- **Security boundary is unchanged and must stay unchanged.** Readers without
  access are served by `redactSpicy` server-side in `lib/data.ts`; the explicit
  text never enters their payload. Collapsing is a reading-comfort feature, NOT
  a security mechanism. Do not move redaction to the client. Do not touch the
  `is_explicit` SQL gate.
- **`lib/redact.ts` must stay pure** — no imports, no side effects. It is
  imported from both server (`lib/data.ts`) and client (`ChapterEditor`).
- **Collapsed geometry:** `max-height: 7em`, mask
  `linear-gradient(to bottom, #000 45%, transparent)`.
- **Fade must be a `mask-image`, never a gradient overlay.** Readers choose their
  own `bg_color` in settings; an overlay would have to know that color. A mask
  fades to real transparency and works on any background.
- **Button copy, exactly:** `🌶 Show passage` when collapsed, `🌶 Hide` when
  expanded.
- **Do not modify `lib/data.ts` or `components/ChapterEditor.tsx`.** They get the
  new behavior for free via `processChapterContent`/`revealSpicy`. If you find
  yourself editing either, stop — something has gone wrong.
- Node is v26; `node --test` runs `.ts` directly via type stripping. Imports
  between `.ts` files in test code need the explicit `.ts` extension.

---

### Task 1: `splitSpicy` + new `revealSpicy` semantics (with test runner)

This task also stands up the test runner, because `redact.ts` is the
security-critical module and this task is what changes its semantics.

**Files:**
- Modify: `lib/redact.ts:37-42` (`revealSpicy`), plus new exports
- Create: `lib/redact.test.ts`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces, relied on by Task 3:
  - `export type SpicySegment = { spicy: boolean; text: string }`
  - `export function splitSpicy(md: string): SpicySegment[]`
  - `export function revealSpicy(md: string): string` — same name and signature
    as today, new meaning: keeps balanced markers.
  - Unchanged and still exported: `SPICY_REDACTED`, `hasSpicy`, `redactSpicy`,
    `processChapterContent`.

**Semantics being implemented:**

| Input | `splitSpicy` result |
|---|---|
| `a[[spicy]]b[[/spicy]]c` | `[{false,"a"},{true,"b"},{false,"c"}]` |
| `no markers` | `[{false,"no markers"}]` |
| `a[[spicy]]b` (unclosed) | `[{false,"a"},{true,"b"}]` — spicy to end |
| `a[[/spicy]]b` (stray close) | `[{false,"ab"}]` — token removed |
| `""` | `[]` |

Segment text is preserved **exactly** — no trimming. Only truly empty (`""`)
segments are dropped. This keeps `revealSpicy` a faithful normalization.

- [ ] **Step 1: Add the test script to `package.json`**

In the `"scripts"` block, add the `test` line (keep the others as they are):

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "node --test lib/*.test.ts",
    "bootstrap": "node --env-file=.env.local scripts/bootstrap.mjs"
  },
```

Note: running this prints a `MODULE_TYPELESS_PACKAGE_JSON` warning to stderr.
That is expected and harmless — it is Node noting `package.json` has no
`"type": "module"`. **Do not add `"type": "module"` to silence it**; that would
change module resolution for the Next.js config files for no benefit. Tests pass
with the warning present.

- [ ] **Step 2: Write the failing tests**

Create `lib/redact.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitSpicy,
  revealSpicy,
  redactSpicy,
  hasSpicy,
  processChapterContent,
  SPICY_REDACTED,
} from "./redact.ts";

// ---------- splitSpicy ----------

test("splitSpicy: no markers is a single plain segment", () => {
  assert.deepEqual(splitSpicy("just prose"), [{ spicy: false, text: "just prose" }]);
});

test("splitSpicy: empty string yields no segments", () => {
  assert.deepEqual(splitSpicy(""), []);
});

test("splitSpicy: one span splits into three segments", () => {
  assert.deepEqual(splitSpicy("a[[spicy]]b[[/spicy]]c"), [
    { spicy: false, text: "a" },
    { spicy: true, text: "b" },
    { spicy: false, text: "c" },
  ]);
});

test("splitSpicy: span at start of string has no leading plain segment", () => {
  assert.deepEqual(splitSpicy("[[spicy]]b[[/spicy]]c"), [
    { spicy: true, text: "b" },
    { spicy: false, text: "c" },
  ]);
});

test("splitSpicy: span at end of string has no trailing plain segment", () => {
  assert.deepEqual(splitSpicy("a[[spicy]]b[[/spicy]]"), [
    { spicy: false, text: "a" },
    { spicy: true, text: "b" },
  ]);
});

test("splitSpicy: multiple spans", () => {
  assert.deepEqual(splitSpicy("a[[spicy]]b[[/spicy]]c[[spicy]]d[[/spicy]]e"), [
    { spicy: false, text: "a" },
    { spicy: true, text: "b" },
    { spicy: false, text: "c" },
    { spicy: true, text: "d" },
    { spicy: false, text: "e" },
  ]);
});

test("splitSpicy: adjacent spans produce no empty plain segment between them", () => {
  assert.deepEqual(splitSpicy("[[spicy]]a[[/spicy]][[spicy]]b[[/spicy]]"), [
    { spicy: true, text: "a" },
    { spicy: true, text: "b" },
  ]);
});

test("splitSpicy: multi-paragraph span keeps its text exactly, untrimmed", () => {
  const md = "intro\n\n[[spicy]]\n\npara one\n\npara two\n\n[[/spicy]]\n\nouttro";
  assert.deepEqual(splitSpicy(md), [
    { spicy: false, text: "intro\n\n" },
    { spicy: true, text: "\n\npara one\n\npara two\n\n" },
    { spicy: false, text: "\n\nouttro" },
  ]);
});

test("splitSpicy: unclosed [[spicy]] is spicy to end of string", () => {
  assert.deepEqual(splitSpicy("a[[spicy]]b and on and on"), [
    { spicy: false, text: "a" },
    { spicy: true, text: "b and on and on" },
  ]);
});

test("splitSpicy: stray [[/spicy]] is removed from plain text", () => {
  assert.deepEqual(splitSpicy("a[[/spicy]]b"), [{ spicy: false, text: "ab" }]);
});

test("splitSpicy: concatenated segment text is the source minus its markers", () => {
  const md = "intro\n\n[[spicy]]hidden bit[[/spicy]]\n\nouttro";
  assert.equal(
    splitSpicy(md).map((s) => s.text).join(""),
    "intro\n\nhidden bit\n\nouttro"
  );
});

// ---------- revealSpicy ----------

test("revealSpicy: keeps balanced markers intact", () => {
  assert.equal(revealSpicy("a[[spicy]]b[[/spicy]]c"), "a[[spicy]]b[[/spicy]]c");
});

test("revealSpicy: leaves marker-free text alone", () => {
  assert.equal(revealSpicy("just prose"), "just prose");
});

test("revealSpicy: closes an unclosed marker rather than dropping it", () => {
  assert.equal(revealSpicy("a[[spicy]]b"), "a[[spicy]]b[[/spicy]]");
});

test("revealSpicy: strips a stray closing token", () => {
  assert.equal(revealSpicy("a[[/spicy]]b"), "ab");
});

test("revealSpicy: is idempotent", () => {
  const md = "a[[spicy]]b";
  assert.equal(revealSpicy(revealSpicy(md)), revealSpicy(md));
});

test("revealSpicy: splitSpicy sees the same spans before and after revealing", () => {
  const md = "a[[spicy]]b[[/spicy]]c[[spicy]]unclosed";
  assert.deepEqual(splitSpicy(revealSpicy(md)), splitSpicy(md));
});

// ---------- redactSpicy (unchanged behavior — regression guard) ----------

test("redactSpicy: replaces a span with the placeholder block", () => {
  const out = redactSpicy("a\n\n[[spicy]]secret[[/spicy]]\n\nb");
  assert.ok(out.includes(SPICY_REDACTED));
  assert.ok(out.includes("a"));
  assert.ok(out.includes("b"));
});

test("redactSpicy: unclosed marker redacts to end of string", () => {
  const out = redactSpicy("safe[[spicy]]secret trailing text");
  assert.ok(!out.includes("secret"));
  assert.ok(!out.includes("trailing text"));
  assert.ok(out.includes("safe"));
});

test("redactSpicy: adjacent spans collapse to a single placeholder", () => {
  const out = redactSpicy("[[spicy]]a[[/spicy]][[spicy]]b[[/spicy]]");
  const count = out.split(SPICY_REDACTED).length - 1;
  assert.equal(count, 1);
});

test("redactSpicy: NO LEAK — none of the inner text survives", () => {
  const md = [
    "public opening",
    "[[spicy]]", "clandestine", "", "compromising", "[[/spicy]]",
    "public closing",
  ].join("\n\n");
  const out = redactSpicy(md);
  for (const secret of ["clandestine", "compromising"]) {
    assert.ok(!out.includes(secret), `leaked: ${secret}`);
  }
  assert.ok(out.includes("public opening"));
  assert.ok(out.includes("public closing"));
});

// ---------- hasSpicy / processChapterContent ----------

test("hasSpicy: true only when an opening marker is present", () => {
  assert.equal(hasSpicy("a[[spicy]]b[[/spicy]]"), true);
  assert.equal(hasSpicy("plain"), false);
});

test("processChapterContent: reader WITH access keeps markers and text", () => {
  const out = processChapterContent("a[[spicy]]secret[[/spicy]]", true);
  assert.ok(out.includes("secret"));
  assert.ok(out.includes("[[spicy]]"));
});

test("processChapterContent: reader WITHOUT access gets no explicit text", () => {
  const out = processChapterContent("a[[spicy]]secret[[/spicy]]", false);
  assert.ok(!out.includes("secret"));
  assert.ok(out.includes(SPICY_REDACTED));
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`

Expected: FAIL. `splitSpicy` is not exported yet, so the run errors with
`SyntaxError: The requested module './redact.ts' does not provide an export named 'splitSpicy'`.

- [ ] **Step 4: Implement `splitSpicy` and rewrite `revealSpicy`**

In `lib/redact.ts`, replace the existing `revealSpicy` (lines 37-42, including
its doc comment) with the following. Leave `SPICY_REDACTED`, `OPEN`, `CLOSE`,
`SPAN`, `hasSpicy`, `redactSpicy`, and `processChapterContent` exactly as they
are.

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS, all tests, `fail 0`. (The `MODULE_TYPELESS_PACKAGE_JSON` warning
on stderr is expected — see Step 1.)

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

Expected: both clean. `lib/data.ts` and `components/ChapterEditor.tsx` still
compile untouched — `revealSpicy` kept its signature.

- [ ] **Step 7: Commit**

```bash
git add lib/redact.ts lib/redact.test.ts package.json
git commit -m "Keep spicy markers on the reveal path, add splitSpicy

revealSpicy now normalizes-and-keeps balanced markers instead of
stripping them, so the client can tell where a passage begins. Adds
splitSpicy for the renderer, and a node --test suite covering both
plus the redaction no-leak property."
```

---

### Task 2: `SpicyPassage` component and its styles

**Files:**
- Create: `components/SpicyPassage.tsx`
- Modify: `app/globals.css` (add after the `.spicy-redacted` block, ~line 200)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces, relied on by Task 3:
  `export default function SpicyPassage({ children }: { children: ReactNode })`

**Structure that matters:** the toggle button is a **sibling below** the masked
region, never inside it. Inside, the mask would fade out its own control.

- [ ] **Step 1: Create the component**

Create `components/SpicyPassage.tsx`:

```tsx
"use client";
import { useId, useState, type ReactNode } from "react";

/**
 * One `[[spicy]]` passage, folded to a fading peek until the reader opens it.
 *
 * Only ever rendered for readers who may see the text — readers without access
 * never receive it (lib/data.ts redacts server-side). So this is a
 * reading-comfort control, not a security boundary: the text really is in the
 * DOM, just clipped.
 *
 * Expansion is per-passage component state by design: every passage starts
 * folded again on reload or chapter change.
 */
export default function SpicyPassage({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <div className="spicy-passage" data-open={open}>
      <div className="spicy-passage-body" id={bodyId}>
        {children}
      </div>
      <button
        type="button"
        className="reader-btn spicy-passage-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "🌶 Hide" : "🌶 Show passage"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add the styles**

In `app/globals.css`, immediately after the closing brace of the existing
`.spicy-redacted` rule (which ends around line 200, just before
`.reader-content table`), add:

```css
/* A spicy passage, folded away until the reader opens it. Sits on the reveal
   path only; .spicy-redacted above is what readers without access get instead. */
.spicy-passage { margin: 1.2em 0; }
.spicy-passage-body > :first-child { margin-top: 0; }
.spicy-passage[data-open="false"] .spicy-passage-body {
  max-height: 7em;
  overflow: hidden;
  /* Fade to transparency, NOT to a background color. Readers pick their own
     bg_color in settings, so a gradient overlay would have to be told that
     color; a mask just lets the real background through. */
  -webkit-mask-image: linear-gradient(to bottom, #000 45%, transparent);
  mask-image: linear-gradient(to bottom, #000 45%, transparent);
}
.spicy-passage-toggle { margin-top: 0.4em; }
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

Expected: both clean. (The component is not rendered anywhere yet — that is
Task 3.)

- [ ] **Step 4: Commit**

```bash
git add components/SpicyPassage.tsx app/globals.css
git commit -m "Add SpicyPassage, a collapsible fading passage wrapper"
```

---

### Task 3: Render segments in `MarkdownView`

**Files:**
- Modify: `components/MarkdownView.tsx` (whole file)

**Interfaces:**
- Consumes: `splitSpicy`, `SPICY_REDACTED` from `@/lib/redact` (Task 1);
  `SpicyPassage` from `@/components/SpicyPassage` (Task 2).
- Produces: `MarkdownView({ source }: { source: string })` — unchanged public
  signature. Both existing callers keep working untouched.

**Why `"use client"` is safe here:** the only two callers, `ReaderView.tsx:5`
and `ChapterEditor.tsx:3`, are already client components (both open with
`"use client"`). No server component renders `MarkdownView`.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `components/MarkdownView.tsx` with:

```tsx
"use client";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { SPICY_REDACTED, splitSpicy } from "@/lib/redact";
import SpicyPassage from "@/components/SpicyPassage";

/** Flatten react-markdown children down to their plain text. */
function toText(children: ReactNode): string {
  if (children == null || children === false) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(toText).join("");
  return "";
}

const COMPONENTS: Components = {
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
};

function Segment({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
}

/**
 * Renders Markdown to HTML. react-markdown does NOT render raw HTML embedded in
 * the source unless you add rehype-raw, so admin-authored Markdown is safe by
 * default. GFM adds tables, strikethrough, task lists, autolinks.
 *
 * The body arrives in one of two shapes, decided server-side in lib/data.ts:
 *
 *  - reader WITH access: `[[spicy]]` markers intact. splitSpicy cuts them out
 *    into their own segments, each folded behind a click by SpicyPassage.
 *  - reader WITHOUT access: no explicit text at all, just `[[spicy-redacted]]`
 *    sentinel paragraphs, rendered below as a labeled block.
 *
 * Each segment gets its own ReactMarkdown, so a Markdown construct cannot span a
 * marker boundary (a list may not open outside a span and close inside it).
 * Markers are scoped to whole passages, so this costs nothing in practice.
 */
export default function MarkdownView({ source }: { source: string }) {
  const segments = splitSpicy(source || "");
  return (
    <div className="reader-content">
      {segments.map((seg, i) =>
        seg.spicy ? (
          <SpicyPassage key={i}>
            <Segment text={seg.text} />
          </SpicyPassage>
        ) : (
          <Segment key={i} text={seg.text} />
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

Expected: both clean.

- [ ] **Step 3: Confirm the full suite still passes**

Run: `npm test`

Expected: PASS, `fail 0`.

- [ ] **Step 4: Confirm the app builds**

Run: `npm run build`

Expected: build succeeds. This is the real check that adding `"use client"` to
`MarkdownView` broke no server/client boundary — a server component importing it
would fail the build here.

- [ ] **Step 5: Commit**

```bash
git add components/MarkdownView.tsx
git commit -m "Fold spicy passages behind a click in MarkdownView"
```

---

### Task 4: Visual verification (screenshot loop)

The unit tests cover `redact.ts`, but nothing so far has confirmed the *fade*
looks right — and that is the feature. This task is not optional and is the gate
on the CSS.

**Files:** none created. This task may produce follow-up edits to
`app/globals.css` or `components/SpicyPassage.tsx`.

- [ ] **Step 1: Seed a chapter that exercises the edge cases**

You need a chapter whose body contains all three of:

```markdown
Ordinary prose before the passage, at least a paragraph of it.

[[spicy]]A short one. Two lines at most, well under the 7em clamp.[[/spicy]]

More ordinary prose between the two passages.

[[spicy]]
A long passage. Several paragraphs, comfortably past the clamp.

Second paragraph, so the fade has real text to dissolve.

Third paragraph, which should be fully hidden when collapsed.
[[/spicy]]

Ordinary prose after.
```

Author it through the admin chapter editor, or seed it directly — whichever is
faster in this environment.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: serving on `http://localhost:3000`.

- [ ] **Step 3: Screenshot the reader states, as a reader WITH access**

Use the Playwright MCP tools (`browser_navigate`, `browser_click`,
`browser_take_screenshot`). Capture and actually LOOK at each:

1. Chapter loaded — both passages collapsed.
2. The long passage expanded (click `🌶 Show passage`).
3. Re-collapsed (click `🌶 Hide`).

Check: is the fade smooth, does it dissolve into the page rather than ending in
a hard edge, is the button fully visible and not itself faded?

- [ ] **Step 4: Screenshot against custom background colors**

In reader settings, switch to the **Dark** preset (`#17171a`), screenshot the
collapsed passage; then the **Sepia** preset (`#f4ecd8`), screenshot again.

This is the step that would expose a wrong fade: a gradient overlay hardcoded to
one background shows a visible rectangle or color seam here. A correct
`mask-image` shows none. **Do not skip this step** — it is the whole reason the
spec mandates a mask.

- [ ] **Step 5: Judge the short-passage trade-off**

Look at the short passage in the screenshots from Step 3. Expected per the spec:
it renders fully visible but fading, with its last line clipped.

Decide from the image, not from theory:
- Acceptable → leave it, note the decision in the commit message.
- Looks broken → fix it by measuring in `SpicyPassage`: a `useRef` on
  `.spicy-passage-body` plus a `useLayoutEffect` comparing `scrollHeight`
  against the clamp, and render the passage flat (no clamp, no mask, no button)
  when it already fits.

- [ ] **Step 6: Screenshot paginated mode**

Switch the reader to the paginated layout. Screenshot a collapsed passage
mid-column, then expand it and screenshot again. Expected: columns reflow and
following text shifts — that is the documented, accepted trade-off. You are
checking it *reflows sanely*, not that it doesn't move. Flag it only if text is
clipped or lost.

- [ ] **Step 7: Screenshot the unchanged paths (regression check)**

1. As a reader **WITHOUT** access: the same chapter shows
   `🌶 spicy content hidden` blocks, exactly as before, and **no** collapsed
   passages. Confirm via view-source or DevTools that the explicit text is
   **not** in the payload.
2. In the admin editor: the **Full** preview now collapses the passages; the
   **Redacted** preview is unchanged.

- [ ] **Step 8: Commit any CSS fixes from this loop**

If Steps 3-6 produced changes:

```bash
git add app/globals.css components/SpicyPassage.tsx
git commit -m "Tune spicy passage fade after visual review"
```

If nothing needed fixing, skip this step — do not create an empty commit.

---

## Definition of Done

- `npm test` passes; `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.
- A reader with access sees folded passages that expand and re-collapse.
- The fade shows no seam on the Dark and Sepia presets (verified by screenshot).
- A reader without access sees redaction blocks and the explicit text is absent
  from their payload.
- `lib/data.ts` and `components/ChapterEditor.tsx` are unmodified.
