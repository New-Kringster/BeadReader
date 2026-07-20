# Spec: Reader Presence, Social Nudges & Comprehensive Reading-Progress Tracker

**Status:** Draft for review — decisions locked (see §3)
**Author:** (drafted with Claude Code)
**Date:** 2026-07-19
**Applies to:** BeadReader (Next.js 16 App Router + Supabase Postgres + Cloudflare R2)

---

## 1. Summary

Add a shared, social layer to BeadReader so the small circle of invited readers can
see each other's activity and lightly interact:

1. **Presence** — who is *online right now*, what book/chapter they're reading, and
   how far along they are. Surfaced in the **library** and inside the **reader**
   (top-bar avatar cluster with a green online dot; a green ring + chapter-number
   badge when someone is in the *same* book as you). **Online/offline only.**
2. **Tap-to-interact (nudges)** — in the reader, tap another reader's avatar to see
   what they're reading and send them a **"bump"** or a **short quick-text**. Both are
   **ephemeral**: they pop up on the recipient's screen, linger a few seconds, then
   fade. Nothing is stored after delivery.
3. **Comprehensive progress tracker** — a stats view every reader can see: time per
   chapter, an **hourly-per-day** reading histogram you can **scroll sideways through
   day by day**, streaks, pace, and per-book history. Reached from a **Stats** entry in
   the library menu, with a click-through detail page per reader.

Built on infrastructure that already exists (`reading_progress`, `chapter_reads`,
`reading_time`, the static `getBookReadersProgress()` "Who's reading" widget). The
progress half is mostly surfacing/aggregation; the new work is a **presence layer**
(no "active now" concept today), **finer-grained capture** (per-chapter time +
hourly-per-day buckets), and a tiny **ephemeral nudge relay**.

---

## 2. Goals & non-goals

### Goals
- See which readers are online and what they're reading, from the library and the reader.
- Reader top bar: avatar cluster, green dot for online; green ring + current-chapter
  badge for readers in the *same* book.
- Tap a reader → see their book/chapter → send a **bump** or **ephemeral quick-text**.
- All-readers-visible stats: per-chapter time, hourly-per-day histogram (day-scrollable),
  streaks, pace, per-book history — clickable into per-reader detail.
- **One telemetry event.** Presence rides the existing ~15 s reading-time flush — no
  second heartbeat timer.
- Preserve the security model: **no client-side DB access**; everything through server
  routes on the service role; RLS stays policy-less.

### Non-goals (v1)
- No "away/idle" amber tier — **online/offline only**.
- No persistent chat / message history — nudges are fire-and-forget and purged on delivery.
- No websockets — polling at the existing ~15 s cadence is snappy enough at this scale.
- No push notifications.
- No admin changes (`getReaderActivity` / `/admin/readers` stay as-is). Admins are
  excluded from the social layer.

---

## 3. Locked decisions (from review)

| # | Decision |
|---|---|
| 1 | Presence is **online/offline only** (no away tier). |
| 2 | Stats use **pre-aggregated rollups**, not a raw event log. |
| 3 | A per-reader **opt-out toggle** lives in reader settings (`share_activity`, default on). |
| 4 | Reading-hours are captured **hourly-per-day**, and the stats UI lets you **scroll sideways through the history, one day at a time**. |
| 5 | **Fold presence into the existing ~15 s reading-time flush** — a single event, kept snappy. No separate heartbeat. |
| 6 | Add **tap-a-reader → bump / quick-text**, ephemeral (appears briefly, then disappears; not saved). |

Scale assumption for budgeting: **~4 readers, ~2 h/day each.**

---

## 4. Feature A — Reader Presence

### 4.1 Definitions
- **Online:** the reader's client flushed a presence beat within the last
  `ONLINE_WINDOW` (proposed **45 s** — 3× the ~15 s flush, tolerant of one dropped
  beat) **and** was engaged at that beat (existing rule: `visibilityState ===
  "visible"` && `document.hasFocus()` && not idle for `IDLE_MS`).
- **Offline:** no fresh beat in `ONLINE_WINDOW`, or last beat had `active=false`.
- No away/idle tier (locked decision #1).
- **Reading X · ch N:** from the reader's presence row (`book_id` + `chapter_id`),
  resolving chapter → 1-based number via the shared ordering helper (§6.3).

### 4.2 Where presence appears
**(a) Library — `app/read/page.tsx`:** an "Online now" strip of avatar chips at the
top (hidden when nobody's online), each showing name + "reading *Title* · ch N".
Book cards get a small "N reading now" stacked-avatar cluster.

**(b) Book contents — `app/read/[bookId]/page.tsx` + `components/BookReadersProgress.tsx`:**
the existing "Who's reading" widget gains a live **green dot** on online readers and
floats them to the top.

**(c) Reader top bar — `components/ReaderView.tsx` (~L343-367) & `components/WebtoonReaderView.tsx` (~L198):**
a **presence cluster** in the `ml-auto` icon group, reusing `reader-icon` sizing and
the initial-avatar style:
- Up to 3 stacked initial-avatars, each with a **green online dot** (bottom-right);
  overflow "+N".
- A reader online **in the same book as you** gets a **green ring** + a **status badge**
  showing their **current chapter number** (green circle with "N").
- Tapping opens the **reader popover** (§5) — the entry point for nudges.

```
   ┌─────────┐
   │  ( A )  │  initial avatar (bg-accent/15 text-accent, rounded-full)
   │       ● │  green dot            = online, different book
   └─────────┘  green ring + "N" dot = online, SAME book, on chapter N
```

### 4.3 Data model (presence)
```sql
-- migration 0005_reader_presence.sql
create table reader_presence (
  user_id      uuid primary key references users(id) on delete cascade,
  book_id      uuid references books(id) on delete set null,
  chapter_id   uuid references chapters(id) on delete set null,
  scroll_fraction real not null default 0,
  is_active    boolean not null default true,
  last_beat_at timestamptz not null default now()
);
create index reader_presence_last_beat_idx on reader_presence (last_beat_at);
-- RLS enabled, no policies (server-only via service role).
```
Dedicated table (not `reading_progress.updated_at`) because progress only writes on
position change; presence needs its own freshness signal.

```ts
// lib/types.ts
export interface ReaderPresence {
  user_id: string; book_id: string | null; chapter_id: string | null;
  scroll_fraction: number; is_active: boolean; last_beat_at: string;
}
export interface PresenceEntry {
  userId: string; name: string; online: boolean;
  bookId: string | null; bookTitle: string | null;
  chapterNumber: number | null; sameBook: boolean; lastBeatAt: string;
}
```

### 4.4 Write path — folded into the reading-time flush (decision #5)
There is **no separate heartbeat**. The existing `flushTime` in `ReaderView` /
`WebtoonReaderView` (every `FLUSH_MS = 15_000`, and on `pagehide`/visibility-hidden)
is extended to carry presence:

- `POST /api/reading-time` payload grows from `{ bookId, seconds }` to
  `{ bookId, chapterId, seconds, scrollFraction, active, hourOfDay, localDay }`.
  (`active` reuses the existing `visible && hasFocus && !idle` computation;
  `hourOfDay`/`localDay` come from the client's local clock — see §7.)
- The route (`app/api/reading-time/route.ts`), after re-auth via `getCurrentUser()`,
  now writes in one call:
  1. `reading_time` (book total) — unchanged.
  2. `chapter_reading_time` (per-chapter total) — new (§7).
  3. `reading_time_hourly` (per day+hour) — new (§7).
  4. **`reader_presence`** upsert with `last_beat_at = now()`, `is_active = active`.
- On `pagehide`/hidden, the final beacon carries `active:false` → the reader drops
  offline within `ONLINE_WINDOW`.
- Readers only; admins never write presence.

> Keeping the ~15 s cadence (not slowing it) keeps presence snappy, as requested. One
> POST does time-tracking **and** presence — no extra request.

### 4.5 Read path — poll
- `GET /api/presence?bookId=<current>` returns `PresenceEntry[]` for non-revoked
  readers with a fresh beat, excluding the viewer, honoring the opt-out (§9) and
  cal-mode/access rules, with `sameBook` computed against `bookId`. **The same
  response also carries any pending nudges for the viewer (§5.3).**
- **Poll cadence: 15 s**, paused when the tab is hidden (`visibilitychange`). Matches
  the write cadence so presence and nudges feel live. At 4 readers this is trivial
  (see §8).
- Library and reader each render an initial server snapshot, then a small client
  component polls to stay fresh.

`lib/data.ts` additions: `getOnlinePresence(viewerId, viewerBookId?)`,
`upsertPresence(...)` (called inside the reading-time write), and a shared
`chapterNumberMap(bookId)` helper factored out of `getBookReadersProgress`.

### 4.6 Edge cases
- Reader on library/TOC (no chapter): beat with `chapterId=null` → "online, browsing"
  (green dot, no badge). A lightweight flush on the library page keeps browsing counted
  as online.
- Multiple tabs: single row per user, last write wins.
- Freshness always computed server-side vs `now()`.
- Cal-mode / explicit chapters the viewer can't see: show book + generic "reading",
  suppress chapter number.
- Stale rows self-expire (filtered by `last_beat_at`); optional cheap sweep on write.

---

## 5. Feature B — Tap-to-interact: bump & ephemeral quick-text (decision #6)

### 5.1 Interaction
1. In the reader, tap the presence cluster (or a specific avatar) → **reader popover**.
2. Popover shows, per online reader: avatar, name, "reading *Title* · ch N", "active now".
3. Two actions on a reader:
   - **Bump** — one tap; sends a canned nudge (e.g. "📚 bumped you").
   - **Quick-text** — a short input (≤ 140 chars, single line); sends once.
4. On the **recipient's** screen (anywhere in the app that polls — reader or library),
   an incoming bump/text appears as a **toast/overlay**:
   - Bump: e.g. "👋 Alice bumped you" — visible ~**5 s**, then fades.
   - Text: e.g. "Alice: this chapter 😭" — visible ~**8 s**, then fades. Tap to dismiss early.
5. **Nothing is persisted after delivery** — no history, no inbox, no "seen at". Sender
   sees only a lightweight "sent ✓".

### 5.2 Data model (transient relay)
Ephemeral still needs a tiny queue to bridge the ≤ 15 s poll gap:
```sql
-- migration 0008_reader_nudges.sql
create table reader_nudges (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id   uuid not null references users(id) on delete cascade,
  kind         text not null check (kind in ('bump','text')),
  body         text,                       -- null for bump; ≤140 chars for text
  created_at   timestamptz not null default now()
);
create index reader_nudges_to_idx on reader_nudges (to_user_id, created_at);
```
- **Delete-on-deliver:** when a poll returns a nudge to its recipient, that row is
  **deleted in the same request**. Undelivered rows older than **60 s** are swept
  (recipient wasn't online / didn't poll — nudge simply expires). Net effect: the table
  holds at most a few seconds of in-flight nudges; `body` never outlives delivery.
- This satisfies "not saved" while still crossing the poll gap. (A pure fire-and-forget
  with zero storage isn't possible without websockets.)

### 5.3 Send & deliver
- **Send:** `POST /api/nudge` `{ toUserId, kind, body? }` → re-auth, validate
  (`kind`, `body` length, recipient is a visible non-revoked reader, not self), insert
  one row. **Rate limit:** max ~1 nudge / 3 s per (sender→recipient); reject spam with 429.
- **Deliver:** folded into `GET /api/presence` — the response gains
  `nudges: { fromName, kind, body }[]` for the viewer; those rows are deleted as they're
  returned. No separate polling loop.
- **Client:** a small `NudgeToaster` (mounted app-wide in the read layout) renders and
  auto-dismisses incoming nudges; the reader popover hosts the send UI.

### 5.4 Privacy / abuse
- You can only bump/text a reader you can currently **see online** (so opt-out /
  invisibility also means un-bumpable).
- Rate-limited; `body` length-capped and treated as plain text (escaped on render).
- No history means no audit trail — acceptable for a 4-person trusted circle; noted as a
  deliberate trade-off. (A future "block" / "do not disturb" flag can extend §9.)

---

## 6. Feature C — Comprehensive progress tracker

### 6.1 From existing data (no new capture)
Overall %/chapters (`chapter_reads`), total time per book & grand total (`reading_time`),
current position (`reading_progress`), books started/finished.

### 6.2 New capture — rollups (decision #2)

**(a) Time per chapter** — `reading_time` is per-book; add per-chapter:
```sql
-- migration 0006_chapter_reading_time.sql
create table chapter_reading_time (
  user_id uuid not null references users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  total_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create index chapter_reading_time_book_idx on chapter_reading_time (book_id);
```

**(b) Hourly-per-day reading (decision #4)** — keyed on day **and** hour so the UI can
scroll day by day. This single table also yields daily totals and streaks, so **no
separate `reading_days` table**:
```sql
-- migration 0007_reading_time_hourly.sql
create table reading_time_hourly (
  user_id uuid not null references users(id) on delete cascade,
  day date not null,                              -- reader-local date
  hour_of_day smallint not null check (hour_of_day between 0 and 23),
  seconds integer not null default 0,
  primary key (user_id, day, hour_of_day)
);
create index reading_time_hourly_user_day_idx on reading_time_hourly (user_id, day);
```
The reading-time flush sends `localDay` + `hourOfDay`; the route increments the matching
`(user_id, day, hour_of_day)` bucket. Rows only exist for hours actually read, so it
stays small (§8). Daily total = `sum(seconds) group by day`; streak = run of consecutive
days present.

**(c) Derived (no tables):** avg time/chapter, est. time-to-finish, fastest/slowest
chapter (from `chapter_reading_time`), last-read timestamp.

> Rollup trade-off (locked #2): tiny + fast + matches the codebase, but not re-sliceable
> (e.g. "hours by book"). Revisit an append-only event log only if arbitrary slicing is
> ever needed.

### 6.3 UI
- **Library menu:** add a **"Stats"** link (`app/read/page.tsx`, beside account).
- **Overview — `app/read/stats/page.tsx`:** per-reader cards (avatar + online dot,
  total time, books in progress/finished, current streak, last read), each linking to
  detail. Reuses `BookReadersProgress` visual language.
- **Detail — `app/read/stats/[userId]/page.tsx`:**
  - Header: totals + streaks + online status.
  - **Time-per-chapter** bars per book (fastest/slowest highlighted).
  - **Hourly-per-day histogram:** a **24-bar day view** with **left/right day
    navigation** (swipe / arrows) to scroll through history one day at a time; a small
    date label + "today/yesterday". Backed by `reading_time_hourly` (one query per day
    range).
  - **Streak / activity calendar** derived from daily sums.
  - **Per-book progress list** with est. time to finish.
  - Respects the opt-out (§9).
- Charts: hand-rolled **CSS/flex bars** (matches existing progress bars; no new dep).

`lib/data.ts`: `getReadingStatsOverview()`, `getReaderStats(userId)`,
`getReaderHourly(userId, dayRange)`.

Shared helper `chapterNumberMap(bookId)` (factored from `getBookReadersProgress`) is used
by presence, the who's-reading widget, and stats so chapter numbering never disagrees.

---

## 7. New/changed surface — file map

| Area | File | Change |
|---|---|---|
| Migration | `supabase/migrations/0005_reader_presence.sql` | new `reader_presence` |
| Migration | `supabase/migrations/0006_chapter_reading_time.sql` | new `chapter_reading_time` |
| Migration | `supabase/migrations/0007_reading_time_hourly.sql` | new `reading_time_hourly` |
| Migration | `supabase/migrations/0008_reader_nudges.sql` | new `reader_nudges` |
| Migration | `supabase/migrations/0009_reader_settings_share.sql` | `reader_settings.share_activity boolean not null default true` |
| Types | `lib/types.ts` | `ReaderPresence`, `PresenceEntry`, nudge + stats types; add `share_activity` to `ReaderSettings` |
| Data layer | `lib/data.ts` | `getOnlinePresence`, `upsertPresence`, `getReadingStatsOverview`, `getReaderStats`, `getReaderHourly`; extend reading-time write (chapter + hourly + presence); `chapterNumberMap` helper |
| API | `app/api/reading-time/route.ts` | extend payload → time + chapter + hourly + presence in one write |
| API | `app/api/presence/route.ts` | new — `GET` presence **+ nudge delivery (delete-on-deliver)** |
| API | `app/api/nudge/route.ts` | new — `POST` send bump/text (rate-limited) |
| Presence UI | `components/PresenceCluster.tsx` | new — reader top-bar cluster + popover + send UI |
| Presence UI | `components/OnlineNowStrip.tsx` | new — library online strip (client poll) |
| Nudge UI | `components/NudgeToaster.tsx` | new — app-wide ephemeral toast (auto-dismiss) |
| Reader | `components/ReaderView.tsx` | extend `flushTime` payload; mount `PresenceCluster` (~L343-367) |
| Reader | `components/WebtoonReaderView.tsx` | same (header ~L198) |
| Layout | read layout (e.g. `app/read/layout.tsx`) | mount `NudgeToaster` + shared presence poll |
| Library | `app/read/page.tsx` | `OnlineNowStrip`; per-card "reading now"; **Stats** link |
| TOC | `app/read/[bookId]/page.tsx` + `components/BookReadersProgress.tsx` | live online dots |
| Chapter route | `app/read/[bookId]/[chapterId]/page.tsx` | pass initial presence snapshot |
| Stats | `app/read/stats/page.tsx`, `app/read/stats/[userId]/page.tsx` | new — overview + detail (day-scroll histogram) |
| Settings | `app/read/account` + `app/api/settings/route.ts` | `share_activity` toggle |

`proxy.ts` unchanged (`/read/:path*` already matched; `/api/*` re-auths itself).

---

## 8. Free-tier budget (Vercel + Supabase)

Scale: **4 readers × 2 h/day × 30 days = 240 reader-hours/month.**

Requests per active reader-hour (folded design, 15 s cadence):

| Source | Rate | Notes |
|---|---|---|
| Reading-time flush = time + chapter + hourly + **presence** | 240/hr | one POST does all |
| Presence poll GET (+ nudge delivery) | 240/hr | 15 s |
| Progress writes (scroll, debounced) | ~100/hr | existing, bursty |
| Nudge sends | ~0 | a handful/day |
| **Total** | **~580/hr** | |

Monthly: 240 × 580 ≈ **139,000 requests/month**.

| Limit (approx, verify current) | Allowance | This design | Headroom |
|---|---|---|---|
| Vercel Edge Requests | ~1,000,000/mo | ~140k (+ page loads) ≈ **~15%** | ✅ |
| Vercel Function Invocations | ~1,000,000/mo | ~140k ≈ **~14%** | ✅ |
| Vercel Fast Data Transfer | 100 GB/mo | JSON only, <1 GB | ✅ |
| Vercel Edge Middleware | ~1,000,000/mo | page loads only (`/api/*` skips middleware) | ✅ |
| Supabase Egress | 5 GB/mo | 139k × ~2 KB ≈ **~0.3 GB** | ✅ |
| Supabase DB size | 500 MB | new tables ≈ KB–low MB (see below) | ✅ |
| Supabase API requests | uncapped | — | ✅ |

**New storage/year (4 readers):** `reading_time_hourly` ≈ 4 × 365 × (few active
hours/day) ≈ low thousands of rows; `chapter_reading_time` ≈ 4 × chapters read;
`reader_presence` = 4 rows; `reader_nudges` ≈ near-zero (delete-on-deliver). **Total:
kilobytes.** Book `content` text remains the only real DB consumer.

> Verdict: comfortably inside every free-tier limit — well under 20% of Vercel's request
> ceilings and a rounding error on Supabase. The 15 s cadence is affordable at 4 users;
> if the circle ever grows, the cheap levers are (a) 15 s → 30 s poll, (b) cache
> `GET /api/presence` ~10 s, (c) pause polling on hidden tabs (already planned).
>
> Note: Vercel Hobby is personal/non-commercial use only, which a private reader satisfies.

---

## 9. Privacy & permissions
- Baseline: trusted invite-only circle → default **share on**.
- **Opt-out toggle** (decision #3): `reader_settings.share_activity` (default `true`),
  surfaced on `app/read/account`. When off, the reader is omitted from presence lists,
  shows as "private" in stats (still sees their own data), and — since others can't see
  them online — **cannot be bumped**.
- Honor `cal_mode` / explicit-access: never leak a chapter title or spicy-chapter
  presence to a viewer who couldn't otherwise see it.
- Nudges: rate-limited, length-capped, plain-text-escaped, purged on delivery, only to
  visible readers. Admins excluded from the whole social layer.

---

## 10. Phasing
1. **Presence core** — migrations `0005`, `0009`; fold presence into reading-time flush;
   `GET /api/presence`; `PresenceCluster` (dot + same-book ring + chapter badge);
   `OnlineNowStrip`; live dots on "Who's reading". *(Ships the top-bar icon + who's-online.)*
2. **Nudges** — migration `0008`; `POST /api/nudge` + delivery via presence poll;
   `NudgeToaster` + send UI in the popover.
3. **Capture** — migrations `0006`, `0007`; extend reading-time write to per-chapter +
   hourly-per-day. *(Fine-grained history "starts now"; per-book totals unaffected.)*
4. **Stats dashboard** — `getReadingStatsOverview` / `getReaderStats` / `getReaderHourly`;
   `/read/stats` overview + `/read/stats/[userId]` detail with the **day-scroll hourly
   histogram**; Stats menu link.
5. **Polish** — opt-out toggle UI, empty states, a11y labels for dots/badges/toasts,
   visibility-pause on polling.

---

## 11. Open questions (remaining)
1. **Bump copy & style** — canned bump wording/emoji, and toast durations (5 s bump /
   8 s text) — fine as proposed, or tune?
2. **History depth** for the day-scroll histogram — scroll back indefinitely, or cap
   (e.g. last 90 days)?
3. **Nudge while offline** — silently expire (current design), or show "delivered when
   they're next online"? (Current: expire, to honor "not saved".)
4. **Avatars** — keep initial-letter avatars, or add optional emoji/photo avatars later?
