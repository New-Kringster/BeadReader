-- ============ chapter_reads ============
-- Tracks every chapter a reader has actually opened, so the table-of-contents
-- can mark read chapters (independently of the single "current position" stored
-- in reading_progress). One row per user+chapter; opening a chapter upserts it.
-- Like every other table, RLS is enabled with no policies — all access is
-- server-side via the service_role key.

create table if not exists public.chapter_reads (
  user_id    uuid not null references public.users(id)    on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  book_id    uuid not null references public.books(id)    on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create index if not exists chapter_reads_user_book_idx
  on public.chapter_reads(user_id, book_id);

alter table public.chapter_reads enable row level security;
