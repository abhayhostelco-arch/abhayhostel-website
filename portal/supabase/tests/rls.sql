begin;

create extension if not exists pgtap with schema extensions;
select plan(69);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'one@example.com', '', now(), '{"role":"student"}', '{"full_name":"Student One","joined_on":"2026-01-01"}', now(), now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'two@example.com', '', now(), '{"role":"student"}', '{"full_name":"Student Two","joined_on":"2026-01-01"}', now(), now()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', '', now(), '{"role":"admin"}', '{"full_name":"Admin User"}', now(), now()),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', '', now(), '{"role":"super_admin"}', '{"full_name":"Owner User"}', now(), now());

insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, chanting_rounds, gita_class_status)
values
  ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date, '22:00', '06:00', 240, 16, 'present'),
  ('00000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Kolkata')::date, '23:00', '07:00', 180, 8, 'absent');

update public.profiles set mentor_id = '00000000-0000-4000-8000-000000000003'
where id = '00000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.daily_entries), 1, 'student sees only own entry');
select is((select count(*)::integer from public.profiles), 1, 'student sees only own profile');
select lives_ok(
  $$ update public.daily_entries set note = 'forged' where student_id = '00000000-0000-4000-8000-000000000002' $$,
  'cross-student update is filtered by RLS'
);
reset role;
select is((select note from public.daily_entries where student_id = '00000000-0000-4000-8000-000000000002'), null, 'cross-student data remains unchanged');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, chanting_rounds, gita_class_status) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date + 1, '22:00', '06:00', 240, 16, 'present') $$,
  '42501', null, 'future entry rejected by RLS'
);
select throws_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, chanting_rounds, gita_class_status) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date - 90, '22:00', '06:00', 240, 16, 'present') $$,
  '42501', null, 'entry older than 89 days rejected by RLS'
);
select throws_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, chanting_rounds, gita_class_status) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date - 2, '22:00', '06:00', 240, 16, 'present') $$,
  '42501', null, 'student cannot backfill earlier than yesterday'
);
select lives_ok(
  $$ update public.alert_settings set min_study_minutes = 120 $$,
  'student settings update is filtered by RLS'
);
select lives_ok(
  $$ update public.profiles set birth_date = '2005-01-20' where id = '00000000-0000-4000-8000-000000000002' $$,
  'student cross-profile detail update is filtered by RLS'
);
select throws_ok(
  $$ update public.profiles set role = 'super_admin' where id = '00000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'student cannot escalate role'
);
select throws_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, chanting_rounds, gita_class_status) values ('00000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Kolkata')::date - 1, '22:00', '06:00', 240, 16, 'present') $$,
  '42501', null, 'forged student id is rejected'
);
select is((select count(*)::integer from public.score_settings), 1, 'active student can read score settings');

reset role;
select is((select min_study_minutes::integer from public.alert_settings), 240, 'student cannot change global settings');
select is((select birth_date from public.profiles where id = '00000000-0000-4000-8000-000000000002'), null, 'student cannot change another profile details');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok($$ update public.score_settings set study_weight = 30 $$, 'student score-settings update is filtered by RLS');
reset role;
select is((select study_weight::integer from public.score_settings), 25, 'student cannot change score settings');

select throws_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, gita_class_status) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date - 1, '22:00', '06:00', 240, 'present') $$,
  '22023', 'chanting rounds are required', 'new entries require chanting rounds'
);
select throws_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, chanting_rounds, gita_class_status) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date - 1, '22:00', '06:00', 240, 109, 'present') $$,
  '23514', null, 'chanting rounds above 108 are rejected'
);
select throws_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, chanting_rounds, gita_class_status, evening_reading_minutes) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date - 1, '22:00', '06:00', 240, 16, 'present', 361) $$,
  '23514', null, 'evening reading above 360 minutes is rejected'
);
select throws_ok(
  $$ update public.score_settings set study_weight = 26 $$,
  '23514', null, 'score category weights must total 100'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.daily_entries), 1, 'Mentor sees assigned-student entries only');
select is((select count(*)::integer from public.profiles), 2, 'Mentor sees self and assigned student');
select lives_ok(
  $$ update public.daily_entries set note = 'admin edit' $$,
  'Mentor can correct assigned-student entries'
);
select lives_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, chanting_rounds, gita_class_status) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date - 1, '22:00', '06:00', 240, 16, 'present') $$,
  'Mentor can backfill an assigned student within 90 days'
);
select lives_ok(
  $$ update public.alert_settings set min_study_minutes = 120 $$,
  'admin settings update is filtered by RLS'
);
select lives_ok(
  $$ update public.profiles set birth_date = '2005-01-20' where id = '00000000-0000-4000-8000-000000000001' $$,
  'Mentor profile-detail update is filtered by RLS'
);
select lives_ok($$ update public.score_settings set study_weight = 30 $$, 'admin score-settings update is filtered by RLS');

reset role;
select is((select count(*)::integer from public.daily_entries where note = 'admin edit'), 1, 'Mentor correction persists for assigned student');
select is((select min_study_minutes::integer from public.alert_settings), 240, 'admin cannot change global settings');
select is((select birth_date from public.profiles where id = '00000000-0000-4000-8000-000000000001'), null, 'Mentor cannot change student-owned profile details');
select is((select study_weight::integer from public.score_settings), 25, 'admin cannot change score settings');
update public.profiles set is_active = false where id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.daily_entries), 0, 'inactive user loses database access');
select is((select count(*)::integer from public.score_settings), 0, 'inactive user cannot read score settings');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select lives_ok(
  $$ update public.score_settings set study_target_minutes = 300 $$,
  'Super Admin can update score settings'
);
select is((select study_target_minutes::integer from public.score_settings), 300, 'Super Admin score-setting change is persisted');
select is((select count(*)::integer from public.profiles), 4, 'Admin sees all portal profiles');
select lives_ok(
  $$ insert into public.shared_resources (title, url, category, created_by) values ('Bhagavad Gita', 'https://example.com/gita', 'Reading', '00000000-0000-4000-8000-000000000004') $$,
  'Admin can publish a resource'
);
select lives_ok(
  $$ insert into public.weekly_programs (program_date, created_by) values ((now() at time zone 'Asia/Kolkata')::date, '00000000-0000-4000-8000-000000000004') $$,
  'Admin can open a Weekly Program'
);
select lives_ok(
  $$ insert into public.attendance_events (name, created_by) values ('Sunday Program', '00000000-0000-4000-8000-000000000004') $$,
  'Admin can create an attendance event'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.shared_resources), 1, 'Student can read published resources');
select lives_ok(
  $$ insert into public.weekly_program_entries (program_id, student_id, attendance, wore_dhoti_kurta) select id, '00000000-0000-4000-8000-000000000002', 'present', true from public.weekly_programs where is_active $$,
  'Student can submit the active Weekly Program'
);
select is((select count(*)::integer from public.attendance_events), 1, 'Student can read attendance events without a shared password');

select lives_ok(
  $$ update public.profiles set birth_date = '2005-01-20' where id = '00000000-0000-4000-8000-000000000002' $$,
  'Student can update their own birth date'
);
select is((select count(*)::integer from public.gita_class_attendance), 0, 'Student cannot read official Gita attendance');
select throws_ok(
  $$ insert into public.gita_class_attendance (student_id, attendance_date, status, recorded_by) values ('00000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Kolkata')::date, 'present', '00000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'Student cannot record official Gita attendance'
);

reset role;
update public.profiles set is_active = true where id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select lives_ok(
  $$ insert into public.gita_class_attendance (student_id, attendance_date, status, recorded_by) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date, 'present', '00000000-0000-4000-8000-000000000004'), ('00000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Kolkata')::date, 'absent', '00000000-0000-4000-8000-000000000004') $$,
  'Admin can record official attendance for all students'
);
select is((select count(*)::integer from public.gita_class_attendance), 2, 'Admin can read all official attendance');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.gita_class_attendance), 1, 'Mentor sees assigned-student attendance only');

reset role;
update public.profiles set is_active = false where id = '00000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.gita_class_attendance where student_id = '00000000-0000-4000-8000-000000000001'), 1, 'Official attendance remains after student deactivation');

update public.profiles set is_active = true where id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ insert into public.leave_requests (id, student_id, start_date, end_date, reason) values ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date + 1, (now() at time zone 'Asia/Kolkata')::date + 2, 'Family visit') $$,
  'Student can submit their own pending leave request'
);
select throws_ok(
  $$ insert into public.leave_requests (id, student_id, start_date, end_date, reason) values ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date + 2, (now() at time zone 'Asia/Kolkata')::date + 3, 'Overlapping visit') $$,
  '23P01', 'leave request overlaps an existing pending or approved request', 'Overlapping pending leave is rejected'
);
select throws_ok(
  $$ insert into public.leave_requests (id, student_id, start_date, end_date, reason) values ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Kolkata')::date + 1, (now() at time zone 'Asia/Kolkata')::date + 2, 'Forged request') $$,
  '42501', null, 'Student cannot submit leave for another Student'
);
select is((select count(*)::integer from public.leave_requests), 1, 'Student sees only their own leave requests');
select throws_ok(
  $$ update public.leave_requests set status = 'approved', decided_at = now() where id = '00000000-0000-4000-8000-000000000010' $$,
  '42501', null, 'Student cannot approve their own leave'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('maha-mantra-evidence', '00000000-0000-4000-8000-000000000001/2026-08-29/maha-mantra-1724800000000.png', '00000000-0000-4000-8000-000000000001') $$,
  'Student can upload evidence in their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('maha-mantra-evidence', '00000000-0000-4000-8000-000000000002/2026-08-29/maha-mantra-1724800000001.png', '00000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'Student cannot upload evidence for another Student'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.leave_requests), 1, 'Mentor sees assigned-Student leave only');
select is((select count(*)::integer from storage.objects where bucket_id = 'maha-mantra-evidence'), 1, 'Mentor sees assigned-Student evidence only');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.leave_requests), 0, 'Student cannot see another Student leave');
select is((select count(*)::integer from storage.objects where bucket_id = 'maha-mantra-evidence'), 0, 'Student cannot see another Student evidence');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.leave_requests), 1, 'Admin sees all leave requests');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('student-avatars', '00000000-0000-4000-8000-000000000001/avatar-1724800000000.webp', '00000000-0000-4000-8000-000000000001') $$,
  'Student can upload an avatar in their own folder'
);
select is((select count(*)::integer from storage.objects where bucket_id = 'student-avatars'), 1, 'Student sees their own avatar');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from storage.objects where bucket_id = 'student-avatars'), 0, 'Student cannot read another Student avatar');
select throws_ok(
  $$ update storage.objects set metadata = '{"forged":true}'::jsonb where bucket_id = 'student-avatars' and name = '00000000-0000-4000-8000-000000000001/avatar-1724800000000.webp' $$,
  '42501', null, 'Student cannot update another Student avatar'
);
select throws_ok(
  $$ delete from storage.objects where bucket_id = 'student-avatars' and name = '00000000-0000-4000-8000-000000000001/avatar-1724800000000.webp' $$,
  '42501', null, 'Student cannot remove another Student avatar'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from storage.objects where bucket_id = 'student-avatars'), 1, 'Mentor can read an assigned Student avatar');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'student-avatars' and name = '00000000-0000-4000-8000-000000000001/avatar-1724800000000.webp' $$,
  'Student can remove their own avatar'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('student-avatars', '00000000-0000-4000-8000-000000000001/avatar-1724800000001.png', '00000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'Student cannot upload an avatar for another Student'
);

select * from finish();
rollback;
