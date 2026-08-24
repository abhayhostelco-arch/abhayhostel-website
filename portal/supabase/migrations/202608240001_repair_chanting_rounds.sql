begin;

-- The original chanting-rounds migration was recorded in some environments
-- without the column being present. Repair those databases safely while
-- remaining harmless for databases where the column already exists.
alter table public.daily_entries
  add column if not exists chanting_rounds smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.daily_entries'::regclass
      and conname = 'daily_entries_chanting_rounds_check'
  ) then
    alter table public.daily_entries
      add constraint daily_entries_chanting_rounds_check
      check (chanting_rounds between 0 and 108);
  end if;
end;
$$;

comment on column public.daily_entries.chanting_rounds is
  'Daily chanting rounds. Null is retained only for entries created before this field existed.';

create or replace function private.validate_daily_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_ist date := (now() at time zone 'Asia/Kolkata')::date;
  sleep_minutes integer;
begin
  if new.entry_date > today_ist or new.entry_date < today_ist - 89 then
    raise exception 'entry date is outside the permitted 90-day window'
      using errcode = '22023';
  end if;

  sleep_minutes := private.sleep_duration_minutes(new.sleep_time, new.wake_time);
  if sleep_minutes <= 0 or sleep_minutes > 960 then
    raise exception 'sleep duration must be between 1 minute and 16 hours'
      using errcode = '22023';
  end if;

  if new.chanting_rounds is null then
    raise exception 'chanting rounds are required'
      using errcode = '22023';
  end if;

  if new.note is not null then
    new.note := nullif(btrim(new.note), '');
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

commit;
