begin;

alter table public.profiles add column deletion_pending_at timestamptz;
alter table public.profiles add constraint profiles_deletion_pending_inactive
  check (deletion_pending_at is null or is_active = false);

alter table public.audit_events add column cleanup_run_id uuid;
alter table public.audit_events drop constraint audit_events_actor_id_fkey;
alter table public.audit_events add constraint audit_events_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;
create unique index audit_events_cleanup_run_id_unique_idx
  on public.audit_events (cleanup_run_id) where cleanup_run_id is not null;

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (action in (
  'account_created', 'account_deactivated', 'account_reactivated', 'credential_reset',
  'settings_updated', 'score_settings_updated', 'report_exported', 'super_admin_bootstrapped',
  'mentor_assigned', 'entry_corrected', 'resource_created', 'resource_updated',
  'weekly_program_created', 'weekly_program_closed', 'weekly_program_reopened',
  'attendance_person_created', 'attendance_event_created', 'attendance_recorded',
  'leave_approved', 'leave_rejected', 'student_birthdate_updated',
  'cleanup_settings_updated', 'cleanup_history_completed', 'cleanup_history_partial',
  'student_deletion_completed', 'student_deletion_partial'
));

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.actor_id is not null
    and new.actor_id is null
    and new.id is not distinct from old.id
    and new.action is not distinct from old.action
    and new.target_id is not distinct from old.target_id
    and new.metadata is not distinct from old.metadata
    and new.cleanup_run_id is not distinct from old.cleanup_run_id
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  raise exception 'audit events are immutable' using errcode = '42501';
end;
$$;

create table public.cleanup_settings (
  id boolean primary key default true check (id),
  automatic_enabled boolean not null default false,
  last_automatic_run_id uuid,
  last_automatic_started_at timestamptz,
  last_automatic_finished_at timestamptz,
  last_automatic_status text check (last_automatic_status in ('completed', 'partial', 'failed', 'cancelled')),
  last_automatic_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(last_automatic_summary) = 'object'),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.cleanup_settings (id) values (true);

create table public.cleanup_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  mode text not null check (mode in ('auto', 'manual', 'student_delete')),
  status text not null default 'previewed' check (status in ('previewed', 'queued', 'running', 'completed', 'partial', 'failed', 'cancelled')),
  phase text not null default 'history_database' check (phase in (
    'history_database', 'object_removal', 'claimed', 'auth_banned', 'upload_quarantine',
    'storage_cleared', 'database_cleared', 'auth_deleted', 'completed'
  )),
  requested_by uuid references public.profiles(id) on delete set null,
  target_student_id uuid references public.profiles(id) on delete set null,
  cutoff_date date,
  categories text[] not null default '{}'::text[],
  preview_impact jsonb,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  preview_expires_at timestamptz,
  queued_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  next_work_at timestamptz,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(categories) <= 7),
  check ((mode = 'student_delete') = (target_student_id is not null))
);

create index cleanup_runs_status_next_work_idx on public.cleanup_runs (status, next_work_at);
create unique index cleanup_runs_auto_india_date_unique_idx
  on public.cleanup_runs (cutoff_date)
  where mode = 'auto' and cutoff_date is not null;

create table public.cleanup_candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  run_id uuid not null references public.cleanup_runs(id) on delete cascade,
  category text not null check (category in (
    'daily_entries', 'gita_attendance', 'weekly_programs', 'attendance_records',
    'completed_leaves', 'archived_resources', 'orphan_files', 'student_delete'
  )),
  entity_id uuid,
  fingerprint jsonb not null default '{}'::jsonb check (jsonb_typeof(fingerprint) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'deleted', 'stale', 'skipped', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, category, entity_id)
);

create index cleanup_candidates_run_status_idx on public.cleanup_candidates (run_id, status);

create table public.cleanup_object_tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  run_id uuid not null references public.cleanup_runs(id) on delete cascade,
  bucket_id text not null check (bucket_id in ('student-avatars', 'maha-mantra-evidence', 'leave-applications')),
  object_name text not null check (char_length(object_name) between 1 and 1024),
  object_id uuid,
  observed_version text,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'deleted', 'missing', 'stale', 'retryable', 'permanent_failure')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  last_error_class text,
  claimed_by uuid,
  claimed_at timestamptz,
  next_work_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, bucket_id, object_name)
);

create index cleanup_object_tasks_run_status_idx on public.cleanup_object_tasks (run_id, status);

create table public.cleanup_global_lease (
  id boolean primary key default true check (id),
  active_run_id uuid references public.cleanup_runs(id) on delete set null,
  lease_owner uuid,
  lease_generation bigint not null default 0 check (lease_generation >= 0),
  lease_expires_at timestamptz
);

insert into public.cleanup_global_lease (id) values (true);

create table public.cleanup_path_reservations (
  bucket_id text not null check (bucket_id in ('student-avatars', 'maha-mantra-evidence', 'leave-applications')),
  object_name text not null check (char_length(object_name) between 1 and 1024),
  run_id uuid not null references public.cleanup_runs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bucket_id, object_name)
);

create or replace function private.cleanup_path_reserved(p_bucket_id text, p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cleanup_path_reservations
    where bucket_id = p_bucket_id and object_name = p_object_name
  )
$$;

create function private.require_active_super_admin(p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'super_admin' and is_active
  ) then
    raise exception 'active super admin required' using errcode = '42501';
  end if;
end;
$$;

create function public.cleanup_get_settings()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'automatic_enabled', automatic_enabled,
    'last_automatic_run_id', last_automatic_run_id,
    'last_automatic_started_at', last_automatic_started_at,
    'last_automatic_finished_at', last_automatic_finished_at,
    'last_automatic_status', last_automatic_status,
    'last_automatic_summary', last_automatic_summary
  )
  from public.cleanup_settings where id
$$;

create function public.cleanup_update_auto(p_actor_uuid uuid, p_enabled_boolean boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform private.require_active_super_admin(p_actor_uuid);
  update public.cleanup_settings
  set automatic_enabled = p_enabled_boolean, updated_by = p_actor_uuid, updated_at = now()
  where id;
  if not p_enabled_boolean then
    update public.cleanup_runs
    set status = 'cancelled', finished_at = now(), next_work_at = null,
        error_summary = 'Automatic cleanup disabled', updated_at = now()
    where mode = 'auto' and status = 'queued';
  end if;
  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (p_actor_uuid, 'cleanup_settings_updated', null, jsonb_build_object('automatic_enabled', p_enabled_boolean));
  select public.cleanup_get_settings() into result;
  return result;
end;
$$;

create function public.cleanup_claim_lease(p_run_uuid uuid, p_worker_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  lease public.cleanup_global_lease%rowtype;
  run_row public.cleanup_runs%rowtype;
begin
  select * into lease from public.cleanup_global_lease where id for update;
  select * into run_row from public.cleanup_runs where id = p_run_uuid for update;
  if not found or run_row.status not in ('queued', 'running') then return null; end if;
  if lease.lease_expires_at is not null and lease.lease_expires_at > now() then return null; end if;
  update public.cleanup_global_lease
  set active_run_id = p_run_uuid,
      lease_owner = p_worker_uuid,
      lease_generation = lease.lease_generation + 1,
      lease_expires_at = now() + interval '17 minutes'
  where id
  returning * into lease;
  update public.cleanup_runs
  set status = 'running', started_at = coalesce(started_at, now()), updated_at = now()
  where id = p_run_uuid;
  return jsonb_build_object('run_id', p_run_uuid, 'worker_id', p_worker_uuid,
    'generation', lease.lease_generation, 'lease_expires_at', lease.lease_expires_at);
end;
$$;

create function public.cleanup_release_lease(p_run_uuid uuid, p_worker_uuid uuid, p_generation bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cleanup_global_lease
  set active_run_id = null, lease_owner = null, lease_expires_at = null
  where id and active_run_id = p_run_uuid and lease_owner = p_worker_uuid and lease_generation = p_generation;
  if not found then
    raise exception 'cleanup lease generation mismatch' using errcode = '40001';
  end if;
end;
$$;

create function public.cleanup_get_run(p_run_uuid uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select to_jsonb(r) from public.cleanup_runs r where r.id = p_run_uuid
$$;

create function public.cleanup_resume_run(p_actor_uuid uuid, p_run_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_active_super_admin(p_actor_uuid);
  update public.cleanup_object_tasks
  set status = 'pending', claimed_by = null, claimed_at = null, last_error_class = null, updated_at = now()
  where run_id = p_run_uuid and status in ('permanent_failure', 'retryable', 'claimed');
  update public.cleanup_runs
  set status = 'queued', next_work_at = now(), error_summary = null,
      queued_at = coalesce(queued_at, now()), updated_at = now()
  where id = p_run_uuid and status in ('partial', 'failed');
  if not found then
    raise exception 'cleanup run is not resumable' using errcode = '22023';
  end if;
  select public.cleanup_get_run(p_run_uuid) into result;
  return result;
end;
$$;

create function public.cleanup_cancel_expired_previews()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare cancelled integer;
begin
  update public.cleanup_runs
  set status = 'cancelled', finished_at = now(), updated_at = now(), error_summary = 'Preview expired'
  where status = 'previewed' and preview_expires_at is not null and preview_expires_at <= now();
  get diagnostics cancelled = row_count;
  return cancelled;
end;
$$;

create function private.require_cleanup_lease(p_run_uuid uuid, p_worker_uuid uuid, p_generation bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.cleanup_global_lease
    where id and active_run_id = p_run_uuid and lease_owner = p_worker_uuid
      and lease_generation = p_generation and lease_expires_at > now()
  ) then
    raise exception 'cleanup lease generation mismatch' using errcode = '40001';
  end if;
end;
$$;

create function public.cleanup_finalize_run(
  p_run_uuid uuid,
  p_worker_uuid uuid,
  p_generation bigint,
  p_final_status text,
  p_summary_jsonb jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare run_row public.cleanup_runs%rowtype;
declare audit_action text;
begin
  if p_final_status not in ('completed', 'partial', 'failed', 'cancelled') then
    raise exception 'invalid cleanup terminal status' using errcode = '22023';
  end if;
  if jsonb_typeof(p_summary_jsonb) <> 'object' then
    raise exception 'cleanup summary must be an object' using errcode = '22023';
  end if;
  perform private.require_cleanup_lease(p_run_uuid, p_worker_uuid, p_generation);
  update public.cleanup_runs
  set status = p_final_status, phase = case when p_final_status = 'completed' then 'completed' else phase end,
      summary = p_summary_jsonb, finished_at = now(), next_work_at = null, updated_at = now()
  where id = p_run_uuid and status = 'running'
  returning * into run_row;
  if not found then raise exception 'cleanup run is not running' using errcode = '22023'; end if;
  if run_row.mode = 'auto' then
    update public.cleanup_settings
    set last_automatic_run_id = run_row.id,
        last_automatic_started_at = run_row.started_at,
        last_automatic_finished_at = run_row.finished_at,
        last_automatic_status = p_final_status,
        last_automatic_summary = p_summary_jsonb,
        updated_at = now()
    where id;
  end if;
  audit_action := case
    when run_row.mode = 'student_delete' and p_final_status = 'completed' then 'student_deletion_completed'
    when run_row.mode = 'student_delete' then 'student_deletion_partial'
    when p_final_status = 'completed' then 'cleanup_history_completed'
    else 'cleanup_history_partial'
  end;
  insert into public.audit_events (actor_id, action, target_id, metadata, cleanup_run_id)
  values (run_row.requested_by, audit_action, run_row.target_student_id,
    jsonb_build_object('mode', run_row.mode, 'status', p_final_status), run_row.id)
  on conflict (cleanup_run_id) where cleanup_run_id is not null do nothing;
  return public.cleanup_get_run(p_run_uuid);
end;
$$;

create function public.cleanup_housekeep_terminal_runs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed integer;
begin
  with eligible as (
    select r.id from public.cleanup_runs r
    where r.status in ('completed', 'partial', 'failed', 'cancelled')
      and r.finished_at <= now() - interval '30 days'
      and exists (select 1 from public.audit_events a where a.cleanup_run_id = r.id)
  ), deleted_candidates as (
    delete from public.cleanup_candidates c using eligible e where c.run_id = e.id returning c.id
  ), deleted_tasks as (
    delete from public.cleanup_object_tasks t using eligible e where t.run_id = e.id returning t.id
  )
  select (select count(*) from deleted_candidates) + (select count(*) from deleted_tasks) into removed;
  return removed;
end;
$$;

create function public.cleanup_preview_history(
  p_actor_uuid uuid,
  p_retention_days integer,
  p_categories text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_uuid uuid;
  cutoff_date date;
  category text;
begin
  perform private.require_active_super_admin(p_actor_uuid);
  if p_retention_days not in (90, 180, 365) then
    raise exception 'unsupported cleanup retention' using errcode = '22023';
  end if;
  if p_categories is null or cardinality(p_categories) = 0
    or exists (select 1 from unnest(p_categories) c where c not in (
      'daily_entries', 'gita_attendance', 'weekly_programs', 'attendance_records',
      'completed_leaves', 'archived_resources', 'orphan_files'
    )) then
    raise exception 'unsupported cleanup category' using errcode = '22023';
  end if;
  cutoff_date := (now() at time zone 'Asia/Kolkata')::date - p_retention_days;
  insert into public.cleanup_runs (
    mode, requested_by, cutoff_date, categories, preview_expires_at
  ) values (
    'manual', p_actor_uuid, cutoff_date, p_categories, now() + interval '15 minutes'
  ) returning id into run_uuid;

  foreach category in array p_categories loop
    if category = 'daily_entries' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, category, d.id,
        jsonb_build_object('entry_date', d.entry_date, 'updated_at', d.updated_at,
          'maha_mantra_path', d.maha_mantra_path)
      from public.daily_entries d
      where d.entry_date < cutoff_date;
    elsif category = 'gita_attendance' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, category, g.id,
        jsonb_build_object('attendance_date', g.attendance_date, 'updated_at', g.updated_at)
      from public.gita_class_attendance g
      where g.attendance_date < cutoff_date;
    elsif category = 'weekly_programs' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, category, w.id,
        jsonb_build_object('program_date', w.program_date, 'updated_at', w.updated_at,
          'entry_ids', coalesce((select jsonb_agg(e.id order by e.id)
            from public.weekly_program_entries e where e.program_id = w.id), '[]'::jsonb))
      from public.weekly_programs w
      where w.program_date < cutoff_date and not w.is_active;
    elsif category = 'attendance_records' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, category, a.id,
        jsonb_build_object('attendance_date', a.attendance_date, 'updated_at', a.updated_at)
      from public.attendance_records a
      where a.attendance_date < cutoff_date;
    elsif category = 'completed_leaves' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, category, l.id,
        jsonb_build_object('end_date', l.end_date, 'status', l.status, 'updated_at', l.updated_at,
          'attachment_path', l.attachment_path)
      from public.leave_requests l
      where l.end_date < cutoff_date and l.status in ('approved', 'rejected', 'withdrawn');
    elsif category = 'archived_resources' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, category, r.id,
        jsonb_build_object('updated_at', r.updated_at, 'is_published', r.is_published)
      from public.shared_resources r
      where not r.is_published
        and r.updated_at < (cutoff_date::timestamp at time zone 'Asia/Kolkata');
    elsif category = 'orphan_files' then
      insert into public.cleanup_object_tasks (run_id, bucket_id, object_name, object_id, observed_version)
      select run_uuid, o.bucket_id, o.name, o.id, o.updated_at::text
      from storage.objects o
      where o.bucket_id in ('student-avatars', 'maha-mantra-evidence', 'leave-applications')
        and greatest(o.created_at, o.updated_at) < now() - interval '24 hours'
        and not exists (select 1 from public.profiles p where p.avatar_path = o.name)
        and not exists (select 1 from public.daily_entries d where d.maha_mantra_path = o.name)
        and not exists (select 1 from public.leave_requests l where l.attachment_path = o.name);
    end if;
  end loop;
  update public.cleanup_runs
  set preview_impact = jsonb_build_object(
    'rowCounts', (select coalesce(jsonb_object_agg(category, count), '{}'::jsonb)
      from (select category, count(*)::integer as count from public.cleanup_candidates where run_id = run_uuid group by category) counts),
    'objectCount', (select count(*)::integer from public.cleanup_object_tasks where run_id = run_uuid)
  )
  where id = run_uuid;
  return run_uuid;
end;
$$;

create function public.cleanup_enqueue_auto(p_actor_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_uuid uuid;
  india_date date := (now() at time zone 'Asia/Kolkata')::date;
begin
  perform private.require_active_super_admin(p_actor_uuid);
  perform 1 from public.cleanup_settings where id and automatic_enabled for update;
  if not found then return null; end if;
  select id into run_uuid from public.cleanup_runs
  where mode = 'auto' and cutoff_date = india_date - 90
  order by created_at desc limit 1;
  if run_uuid is not null then return run_uuid; end if;
  run_uuid := public.cleanup_preview_history(
    p_actor_uuid,
    90,
    array['daily_entries','gita_attendance','weekly_programs','attendance_records','completed_leaves','orphan_files']::text[]
  );
  update public.cleanup_runs
  set mode = 'auto', status = 'queued', preview_expires_at = null,
      queued_at = now(), next_work_at = now(), updated_at = now()
  where id = run_uuid;
  return run_uuid;
end;
$$;

create function public.cleanup_confirm_preview(p_actor_uuid uuid, p_run_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_active_super_admin(p_actor_uuid);
  update public.cleanup_runs
  set status = 'queued', queued_at = now(), next_work_at = now(), updated_at = now()
  where id = p_run_uuid and requested_by = p_actor_uuid and mode = 'manual'
    and status = 'previewed' and preview_expires_at > now();
  return found;
end;
$$;

create function public.cleanup_process_database_batch(
  p_run_uuid uuid, p_worker_uuid uuid, p_generation bigint, p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.cleanup_candidates%rowtype;
  deleted_count integer := 0;
  skipped_count integer := 0;
  processed integer := 0;
  run_row public.cleanup_runs%rowtype;
  current_updated timestamptz;
  current_path text;
begin
  if p_limit < 1 or p_limit > 500 then
    raise exception 'invalid cleanup batch size' using errcode = '22023';
  end if;
  perform private.require_cleanup_lease(p_run_uuid, p_worker_uuid, p_generation);
  select * into run_row from public.cleanup_runs where id = p_run_uuid for update;
  if not found or run_row.status <> 'running' then
    raise exception 'cleanup run is not running' using errcode = '22023';
  end if;
  for candidate in
    select c.* from public.cleanup_candidates c
    where c.run_id = p_run_uuid and c.status = 'pending'
    order by c.created_at, c.id limit p_limit for update skip locked
  loop
    processed := processed + 1;
    current_updated := null;
    current_path := null;
    if candidate.category = 'daily_entries' then
      select d.updated_at, d.maha_mantra_path into current_updated, current_path
      from public.daily_entries d where d.id = candidate.entity_id;
      if current_updated is null or current_updated <> (candidate.fingerprint->>'updated_at')::timestamptz
        or current_path is distinct from candidate.fingerprint->>'maha_mantra_path'
        or (select d.entry_date from public.daily_entries d where d.id = candidate.entity_id)
          >= run_row.cutoff_date then
        update public.cleanup_candidates set status = 'stale', updated_at = now() where id = candidate.id;
        skipped_count := skipped_count + 1; continue;
      end if;
      if current_path is not null then
        insert into public.cleanup_object_tasks (run_id, bucket_id, object_name, observed_version)
        values (p_run_uuid, 'maha-mantra-evidence', current_path, current_updated::text)
        on conflict (run_id, bucket_id, object_name) do nothing;
      end if;
      delete from public.daily_entries where id = candidate.entity_id;
    elsif candidate.category = 'gita_attendance' then
      delete from public.gita_class_attendance g where g.id = candidate.entity_id
        and g.updated_at = (candidate.fingerprint->>'updated_at')::timestamptz
        and g.attendance_date < run_row.cutoff_date;
    elsif candidate.category = 'weekly_programs' then
      if not exists (select 1 from public.weekly_programs w where w.id = candidate.entity_id
        and not w.is_active and w.program_date < run_row.cutoff_date
        and w.updated_at = (candidate.fingerprint->>'updated_at')::timestamptz
        and coalesce((select jsonb_agg(e.id order by e.id) from public.weekly_program_entries e where e.program_id = w.id), '[]'::jsonb)
          = candidate.fingerprint->'entry_ids') then
        update public.cleanup_candidates set status = 'stale', updated_at = now() where id = candidate.id;
        skipped_count := skipped_count + 1; continue;
      end if;
      delete from public.weekly_program_entries where program_id = candidate.entity_id;
      delete from public.weekly_programs where id = candidate.entity_id;
    elsif candidate.category = 'attendance_records' then
      delete from public.attendance_records a where a.id = candidate.entity_id
        and a.updated_at = (candidate.fingerprint->>'updated_at')::timestamptz
        and a.attendance_date < run_row.cutoff_date;
    elsif candidate.category = 'completed_leaves' then
      select l.updated_at, l.attachment_path into current_updated, current_path
      from public.leave_requests l where l.id = candidate.entity_id
        and l.status in ('approved','rejected','withdrawn') and l.end_date < run_row.cutoff_date;
      if current_updated is null or current_updated <> (candidate.fingerprint->>'updated_at')::timestamptz
        or current_path is distinct from candidate.fingerprint->>'attachment_path' then
        update public.cleanup_candidates set status = 'stale', updated_at = now() where id = candidate.id;
        skipped_count := skipped_count + 1; continue;
      end if;
      if current_path is not null then
        insert into public.cleanup_object_tasks (run_id, bucket_id, object_name, observed_version)
        values (p_run_uuid, 'leave-applications', current_path, current_updated::text)
        on conflict (run_id, bucket_id, object_name) do nothing;
      end if;
      delete from public.leave_requests where id = candidate.entity_id;
    elsif candidate.category = 'archived_resources' then
      delete from public.shared_resources r where r.id = candidate.entity_id
        and not r.is_published and r.updated_at = (candidate.fingerprint->>'updated_at')::timestamptz
        and r.updated_at < (run_row.cutoff_date::timestamp at time zone 'Asia/Kolkata');
    end if;
    if found then
      update public.cleanup_candidates set status = 'deleted', updated_at = now() where id = candidate.id;
      deleted_count := deleted_count + 1;
    else
      update public.cleanup_candidates set status = 'stale', updated_at = now() where id = candidate.id;
      skipped_count := skipped_count + 1;
    end if;
  end loop;
  update public.cleanup_runs set phase = case when exists (select 1 from public.cleanup_object_tasks t where t.run_id = p_run_uuid and t.status not in ('deleted','missing','stale')) then 'object_removal' else phase end,
    next_work_at = now(), updated_at = now() where id = p_run_uuid;
  return jsonb_build_object('processed', processed, 'deleted', deleted_count, 'skipped', skipped_count,
    'remaining', exists (select 1 from public.cleanup_candidates c where c.run_id = p_run_uuid and c.status = 'pending'));
end;
$$;

create function public.cleanup_claim_object_batch(
  p_run_uuid uuid, p_worker_uuid uuid, p_generation bigint, p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if p_limit < 1 or p_limit > 500 then raise exception 'invalid cleanup batch size' using errcode = '22023'; end if;
  perform private.require_cleanup_lease(p_run_uuid, p_worker_uuid, p_generation);
  with claimed as (
    update public.cleanup_object_tasks t set status = 'claimed', claimed_by = p_worker_uuid,
      claimed_at = now(), attempt_count = t.attempt_count + 1, updated_at = now()
    where t.id in (select id from public.cleanup_object_tasks where run_id = p_run_uuid and status in ('pending','retryable')
      and (next_work_at is null or next_work_at <= now()) order by created_at, id limit p_limit for update skip locked)
    returning t.id, t.bucket_id, t.object_name, t.object_id, t.observed_version, t.attempt_count
  ) select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into result from claimed;
  return result;
end;
$$;

create function public.cleanup_complete_object_tasks(
  p_run_uuid uuid, p_worker_uuid uuid, p_generation bigint, p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare item jsonb;
declare outcome text;
begin
  perform private.require_cleanup_lease(p_run_uuid, p_worker_uuid, p_generation);
  if jsonb_typeof(p_results) <> 'array' then raise exception 'object results must be an array' using errcode = '22023'; end if;
  for item in select * from jsonb_array_elements(p_results) loop
    outcome := item->>'outcome';
    if outcome not in ('deleted','missing','stale','retryable','permanent_failure') then
      raise exception 'invalid object result' using errcode = '22023';
    end if;
    update public.cleanup_object_tasks set status = outcome, last_error_class = item->>'error_class',
      claimed_by = null, claimed_at = null, updated_at = now()
    where id = (item->>'task_id')::uuid and run_id = p_run_uuid and status = 'claimed' and claimed_by = p_worker_uuid;
  end loop;
  return jsonb_build_object('remaining', exists (select 1 from public.cleanup_object_tasks where run_id = p_run_uuid and status in ('pending','claimed','retryable')));
end;
$$;

create function public.cleanup_dispatch_due_runs()
returns uuid[]
language sql
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id order by next_work_at, id), '{}'::uuid[])
  from public.cleanup_runs
  where status in ('queued','running') and (next_work_at is null or next_work_at <= now());
$$;

alter table public.cleanup_settings enable row level security;
alter table public.cleanup_settings force row level security;
alter table public.cleanup_runs enable row level security;
alter table public.cleanup_runs force row level security;
alter table public.cleanup_candidates enable row level security;
alter table public.cleanup_candidates force row level security;
alter table public.cleanup_object_tasks enable row level security;
alter table public.cleanup_object_tasks force row level security;
alter table public.cleanup_global_lease enable row level security;
alter table public.cleanup_global_lease force row level security;
alter table public.cleanup_path_reservations enable row level security;
alter table public.cleanup_path_reservations force row level security;

revoke all on table public.cleanup_settings, public.cleanup_runs, public.cleanup_candidates,
  public.cleanup_object_tasks, public.cleanup_global_lease, public.cleanup_path_reservations
  from public, anon, authenticated;
revoke execute on function private.cleanup_path_reserved(text, text),
  private.require_active_super_admin(uuid), private.require_cleanup_lease(uuid, uuid, bigint)
  from public, anon, authenticated;

revoke execute on function public.cleanup_get_settings(),
  public.cleanup_update_auto(uuid, boolean),
  public.cleanup_claim_lease(uuid, uuid),
  public.cleanup_release_lease(uuid, uuid, bigint),
  public.cleanup_get_run(uuid),
  public.cleanup_resume_run(uuid, uuid),
  public.cleanup_cancel_expired_previews(),
  public.cleanup_finalize_run(uuid, uuid, bigint, text, jsonb),
  public.cleanup_housekeep_terminal_runs(),
  public.cleanup_preview_history(uuid, integer, text[]),
  public.cleanup_enqueue_auto(uuid),
  public.cleanup_confirm_preview(uuid, uuid),
  public.cleanup_process_database_batch(uuid, uuid, bigint, integer),
  public.cleanup_claim_object_batch(uuid, uuid, bigint, integer),
  public.cleanup_complete_object_tasks(uuid, uuid, bigint, jsonb),
  public.cleanup_dispatch_due_runs()
  from public, anon, authenticated;
grant execute on function public.cleanup_get_settings(),
  public.cleanup_update_auto(uuid, boolean),
  public.cleanup_claim_lease(uuid, uuid),
  public.cleanup_release_lease(uuid, uuid, bigint),
  public.cleanup_get_run(uuid),
  public.cleanup_resume_run(uuid, uuid),
  public.cleanup_cancel_expired_previews(),
  public.cleanup_finalize_run(uuid, uuid, bigint, text, jsonb),
  public.cleanup_housekeep_terminal_runs(),
  public.cleanup_preview_history(uuid, integer, text[]),
  public.cleanup_enqueue_auto(uuid),
  public.cleanup_confirm_preview(uuid, uuid),
  public.cleanup_process_database_batch(uuid, uuid, bigint, integer),
  public.cleanup_claim_object_batch(uuid, uuid, bigint, integer),
  public.cleanup_complete_object_tasks(uuid, uuid, bigint, jsonb),
  public.cleanup_dispatch_due_runs()
  to service_role;

commit;
