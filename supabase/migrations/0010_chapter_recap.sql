-- ---------- chapter recap ----------
-- A short, admin-authored summary of the chapter (Markdown), shown to readers in
-- a collapsible "Recap" panel at the end of the chapter. Empty string = no recap.
alter table public.chapters
  add column if not exists recap text not null default '';
