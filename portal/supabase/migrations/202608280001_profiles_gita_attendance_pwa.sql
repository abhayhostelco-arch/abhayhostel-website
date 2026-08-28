begin;

alter table public.profiles
  add column birth_date date,
  add column avatar_path text;

alter table public.profiles add constraint profiles_birth_date_valid check (
  birth_date is null or birth_date <= (now() at time zone 'Asia/Kolkata')::date
);
alter table public.profiles add constraint profiles_avatar_path_valid check (
  avatar_path is null or (
    char_length(avatar_path) <= 240
    and avatar_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/avatar-[0-9]+\.(jpg|jpeg|png|webp)$'
  )
);

create table public.gita_class_attendance (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete restrict,
  attendance_date date not null,
  status public.gita_class_status not null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create index gita_attendance_date_status_idx
  on public.gita_class_attendance (attendance_date desc, status);
create index gita_attendance_student_date_idx
  on public.gita_class_attendance (student_id, attendance_date desc);

create function private.validate_gita_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_ist date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if new.attendance_date > today_ist or new.attendance_date < today_ist - 89 then
    raise exception 'attendance date is outside the permitted 90-day window'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.student_id and p.role = 'student'
  ) then
    raise exception 'attendance can only be recorded for a student'
      using errcode = '22023';
  end if;
  new.recorded_by := (select auth.uid());
  return new;
end;
$$;

create trigger gita_attendance_validate
before insert or update on public.gita_class_attendance
for each row execute function private.validate_gita_attendance();

create trigger gita_attendance_touch_updated
before update on public.gita_class_attendance
for each row execute function private.touch_updated_at();

alter table public.gita_class_attendance enable row level security;
alter table public.gita_class_attendance force row level security;

create policy profiles_update_own_student_details
on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  and private.current_role() = 'student'
)
with check (
  id = (select auth.uid())
  and role = 'student'
  and is_active
);

create policy gita_attendance_select_staff
on public.gita_class_attendance for select to authenticated
using (
  private.current_role() = 'super_admin'
  or private.current_mentor_manages(student_id)
);

create policy gita_attendance_insert_staff
on public.gita_class_attendance for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and (
    private.current_role() = 'super_admin'
    or private.current_mentor_manages(student_id)
  )
);

create policy gita_attendance_update_staff
on public.gita_class_attendance for update to authenticated
using (
  private.current_role() = 'super_admin'
  or private.current_mentor_manages(student_id)
)
with check (
  recorded_by = (select auth.uid())
  and (
    private.current_role() = 'super_admin'
    or private.current_mentor_manages(student_id)
  )
);

revoke all on table public.gita_class_attendance from anon, authenticated;
grant select, insert, update on table public.gita_class_attendance to authenticated;
grant update (birth_date, avatar_path) on table public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-avatars',
  'student-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy student_avatars_select_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'student-avatars'
  and (
    (
      private.current_user_is_active()
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or private.current_role() = 'super_admin'
    or (
      private.current_role() = 'admin'
      and private.current_mentor_manages(
        case
          when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then ((storage.foldername(name))[1])::uuid
          else null
        end
      )
    )
  )
);

create policy student_avatars_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-avatars'
  and private.current_role() in ('student', 'admin')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy student_avatars_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'student-avatars'
  and private.current_role() in ('student', 'admin')
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'student-avatars'
  and private.current_role() in ('student', 'admin')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy student_avatars_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'student-avatars'
  and private.current_role() in ('student', 'admin')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
