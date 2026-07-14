-- ============ BeadReader schema ============
-- Custom access-code auth (no Supabase Auth). All app access is server-side via
-- the service_role key, which BYPASSES RLS. We still enable RLS with NO policies
-- so the public/anon key can never read these tables directly. Run this in a fresh
-- Supabase project's SQL editor (or via the Supabase CLI).

create extension if not exists pgcrypto;

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- users ----------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'reader' check (role in ('admin','reader')),
  access_code text not null unique,
  has_explicit_access boolean not null default false,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- books ----------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  cover_url text,
  description text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists books_updated_at on public.books;
create trigger books_updated_at before update on public.books
  for each row execute function public.set_updated_at();
create index if not exists books_status_idx on public.books(status);

-- ---------- chapters ----------
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  content text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  is_explicit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists chapters_updated_at on public.chapters;
create trigger chapters_updated_at before update on public.chapters
  for each row execute function public.set_updated_at();
create index if not exists chapters_book_idx on public.chapters(book_id, position);

-- ---------- reading_progress (one row per user+book) ----------
create table if not exists public.reading_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  scroll_fraction numeric(7,6) not null default 0,  -- 0..1 within the chapter (scroll mode)
  page integer not null default 1,                  -- page number (page mode)
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- ---------- reader_settings (one row per user) ----------
create table if not exists public.reader_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  bg_color text not null default '#faf8f4',
  text_color text not null default '#1a1a1a',
  font_size integer not null default 19,
  layout text not null default 'scroll' check (layout in ('scroll','page')),
  updated_at timestamptz not null default now()
);

-- ---------- reading_time (active seconds per user+book) ----------
create table if not exists public.reading_time (
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  total_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- ---------- comments (per chapter) ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_chapter_idx on public.comments(chapter_id, created_at);

-- ---------- Lock down: RLS on, no policies (service_role bypasses) ----------
alter table public.users            enable row level security;
alter table public.books            enable row level security;
alter table public.chapters         enable row level security;
alter table public.reading_progress enable row level security;
alter table public.reader_settings  enable row level security;
alter table public.reading_time     enable row level security;
alter table public.comments         enable row level security;

-- ---------- Storage bucket for cover images (public read) ----------
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;
