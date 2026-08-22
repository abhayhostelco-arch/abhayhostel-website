begin;

alter table public.profiles
  add column mentor_id uuid references public.profiles(id) on delete restrict;

create index profiles_mentor_active_idx on public.profiles (mentor_id, is_active)
  where role = 'student';
create unique index profiles_single_super_admin_idx on public.profiles (role)
  where role = 'super_admin';

alter table public.profiles add constraint profiles_mentor_only_for_students check (
  (role = 'student') or mentor_id is null
);

create function private.current_mentor_manages(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as p
    where p.id = student
      and p.role = 'student'
      and p.is_active
      and p.mentor_id = (select auth.uid())
      and private.current_role() = 'admin'
  )
$$;

create table public.shared_resources (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  url text not null check (char_length(url) between 8 and 2048),
  category text check (category is null or char_length(category) <= 80),
  is_published boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weekly_programs (
  id uuid primary key default extensions.gen_random_uuid(),
  program_date date not null unique,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index weekly_programs_one_active_idx on public.weekly_programs (is_active)
  where is_active;

create table public.weekly_program_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  program_id uuid not null references public.weekly_programs(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  attendance text not null check (attendance in ('present', 'absent')),
  wore_dhoti_kurta boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, student_id)
);

create table public.attendance_people (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  notes text check (notes is null or char_length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_events (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  status_options text[] not null default array['Present','Absent','Late']::text[],
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(status_options) between 1 and 8)
);

create table public.attendance_event_people (
  event_id uuid not null references public.attendance_events(id) on delete cascade,
  person_id uuid not null references public.attendance_people(id) on delete cascade,
  primary key (event_id, person_id)
);

create table public.attendance_records (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.attendance_events(id) on delete restrict,
  person_id uuid not null references public.attendance_people(id) on delete restrict,
  attendance_date date not null,
  status text not null check (char_length(status) between 1 and 40),
  remark text check (remark is null or char_length(remark) <= 300),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, person_id, attendance_date)
);

create index weekly_entries_student_idx on public.weekly_program_entries (student_id, program_id);
create index attendance_records_event_date_idx on public.attendance_records (event_id, attendance_date desc);
create index attendance_records_person_date_idx on public.attendance_records (person_id, attendance_date desc);

create trigger resources_touch_updated before update on public.shared_resources
for each row execute function private.touch_updated_at();
create trigger weekly_programs_touch_updated before update on public.weekly_programs
for each row execute function private.touch_updated_at();
create trigger weekly_entries_touch_updated before update on public.weekly_program_entries
for each row execute function private.touch_updated_at();
create trigger attendance_people_touch_updated before update on public.attendance_people
for each row execute function private.touch_updated_at();
create trigger attendance_events_touch_updated before update on public.attendance_events
for each row execute function private.touch_updated_at();
create trigger attendance_records_touch_updated before update on public.attendance_records
for each row execute function private.touch_updated_at();

drop policy profiles_select_active on public.profiles;
create policy profiles_select_active on public.profiles for select to authenticated using (
  (id = (select auth.uid()) and is_active)
  or private.current_role() = 'super_admin'
  or (private.current_role() = 'admin' and private.current_mentor_manages(id))
);

drop policy entries_select_authorized on public.daily_entries;
drop policy entries_insert_own on public.daily_entries;
drop policy entries_update_own on public.daily_entries;
create policy entries_select_authorized on public.daily_entries for select to authenticated using (
  (student_id = (select auth.uid()) and private.current_role() = 'student')
  or private.current_role() = 'super_admin'
  or private.current_mentor_manages(student_id)
);
create policy entries_insert_authorized on public.daily_entries for insert to authenticated with check (
  entry_date between (now() at time zone 'Asia/Kolkata')::date - 89 and (now() at time zone 'Asia/Kolkata')::date
  and (
    (student_id = (select auth.uid()) and private.current_role() = 'student'
      and entry_date >= (now() at time zone 'Asia/Kolkata')::date - 1)
    or private.current_role() = 'super_admin'
    or private.current_mentor_manages(student_id)
  )
);
create policy entries_update_authorized on public.daily_entries for update to authenticated using (
  (student_id = (select auth.uid()) and private.current_role() = 'student'
    and entry_date >= (now() at time zone 'Asia/Kolkata')::date - 1)
  or private.current_role() = 'super_admin'
  or private.current_mentor_manages(student_id)
) with check (
  entry_date between (now() at time zone 'Asia/Kolkata')::date - 89 and (now() at time zone 'Asia/Kolkata')::date
  and (
    (student_id = (select auth.uid()) and private.current_role() = 'student'
      and entry_date >= (now() at time zone 'Asia/Kolkata')::date - 1)
    or private.current_role() = 'super_admin'
    or private.current_mentor_manages(student_id)
  )
);

alter table public.shared_resources enable row level security;
alter table public.shared_resources force row level security;
alter table public.weekly_programs enable row level security;
alter table public.weekly_programs force row level security;
alter table public.weekly_program_entries enable row level security;
alter table public.weekly_program_entries force row level security;
alter table public.attendance_people enable row level security;
alter table public.attendance_people force row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_events force row level security;
alter table public.attendance_event_people enable row level security;
alter table public.attendance_event_people force row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_records force row level security;

create policy resources_read on public.shared_resources for select to authenticated using (
  private.current_user_is_active() and (is_published or private.current_role() = 'super_admin')
);
create policy resources_admin_write on public.shared_resources for all to authenticated
using (private.current_role() = 'super_admin') with check (private.current_role() = 'super_admin');

create policy programs_read on public.weekly_programs for select to authenticated using (private.current_user_is_active());
create policy programs_admin_write on public.weekly_programs for all to authenticated
using (private.current_role() = 'super_admin') with check (private.current_role() = 'super_admin');
create policy weekly_entries_read on public.weekly_program_entries for select to authenticated using (
  student_id = (select auth.uid()) or private.current_role() = 'super_admin' or private.current_mentor_manages(student_id)
);
create policy weekly_entries_student_insert on public.weekly_program_entries for insert to authenticated with check (
  student_id = (select auth.uid()) and private.current_role() = 'student'
  and exists (select 1 from public.weekly_programs w where w.id = program_id and w.is_active)
);
create policy weekly_entries_student_update on public.weekly_program_entries for update to authenticated
using (student_id = (select auth.uid()) and private.current_role() = 'student')
with check (student_id = (select auth.uid()) and exists (select 1 from public.weekly_programs w where w.id = program_id and w.is_active));

create policy attendance_people_read on public.attendance_people for select to authenticated using (
  private.current_role() = 'super_admin'
  or profile_id = (select auth.uid())
  or (profile_id is not null and private.current_mentor_manages(profile_id))
);
create policy attendance_people_admin_write on public.attendance_people for all to authenticated
using (private.current_role() = 'super_admin') with check (private.current_role() = 'super_admin');
create policy attendance_events_read on public.attendance_events for select to authenticated using (private.current_user_is_active());
create policy attendance_events_admin_write on public.attendance_events for all to authenticated
using (private.current_role() = 'super_admin') with check (private.current_role() = 'super_admin');
create policy attendance_event_people_read on public.attendance_event_people for select to authenticated using (
  private.current_role() = 'super_admin' or exists (
    select 1 from public.attendance_people p where p.id = person_id
      and (p.profile_id = (select auth.uid()) or private.current_mentor_manages(p.profile_id))
  )
);
create policy attendance_event_people_admin_write on public.attendance_event_people for all to authenticated
using (private.current_role() = 'super_admin') with check (private.current_role() = 'super_admin');
create policy attendance_records_read on public.attendance_records for select to authenticated using (
  private.current_role() = 'super_admin' or exists (
    select 1 from public.attendance_people p where p.id = person_id
      and (p.profile_id = (select auth.uid()) or private.current_mentor_manages(p.profile_id))
  )
);
create policy attendance_records_write on public.attendance_records for all to authenticated using (
  private.current_role() = 'super_admin' or exists (
    select 1 from public.attendance_people p where p.id = person_id and private.current_mentor_manages(p.profile_id)
  )
) with check (
  recorded_by = (select auth.uid()) and (
    private.current_role() = 'super_admin' or exists (
      select 1 from public.attendance_people p where p.id = person_id and private.current_mentor_manages(p.profile_id)
    )
  )
);

revoke all on public.shared_resources, public.weekly_programs, public.weekly_program_entries,
  public.attendance_people, public.attendance_events, public.attendance_event_people, public.attendance_records
  from anon, authenticated;
grant select, insert, update on public.shared_resources, public.weekly_programs, public.weekly_program_entries,
  public.attendance_people, public.attendance_events, public.attendance_event_people, public.attendance_records
  to authenticated;
grant delete on public.attendance_event_people to authenticated;
grant execute on function private.current_mentor_manages(uuid) to authenticated;

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (action in (
  'account_created', 'account_deactivated', 'account_reactivated', 'credential_reset',
  'settings_updated', 'score_settings_updated', 'report_exported', 'super_admin_bootstrapped',
  'mentor_assigned', 'entry_corrected', 'resource_created', 'resource_updated',
  'weekly_program_created', 'weekly_program_closed', 'attendance_person_created',
  'attendance_event_created', 'attendance_recorded'
));

commit;
