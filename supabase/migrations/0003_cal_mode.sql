-- ============ Cal mode ============
-- A per-reader flag (like has_explicit_access, but the opposite intent): a
-- "cal mode" reader sees the book as if it had no spicy content at all. Inline
-- [[spicy]] passages are removed for them with no placeholder, and whole-chapter
-- explicit chapters stay hidden — the story reads seamlessly with no 🌶 markers.
--
-- Mutually exclusive with has_explicit_access at the application layer: granting
-- one clears the other.

alter table public.users
  add column if not exists cal_mode boolean not null default false;
