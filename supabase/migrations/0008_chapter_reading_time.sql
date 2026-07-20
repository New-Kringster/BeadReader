-- Per-chapter reading time (the book-level total already lives in reading_time).
-- Accumulated from the same ~15s flush, so the stats dashboard can show how long
-- each chapter took.
create table if not exists public.chapter_reading_time (
  user_id       uuid not null references public.users(id) on delete cascade,
  chapter_id    uuid not null references public.chapters(id) on delete cascade,
  book_id       uuid not null references public.books(id) on delete cascade,
  total_seconds integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create index if not exists chapter_reading_time_book_idx
  on public.chapter_reading_time (book_id);

alter table public.chapter_reading_time enable row level security;
revoke all on table public.chapter_reading_time from anon, authenticated;
