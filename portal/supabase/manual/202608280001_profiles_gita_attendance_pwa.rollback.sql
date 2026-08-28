-- MANUAL ROLLBACK ONLY. Do not place this file in supabase/migrations.
--
-- Run only after the previous application version has been restored.
-- This permanently deletes official Gita attendance and the two new profile
-- fields. Download any required data and empty the student-avatars bucket
-- through the Supabase Storage API or Dashboard before running this script.

begin;

-- Abort before changing anything if avatar objects still exist. Removing rows
-- directly from storage.objects would not remove the underlying stored files.
do $$
begin
  if exists (
    select 1 from storage.objects where bucket_id = 'student-avatars'
  ) then
    raise exception 'student-avatars is not empty; download and remove its files through Supabase Storage before rollback';
  end if;
end;
$$;

drop policy if exists student_avatars_select_authorized on storage.objects;
drop policy if exists student_avatars_insert_own on storage.objects;
drop policy if exists student_avatars_update_own on storage.objects;
drop policy if exists student_avatars_delete_own on storage.objects;

delete from storage.buckets where id = 'student-avatars';

drop policy if exists profiles_update_own_student_details on public.profiles;
revoke update (birth_date, avatar_path) on table public.profiles from authenticated;

revoke all on table public.gita_class_attendance from anon, authenticated;
drop policy if exists gita_attendance_select_staff on public.gita_class_attendance;
drop policy if exists gita_attendance_insert_staff on public.gita_class_attendance;
drop policy if exists gita_attendance_update_staff on public.gita_class_attendance;

drop table public.gita_class_attendance;
drop function private.validate_gita_attendance();

alter table public.profiles
  drop constraint profiles_birth_date_valid,
  drop constraint profiles_avatar_path_valid,
  drop column birth_date,
  drop column avatar_path;

commit;
