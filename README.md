# 📖 BeadReader

A small, private online book reader. An **admin** publishes text books in Markdown
or optional image-based webtoons; **readers** log in with a single access code and read —
with the app remembering exactly where each reader left off. Readers can also see who
else is around, react in the moment, and follow everyone's reading in a shared stats
dashboard.

Built with **Next.js (App Router) + Tailwind CSS v4 + Supabase (Postgres + Storage)**.
Designed for one admin and a handful of readers — not a public product.

---

## 🚀 Deploy your own (one-click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNew-Kringster%2FBeadReader&env=SESSION_SECRET,BOOTSTRAP_ADMIN_CODE&envDescription=SESSION_SECRET%20signs%20the%20login%20cookie%3B%20BOOTSTRAP_ADMIN_CODE%20is%20your%20first%20admin%20login%20code&envLink=https%3A%2F%2Fgithub.com%2FNew-Kringster%2FBeadReader%23environment-variables&project-name=beadreader&repository-name=beadreader&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6)

Clicking the button walks you through the whole thing:

1. **Clone** — Vercel forks this repo into your own GitHub account.
2. **Connect Supabase** — the Vercel↔Supabase integration provisions (or links) a
   Supabase project and injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (plus
   the Postgres connection string) for you — no copy-pasting keys.
3. **Enter two values** when prompted:
   - `SESSION_SECRET` — a long random string that signs the login cookie
      Use this hex generator to generate a random string [Hex Generator](https://codebeautify.org/generate-random-hexadecimal-numbers).
   - `BOOTSTRAP_ADMIN_CODE` — the access code you'll log in with as the first admin.
     Pick something unguessable, e.g. `ADMIN-9F2KQ7XM`.
4. **Deploy** — during the build, [`scripts/setup-db.mjs`](scripts/setup-db.mjs) runs
   the SQL migrations (tables, RLS, the public `covers` bucket) and creates your admin
   from `BOOTSTRAP_ADMIN_CODE`.

When it finishes, open **`/login`**, enter your `BOOTSTRAP_ADMIN_CODE`, and start
adding books and readers. That's the entire setup.

> The DB step runs on every build but is safe to repeat: each migration is applied
> once (tracked in a `schema_migrations` table) and the admin is only created if none
> exists yet. If you deploy **without** the Supabase integration, no Postgres URL is
> present so the step is skipped — set the schema up by hand (see [Manual setup](#1-local-setup)).

---

## Features

- **Access-code auth only.** No passwords, no sign-up. One code = identity + role
  (admin or reader) + explicit-content access. Session persists in a signed cookie.
- **Admin**
  - Book CRUD (title, author, cover image, description, draft/published).
  - Choose an immutable **Text** or **Webtoon** format when a book is created.
  - Markdown chapter editor with **live side-by-side preview**.
  - Optional webtoon editor: select a numbered image folder, preview its natural
    order, upload directly to Cloudflare R2, reorder, retry, and delete images.
  - Reorder / delete chapters; per-chapter **draft/published** and **Explicit ("spicy")** toggle.
  - Reader management: create readers (auto-generates a code to share), copy /
    regenerate / revoke codes, toggle each reader's spicy access or **cal mode**,
    and a per-reader activity view (which book/chapter they're on + total reading time).
  - Inline **`[[spicy]]…[[/spicy]]`** passages within an otherwise-readable chapter,
    with a Full / Preview / Clean preview so you can see exactly what each audience gets.
- **Readers**
  - Library of published books; drafts are invisible.
  - Immersive reading view: adjustable background/text colour, font size, and
    **scroll vs. paginated** layout — all saved per user.
  - Webtoon chapters use a phone-friendly, gapless vertical image strip with the
    same resume, read tracking, comments, spicy gating, and chapter navigation.
  - **Auto-resume**: opening a book jumps straight to the exact chapter and
    scroll/page position last reached.
  - **Contents with read tracking**: the chapter list marks a 🌶 on spicy
    chapters, shows a progress bar on the chapter in progress, and greys out
    every chapter already opened (with a low-key per-chapter "mark unread").
  - **Inline spicy passages** adapt per reader: readers with access get a
    click-to-reveal block (a blurred teaser that expands); readers without access
    get a small locked preview with a request-access note; **cal-mode** readers see
    the book with all spicy content removed — no markers, no previews, no 🌶.
  - **Prev/next chapter** navigation (buttons, an end-of-chapter button, arrow keys)
    and a Contents drawer.
  - **Active reading-time tracking** that pauses when the tab loses focus or goes idle.
- **Reading together (social)**
  - **Presence**: see who's online from the library ("Online now") and inside a book
    (a small avatar cluster at the top of the reader, each with a green dot).
  - **Same-book indicator**: a reader in the exact book you're in gets a green ring and
    a chapter-number status dot, so you can tell a friend is right there with you.
  - **Bump & quick message**: tap the cluster to see who's around and send a 👋 bump or a
    short note. These are ephemeral — they pop up on the other screen for a few seconds
    and then disappear; nothing is saved.
  - **Profile photos**: upload a photo (cropped and compressed in the browser) that shows
    next to your name wherever readers appear.
  - **Privacy**: a per-reader "Share my reading activity" toggle — turn it off to be
    hidden from presence and stats while still seeing everyone else.
  - **Reading-stats dashboard** (`/read/stats`): total time, books finished, streaks, a
    "when do you read" histogram you scroll day by day, and a per-book, per-chapter time
    breakdown — visible for every reader who shares their activity.
- **Speed & offline**
  - A service worker caches covers, artwork and static files on-device (never HTML/API),
    and the reader pre-loads the next chapter, so pages open fast and use less data.
  - **Account → Storage** shows exactly what's cached (covers, artwork by chapter, app
    files, size used, saved preferences) and a **Clear all saved data** button.
- **In-app updates**
  - App version + a **Changelog** link on the login and library pages, a public
    `/changelog`, and a once-per-version **what's-new popup** with per-feature "how to
    use" steps. A refresh prompt appears when a newer build is deployed — sourced from
    the Vercel build, never the database.
- **Explicit-content gate** enforced in the database query itself — gated chapters
  never leave the server for a reader without access (not just hidden with CSS).
- Light/dark app theme with a toggle, plus per-reader reading themes.

---

## How the pieces fit

| Concern | Where |
|---|---|
| DB access (service role, server-only) | [lib/supabase.ts](lib/supabase.ts) |
| Queries + the explicit gate | [lib/data.ts](lib/data.ts) (`listReadableChapters`, `getReadableChapter`) |
| Session cookie (HMAC, edge+node) | [lib/session.ts](lib/session.ts), [lib/auth.ts](lib/auth.ts) |
| Route protection | [proxy.ts](proxy.ts) (cookie check) + `requireAdmin`/`requireUser` in layouts |
| Server actions | [app/actions/](app/actions/) |
| Reader engine | [components/ReaderView.tsx](components/ReaderView.tsx) |
| Presence + nudges (one poll) | [components/PresenceProvider.tsx](components/PresenceProvider.tsx), [app/api/presence/](app/api/presence/), [app/api/nudge/](app/api/nudge/) |
| Reading stats | [app/read/stats/](app/read/stats/) + `getReadingStatsOverview` / `getReaderStats` in [lib/data.ts](lib/data.ts) |
| Version / changelog / update prompt | [lib/version.ts](lib/version.ts), [lib/changelog.ts](lib/changelog.ts), [app/api/version/](app/api/version/), [components/VersionWatcher.tsx](components/VersionWatcher.tsx) |
| On-device asset cache | [public/sw.js](public/sw.js), [components/ServiceWorkerRegister.tsx](components/ServiceWorkerRegister.tsx) |

Because auth is custom (not Supabase Auth), **all database access runs server-side
with the `service_role` key**, which bypasses RLS. Every table has RLS *enabled with
no policies*, so the public/anon key can read nothing directly. The spicy gate lives
in the SQL query, so it can't be bypassed via the raw API response.

---

## 1. Local setup

_(Prefer the [one-click button](#-deploy-your-own-one-click) above? These sections are
the manual path — for local development, or for hand-wiring a deploy.)_

Requires **Node 20+** (Node 24 recommended).

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → your project → **Project Settings → API → Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings → API Keys → `service_role`** (click *Reveal*). Secret — server-side only. |
| `SESSION_SECRET` | Any long random string. Generate with `openssl rand -hex 32`. |
| `BOOTSTRAP_ADMIN_CODE` | *(optional)* the access code for the first admin, used by `npm run bootstrap` and by the one-click deploy's auto-setup. |

The five `R2_*` variables in `.env.example` are optional and are needed only for
webtoon publishing. A deployment with none of them remains a fully functional
text-book reader, and the New Book screen explains why the Webtoon choice is unavailable.

> `.env.local` is git-ignored. Never commit the `service_role` key.
>
> On the [one-click deploy](#-deploy-your-own-one-click), `SUPABASE_URL` and
> `SUPABASE_SERVICE_ROLE_KEY` are injected by the Supabase integration — you only
> supply `SESSION_SECRET` and `BOOTSTRAP_ADMIN_CODE`. The auto-setup uses the
> integration's `POSTGRES_URL_NON_POOLING` / `POSTGRES_URL` to run migrations.

### Database schema

The schema lives in [`supabase/migrations/`](supabase/migrations/). If you are
setting up a **fresh** Supabase project, run that SQL in the Supabase **SQL Editor**
(or via the Supabase CLI). It creates the tables, enables RLS, and creates the
public `covers` storage bucket.

_(If you received this project already wired to a Supabase project, the schema and a
first admin are already in place — skip to step 3.)_

---

## 2. Create the first admin (bootstrapping)

There's no admin until you make one. With `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
(and optionally `BOOTSTRAP_ADMIN_CODE`) set in `.env.local`:

```bash
npm run bootstrap
```

It prints an admin access code. Go to `/login`, enter it, and you're in. From there,
create readers under **Admin → Readers** — each gets its own code to share
out-of-band (text, email, etc.).

---

## 3. Deploy to Vercel

The fastest path is the [one-click button](#-deploy-your-own-one-click) at the top.
To wire it up manually instead:

1. Push this repo to GitHub and **Import** it in Vercel (framework auto-detected as Next.js).
2. In the Vercel project's **Settings → Environment Variables**, add the four
   variables from above (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`,
   and optionally `BOOTSTRAP_ADMIN_CODE`) for the **Production** (and Preview) environments.
3. Deploy. If this is a brand-new database, run `npm run bootstrap` once locally
   (pointed at the same Supabase project) to mint the first admin — or insert an
   admin row directly in the Supabase SQL editor.

> If a Postgres connection string (`POSTGRES_URL_NON_POOLING` / `POSTGRES_URL`) is
> present in the Vercel environment — as it is when you add the Supabase integration —
> the `vercel-build` step auto-applies the migrations and bootstraps the admin, so you
> can skip the manual SQL and step 3.

That's it — no other infrastructure. Cover images are stored in the Supabase
`covers` bucket and served from its public URL.

### Optional: enable webtoon publishing with Cloudflare R2

The ordinary one-click deployment above does **not** require Cloudflare. To add
webtoons later:

1. In Cloudflare, create a Standard R2 bucket and an R2 API token with Object Read
   & Write access for that bucket. Copy the account ID, access key ID, and secret.
2. Attach a custom domain to the bucket. Put its origin (for example,
   `https://images.example.com`) in `R2_PUBLIC_BASE_URL`.
3. Add this CORS policy to the bucket, replacing the example origins with the
   production and preview origins that contain your admin editor:

   ```json
   [
     {
       "AllowedOrigins": ["https://reader.example.com", "http://localhost:3000"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET_NAME`, and `R2_PUBLIC_BASE_URL` to the Vercel project, then redeploy.

Uploads go directly from the signed-in admin browser to R2 using short-lived PUT
URLs. Supabase stores only ordered metadata. Reading uses the R2 custom domain;
the presigned upload URL itself uses Cloudflare's S3-compatible endpoint.

For artwork, use 1080×1920 px portrait images where possible and name a flat
chapter folder `001`, `002`, `003`, and so on. BeadReader preserves natural order,
reduces images wider than 1080 px, and converts uploads to delivery-friendly WebP.
Dialogue must already be baked into each image. The complete story-to-folder
workflow and reusable ChatGPT prompt are in [docs/webtoon-image-prompt.md](docs/webtoon-image-prompt.md).

---

## Notes / edge cases handled

- Revoked or unknown access code → clear error on the login screen; an already
  logged-in reader whose code is revoked is bounced on their next request.
- Empty states for no books, no chapters, and an empty library.
- Draft books/chapters never appear to readers; gated chapters never appear (or
  load) for readers without spicy access, even by direct URL.
- Reader font-size changes don't break resume — position is stored as a fraction
  (scroll) or page number, not raw pixels.

## Useful scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run start      # run the production build
npm run bootstrap  # create/print the first admin access code
npm run db:setup   # apply migrations + bootstrap admin via a Postgres URL
                   # (what vercel-build runs; needs POSTGRES_URL* in the env)
```
