# Webtoon Books Design

**Date:** 2026-07-19  
**Status:** Approved for implementation

## Summary

BeadReader currently supports text books whose chapters are authored and rendered as Markdown. This change adds an optional `webtoon` book format. A webtoon chapter contains an ordered sequence of images that an admin can upload as a folder or multi-file selection and readers consume as one seamless vertical strip.

Text remains the default format. Existing books, existing Supabase-only installations, and the current Vercel deployment path continue to work without Cloudflare credentials. Webtoon creation is enabled only when all required Cloudflare R2 settings are configured.

The artwork is produced outside BeadReader: the admin supplies a completed story to ChatGPT, generates numbered images sequentially, downloads them into a folder, and uploads that folder to the chapter editor. OpenAI API integration is not part of this change.

## Goals

- Let an admin choose `Text` or `Webtoon` once when creating a book.
- Preserve every existing text-book workflow and reader behavior.
- Upload a folder of numbered JPEG, PNG, or WebP images to a webtoon chapter.
- Order selected images naturally by filename, then let the admin preview, reorder, retry, and delete them.
- Optimize images in the browser and upload them directly to R2 so Vercel does not proxy large request bodies.
- Render a webtoon chapter as a responsive, gapless vertical strip with stable scroll restoration.
- Keep R2 optional so a plain Supabase + Vercel installation still deploys and operates normally.
- Preserve chapter publishing, spicy gating, comments, read marks, reading time, progress, contents, and previous/next navigation.

## Non-goals

- Generating images inside BeadReader or requiring an OpenAI API key.
- Mixed text/image books or mixed text/image blocks within a chapter.
- Converting an existing book between formats.
- Speech-bubble editing, dialogue overlays, or other image editing inside BeadReader. Dialogue is baked into the uploaded artwork.
- Scheduling, collaborative editing, or bulk creation of multiple chapters.
- A storage-provider picker in the admin UI. R2 is the first image provider, isolated behind a small server module so another provider can be added later.
- Strong DRM. Authorized readers can always save or screenshot delivered artwork.

## Product Decisions

### Book-level format

`books.format` is either `text` or `webtoon`. It defaults to `text`, which automatically classifies all existing rows as text books. The create-book form shows the format choice. The edit-book form displays the chosen format but does not allow it to be changed.

A text book uses the current Markdown chapter editor and text reader. A webtoon book uses the image chapter editor and vertical image reader. All chapters inherit their parent book's format; chapters do not carry a second format field.

### Recommended artwork

- Target: 1080 × 1920 px, portrait 9:16.
- Other portrait heights are accepted; the uploader preserves aspect ratio.
- Images wider than 1080 px are reduced to 1080 px in the browser.
- Opaque artwork is encoded as JPEG at approximately 85% quality. PNG/WebP remains accepted when conversion is inappropriate.
- Recommended size is under 1.5 MB after optimization; source files may be up to 20 MB each.
- Files should be zero-padded (`001.jpg`, `002.jpg`, …) for predictable folder order.

The reader does not require every image to have identical height. Its only layout contract is a known width and height for each stored image.

## Data Model

Add a migration with:

```sql
alter table public.books
  add column format text not null default 'text'
  check (format in ('text', 'webtoon'));

create table public.chapter_images (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  position integer not null,
  object_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size integer not null check (byte_size > 0),
  created_at timestamptz not null default now(),
  unique (chapter_id, position)
);

create index chapter_images_chapter_idx
  on public.chapter_images(chapter_id, position);

alter table public.chapter_images enable row level security;
```

As with the existing schema, RLS is enabled with no public policies because all database access uses the server-side service-role client.

Application types add:

```ts
type BookFormat = "text" | "webtoon";

interface ChapterImage {
  id: string;
  chapter_id: string;
  position: number;
  object_key: string;
  original_filename: string;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  created_at: string;
}
```

The public image URL is derived from configuration plus `object_key`; it is not duplicated in Postgres.

## Optional R2 Configuration

The server reads these optional environment variables:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
```

`isR2Configured()` returns true only when every value exists. Importing the storage module must not throw when configuration is absent. Client components receive a simple boolean and never receive credentials.

Without complete R2 configuration:

- The app builds and starts normally.
- Existing and newly created text books work normally.
- The create-book form disables the Webtoon option and links to setup instructions.
- Existing webtoon rows show an admin configuration error rather than crashing.
- Reader routes fail safely if a webtoon book cannot resolve its image base URL.

The README and `.env.example` document R2 as optional. The ordinary Vercel deployment instructions retain only the existing required variables. A separate “Enable webtoon publishing” section explains how to create a Standard R2 bucket, configure CORS for the deployed admin origin, expose the bucket through a custom domain, and add the five optional environment variables.

## Storage Module

`lib/webtoon-storage.ts` owns all R2-specific behavior:

- configuration detection;
- S3-compatible R2 client creation;
- server-generated object keys under `webtoons/{bookId}/{chapterId}/{uuid}.{ext}`;
- short-lived presigned PUT URLs;
- HEAD verification before metadata is committed;
- object deletion for image/chapter/book removal; and
- public delivery URL construction.

No other module constructs R2 endpoints or reads R2 secrets. The boundary makes a later home-server adapter possible without changing the chapter data model or reader components.

Object keys contain UUIDs and are not enumerable from the app. The public R2 domain behaves as capability-based delivery: readers who are not allowed to read a chapter are never sent its image records or URLs, while anyone who has obtained a direct URL can retain it. This matches the project's small private-library scope but is not DRM.

## Admin Authoring Flow

### Creating a book

The book form shows a format selector:

- `Text book — Markdown chapters`
- `Webtoon — ordered image chapters`

Text is selected by default. Webtoon is disabled with explanatory copy when R2 is not configured. After creation, the format is read-only.

### Editing a webtoon chapter

The existing chapter title, draft/published status, and whole-chapter spicy toggle remain. Markdown-only controls, inline spicy markers, and Markdown preview are replaced by a focused `WebtoonChapterEditor`.

The editor supports:

- a folder picker using the browser's directory-file input capability;
- a normal multiple-file picker as the cross-browser fallback;
- drag-and-drop of files from Finder/Explorer;
- natural filename ordering (`2` before `10`) on initial selection;
- a recommended zero-padded filename hint;
- a vertical preview with filename, dimensions, optimized size, status, and thumbnail;
- drag-and-drop reordering plus accessible Move up/Move down buttons;
- individual removal;
- retry for failed uploads; and
- adding more images to an existing chapter.

Nested directory paths are flattened into the selected batch. Non-image files are ignored and summarized. Duplicate files are not silently added twice within one selection.

### Browser optimization

Each selected image is decoded with browser image APIs, resized to a maximum width of 1080 px without enlargement, and encoded for delivery. The optimizer records the final width, height, MIME type, and byte size. Processing is bounded to a small queue rather than decoding an entire large folder simultaneously.

Validation rejects:

- formats other than JPEG, PNG, or WebP;
- unreadable/corrupt images;
- zero-sized images;
- source files over 20 MB; and
- a save attempt with no images.

### Upload protocol

1. The authenticated admin asks the server for a presigned upload descriptor for each optimized file.
2. The server generates the object key and a short-lived PUT URL.
3. The browser uploads directly to R2 with visible per-file progress/state.
4. On finalize, the server verifies the uploaded objects and writes ordered `chapter_images` rows.
5. The chapter can be saved as draft after all files either succeed or are removed.
6. The chapter cannot be published while any image is processing, uploading, or failed.

The editor keeps successful images intact when another file fails. Retry requests a fresh signed URL. Removing a stored image deletes its database row and R2 object through an admin-only server action. Chapter and book deletion enumerate their object keys and clean up R2 in addition to the database cascade. Storage cleanup failures are surfaced for retry and must not be silently reported as success.

## Reader Experience

The reading route passes the book format to a small dispatcher:

- `TextReaderView` retains the existing Markdown reader.
- `WebtoonReaderView` owns image-strip rendering.

Keeping the image reader separate prevents image-specific loading and sizing behavior from further complicating the text pagination engine.

The webtoon reader:

- renders images as block elements with `display: block`, no vertical gap, and a centered maximum width of 1080 CSS pixels;
- uses stored width/height as an aspect ratio so space is reserved before downloads complete;
- eagerly loads the first images and lazy-loads later images;
- always uses vertical scrolling;
- restores and records the existing fractional scroll progress;
- retains the top/bottom chrome, contents drawer, chapter count, previous/next navigation, comments, read marks, and reading-time tracking;
- hides pagination and font-size controls that cannot affect baked artwork; and
- keeps background/theme controls that remain meaningful around the strip.

At the end of the strip, the reader sees the existing next-chapter/end-of-book treatment followed by chapter comments. Baked dialogue is part of each image and receives no separate overlay.

Whole-chapter spicy access continues to use the existing readable-chapter query gate. Inline `[[spicy]]` passages apply only to Markdown content and therefore do not appear in the webtoon editor.

## Error Handling

- Missing R2 settings disable webtoon creation without affecting text books.
- Folder processing reports ignored and invalid files together, with per-file reasons.
- Upload failures remain visible and retryable; successful siblings are not discarded.
- A publish attempt with incomplete uploads is blocked with focus moved to the first problem.
- A failed finalize does not falsely mark the image saved.
- R2 delete failures remain actionable and do not display a successful deletion message.
- Reader image failures preserve the reserved space and show a restrained retry control/alt label instead of collapsing the strip.
- Server actions validate book ownership, chapter ownership, format, object-key prefix, image metadata, and admin role; client validation is only a convenience.

## Accessibility and Performance

- Reorder controls are keyboard-accessible and expose current position.
- Upload status is announced through an ARIA live region.
- Every image has alt text derived from chapter title and sequence position; author-provided rich alt text is outside the first scope.
- Images include intrinsic dimensions and appropriate lazy/eager loading.
- Browser optimization and bounded concurrency reduce storage, bandwidth, and memory spikes.
- Reader controls remain buttons/links with visible focus and do not rely solely on drag gestures.

## Testing and Verification

Automated coverage will include:

- natural filename sorting and zero-padding edge cases;
- supported-file validation and corrupt/oversized rejection;
- optional R2 configuration detection without import-time crashes;
- object-key generation and prefix validation;
- image metadata creation, ordering, reordering, and deletion;
- book-format defaults and immutability;
- prevention of webtoon publishing with no images or incomplete uploads;
- readable-chapter/spicy gating behavior; and
- regression coverage for existing text books.

Verification will run:

```text
npm test
npm run lint
npm run build
```

Manual browser verification covers:

1. A deployment without any R2 variables: create/read a text book and confirm webtoon is clearly unavailable.
2. A configured deployment: create a webtoon book, select a numbered folder, inspect natural order, reorder, upload, retry a simulated failure, and publish.
3. Read the chapter on narrow and wide viewports, confirm seamless layout, navigation, comments, read marking, reading time, and scroll resume.
4. Confirm a reader without spicy access cannot discover or open a gated webtoon chapter through the app.
5. Delete an image, chapter, and book and confirm their corresponding R2 objects are removed.

## Story-to-Image Prompt

The recommended ChatGPT workflow uses the following master prompt. Dialogue is baked into the artwork; an image with incorrect dialogue is rejected and regenerated before upload.
Bracketed fields in this prompt are intentional author inputs, not unresolved product requirements.

```text
You are the art director and production assistant for a vertical webtoon.

Your job is to transform the complete prewritten chapter below into a numbered
sequence of consistent webtoon images that can be downloaded into one folder and
batch-uploaded to BeadReader.

Do not rewrite, shorten, or alter the story's meaning, dialogue, character
relationships, or event order.

PRODUCTION WORKFLOW

Stage 1 — Plan only
1. Read the entire chapter before planning any images.
2. Divide it into natural visual beats.
3. Create a numbered production manifest beginning with 001.
4. Do not generate artwork until I approve the manifest.

For every image, provide:
- Filename: 001.jpg, 002.jpg, 003.jpg, etc.
- Story excerpt covered
- Characters present
- Location and time
- Panel-by-panel visual description
- Exact dialogue
- Emotional beat
- Camera/composition notes
- Transition from the previous image
- Transition into the next image

Each image should contain 2–4 vertically arranged panels. Use additional images
instead of overcrowding a segment.

Stage 2 — Generate sequentially
After I approve the manifest, wait for commands such as “Generate 001”.

Generate exactly one image per command. After generating it:
- State its recommended filename.
- Confirm which story beat it covers.
- Update the continuity notes.
- Wait for me to request the next image.

IMAGE SPECIFICATIONS

- Target canvas: 1080 × 1920 pixels, portrait 9:16.
- If that exact size is unavailable, use the tallest portrait format available.
- Keep faces, dialogue, and important action inside the central 85% safe area.
- Use full-bleed artwork to the left and right edges.
- Do not add an outer border, watermark, logo, page number, or card background.
- Make the top and bottom visually suitable for stacking against adjacent images.
- Use clear vertical reading order, generous gutters, and intentional pacing.
- Keep lettering large and readable on a phone.
- Use an opaque background.
- Generate one image only per request.

CONTINUITY RULES

- Keep every character's face, body proportions, hairstyle, clothing, colors,
  accessories, and distinguishing features consistent.
- Follow the supplied character sheets and style references closely.
- Maintain the established linework, rendering, lighting, and color palette.
- Do not invent characters, costume changes, props, or locations.
- Track injuries, carried objects, weather, lighting, and character positions.
- Use the ending composition of one image to inform the beginning of the next.
- When available, use the previously approved image as a continuity reference.

DIALOGUE RULES

- Bake every speech bubble and caption into the generated artwork.
- Reproduce dialogue exactly as written, including spelling and punctuation.
- Never paraphrase, correct, omit, or invent dialogue.
- Make speech bubbles follow the correct reading order.
- Keep bubbles away from faces and important action.
- If any text is wrong or unreadable, treat the image as failed and regenerate it.

QUALITY CHECK BEFORE EACH IMAGE

Verify:
- Correct filename and sequence position
- Correct characters and clothing
- Correct story events and dialogue
- No duplicated characters
- No extra limbs or malformed hands
- No illegible, omitted, or invented text
- No sudden style or palette changes
- No important content against the outer edge
- Natural connection to the previous and next images

PROJECT REFERENCES

Series title:
[SERIES TITLE]

Visual style:
[DESCRIBE THE ART STYLE, LINEWORK, COLORING, LIGHTING, AND MOOD]

Character references:
[PASTE CHARACTER DESCRIPTIONS AND ATTACH REFERENCE SHEETS]

Location references:
[PASTE LOCATION DESCRIPTIONS AND ATTACH REFERENCES]

COMPLETE PREWRITTEN CHAPTER

Chapter number and title:
[CHAPTER NUMBER — TITLE]

[PASTE THE COMPLETE CHAPTER HERE]

Begin with Stage 1 only. Produce the numbered manifest and wait for approval.
```

After approving the manifest, generate each file with:

```text
Generate image 001 from the approved manifest. Use the attached character
references. Follow all output, continuity, dialogue, and image specifications.
Generate exactly one image and label it for download as 001.jpg.
```

The downloaded folder is then ready for the chapter editor:

```text
chapter-01/
  001.jpg
  002.jpg
  003.jpg
```
