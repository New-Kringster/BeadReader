-- Reading time bucketed by the reader's local day and hour-of-day. Powers the
-- "when do you read" histogram (scrollable day by day) and, by summing a day's
-- hours, daily totals and streaks. Rows only exist for hours actually read, so
-- it stays small.
create table if not exists public.reading_time_hourly (
  user_id     uuid not null references public.users(id) on delete cascade,
  day         date not null,
  hour_of_day smallint not null check (hour_of_day between 0 and 23),
  seconds     integer not null default 0,
  primary key (user_id, day, hour_of_day)
);

create index if not exists reading_time_hourly_user_day_idx
  on public.reading_time_hourly (user_id, day);

alter table public.reading_time_hourly enable row level security;
revoke all on table public.reading_time_hourly from anon, authenticated;
