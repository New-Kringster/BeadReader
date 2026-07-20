-- Profile photos. The image is compressed in the browser to a small square and
-- stored as a data URI (base64) — a few KB per reader — so no object-storage
-- bucket is needed and the one-click deploy provisions avatars with just this
-- migration. Kept in its own table so the hot users.select('*') path (run on
-- every request) stays lean.
create table if not exists public.user_avatars (
  user_id    uuid primary key references public.users(id) on delete cascade,
  data_uri   text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_avatars enable row level security;
revoke all on table public.user_avatars from anon, authenticated;
