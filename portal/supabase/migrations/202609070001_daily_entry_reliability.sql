begin;

lock table
  public.profiles,
  public.daily_entries,
  public.gita_class_attendance,
  public.weekly_program_entries,
  public.leave_requests,
  public.student_payments,
  public.leave_notification_deliveries,
  public.attendance_people,
  public.cleanup_runs,
  public.audit_events
in share row exclusive mode;

-- Keep an internal, application-inaccessible recovery snapshot because this
-- production project does not have platform backups enabled. These copies are
-- intentionally retained after the migration for manual recovery if needed.
create table if not exists private.migration_202609070001_profiles_backup as table public.profiles;
create table if not exists private.migration_202609070001_daily_entries_backup as table public.daily_entries;
create table if not exists private.migration_202609070001_gita_class_attendance_backup as table public.gita_class_attendance;
create table if not exists private.migration_202609070001_weekly_program_entries_backup as table public.weekly_program_entries;
create table if not exists private.migration_202609070001_leave_requests_backup as table public.leave_requests;
create table if not exists private.migration_202609070001_student_payments_backup as table public.student_payments;
create table if not exists private.migration_202609070001_leave_notification_deliveries_backup as table public.leave_notification_deliveries;
create table if not exists private.migration_202609070001_attendance_people_backup as table public.attendance_people;
create table if not exists private.migration_202609070001_cleanup_runs_backup as table public.cleanup_runs;
create table if not exists private.migration_202609070001_audit_events_backup as table public.audit_events;
create table if not exists private.migration_202609070001_conflicts (
  conflict_type text not null,
  canonical_id uuid not null,
  duplicate_id uuid not null,
  conflict_key text not null,
  details jsonb not null,
  recorded_at timestamptz not null default now(),
  primary key (conflict_type, canonical_id, duplicate_id, conflict_key)
);

alter table private.migration_202609070001_profiles_backup enable row level security;
alter table private.migration_202609070001_profiles_backup force row level security;
alter table private.migration_202609070001_daily_entries_backup enable row level security;
alter table private.migration_202609070001_daily_entries_backup force row level security;
alter table private.migration_202609070001_gita_class_attendance_backup enable row level security;
alter table private.migration_202609070001_gita_class_attendance_backup force row level security;
alter table private.migration_202609070001_weekly_program_entries_backup enable row level security;
alter table private.migration_202609070001_weekly_program_entries_backup force row level security;
alter table private.migration_202609070001_leave_requests_backup enable row level security;
alter table private.migration_202609070001_leave_requests_backup force row level security;
alter table private.migration_202609070001_student_payments_backup enable row level security;
alter table private.migration_202609070001_student_payments_backup force row level security;
alter table private.migration_202609070001_leave_notification_deliveries_backup enable row level security;
alter table private.migration_202609070001_leave_notification_deliveries_backup force row level security;
alter table private.migration_202609070001_attendance_people_backup enable row level security;
alter table private.migration_202609070001_attendance_people_backup force row level security;
alter table private.migration_202609070001_cleanup_runs_backup enable row level security;
alter table private.migration_202609070001_cleanup_runs_backup force row level security;
alter table private.migration_202609070001_audit_events_backup enable row level security;
alter table private.migration_202609070001_audit_events_backup force row level security;
alter table private.migration_202609070001_conflicts enable row level security;
alter table private.migration_202609070001_conflicts force row level security;

revoke all on table private.migration_202609070001_profiles_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_daily_entries_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_gita_class_attendance_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_weekly_program_entries_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_leave_requests_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_student_payments_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_leave_notification_deliveries_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_attendance_people_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_cleanup_runs_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_audit_events_backup from public, anon, authenticated;
revoke all on table private.migration_202609070001_conflicts from public, anon, authenticated;

alter table public.daily_entries
  add column if not exists maha_mantra_purged_at timestamptz;

-- Consolidate only the two known duplicate-name cohorts. The one profile in
-- each cohort that already owns daily entries is the canonical identity.
alter table public.audit_events disable trigger audit_no_update;
alter table public.gita_class_attendance disable trigger gita_attendance_validate;
select set_config('app.daily_entry_maintenance', 'purge', true);
do $$
declare
  target_name text;
  canonical_id uuid;
  duplicate_id uuid;
  entry_bearing_count integer;
  row_counts_before jsonb := jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'daily_entries', (select count(*) from public.daily_entries),
    'gita_class_attendance', (select count(*) from public.gita_class_attendance),
    'weekly_program_entries', (select count(*) from public.weekly_program_entries),
    'leave_requests', (select count(*) from public.leave_requests),
    'student_payments', (select count(*) from public.student_payments),
    'leave_notification_deliveries', (select count(*) from public.leave_notification_deliveries),
    'attendance_people', (select count(*) from public.attendance_people),
    'cleanup_runs', (select count(*) from public.cleanup_runs),
    'audit_events', (select count(*) from public.audit_events)
  );
begin
  foreach target_name in array array['subhash kumar saw', 'subhash mahto'] loop
    if (select count(*) from public.profiles p
        where p.role = 'student'
          and regexp_replace(lower(btrim(p.full_name)), '\s+', ' ', 'g') = target_name) < 2 then
      continue;
    end if;

    select count(*) into entry_bearing_count
    from public.profiles p
    where p.role = 'student'
      and regexp_replace(lower(btrim(p.full_name)), '\s+', ' ', 'g') = target_name
      and exists (select 1 from public.daily_entries d where d.student_id = p.id);
    if entry_bearing_count <> 1 then
      raise exception 'duplicate profile consolidation expected exactly one entry-bearing canonical profile for %', target_name;
    end if;

    select p.id into canonical_id
    from public.profiles p
    where p.role = 'student'
      and regexp_replace(lower(btrim(p.full_name)), '\s+', ' ', 'g') = target_name
      and exists (select 1 from public.daily_entries d where d.student_id = p.id);

    for duplicate_id in
      select p.id from public.profiles p
      where p.role = 'student'
        and regexp_replace(lower(btrim(p.full_name)), '\s+', ' ', 'g') = target_name
        and p.id <> canonical_id
      order by p.id
    loop
      insert into private.migration_202609070001_conflicts
        (conflict_type, canonical_id, duplicate_id, conflict_key, details)
      select 'gita_class_attendance', canonical_id, duplicate_id, old_row.attendance_date::text,
        jsonb_build_object('canonical', to_jsonb(canonical_row), 'duplicate', to_jsonb(old_row))
      from public.gita_class_attendance old_row
      join public.gita_class_attendance canonical_row
        on canonical_row.student_id = canonical_id and canonical_row.attendance_date = old_row.attendance_date
      where old_row.student_id = duplicate_id
      on conflict do nothing;

      insert into private.migration_202609070001_conflicts
        (conflict_type, canonical_id, duplicate_id, conflict_key, details)
      select 'weekly_program_entries', canonical_id, duplicate_id, old_row.program_id::text,
        jsonb_build_object('canonical', to_jsonb(canonical_row), 'duplicate', to_jsonb(old_row))
      from public.weekly_program_entries old_row
      join public.weekly_program_entries canonical_row
        on canonical_row.student_id = canonical_id and canonical_row.program_id = old_row.program_id
      where old_row.student_id = duplicate_id
      on conflict do nothing;

      insert into private.migration_202609070001_conflicts
        (conflict_type, canonical_id, duplicate_id, conflict_key, details)
      select 'student_payments', canonical_id, duplicate_id, old_row.fee_month::text,
        jsonb_build_object('canonical', to_jsonb(canonical_row), 'duplicate', to_jsonb(old_row))
      from public.student_payments old_row
      join public.student_payments canonical_row
        on canonical_row.student_id = canonical_id and canonical_row.fee_month = old_row.fee_month
      where old_row.student_id = duplicate_id
      on conflict do nothing;

      insert into private.migration_202609070001_conflicts
        (conflict_type, canonical_id, duplicate_id, conflict_key, details)
      select 'attendance_people', canonical_id, duplicate_id, old_row.id::text,
        jsonb_build_object('canonical', to_jsonb(canonical_row), 'duplicate', to_jsonb(old_row))
      from public.attendance_people old_row
      join public.attendance_people canonical_row on canonical_row.profile_id = canonical_id
      where old_row.profile_id = duplicate_id
      on conflict do nothing;

      insert into private.migration_202609070001_conflicts
        (conflict_type, canonical_id, duplicate_id, conflict_key, details)
      select 'leave_requests', canonical_id, duplicate_id, old_row.id::text,
        jsonb_build_object('canonical', to_jsonb(canonical_row), 'duplicate', to_jsonb(old_row))
      from public.leave_requests old_row
      join public.leave_requests canonical_row
        on canonical_row.student_id = canonical_id
       and canonical_row.status in ('pending', 'approved')
       and old_row.status in ('pending', 'approved')
       and canonical_row.start_date <= old_row.end_date
       and canonical_row.end_date >= old_row.start_date
      where old_row.student_id = duplicate_id
      on conflict do nothing;

      update public.daily_entries set student_id = canonical_id where student_id = duplicate_id;
      update public.gita_class_attendance old_row set student_id = canonical_id
      where old_row.student_id = duplicate_id and not exists (
        select 1 from public.gita_class_attendance canonical_row
        where canonical_row.student_id = canonical_id
          and canonical_row.attendance_date = old_row.attendance_date
      );
      update public.weekly_program_entries old_row set student_id = canonical_id
      where old_row.student_id = duplicate_id and not exists (
        select 1 from public.weekly_program_entries canonical_row
        where canonical_row.student_id = canonical_id
          and canonical_row.program_id = old_row.program_id
      );
      update public.student_payments old_row set student_id = canonical_id
      where old_row.student_id = duplicate_id and not exists (
        select 1 from public.student_payments canonical_row
        where canonical_row.student_id = canonical_id
          and canonical_row.fee_month = old_row.fee_month
      );
      update public.attendance_people old_row set profile_id = canonical_id
      where old_row.profile_id = duplicate_id and not exists (
        select 1 from public.attendance_people canonical_row
        where canonical_row.profile_id = canonical_id
      );
      update public.leave_requests old_row set student_id = canonical_id
      where old_row.student_id = duplicate_id and not (
        old_row.status in ('pending', 'approved') and exists (
          select 1 from public.leave_requests canonical_row
          where canonical_row.student_id = canonical_id
            and canonical_row.status in ('pending', 'approved')
            and canonical_row.start_date <= old_row.end_date
            and canonical_row.end_date >= old_row.start_date
        )
      );
      update public.leave_notification_deliveries notification set student_id = canonical_id
      where notification.student_id = duplicate_id and exists (
        select 1 from public.leave_requests request
        where request.id = notification.leave_request_id and request.student_id = canonical_id
      );
      update public.cleanup_runs
      set status = 'cancelled', finished_at = coalesce(finished_at, now()),
          error_summary = 'Cancelled during duplicate-profile consolidation to preserve retained records'
      where target_student_id = duplicate_id and mode = 'student_delete'
        and status in ('previewed', 'queued', 'running', 'partial', 'failed');
      update public.audit_events set target_id = canonical_id where target_id = duplicate_id;
      update public.profiles set is_active = false where id = duplicate_id;
    end loop;
  end loop;

  if row_counts_before is distinct from jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'daily_entries', (select count(*) from public.daily_entries),
    'gita_class_attendance', (select count(*) from public.gita_class_attendance),
    'weekly_program_entries', (select count(*) from public.weekly_program_entries),
    'leave_requests', (select count(*) from public.leave_requests),
    'student_payments', (select count(*) from public.student_payments),
    'leave_notification_deliveries', (select count(*) from public.leave_notification_deliveries),
    'attendance_people', (select count(*) from public.attendance_people),
    'cleanup_runs', (select count(*) from public.cleanup_runs),
    'audit_events', (select count(*) from public.audit_events)
  ) then
    raise exception 'daily-entry reliability migration changed protected row counts';
  end if;
end;
$$;
alter table public.audit_events enable trigger audit_no_update;
alter table public.gita_class_attendance enable trigger gita_attendance_validate;

-- Evidence retention updates historical rows after the normal 90-day editing
-- window. Preserve validation for inserts and date changes, while allowing
-- maintenance-only metadata changes such as clearing a purged image path.
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
  if current_setting('app.daily_entry_maintenance', true) is distinct from 'purge'
    and (new.entry_date > today_ist or new.entry_date < today_ist - 89) then
    raise exception 'entry date is outside the permitted 90-day window'
      using errcode = '22023';
  end if;
  sleep_minutes := private.sleep_duration_minutes(new.sleep_time, new.wake_time);
  if sleep_minutes <= 0 or sleep_minutes > 960 then
    raise exception 'sleep duration must be between 1 minute and 16 hours'
      using errcode = '22023';
  end if;
  if new.note is not null then new.note := nullif(btrim(new.note), ''); end if;
  return new;
end;
$$;

alter table public.cleanup_candidates drop constraint if exists cleanup_candidates_category_check;
alter table public.cleanup_candidates add constraint cleanup_candidates_category_check check (category in (
  'daily_entries', 'gita_attendance', 'weekly_programs', 'attendance_records',
  'completed_leaves', 'archived_resources', 'orphan_files', 'student_delete',
  'maha_mantra_evidence'
));

drop index if exists public.cleanup_runs_auto_india_date_unique_idx;
create unique index if not exists cleanup_runs_auto_categories_cutoff_unique_idx
  on public.cleanup_runs (categories, cutoff_date)
  where mode = 'auto' and cutoff_date is not null;

create or replace function public.cleanup_enqueue_auto(p_actor_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_uuid uuid;
  india_date date := (now() at time zone 'Asia/Kolkata')::date;
  history_categories text[] := array[
    'daily_entries','gita_attendance','weekly_programs','attendance_records',
    'completed_leaves','orphan_files'
  ]::text[];
begin
  perform private.require_active_super_admin(p_actor_uuid);
  perform 1 from public.cleanup_settings where id and automatic_enabled for update;
  if not found then return null; end if;
  select id into run_uuid from public.cleanup_runs
  where mode = 'auto' and cutoff_date = india_date - 90
    and categories = history_categories
  order by created_at desc limit 1;
  if run_uuid is not null then return run_uuid; end if;
  run_uuid := public.cleanup_preview_history(p_actor_uuid, 90, history_categories);
  update public.cleanup_runs
  set mode = 'auto', status = 'queued', preview_expires_at = null,
      queued_at = now(), next_work_at = now(), updated_at = now()
  where id = run_uuid;
  return run_uuid;
end;
$$;

create or replace function public.cleanup_enqueue_maha_mantra_retention()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_uuid uuid;
  india_date date := (now() at time zone 'Asia/Kolkata')::date;
begin
  perform set_config('app.daily_entry_maintenance', 'purge', true);
  select id into run_uuid from public.cleanup_runs
  where mode = 'auto'
    and categories = array['maha_mantra_evidence', 'orphan_files']::text[]
    and cutoff_date = india_date - 7
  order by created_at desc limit 1;
  if run_uuid is not null then return run_uuid; end if;

  insert into public.cleanup_runs (
    mode, status, phase, cutoff_date, categories, queued_at, next_work_at
  ) values (
    'auto', 'queued', 'object_removal', india_date - 7,
    array['maha_mantra_evidence', 'orphan_files']::text[], now(), now()
  ) returning id into run_uuid;

  insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
  select run_uuid, 'maha_mantra_evidence', d.id,
    jsonb_build_object('entry_date', d.entry_date, 'updated_at', d.updated_at,
      'maha_mantra_path', d.maha_mantra_path)
  from public.daily_entries d
  where d.maha_mantra_path is not null
    and d.entry_date < india_date - 7;

  insert into public.cleanup_object_tasks (
    run_id, bucket_id, object_name, object_id, observed_version
  )
  select run_uuid, 'maha-mantra-evidence', c.fingerprint->>'maha_mantra_path', o.id, o.updated_at::text
  from public.cleanup_candidates c
  join storage.objects o
    on o.bucket_id = 'maha-mantra-evidence'
   and o.name = c.fingerprint->>'maha_mantra_path'
  where c.run_id = run_uuid and c.category = 'maha_mantra_evidence';

  -- A path absent from storage is already confirmed removed.
  update public.daily_entries d
  set maha_mantra_path = null, maha_mantra_purged_at = now()
  from public.cleanup_candidates c
  where c.run_id = run_uuid and c.category = 'maha_mantra_evidence'
    and c.entity_id = d.id
    and d.maha_mantra_path = c.fingerprint->>'maha_mantra_path'
    and d.entry_date < india_date - 7
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'maha-mantra-evidence'
        and o.name = c.fingerprint->>'maha_mantra_path'
    );
  update public.cleanup_candidates c set status = 'deleted', updated_at = now()
  where c.run_id = run_uuid and c.category = 'maha_mantra_evidence'
    and not exists (
      select 1 from public.daily_entries d
      where d.id = c.entity_id and d.maha_mantra_path = c.fingerprint->>'maha_mantra_path'
    );

  -- Failed form-save cleanup leaves an unreferenced object. Queue those too;
  -- the 24-hour delay avoids racing an in-flight entry save.
  insert into public.cleanup_object_tasks (
    run_id, bucket_id, object_name, object_id, observed_version
  )
  select run_uuid, o.bucket_id, o.name, o.id, o.updated_at::text
  from storage.objects o
  where o.bucket_id = 'maha-mantra-evidence'
    and greatest(o.created_at, o.updated_at) < now() - interval '24 hours'
    and not exists (select 1 from public.daily_entries d where d.maha_mantra_path = o.name)
  on conflict (run_id, bucket_id, object_name) do nothing;

  return run_uuid;
end;
$$;

create or replace function public.cleanup_complete_object_tasks(
  p_run_uuid uuid, p_worker_uuid uuid, p_generation bigint, p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  outcome text;
  task_row public.cleanup_object_tasks%rowtype;
  candidate_row public.cleanup_candidates%rowtype;
  run_cutoff date;
  entry_cleared boolean;
begin
  perform private.require_cleanup_lease(p_run_uuid, p_worker_uuid, p_generation);
  perform set_config('app.daily_entry_maintenance', 'purge', true);
  if jsonb_typeof(p_results) <> 'array' then raise exception 'object results must be an array' using errcode = '22023'; end if;
  select cutoff_date into run_cutoff from public.cleanup_runs where id = p_run_uuid;
  for item in select * from jsonb_array_elements(p_results) loop
    outcome := item->>'outcome';
    if outcome not in ('deleted','missing','stale','retryable','permanent_failure') then
      raise exception 'invalid object result' using errcode = '22023';
    end if;
    update public.cleanup_object_tasks set status = outcome, last_error_class = item->>'error_class',
      claimed_by = null, claimed_at = null, updated_at = now()
    where id = (item->>'task_id')::uuid and run_id = p_run_uuid
      and status = 'claimed' and claimed_by = p_worker_uuid
    returning * into task_row;
    if not found then continue; end if;

    if outcome in ('deleted', 'missing') and task_row.bucket_id = 'maha-mantra-evidence' then
      select * into candidate_row from public.cleanup_candidates c
      where c.run_id = p_run_uuid and c.category = 'maha_mantra_evidence'
        and c.fingerprint->>'maha_mantra_path' = task_row.object_name
      limit 1;
      if found then
        update public.daily_entries d
        set maha_mantra_path = null, maha_mantra_purged_at = now()
        where d.id = candidate_row.entity_id
          and d.maha_mantra_path = task_row.object_name
          and d.entry_date < run_cutoff;
        entry_cleared := found;
        update public.cleanup_candidates set status = case when entry_cleared then 'deleted' else 'stale' end,
          updated_at = now() where id = candidate_row.id;
      end if;
    elsif outcome = 'stale' and task_row.bucket_id = 'maha-mantra-evidence' then
      update public.cleanup_candidates set status = 'stale', updated_at = now()
      where run_id = p_run_uuid and category = 'maha_mantra_evidence'
        and fingerprint->>'maha_mantra_path' = task_row.object_name;
    elsif outcome in ('retryable', 'permanent_failure') then
      -- Preserve the database path so retry/resume can safely try again.
      null;
    end if;
  end loop;
  return jsonb_build_object('remaining', exists (
    select 1 from public.cleanup_object_tasks
    where run_id = p_run_uuid and status in ('pending','claimed','retryable')
  ));
end;
$$;

create or replace function public.cleanup_dispatch_due_runs()
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare result uuid[];
begin
  perform public.cleanup_enqueue_maha_mantra_retention();
  select coalesce(array_agg(id order by next_work_at, id), '{}'::uuid[])
  into result
  from public.cleanup_runs
  where status in ('queued','running') and (next_work_at is null or next_work_at <= now());
  return result;
end;
$$;

revoke execute on function public.cleanup_enqueue_maha_mantra_retention() from public, anon, authenticated;
grant execute on function public.cleanup_enqueue_maha_mantra_retention() to service_role;

notify pgrst, 'reload schema';

commit;
