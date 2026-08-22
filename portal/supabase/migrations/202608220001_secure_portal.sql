begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum ('super_admin', 'admin', 'student');
create type public.academy_status as enum ('present', 'absent', 'no_class');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  role public.app_role not null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 254 and email = lower(email)),
  phone text check (phone is null or char_length(phone) <= 30),
  academy_label text check (academy_label is null or char_length(academy_label) <= 120),
  joined_on date,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_join_date_required check (
    (role = 'student' and joined_on is not null) or
    (role <> 'student' and joined_on is null)
  )
);

create unique index profiles_email_lower_idx on public.profiles (lower(email));
create index profiles_role_active_idx on public.profiles (role, is_active);
create index profiles_academy_label_idx on public.profiles (academy_label)
  where academy_label is not null;

create table public.daily_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete restrict,
  entry_date date not null,
  sleep_time time not null,
  wake_time time not null,
  study_minutes smallint not null check (study_minutes between 0 and 1080),
  academy_status public.academy_status not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, entry_date)
);

create index daily_entries_date_idx on public.daily_entries (entry_date desc);
create index daily_entries_student_date_idx
  on public.daily_entries (student_id, entry_date desc);
create index daily_entries_attendance_idx
  on public.daily_entries (academy_status, entry_date desc);

create table public.alert_settings (
  id boolean primary key default true check (id),
  missed_entry_enabled boolean not null default true,
  sleep_alert_enabled boolean not null default true,
  min_sleep_minutes smallint not null default 360 check (min_sleep_minutes between 60 and 900),
  max_sleep_minutes smallint not null default 600 check (max_sleep_minutes between 120 and 960),
  study_alert_enabled boolean not null default true,
  min_study_minutes smallint not null default 240 check (min_study_minutes between 0 and 1080),
  absence_alert_enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (min_sleep_minutes < max_sleep_minutes)
);

insert into public.alert_settings (id) values (true);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null check (action in (
    'account_created', 'account_deactivated', 'account_reactivated',
    'credential_reset', 'settings_updated', 'report_exported',
    'super_admin_bootstrapped'
  )),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id, created_at desc);

create function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid()) and p.is_active
$$;

create function private.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as p
    where p.id = (select auth.uid()) and p.is_active
  )
$$;

create function private.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.sleep_duration_minutes(sleep_at time, wake_at time)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when (extract(epoch from wake_at)::integer - extract(epoch from sleep_at)::integer) <= 0
      then (extract(epoch from wake_at)::integer - extract(epoch from sleep_at)::integer + 86400) / 60
    else (extract(epoch from wake_at)::integer - extract(epoch from sleep_at)::integer) / 60
  end
$$;

create function private.validate_daily_entry()
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

  if new.note is not null then
    new.note := nullif(btrim(new.note), '');
  end if;
  return new;
end;
$$;

create function private.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'audit events are immutable' using errcode = '42501';
end;
$$;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role public.app_role;
  creator uuid;
begin
  assigned_role := coalesce(new.raw_app_meta_data ->> 'role', 'student')::public.app_role;
  creator := nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid;

  insert into public.profiles (
    id, role, full_name, email, phone, academy_label, joined_on,
    is_active, must_change_password, created_by
  ) values (
    new.id,
    assigned_role,
    btrim(coalesce(new.raw_user_meta_data ->> 'full_name', 'Portal user')),
    lower(new.email),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'academy_label'), ''),
    case
      when assigned_role = 'student' then
        coalesce(nullif(new.raw_user_meta_data ->> 'joined_on', '')::date,
          (now() at time zone 'Asia/Kolkata')::date)
      else null
    end,
    true,
    true,
    creator
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create trigger profiles_touch_updated
before update on public.profiles
for each row execute function private.touch_updated_at();

create trigger entries_validate
before insert or update on public.daily_entries
for each row execute function private.validate_daily_entry();

create trigger entries_touch_updated
before update on public.daily_entries
for each row execute function private.touch_updated_at();

create trigger settings_touch_updated
before update on public.alert_settings
for each row execute function private.touch_updated_at();

create trigger audit_no_update
before update or delete on public.audit_events
for each row execute function private.prevent_audit_mutation();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.daily_entries enable row level security;
alter table public.daily_entries force row level security;
alter table public.alert_settings enable row level security;
alter table public.alert_settings force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

create policy profiles_select_active
on public.profiles for select to authenticated
using (
  (id = (select auth.uid()) and is_active)
  or private.current_role() in ('super_admin', 'admin')
);

create policy entries_select_authorized
on public.daily_entries for select to authenticated
using (
  (student_id = (select auth.uid()) and private.current_role() = 'student')
  or private.current_role() in ('super_admin', 'admin')
);

create policy entries_insert_own
on public.daily_entries for insert to authenticated
with check (
  student_id = (select auth.uid())
  and private.current_role() = 'student'
  and entry_date between
    (now() at time zone 'Asia/Kolkata')::date - 89
    and (now() at time zone 'Asia/Kolkata')::date
);

create policy entries_update_own
on public.daily_entries for update to authenticated
using (
  student_id = (select auth.uid())
  and private.current_role() = 'student'
  and entry_date between
    (now() at time zone 'Asia/Kolkata')::date - 89
    and (now() at time zone 'Asia/Kolkata')::date
)
with check (
  student_id = (select auth.uid())
  and private.current_role() = 'student'
  and entry_date between
    (now() at time zone 'Asia/Kolkata')::date - 89
    and (now() at time zone 'Asia/Kolkata')::date
);

create policy settings_select_admin
on public.alert_settings for select to authenticated
using (private.current_role() in ('super_admin', 'admin'));

create policy settings_update_super_admin
on public.alert_settings for update to authenticated
using (private.current_role() = 'super_admin')
with check (private.current_role() = 'super_admin');

create policy audit_select_super_admin
on public.audit_events for select to authenticated
using (private.current_role() = 'super_admin');

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.daily_entries from anon, authenticated;
revoke all on table public.alert_settings from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select, insert, update on table public.daily_entries to authenticated;
grant select, update on table public.alert_settings to authenticated;
grant select on table public.audit_events to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

commit;
