# Webtoon Demo Book Design

## Goal

Create a real image-based sample book that the owner can inspect and read on the
webtoon pull request preview without exposing an incompatible book to the current
production reader. The preview and production deployments share one Supabase
project, so isolation must be enforced through draft status and admin-only routes.

## Sample Content

The sample is a draft book titled **Webtoon Playground**, with one draft chapter
titled **Four Strange Stops**. It contains four unrelated, playful vertical
illustrations so ordering, responsive scaling, seamless stacking, and scroll
restoration are easy to inspect without depending on character continuity.

Each image is generated separately with the built-in image-generation tool, then
prepared to match the publishing guidance already documented for BeadReader:

- final canvas 1080 × 1920 px, portrait 9:16;
- if the generated portrait has another aspect ratio, crop it to 9:16 without
  stretching, keeping the main subject inside the central safe area, then resize;
- no speech bubbles, captions, logos, watermarks, borders, or page numbers;
- full-bleed composition with important content inside the central safe area;
- opaque artwork suitable for conversion to WebP;
- filenames `001.webp` through `004.webp` after local preparation.

The first image is also used as the book cover. The sample has no explicit-content
gate and remains a draft until the webtoon feature is merged and the owner chooses
to publish it.

## Admin-Only Draft Preview

Add a protected route at:

```text
/admin/books/{bookId}/chapters/{chapterId}/preview
```

The route runs under the existing admin layout and `requireAdmin` protection. It
loads the book, the requested chapter, all of the book's chapters, image metadata,
reader settings, progress, and read markers directly through the server-only data
layer. It does not require the book or chapter to be published because only an
admin can reach it.

The existing webtoon editor receives a **Preview chapter** link when at least one
image exists. `WebtoonReaderView` gains a small navigation-mode prop so its back,
contents, previous, and next links stay inside admin preview routes. Public reader
URLs retain their current default behavior.

The preview continues to exercise the real webtoon reader, including vertical
stacking, fractional progress, active reading time, read tracking, comments, and
chapter navigation. No public query or authorization gate is weakened.

## Storage and Data Flow

1. Apply the already-reviewed `0004_webtoon_books.sql` migration to the connected
   Supabase project and verify `books.format` plus `chapter_images` exist with RLS.
2. Confirm or configure the five R2 variables for the Vercel preview environment.
   R2 remains optional for production and text-only deployments.
3. Generate four images, validate their dimensions/content, and prepare WebP files.
4. Upload objects under
   `webtoons/{bookId}/{chapterId}/{uuid}.webp` using the configured R2 path.
5. Insert one draft `books` row, one draft `chapters` row, and four ordered
   `chapter_images` rows. Use generated UUIDs and never hardcode foreign keys in a
   migration.
6. Derive delivery URLs from `R2_PUBLIC_BASE_URL`; do not store secrets or public
   URLs in Supabase.

Live seed data is created through direct, narrowly scoped operations after the
schema and storage are verified. It is not committed as a migration, so new
deployments do not receive an unwanted demo book.

## Safety and Failure Handling

- The book and chapter remain `draft`, so the current production library never
  lists them.
- Apply only the backward-compatible migration already present in PR #9.
- Do not expose or commit Supabase service keys, R2 credentials, access codes, or
  generated presigned URLs.
- If image generation or upload partially fails, keep successful local files,
  delete any unreferenced R2 objects, and insert metadata only after all four
  objects are verified.
- If database insertion fails after upload, remove the uploaded R2 objects.
- Do not modify the existing production book or reader accounts.
- Record the created book/chapter IDs during verification so the sample can be
  removed cleanly later.

## Verification

1. Run changed-file ESLint and a production Next.js build.
2. Confirm the pull request preview deployment is ready.
3. Confirm the sample does not appear on the production library because its book
   status is draft.
4. Open the admin preview and verify all four images render in order with no gaps.
5. Scroll, reload, and confirm fractional progress restoration.
6. Verify the back link and contents drawer remain inside admin routes.
7. Confirm a logged-out request to the admin preview redirects to login.
8. Query Supabase to verify exactly one sample book, one sample chapter, and four
   ordered image rows.

## Cleanup

Deleting the sample through the admin UI removes its R2 objects before deleting
the database rows. If manual cleanup is needed, delete the four recorded object
keys first, then delete the sample book row; chapter and image metadata cascade.
