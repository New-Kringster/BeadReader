# Spec: Reader Presence & Comprehensive Reading-Progress Tracker

**Status:** Draft for review
**Author:** (drafted with Claude Code)
**Date:** 2026-07-19
**Applies to:** BeadReader (Next.js 16 App Router + Supabase Postgres + Cloudflare R2)

---

## 1. Summary

Add a shared, social layer to BeadReader so the small circle of invited readers can
see each other's activity:

1. **Presence** — who is *online right now*, what book/chapter they're reading, and
   how far along they are. Surfaced in the **library** and inside the **reader**
   (top-bar avatar cluster with a green online dot; a green ring + chapter-number
   badge when someone is in the *same* book as you).
2. **Comprehensive progress tracker** — a richer, shareable stats view that every
   reader can see: time per chapter, when (which hours) each reader reads, streaks,
   pace, and per-book/aggregate history. Reached from a **Stats** entry in the
   library menu, with a click-through detail page per reader.

This builds directly on infrastructure that already exists:
`reading_progress`, `chapter_reads`, `reading_time`, and the static
`getBookReadersProgress()` "Who's reading" widget. The **progress half is mostly a
surfacing/aggregation task**; the genuinely new work is a **presence layer**
(there is no real-time or "last active" concept today) and **finer-grained capture**
(per-chapter time + reading-hour buckets).

---

## 2. Goals & non-goals

### Goals
- See at a glance which readers are online, and what they're reading, from the
  library and the reader.
- In the reader top bar: an avatar cluster with a green dot for online readers; a
  green ring + current-chapter-number badge for readers in the *same book*.
- A comprehensive, all-readers-visible progress dashboard with per-chapter time,
  reading-hour distribution, streaks, pace, and history — clickable into per-reader
  detail.
- Reuse existing telemetry (the 15 s reading-time flush, the 600 ms progress write,
  the chapter-open mark) rather than adding a parallel pipeline.
- Preserve the app's security model: **no client-side DB access**; everything through
  server routes using the service role; RLS stays policy-less.

### Non-goals (v1)
- No chat / reactions / comments-on-progress (comments already exist separately).
- No push notifications / "X started reading Y" alerts.
- No true bidirectional websockets — polling is sufficient at this scale
  (see §6.1 for rationale and the Realtime alternative).
- No cross-account privacy tiers beyond a single per-reader "share my activity"
  toggle and the existing `cal_mode`/explicit-access rules.
- No admin-only analytics changes (`getReaderActivity` / `/admin/readers` stay as-is).

---

## 3. Current state (what we reuse)

| Concern | Where it lives today |
|---|---|
| Current position (book, chapter, scroll/page) | `reading_progress` (PK `user_id, book_id`), `lib/types.ts:ReadingProgress` |
| Chapters opened (out-of-order read marks) | `chapter_reads` (PK `user_id, chapter_id`), migration `0002` |
| Accumulated **active** seconds per book | `reading_time` (PK `user_id, book_id`) |
| Per-book aggregation of readers' progress | `getBookReadersProgress()` — `lib/data.ts` ~L588 |
| Static "Who's reading" widget | `components/BookReadersProgress.tsx` (initial-letter avatars, progress bar, "on chapter X of Y") |
| Active-seconds ticker + 15 s flush | `components/ReaderView.tsx` ~L117-161 (`FLUSH_MS = 15_000`, `IDLE_MS = 120_000`) |
| Progress write (debounced 600 ms) | `ReaderView` → `POST /api/progress` |
| Chapter-open mark (on mount) | `ReaderView` → `POST /api/read` |
| Reader top bar (icon group) | `components/ReaderView.tsx` ~L343-367 (`ml-auto flex … reader-icon`) |
| Webtoon top bar | `components/WebtoonReaderView.tsx` ~L198-202 |
| Library | `app/read/page.tsx` |
| Book contents / TOC | `app/read/[bookId]/page.tsx` |
| Identity (name only, no avatars) | `users` table; initial-letter avatar pattern in `BookReadersProgress.tsx` |

**Key gaps:** (1) nothing records that a reader is *currently* active — `updated_at`
is the closest proxy; (2) time is aggregated per-book only, not per-chapter;
(3) no record of *when* (hour of day) reading happened.

---

## 4. Feature A — Reader Presence

### 4.1 Concept & definitions

- **Online / active now:** a reader whose client has sent a heartbeat within the
  last `ONLINE_WINDOW` (proposed **90 s**). The reader must be actively engaged
  (same rule as the existing ticker: `visibilityState === "visible"` **and**
  `document.hasFocus()` **and** not idle for `IDLE_MS`).
- **Idle (soft-away):** heartbeat within `AWAY_WINDOW` (proposed **5 min**) but not
  the online window — shown as an amber dot, "away". *(Optional in v1; can ship as
  online/offline only and add amber later.)*
- **Offline:** no heartbeat within `AWAY_WINDOW`.
- **Reading X:** the reader's most recent presence row names `book_id` +
  `chapter_id`; we resolve chapter → 1-based chapter number in book order (reuse the
  `numberById` map logic from `getBookReadersProgress`).

### 4.2 Where presence appears

**(a) Library — `app/read/page.tsx`**
- A compact **"Online now" strip** at the top of the library: avatar chips of
  currently-online readers, each showing name + "reading *Title* · ch N" on hover /
  under the avatar. Empty state hidden entirely when nobody is online.
- On each **book card**, a small stacked-avatar cluster ("2 reading now") for readers
  currently in that book, so you can see activity per book at a glance.

**(b) Book contents page — `app/read/[bookId]/page.tsx`**
- Upgrade the existing `BookReadersProgress` "Who's reading" widget: readers online
  in this book get a **green dot** on their avatar and a live "on chapter N now"
  label. (This widget already renders avatars + chapter number — presence just adds
  the live dot and reorders online readers to the top.)

**(c) Reader top bar — `components/ReaderView.tsx` and `components/WebtoonReaderView.tsx`**
- A new **presence cluster** dropped into the `ml-auto` icon group (before the
  Contents/Comments/Settings icons), reusing the `reader-icon` sizing and the
  initial-avatar style:
  - **Any reader online (anywhere):** show up to 3 stacked initial-avatars, each with
    a **green online dot** (bottom-right). Overflow shows "+N".
  - **Reader online in the *same book* as you:** that avatar gets a **green ring**
    around it, plus a small **status badge** (bottom-right, replacing/【combined with】
    the green dot) showing their **current chapter number** (e.g. a green circle with
    "12"). This is the "they're right here with you" signal you asked for.
  - Tapping the cluster opens a small popover listing online readers: avatar, name,
    "reading *Title* · ch N", and a relative "· active now / 2m ago".

**Visual spec for the same-book avatar (reader top bar):**

```
   ┌─────────┐
   │  ( A )  │  ← initial avatar, bg-accent/15 text-accent, rounded-full
   │       ● │  ← status dot: green circle, bottom-right
   └─────────┘     · plain green dot        = online, different book
     green ring     · green ring + "N" dot  = online, SAME book, on chapter N
```

- Both the text reader and webtoon reader get the same cluster for parity
  (webtoon header is `WebtoonReaderView.tsx` ~L198).

### 4.3 Data model (presence)

Add a single presence table. One row per reader (their *latest* live location), so
presence lookups are cheap and self-cleaning (a stale row simply reads as offline).

```sql
-- migration 0005_reader_presence.sql
create table reader_presence (
  user_id      uuid primary key references users(id) on delete cascade,
  book_id      uuid references books(id) on delete set null,
  chapter_id   uuid references chapters(id) on delete set null,
  scroll_fraction real not null default 0,
  is_active    boolean not null default true,   -- engaged vs. soft-away at last beat
  last_beat_at timestamptz not null default now()
);
create index reader_presence_last_beat_idx on reader_presence (last_beat_at);
-- RLS stays enabled with no policies (server-only access via service role).
```

Rationale for a dedicated table (vs. reusing `reading_progress.updated_at`):
`reading_progress` only updates when the position changes (debounced 600 ms on
scroll), so a reader sitting still on one page would look "offline" within seconds.
Presence needs its own heartbeat cadence independent of position changes.

`lib/types.ts` addition:

```ts
export interface ReaderPresence {
  user_id: string;
  book_id: string | null;
  chapter_id: string | null;
  scroll_fraction: number;
  is_active: boolean;
  last_beat_at: string;
}

// Derived, for UI:
export interface PresenceEntry {
  userId: string;
  name: string;
  status: "online" | "away" | "offline";
  bookId: string | null;
  bookTitle: string | null;
  chapterNumber: number | null;   // 1-based, in book order
  sameBook: boolean;              // set relative to the viewer's current book
  lastBeatAt: string;
}
```

### 4.4 Heartbeat (client → server)

Piggyback on the existing engagement ticker in `ReaderView`/`WebtoonReaderView`
rather than adding a new timer:

- **Cadence:** send a heartbeat every `HEARTBEAT_MS` (proposed **30 s**) *and*
  immediately on chapter change. Reuse the existing `active` computation
  (`visible && hasFocus && !idle`) to set `is_active`.
- **Transport:** `POST /api/presence` with
  `{ bookId, chapterId, scrollFraction, active }`. On `pagehide`/`visibilitychange →
  hidden`, send a final beacon with `active:false` (via `navigator.sendBeacon`,
  mirroring `flushTime(true)`), so the reader drops offline promptly.
- **Server:** `app/api/presence/route.ts` re-auths with `getCurrentUser()` (same as
  the other telemetry routes) and upserts the caller's `reader_presence` row with
  `last_beat_at = now()`. Reader role only; admins excluded from presence (consistent
  with `getBookReadersProgress`).

New endpoint: `app/api/presence/route.ts`
- `POST` → upsert own heartbeat (above).
- `GET` → return presence for the viewer. Query params: optional `bookId` (the
  book the viewer is currently in, to compute `sameBook`). Returns
  `PresenceEntry[]` for all non-revoked readers whose `last_beat_at` is within
  `AWAY_WINDOW`, excluding the viewer, honoring the share toggle (§8) and
  `cal_mode`/access visibility rules. This is the endpoint the library and reader
  poll.

### 4.5 Fetching presence (server → client)

Polling, not sockets (see §6.1):

- **Library (`app/read/page.tsx`):** server-render the initial "online now" strip
  from a new `getOnlinePresence(viewerId)` in `lib/data.ts`, then a small client
  component polls `GET /api/presence` every `POLL_MS` (proposed **20 s**) to keep it
  fresh. Poll pauses when the tab is hidden (`visibilitychange`) to save requests.
- **Reader:** the chapter route (`app/read/[bookId]/[chapterId]/page.tsx`) passes an
  initial presence snapshot as a prop; the top-bar cluster client component polls
  `GET /api/presence?bookId=<current>` on the same cadence and recomputes
  `sameBook` / chapter badges.

`lib/data.ts` additions:
- `getOnlinePresence(viewerId, viewerBookId?)` → `PresenceEntry[]` — joins
  `reader_presence` (fresh rows) with `users`, resolves chapter → number using the
  same per-book ordering used in `getBookReadersProgress`, sets `sameBook`.
- Reuse existing chapter-ordering helper (factor `numberById` out of
  `getBookReadersProgress` into a small shared helper to avoid duplication).

### 4.6 Edge cases
- **Reader on the library/TOC page (not in a chapter):** heartbeat with
  `chapterId = null` → shown as "online, browsing" (green dot, no chapter badge).
  *(Optional: add a lightweight heartbeat to the library client too, so browsing
  counts as online. v1 may treat only in-reader as online.)*
- **Multiple tabs:** last write wins (single row per user); harmless.
- **Clock skew:** freshness computed server-side against `now()`, never client time.
- **Cal-mode / explicit-access chapters:** if a reader is in a chapter the viewer
  can't see, show book + generic "reading" but suppress the chapter number.
- **Admins:** never appear in presence lists (readers-only social layer).
- **Stale rows:** no cron needed — rows outside `AWAY_WINDOW` are simply filtered
  out. (Optional housekeeping: a `delete from reader_presence where last_beat_at <
  now() - interval '1 day'` on write, cheap and bounded.)

---

## 5. Feature B — Comprehensive Reading-Progress Tracker

An all-readers-visible dashboard, reachable from a **Stats** item in the library
menu, with a per-reader detail page.

### 5.1 Stats we can show from existing data (no new capture)
- **Overall progress per book:** chapters read / total, % — from `chapter_reads`
  (already in `getBookReadersProgress`).
- **Total time per book & grand total:** from `reading_time`.
- **Current position / "on chapter N":** from `reading_progress`.
- **Books started / finished, leaderboard-style ordering:** derived.

### 5.2 Stats needing finer capture (new)

**(a) Time per chapter.** Today `reading_time` is per **book**. Add per-chapter
accumulation:

```sql
-- migration 0006_chapter_reading_time.sql
create table chapter_reading_time (
  user_id     uuid not null references users(id) on delete cascade,
  chapter_id  uuid not null references chapters(id) on delete cascade,
  book_id     uuid not null references books(id) on delete cascade,
  total_seconds integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create index chapter_reading_time_book_idx on chapter_reading_time (book_id);
```

The reader already knows its current `chapterId`; extend the `flushTime` payload to
`POST /api/reading-time` with `{ bookId, chapterId, seconds }` and have the route
increment **both** `reading_time` (book total, unchanged) **and**
`chapter_reading_time`. No new client timer — the existing active-seconds ticker
already produces the number.

**(b) Reading-hour distribution ("what hours you were reading at").** Bucket active
seconds by hour-of-day. To keep it timezone-honest and cheap to query, accumulate
into per-hour-of-week (or per-hour-of-day) buckets:

```sql
-- migration 0007_reading_time_by_hour.sql
create table reading_time_by_hour (
  user_id      uuid not null references users(id) on delete cascade,
  hour_of_day  smallint not null check (hour_of_day between 0 and 23),
  total_seconds integer not null default 0,
  primary key (user_id, hour_of_day)
);
```

Client sends its local `hourOfDay` (0-23) alongside the reading-time flush; the route
increments the matching bucket. This yields a 24-bar "when I read" histogram per
reader without storing a raw event log. *(If we later want day-of-week too, widen the
PK to `(user_id, dow, hour_of_day)`.)*

**(c) Streaks & "days active".** Cheapest robust approach: a per-day activity table
keyed on the reader's local date, upserted on any reading-time flush:

```sql
-- migration 0008_reading_days.sql
create table reading_days (
  user_id    uuid not null references users(id) on delete cascade,
  day        date not null,          -- reader-local date
  seconds    integer not null default 0,
  primary key (user_id, day)
);
```

Current streak, longest streak, and a GitHub-style activity heatmap all derive from
this. (Alternative: derive days from a raw session log, but per-day rollup is smaller
and matches how the rest of the app aggregates.)

**(d) Pace / derived metrics (no new tables):**
- **Avg time per chapter** = `reading_time.total_seconds` / chapters read.
- **Est. time to finish** = avg time/chapter × chapters remaining.
- **Fastest/slowest chapter** = from `chapter_reading_time`.
- **Last read** = `max(reading_progress.updated_at, reading_time.updated_at)`.

> **Trade-off note.** (a)-(c) use pre-aggregated rollups instead of a raw
> `reading_events` log. Rollups are tiny, fast to read, and match the app's existing
> pattern — but they can't be re-sliced later (e.g. "reading by hour *per book*")
> without adding a dimension. If future flexibility matters more than simplicity, a
> single append-only `reading_events(user_id, book_id, chapter_id, seconds, at)` log
> could back **all** of (a)-(c) via query-time aggregation at the cost of table
> growth + heavier queries. **Recommendation: ship rollups for v1**, revisit an event
> log only if we need arbitrary slicing.

### 5.3 UI

**Library menu entry.** Add a **"Stats" / "Reading activity"** link in the library
(`app/read/page.tsx` header/menu, alongside the account link). Opens a new route.

**Overview page — `app/read/stats/page.tsx` (server component):**
- **Reader leaderboard / cards:** one card per reader — avatar (online dot if
  present), total time, books in progress/finished, current streak, "last read".
  Sorted by recent activity or total time (toggle).
- **This week strip:** aggregate hours read across all readers, simple bars.
- Each card is a `<Link>` into the detail page. Reuses `BookReadersProgress` visual
  language for consistency.

**Per-reader detail — `app/read/stats/[userId]/page.tsx`:**
- Header: avatar, name, online status, totals (time, chapters, books, streaks).
- **Time-per-chapter:** per-book breakdown, horizontal bars (from
  `chapter_reading_time`), with fastest/slowest highlighted.
- **Reading-hours histogram:** 24-bar chart (from `reading_time_by_hour`) — "reads
  mostly at 11pm-1am".
- **Activity heatmap / streak calendar:** from `reading_days`.
- **Per-book progress list:** % complete, chapters read/total, current chapter, time,
  est. time to finish.
- Respects the share toggle (§8): a reader who's opted out shows only what they've
  chosen to share (default: everything, since this is a trusted private circle).

`lib/data.ts` additions (aggregation queries, all server-side / service role):
- `getReadingStatsOverview()` → per-reader summary rows for the overview.
- `getReaderStats(userId)` → full detail bundle (chapter times, hour buckets,
  reading days, per-book progress) for the detail page.

Charts: start with **CSS/flex bar charts** (no new dependency, matches the existing
hand-rolled progress bars in `BookReadersProgress`). Only pull in a charting lib if
the heatmap/histograms outgrow simple bars.

---

## 6. Technical decisions

### 6.1 Presence transport: polling vs. Supabase Realtime — **recommend polling**
- **Polling (recommended):** heartbeat `POST` + `GET /api/presence` every ~20 s, tab
  paused when hidden. Fits the app's **server-only** Supabase model perfectly (no
  client DB access, service role stays server-side, RLS stays policy-less). Trivial
  to reason about, cache, and rate-limit. At this user scale (a handful of readers)
  the request volume is negligible.
- **Supabase Realtime presence (alternative):** lower latency and no polling, but the
  client lib is currently used **server-side only**; enabling Realtime means exposing
  an anon/authenticated channel to the browser and reconciling it with the custom
  HMAC-cookie auth (not Supabase Auth) and the policy-less RLS. That's a meaningful
  security/architecture change for marginal benefit here.
- **Decision:** polling for v1. Keep the presence read path behind one endpoint so we
  can swap to Realtime later without touching UI.

### 6.2 Reuse, don't duplicate, telemetry
- Heartbeat rides the existing engagement ticker; per-chapter time and hour buckets
  ride the existing `flushTime` payload. Net new client timers: **one** (the 30 s
  heartbeat, and even that can share the ticker's `setInterval`).

### 6.3 Consistency & correctness
- All freshness/threshold math is **server-side** against `now()`.
- Chapter→number resolution reuses one shared helper (factored out of
  `getBookReadersProgress`) so presence, the "who's reading" widget, and stats never
  disagree on chapter numbering.
- Presence and stats are **readers-only**; admins excluded everywhere for parity with
  today's behavior.

---

## 7. New/changed surface — file map

| Area | File | Change |
|---|---|---|
| Migration | `supabase/migrations/0005_reader_presence.sql` | new `reader_presence` |
| Migration | `supabase/migrations/0006_chapter_reading_time.sql` | new `chapter_reading_time` |
| Migration | `supabase/migrations/0007_reading_time_by_hour.sql` | new `reading_time_by_hour` |
| Migration | `supabase/migrations/0008_reading_days.sql` | new `reading_days` |
| Types | `lib/types.ts` | `ReaderPresence`, `PresenceEntry`, stats types |
| Data layer | `lib/data.ts` | `getOnlinePresence`, `upsertPresence`, `getReadingStatsOverview`, `getReaderStats`; extend reading-time write to per-chapter + hour + day; factor out `numberById` helper |
| API | `app/api/presence/route.ts` | new — `POST` heartbeat, `GET` presence |
| API | `app/api/reading-time/route.ts` | extend payload → also write chapter/hour/day |
| Presence UI | `components/PresenceCluster.tsx` | new — reader top-bar avatar cluster + popover |
| Presence UI | `components/OnlineNowStrip.tsx` | new — library online strip (client poll) |
| Reader | `components/ReaderView.tsx` | add heartbeat; mount `PresenceCluster` in `ml-auto` group (~L343-367) |
| Reader | `components/WebtoonReaderView.tsx` | same (header ~L198) |
| Library | `app/read/page.tsx` | render `OnlineNowStrip`; per-card "reading now"; add **Stats** menu link |
| TOC | `app/read/[bookId]/page.tsx` + `components/BookReadersProgress.tsx` | add live online dots to "Who's reading" |
| Chapter route | `app/read/[bookId]/[chapterId]/page.tsx` | pass initial presence snapshot to reader |
| Stats | `app/read/stats/page.tsx` | new — overview |
| Stats | `app/read/stats/[userId]/page.tsx` | new — per-reader detail |
| Middleware | `proxy.ts` | no change (`/read/:path*` already matched; `/api/*` re-auths itself) |

---

## 8. Privacy & permissions
- **Trusted private circle** is the baseline assumption (invite-only reader group), so
  default is **share everything with other readers**.
- Add one per-reader **"Show my reading activity to others"** toggle (default on) in
  `reader_settings` (`share_activity boolean not null default true`) surfaced on
  `app/read/account`. When off: the reader is omitted from presence lists and shows as
  "private" in stats (their own view still shows their data).
- Honor existing `cal_mode`/explicit-access visibility: never leak a chapter title or
  spicy-chapter presence to a viewer who couldn't otherwise see it (see §4.6).
- Admins are excluded from the social layer entirely.

---

## 9. Phasing

**Milestone 1 — Presence core**
- Migration `0005`; `POST/GET /api/presence`; heartbeat in `ReaderView` +
  `WebtoonReaderView`; `PresenceCluster` (green dot + same-book ring + chapter badge);
  `OnlineNowStrip` in library; live dots on "Who's reading". *Ships the top-bar icon
  and "who's online" experience.*

**Milestone 2 — Finer capture**
- Migrations `0006`-`0008`; extend reading-time write to per-chapter + hour + day.
  *(Backfill: existing per-book totals stay; per-chapter/hour/day accrue from launch —
  note in UI that fine-grained history "starts now".)*

**Milestone 3 — Stats dashboard**
- `getReadingStatsOverview` / `getReaderStats`; `/read/stats` overview +
  `/read/stats/[userId]` detail; Stats menu link; CSS bar charts, hour histogram,
  streak heatmap.

**Milestone 4 — Polish**
- Away/idle amber state; share-activity toggle; per-card "reading now" on library;
  poll-pause on hidden tab; empty states; a11y (labels for dots/badges).

---

## 10. Open questions
1. **Away state in v1?** Ship online/offline only, or include the amber "away" tier
   from the start? (Recommend: online/offline for M1, amber in M4.)
2. **Count library browsing as "online"?** Requires a lightweight heartbeat on the
   library page too. (Recommend: yes, small, do it in M1.)
3. **Rollups vs. raw event log** for stats (§5.2 trade-off) — confirm rollups are
   acceptable (recommended) vs. wanting a re-sliceable `reading_events` log.
4. **Default privacy** — confirm "share everything by default" matches your intent for
   this circle, with an opt-out toggle.
5. **Hour histogram granularity** — hour-of-day only, or hour × day-of-week?
6. **Avatars** — stick with initial-letter avatars (current pattern), or add optional
   uploaded/emoji avatars as a follow-up?

---

## 11. Rough estimate (relative)
- **M1 Presence:** ~1 migration, 1 endpoint, 2 client components, ticker edits, 3
  surfaces. Small-to-medium.
- **M2 Capture:** 3 tiny migrations + one route extension. Small.
- **M3 Stats:** 2 aggregation queries + 2 pages + charts. Medium.
- **M4 Polish:** small, incremental.

The heavy lifting is UI; the data model is a light extension of what already exists.
