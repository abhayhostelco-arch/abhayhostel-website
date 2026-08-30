begin;

create or replace function public.cleanup_preview_history(
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
  candidate_category text;
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
  insert into public.cleanup_runs (mode, requested_by, cutoff_date, categories, preview_expires_at)
  values ('manual', p_actor_uuid, cutoff_date, p_categories, now() + interval '15 minutes')
  returning id into run_uuid;

  foreach candidate_category in array p_categories loop
    if candidate_category = 'daily_entries' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, candidate_category, d.id, jsonb_build_object('entry_date', d.entry_date, 'updated_at', d.updated_at, 'maha_mantra_path', d.maha_mantra_path)
      from public.daily_entries d where d.entry_date < cutoff_date;
    elsif candidate_category = 'gita_attendance' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, candidate_category, g.id, jsonb_build_object('attendance_date', g.attendance_date, 'updated_at', g.updated_at)
      from public.gita_class_attendance g where g.attendance_date < cutoff_date;
    elsif candidate_category = 'weekly_programs' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, candidate_category, w.id, jsonb_build_object('program_date', w.program_date, 'updated_at', w.updated_at, 'entry_ids', coalesce((select jsonb_agg(e.id order by e.id) from public.weekly_program_entries e where e.program_id = w.id), '[]'::jsonb))
      from public.weekly_programs w where w.program_date < cutoff_date and not w.is_active;
    elsif candidate_category = 'attendance_records' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, candidate_category, a.id, jsonb_build_object('attendance_date', a.attendance_date, 'updated_at', a.updated_at)
      from public.attendance_records a where a.attendance_date < cutoff_date;
    elsif candidate_category = 'completed_leaves' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, candidate_category, l.id, jsonb_build_object('end_date', l.end_date, 'status', l.status, 'updated_at', l.updated_at, 'attachment_path', l.attachment_path)
      from public.leave_requests l where l.end_date < cutoff_date and l.status in ('approved', 'rejected', 'withdrawn');
    elsif candidate_category = 'archived_resources' then
      insert into public.cleanup_candidates (run_id, category, entity_id, fingerprint)
      select run_uuid, candidate_category, r.id, jsonb_build_object('updated_at', r.updated_at, 'is_published', r.is_published)
      from public.shared_resources r where not r.is_published and r.updated_at < (cutoff_date::timestamp at time zone 'Asia/Kolkata');
    elsif candidate_category = 'orphan_files' then
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
    'rowCounts', (select coalesce(jsonb_object_agg(counts.cleanup_category, counts.candidate_count), '{}'::jsonb)
      from (select c.category as cleanup_category, count(*)::integer as candidate_count
        from public.cleanup_candidates c where c.run_id = run_uuid group by c.category) counts),
    'objectCount', (select count(*)::integer from public.cleanup_object_tasks t where t.run_id = run_uuid)
  )
  where id = run_uuid;
  return run_uuid;
end;
$$;

commit;
