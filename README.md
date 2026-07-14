# 📖 BeadReader

A small, private online book reader. An **admin** publishes books and chapters
(written in Markdown); **readers** log in with a single access code and read —
with the app remembering exactly where each reader left off.

Built with **Next.js (App Router) + Tailwind CSS v4 + Supabase (Postgres + Storage)**.
Designed for one admin and a handful of readers — not a public product.

---

## Features

- **Access-code auth only.** No passwords, no sign-up. One code = identity + role
  (admin or reader) + explicit-content access. Session persists in a signed cookie.
- **Admin**
  - Book CRUD (title, author, cover image, description, draft/published).
  - Markdown chapter editor with **live side-by-side preview**.
  - Reorder / delete chapters; per-chapter **draft/published** and **Explicit ("spicy")** toggle.
  - Reader management: create readers (auto-generates a code to share), copy /
    regenerate / revoke codes, toggle each reader's spicy access, and a per-reader
    activity view (which book/chapter they're on + total reading time).
- **Readers**
  - Library of published books; drafts are invisible.
  - Immersive reading view: adjustable background/text colour, font size, and
    **scroll vs. paginated** layout — all saved per user.
  - **Auto-resume**: opening a book jumps straight to the exact chapter and
    scroll/page position last reached.
  - **Prev/next chapter** navigation (buttons, an end-of-chapter button, arrow keys)
    and a Contents drawer.
  - **Active reading-time tracking** that pauses when the tab loses focus or goes idle.
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

Because auth is custom (not Supabase Auth), **all database access runs server-side
with the `service_role` key**, which bypasses RLS. Every table has RLS *enabled with
no policies*, so the public/anon key can read nothing directly. The spicy gate lives
in the SQL query, so it can't be bypassed via the raw API response.

---

## 1. Local setup

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
| `BOOTSTRAP_ADMIN_CODE` | *(optional)* the access code for the first admin, used by `npm run bootstrap`. |

> `.env.local` is git-ignored. Never commit the `service_role` key.

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

1. Push this repo to GitHub and **Import** it in Vercel (framework auto-detected as Next.js).
2. In the Vercel project's **Settings → Environment Variables**, add the same four
   variables as above (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`,
   and optionally `BOOTSTRAP_ADMIN_CODE`) for the **Production** (and Preview) environments.
3. Deploy. If this is a brand-new database, run `npm run bootstrap` once locally
   (pointed at the same Supabase project) to mint the first admin — or insert an
   admin row directly in the Supabase SQL editor.

That's it — no other infrastructure. Cover images are stored in the Supabase
`covers` bucket and served from its public URL.

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
```
