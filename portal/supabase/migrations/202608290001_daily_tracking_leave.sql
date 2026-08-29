begin;

alter table public.daily_entries
  add column morning_arati_status text not null default 'present'
    check (morning_arati_status in ('present', 'late', 'absent')),
  add column maha_mantra_path text;

update public.daily_entries
set morning_arati_status = case when morning_arati_attended then 'present' else 'absent' end;

alter table public.daily_entries add constraint daily_entries_maha_mantra_path_valid check (
  maha_mantra_path is null or (
    char_length(maha_mantra_path) <= 260
    and maha_mantra_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9]{4}-[0-9]{2}-[0-9]{2}/maha-mantra-[0-9]+\.(jpg|jpeg|png|webp)$'
  )
);

create function private.sync_morning_arati_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.morning_arati_status = 'late' then
      new.morning_arati_attended := false;
    else
      new.morning_arati_status := case when new.morning_arati_attended then 'present' else 'absent' end;
    end if;
  elsif new.morning_arati_status is distinct from old.morning_arati_status then
    new.morning_arati_attended := new.morning_arati_status = 'present';
  elsif new.morning_arati_attended is distinct from old.morning_arati_attended then
    new.morning_arati_status := case when new.morning_arati_attended then 'present' else 'absent' end;
  end if;
  return new;
end;
$$;

create trigger entries_sync_morning_arati
before insert or update on public.daily_entries
for each row execute function private.sync_morning_arati_fields();

create table public.leave_requests (
  id uuid primary key,
  student_id uuid not null references public.profiles(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  attachment_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check ((status = 'pending' and decided_by is null and decided_at is null)
    or (status = 'withdrawn' and decided_by is null and decided_at is not null)
    or (status in ('approved', 'rejected') and decided_by is not null and decided_at is not null)),
  check (status <> 'rejected' or decision_note is not null),
  check (attachment_path is null or (
    char_length(attachment_path) <= 260
    and attachment_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/application-[0-9]+\.(jpg|jpeg|png|pdf)$'
  ))
);

create index leave_requests_student_dates_idx on public.leave_requests (student_id, start_date, end_date);
create index leave_requests_status_start_idx on public.leave_requests (status, start_date);
create function private.prevent_overlapping_leave_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('pending', 'approved') and exists (
    select 1 from public.leave_requests existing
    where existing.student_id = new.student_id
      and existing.id <> new.id
      and existing.status in ('pending', 'approved')
      and existing.start_date <= new.end_date
      and existing.end_date >= new.start_date
  ) then
    raise exception 'leave request overlaps an existing pending or approved request' using errcode = '23P01';
  end if;
  return new;
end;
$$;
create trigger leave_requests_prevent_overlap before insert or update on public.leave_requests
for each row execute function private.prevent_overlapping_leave_requests();
create trigger leave_requests_touch_updated before update on public.leave_requests
for each row execute function private.touch_updated_at();

alter table public.leave_requests enable row level security;
alter table public.leave_requests force row level security;
create policy leave_requests_select_authorized on public.leave_requests for select to authenticated using (
  (student_id = (select auth.uid()) and private.current_role() = 'student')
  or private.current_role() = 'super_admin'
  or private.current_mentor_manages(student_id)
);
create policy leave_requests_insert_own on public.leave_requests for insert to authenticated with check (
  student_id = (select auth.uid())
  and private.current_role() = 'student'
  and status = 'pending'
  and decided_by is null
  and decided_at is null
);

revoke all on table public.leave_requests from anon, authenticated;
grant select, insert on table public.leave_requests to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('maha-mantra-evidence', 'maha-mantra-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('leave-applications', 'leave-applications', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']);

create policy tracking_uploads_select_authorized on storage.objects for select to authenticated using (
  bucket_id in ('maha-mantra-evidence', 'leave-applications')
  and (
    (private.current_user_is_active() and (storage.foldername(name))[1] = (select auth.uid())::text)
    or private.current_role() = 'super_admin'
    or (private.current_role() = 'admin' and private.current_mentor_manages(
      case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then ((storage.foldername(name))[1])::uuid else null end
    ))
  )
);
create policy tracking_uploads_insert_own on storage.objects for insert to authenticated with check (
  bucket_id in ('maha-mantra-evidence', 'leave-applications')
  and private.current_role() = 'student'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy tracking_uploads_update_own on storage.objects for update to authenticated using (
  bucket_id in ('maha-mantra-evidence', 'leave-applications')
  and private.current_role() = 'student'
  and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id in ('maha-mantra-evidence', 'leave-applications')
  and private.current_role() = 'student'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy tracking_uploads_delete_own on storage.objects for delete to authenticated using (
  bucket_id in ('maha-mantra-evidence', 'leave-applications')
  and private.current_role() = 'student'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (action in (
  'account_created', 'account_deactivated', 'account_reactivated', 'credential_reset',
  'settings_updated', 'score_settings_updated', 'report_exported', 'super_admin_bootstrapped',
  'mentor_assigned', 'entry_corrected', 'resource_created', 'resource_updated',
  'weekly_program_created', 'weekly_program_closed', 'attendance_person_created',
  'attendance_event_created', 'attendance_recorded', 'leave_approved', 'leave_rejected'
));

commit;
