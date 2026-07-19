-- Optional webtoon publishing: books choose one immutable format, while image
-- bytes live in Cloudflare R2 and only ordered metadata is stored in Postgres.

alter table public.books
  add column if not exists format text not null default 'text'
  check (format in ('text', 'webtoon'));

create or replace function public.prevent_book_format_change()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.format is distinct from old.format then
    raise exception 'A book format cannot be changed after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists books_format_immutable on public.books;
create trigger books_format_immutable before update of format on public.books
  for each row execute function public.prevent_book_format_change();

create table if not exists public.chapter_images (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  position integer not null check (position >= 0),
  object_key text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size bigint not null check (byte_size > 0),
  created_at timestamptz not null default now(),
  unique (chapter_id, position)
);

create index if not exists chapter_images_chapter_idx
  on public.chapter_images(chapter_id, position);

alter table public.chapter_images enable row level security;

-- Be explicit for projects created after Supabase's 2026 Data API grant change.
-- No anon/authenticated grants or RLS policies are added; access remains server-only.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.chapter_images to service_role;
