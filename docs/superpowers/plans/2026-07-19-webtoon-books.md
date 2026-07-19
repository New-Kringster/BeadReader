# Webtoon Books Implementation Plan

Approved design: `docs/superpowers/specs/2026-07-19-webtoon-books-design.md`.

## 1. Data model and optional R2 client

- Add a Supabase migration that gives `books` an immutable `format` (`text` by default) and creates ordered `chapter_images` metadata with RLS enabled.
- Grant the server-only `service_role` access explicitly so new Supabase projects remain compatible with the 2026 Data API grant behavior.
- Extend TypeScript models and data access with book-format and chapter-image operations.
- Add a lazy Cloudflare R2 client. Importing or building the app must succeed with no R2 variables; webtoon-only operations return a useful configuration error.
- Add deterministic object keys, public URL construction, presigned PUT support, object verification, and cleanup helpers.

## 2. Book format and chapter routing

- Add a `Text book` / `Webtoon` choice only to the new-book form.
- Display the saved format as read-only on an existing book so it cannot be changed after creation.
- Route new/edit chapter screens by the book format. Text books retain the Markdown editor and all current behavior.
- Prevent mismatched server actions and reject publishing a webtoon chapter with no completed images.

## 3. Webtoon authoring and direct upload

- Add a small first-step form that creates a draft webtoon chapter shell, then opens its image editor.
- Build a webtoon editor for title, draft/published status, whole-chapter explicit gating, folder or multi-file selection, natural filename ordering, preview, reorder, retry, and delete.
- Resize images wider than 1080 px and encode upload-ready artwork in the browser when possible.
- Add admin-only route handlers that issue short-lived R2 PUT URLs, verify completed uploads, persist ordered metadata, reorder rows, and delete objects.
- Use per-file XHR upload progress and keep failed items retryable without discarding successful uploads.

## 4. Webtoon reader

- Dispatch from the reading page by `book.format` after the existing published/spicy query gate.
- Render ordered images as a centered, gapless, full-width vertical strip with no font or pagination controls.
- Preserve chapter navigation, contents/read markers, comments, active reading-time tracking, and fractional resume progress.
- Never return image URLs until the current reader is authorized to read the chapter.

## 5. Deletion and lifecycle correctness

- Delete R2 objects when an image, chapter, or webtoon book is deleted, and surface storage cleanup failures.
- Keep database metadata server-only behind the existing custom auth and RLS posture.
- Revalidate affected admin and reader paths after mutations.

## 6. Documentation and optional deployment

- Document the 1080x1920 recommended artwork target, numbered folder convention, baked-in dialogue workflow, and finalized ChatGPT story-to-images prompt.
- Document R2 bucket/CORS/custom-domain setup and the five optional server environment variables.
- Keep the current Vercel button and required environment-variable list unchanged. Explain that text-only publishing works without R2 and that the admin UI disables webtoon creation until R2 is configured.

## 7. Verification

- Add focused tests for natural ordering, configuration detection, object-key safety, and webtoon publication validation where practical.
- Run TypeScript/build, ESLint, and the migration runner's non-database-safe checks.
- Exercise both formats in a local browser: existing text reading, optional-state messaging without R2, webtoon editor behavior, authorization boundaries, and vertical resume/navigation.
- Review the final diff and dependency changes, then commit, push `codex/webtoon-books`, and open a draft pull request.
