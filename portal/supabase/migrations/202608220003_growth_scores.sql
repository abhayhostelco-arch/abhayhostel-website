begin;

alter type public.academy_status rename to gita_class_status;
alter table public.daily_entries rename column academy_status to gita_class_status;
alter index public.daily_entries_attendance_idx rename to daily_entries_gita_attendance_idx;

alter table public.daily_entries
  add column morning_arati_attended boolean not null default false,
  add column evening_reading_minutes smallint not null default 0 check (evening_reading_minutes between 0 and 360),
  add column library_attended boolean not null default false,
  add column seva_minutes smallint not null default 0 check (seva_minutes between 0 and 720);

create table public.score_settings (
  id boolean primary key default true check (id),
  sadhana_weight smallint not null default 40 check (sadhana_weight between 0 and 100),
  study_weight smallint not null default 25 check (study_weight between 0 and 100),
  discipline_weight smallint not null default 20 check (discipline_weight between 0 and 100),
  seva_weight smallint not null default 15 check (seva_weight between 0 and 100),
  chanting_target_rounds smallint not null default 16 check (chanting_target_rounds between 1 and 108),
  evening_reading_target_minutes smallint not null default 30 check (evening_reading_target_minutes between 1 and 360),
  study_target_minutes smallint not null default 240 check (study_target_minutes between 1 and 1080),
  wake_target_time time not null default '06:00',
  bedtime_target_time time not null default '22:30',
  seva_target_minutes smallint not null default 60 check (seva_target_minutes between 1 and 720),
  discipline_grace_minutes smallint not null default 120 check (discipline_grace_minutes between 1 and 360),
  score_start_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  updated_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (sadhana_weight + study_weight + discipline_weight + seva_weight = 100)
);

insert into public.score_settings (id) values (true);

create trigger score_settings_touch_updated
before update on public.score_settings
for each row execute function private.touch_updated_at();

alter table public.score_settings enable row level security;
alter table public.score_settings force row level security;

create policy score_settings_select_active
on public.score_settings for select to authenticated
using (private.current_user_is_active());

create policy score_settings_update_super_admin
on public.score_settings for update to authenticated
using (private.current_role() = 'super_admin')
with check (private.current_role() = 'super_admin');

revoke all on table public.score_settings from anon, authenticated;
grant select, update on table public.score_settings to authenticated;

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (action in (
  'account_created', 'account_deactivated', 'account_reactivated',
  'credential_reset', 'settings_updated', 'score_settings_updated',
  'report_exported', 'super_admin_bootstrapped'
));

commit;
