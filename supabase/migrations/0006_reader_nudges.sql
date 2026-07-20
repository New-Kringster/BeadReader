-- Ephemeral reader-to-reader nudges: a "bump" or a short one-line text. These
-- are NOT a message history — a nudge is a transient relay that exists only long
-- enough to cross the ~15s presence-poll gap. Delivered rows are deleted the
-- moment they're read; anything undelivered is swept after a short TTL. Nothing
-- is retained after delivery.
create table if not exists public.reader_nudges (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id   uuid not null references public.users(id) on delete cascade,
  kind         text not null check (kind in ('bump', 'text')),
  body         text,                    -- null for a bump; short text otherwise
  created_at   timestamptz not null default now()
);

create index if not exists reader_nudges_to_idx
  on public.reader_nudges (to_user_id, created_at);

alter table public.reader_nudges enable row level security;
revoke all on table public.reader_nudges from anon, authenticated;
