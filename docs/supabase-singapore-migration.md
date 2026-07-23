# Moving the Supabase database to Singapore (`ap-southeast-1`)

Supabase has **no in-place region change**. Relocating means standing up a new
project in Singapore, replaying the schema, copying the data, moving the storage
objects, and repointing the app. This runbook captures everything needed to do
that for BeadReader, based on a survey of the live project.

## Current state (surveyed 2026-07-23)

- **Source project**: `beadreader` — ref `trhrppqbrbawxinhvmtf`, region `us-east-1`,
  org `Chiambucket` (`eujrnpvcharcytyhxtlx`), Postgres 17.
- **Target region**: `ap-southeast-1` (Singapore).
- **No Supabase Auth in use** — `auth.users` and `auth.identities` are empty. The
  app uses custom access-code auth via the `service_role` key, so there are no
  auth users, passwords, or identities to migrate.
- **Schema** is fully described by `supabase/migrations/0001`–`0010`. (The live
  migration *names* differ from the repo filenames — early migrations were
  squashed in the tracking table — but replaying the repo files reproduces the
  same objects.)
- **Data is small** (snapshot; will drift):

  | table                     | rows |
  |---------------------------|-----:|
  | users                     |    4 |
  | books                     |    3 |
  | chapters                  |  169 |
  | chapter_images (metadata) |   36 |
  | comments                  |   20 |
  | reading_progress          |   11 |
  | user_avatars              |    1 |
  | + small stats tables      |  ... |

  `chapter_images` holds only metadata; the image bytes live in **Cloudflare R2**,
  which is region-independent and needs no migration.
- **Storage**: one bucket `covers` with **3 objects** (~600 KB total). The public
  URLs are referenced in `books.cover_url` and point at the source project's
  domain, so both the bytes and the URLs must be updated.

## Blocker to clear first

The org is on the **free plan (max 2 active free projects)** and both slots are
full (`beadreader`, `my-thank-you-note`). Free one slot before starting, by
**either**:
- Pausing/deleting `my-thank-you-note` (takes that app offline / destroys it), **or**
- Upgrading `Chiambucket` to Pro (lifts the cap, ~$25/mo).

The source `beadreader` must stay **alive** throughout — it's the copy source — so
it can't be the slot you free. Decommission it only at cutover (step 7).

## Migration steps

### 1. Create the Singapore project
Create a project named `beadreader-sg` in `ap-southeast-1`, org `Chiambucket`.
Wait for status `ACTIVE_HEALTHY`. Note its ref (call it `NEWREF`).

### 2. Replay the schema
Apply `supabase/migrations/0001`–`0010` to `NEWREF` in order. This recreates all
tables, triggers (`set_updated_at`, `prevent_book_format_change`), indexes, RLS
(enabled, no policies), the `service_role` grants, and the `covers` storage bucket.

### 3. Copy table data (respect FK order)
For each table: read from source as JSON, insert into target. A robust technique
that preserves types and column mapping:

```sql
-- on SOURCE:
SELECT json_agg(t) FROM public.<table> t;
-- on TARGET (NEWREF):
INSERT INTO public.<table>
SELECT * FROM json_populate_recordset(NULL::public.<table>, $json$ <paste> $json$);
```

Order (parents first):
`users` → `books` → `chapters` → `chapter_images` → `comments` →
`reading_progress` → `reader_settings` → `reading_time` → `chapter_reads` →
`reader_presence` → `reader_nudges` → `user_avatars` → `chapter_reading_time` →
`reading_time_hourly`.

`chapters` carries ~5 MB of content text — if a single statement is too large,
batch it (e.g. one book at a time, or by `LIMIT/OFFSET`). The `updated_at`
triggers fire on UPDATE only, so inserted timestamps are preserved.

### 4. Move the 3 cover images
The `covers` bucket is public, so the bytes can be pulled without credentials and
re-uploaded to the new project with its `service_role` key:

```sh
NEWREF=<new-project-ref>
SR=<new-project-service_role-key>
for OBJ in \
  dbd556ef-627c-4fc8-bc64-ae6593d99aa6.jpeg \
  891f37ef-2ccf-4849-b560-2bafe584610d.jpg \
  af5a7888-339d-4bb0-ac54-d3702c6c506b.jpg ; do
  curl -sSf "https://trhrppqbrbawxinhvmtf.supabase.co/storage/v1/object/public/covers/$OBJ" -o "/tmp/$OBJ"
  curl -sSf -X POST "https://$NEWREF.supabase.co/storage/v1/object/covers/$OBJ" \
    -H "Authorization: Bearer $SR" \
    -H "Content-Type: image/jpeg" \
    --data-binary "@/tmp/$OBJ"
done
```

Then rewrite the URLs to the new domain:

```sql
-- on TARGET:
UPDATE public.books
SET cover_url = replace(cover_url,
  'trhrppqbrbawxinhvmtf.supabase.co', NEWREF || '.supabase.co');
```

### 5. Verify parity
- Compare `count(*)` per table between source and target.
- `list_tables` (verbose) diff — columns, PKs, FKs match.
- Run security + performance advisors on the target.
- Smoke-test the app against the new project (see step 6).

### 6. Repoint the app
The new project has a **fresh URL and keys**. Update:
- `SUPABASE_URL` → `https://<NEWREF>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` → new project's service_role key

in **`.env.local`** and in the **deployment env** (Vercel project settings), then
redeploy. `SESSION_SECRET`, `BOOTSTRAP_ADMIN_CODE`, and all `R2_*` values are
unchanged. No code changes are required — the client reads these from env
(`lib/supabase.ts`).

### 7. Cut over and decommission
Once the app is confirmed working against Singapore, delete (or pause) the old
`us-east-1` `beadreader` project. If `my-thank-you-note` was paused to free a
slot, unpause it now.

## Notes
- Doing this over the Supabase MCP tools covers steps 1–5 directly; the storage
  re-upload in step 4 uses `curl` because MCP has no storage-write tool.
- There is a brief write-downtime window between the last data copy and the app
  repoint. For this app's usage that's negligible; for a clean cutover, avoid
  admin edits while copying.
