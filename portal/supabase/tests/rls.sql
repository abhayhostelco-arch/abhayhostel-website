begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'one@example.com', '', now(), '{"role":"student"}', '{"full_name":"Student One","joined_on":"2026-01-01"}', now(), now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'two@example.com', '', now(), '{"role":"student"}', '{"full_name":"Student Two","joined_on":"2026-01-01"}', now(), now()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', '', now(), '{"role":"admin"}', '{"full_name":"Admin User"}', now(), now()),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', '', now(), '{"role":"super_admin"}', '{"full_name":"Owner User"}', now(), now());

insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, academy_status)
values
  ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date, '22:00', '06:00', 240, 'present'),
  ('00000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Kolkata')::date, '23:00', '07:00', 180, 'absent');

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
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, academy_status) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date + 1, '22:00', '06:00', 240, 'present') $$,
  '42501', null, 'future entry rejected by RLS'
);
select throws_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, academy_status) values ('00000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date - 90, '22:00', '06:00', 240, 'present') $$,
  '42501', null, 'entry older than 89 days rejected by RLS'
);
select lives_ok(
  $$ update public.alert_settings set min_study_minutes = 120 $$,
  'student settings update is filtered by RLS'
);
select throws_ok(
  $$ update public.profiles set role = 'super_admin' where id = '00000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'student cannot escalate role'
);
select throws_ok(
  $$ insert into public.daily_entries (student_id, entry_date, sleep_time, wake_time, study_minutes, academy_status) values ('00000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Kolkata')::date - 1, '22:00', '06:00', 240, 'present') $$,
  '42501', null, 'forged student id is rejected'
);

reset role;
select is((select min_study_minutes::integer from public.alert_settings), 240, 'student cannot change global settings');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.daily_entries), 2, 'admin can report across students');
select lives_ok(
  $$ update public.daily_entries set note = 'admin edit' $$,
  'admin entry update is filtered by RLS'
);
select lives_ok(
  $$ update public.alert_settings set min_study_minutes = 120 $$,
  'admin settings update is filtered by RLS'
);

reset role;
select is((select count(*)::integer from public.daily_entries where note = 'admin edit'), 0, 'admin cannot alter student data');
select is((select min_study_minutes::integer from public.alert_settings), 240, 'admin cannot change global settings');
update public.profiles set is_active = false where id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.daily_entries), 0, 'inactive user loses database access');

select * from finish();
rollback;
