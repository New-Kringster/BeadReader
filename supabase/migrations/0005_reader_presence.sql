-- Reader presence: who is actively reading right now, and where.
--
-- One row per reader (their latest live location), upserted on the same ~15s
-- flush that already records reading time — no separate heartbeat. A row counts
-- as "online" when its last_beat_at is fresh and is_active is true; stale rows
-- simply read as offline, so no background cleanup is required.
create table if not exists public.reader_presence (
  user_id        uuid primary key references public.users(id) on delete cascade,
  book_id        uuid references public.books(id) on delete set null,
  chapter_id     uuid references public.chapters(id) on delete set null,
  scroll_fraction real not null default 0,
  is_active      boolean not null default true,
  last_beat_at   timestamptz not null default now()
);

create index if not exists reader_presence_last_beat_idx
  on public.reader_presence (last_beat_at);

-- RLS on, no policies — reachable only through the server's service-role client,
-- like every other table.
alter table public.reader_presence enable row level security;
revoke all on table public.reader_presence from anon, authenticated;

-- Per-reader opt-out for the social presence/stats layer. Default on: this is a
-- small, trusted, invite-only circle.
alter table public.reader_settings
  add column if not exists share_activity boolean not null default true;
