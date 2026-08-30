begin;

create extension if not exists pgtap with schema extensions;
select plan(135);

select has_column('public', 'profiles', 'student_group', 'profiles expose the canonical student group');
select has_table('public', 'payment_settings', 'payment settings persist the QR path and instructions');
select has_table('public', 'student_payments', 'student payments persist monthly payment proofs');
select has_column('public', 'leave_requests', 'decision_version', 'leave decisions carry a stable version');
select has_table('public', 'leave_notification_deliveries', 'leave notification delivery state is durable');
select has_column('public', 'leave_notification_deliveries', 'lease_token', 'each delivery claim has a unique lease token');
select is(
  (select enum_range(null::public.student_group)::text),
  '{abhay_hostel,krishna_home}',
  'student groups use only the two canonical values'
);
select is(
  (select enum_range(null::public.payment_status)::text),
  '{pending,verified,rejected}',
  'payment status uses the required workflow values'
);
select is((select count(*)::integer from public.payment_settings), 1, 'payment settings is a singleton');
select is((select count(*)::integer from storage.buckets where id = 'payment-qr'), 1, 'the private payment QR bucket exists');
select is(
  (select public from storage.buckets where id = 'payment-qr'),
  false,
  'the payment QR bucket is private'
);
select is(
  (select confdeltype::text from pg_constraint where conname = 'student_payments_student_id_fkey'),
  'r',
  'student payment ownership uses ON DELETE RESTRICT'
);
select is(
  (select confdeltype::text from pg_constraint where conname = 'student_payments_reviewed_by_fkey'),
  'r',
  'student payment reviewer history uses ON DELETE RESTRICT'
);
select is(
  (select confdeltype::text from pg_constraint where conname = 'leave_notification_deliveries_leave_request_id_fkey'),
  'r',
  'leave notification history uses ON DELETE RESTRICT'
);

select is(has_table_privilege('authenticated', 'public.student_payments', 'select'), true, 'authenticated users receive payment SELECT');
select is(has_table_privilege('authenticated', 'public.student_payments', 'insert'), false, 'authenticated users cannot insert payments directly');
select is(has_table_privilege('authenticated', 'public.student_payments', 'update'), false, 'authenticated users cannot update payments directly');
select is(has_table_privilege('authenticated', 'public.student_payments', 'delete'), false, 'authenticated users cannot delete payments directly');
select is(has_table_privilege('authenticated', 'public.payment_settings', 'select'), true, 'authenticated users receive payment-settings SELECT');
select is(has_table_privilege('authenticated', 'public.payment_settings', 'update'), false, 'authenticated users cannot update payment settings directly');
select is(has_table_privilege('authenticated', 'public.leave_notification_deliveries', 'select'), true, 'authenticated users receive notification SELECT');
select is(has_table_privilege('authenticated', 'public.leave_notification_deliveries', 'insert'), false, 'authenticated users cannot insert notifications directly');
select is(has_column_privilege('authenticated', 'public.profiles', 'student_group', 'update'), false, 'authenticated users cannot change groups directly');
select is(has_column_privilege('service_role', 'public.profiles', 'student_group', 'update'), false, 'service role cannot bypass the student-group audit RPC');
select is(has_column_privilege('service_role', 'public.profiles', 'is_active', 'update'), true, 'service role retains unrelated profile maintenance access');
select is(has_table_privilege('service_role', 'public.payment_settings', 'select'), true, 'service role can read payment settings');
select is(has_table_privilege('service_role', 'public.payment_settings', 'insert'), false, 'service role cannot insert payment settings directly');
select is(has_table_privilege('service_role', 'public.payment_settings', 'update'), false, 'service role cannot update payment settings directly');
select is(has_table_privilege('service_role', 'public.payment_settings', 'delete'), false, 'service role cannot delete payment settings directly');
select is(has_table_privilege('service_role', 'public.student_payments', 'select'), true, 'service role can read student payments');
select is(has_table_privilege('service_role', 'public.student_payments', 'insert'), false, 'service role cannot insert student payments directly');
select is(has_table_privilege('service_role', 'public.student_payments', 'update'), false, 'service role cannot update student payments directly');
select is(has_table_privilege('service_role', 'public.student_payments', 'delete'), false, 'service role cannot delete student payments directly');
select is(has_table_privilege('service_role', 'public.leave_notification_deliveries', 'select'), true, 'service role can read notification deliveries');
select is(has_table_privilege('service_role', 'public.leave_notification_deliveries', 'insert'), false, 'service role cannot insert notification deliveries directly');
select is(has_table_privilege('service_role', 'public.leave_notification_deliveries', 'update'), false, 'service role cannot update notification deliveries directly');
select is(has_table_privilege('service_role', 'public.leave_notification_deliveries', 'delete'), false, 'service role cannot delete notification deliveries directly');

select function_privs_are(
  'public', 'update_student_group', array['uuid', 'uuid', 'student_group'],
  'authenticated', array[]::text[], 'authenticated users cannot change a student group through the server RPC'
);
select function_privs_are(
  'public', 'update_student_group', array['uuid', 'uuid', 'student_group'],
  'service_role', array['EXECUTE']::text[], 'service role can change a student group transactionally'
);
select function_privs_are(
  'public', 'update_payment_settings', array['uuid', 'text', 'text'],
  'authenticated', array[]::text[], 'authenticated users cannot change payment settings through the server RPC'
);
select function_privs_are(
  'public', 'update_payment_settings', array['uuid', 'text', 'text'],
  'service_role', array['EXECUTE']::text[], 'service role can change payment settings transactionally'
);

select function_privs_are(
  'public', 'submit_student_payment', array['uuid', 'date', 'bigint', 'date', 'text', 'text'],
  'authenticated', array[]::text[], 'authenticated users cannot bypass the server submission boundary'
);
select function_privs_are(
  'public', 'submit_student_payment', array['uuid', 'date', 'bigint', 'date', 'text', 'text'],
  'service_role', array['EXECUTE']::text[], 'service role can submit a payment transactionally'
);
select function_privs_are(
  'public', 'resubmit_student_payment', array['uuid', 'uuid', 'integer', 'date', 'bigint', 'date', 'text', 'text'],
  'authenticated', array[]::text[], 'authenticated users cannot bypass the server resubmission boundary'
);
select function_privs_are(
  'public', 'resubmit_student_payment', array['uuid', 'uuid', 'integer', 'date', 'bigint', 'date', 'text', 'text'],
  'service_role', array['EXECUTE']::text[], 'service role can resubmit a payment transactionally'
);
select function_privs_are(
  'public', 'verify_student_payment', array['uuid', 'uuid', 'integer'],
  'authenticated', array[]::text[], 'authenticated users cannot verify payments directly'
);
select function_privs_are(
  'public', 'verify_student_payment', array['uuid', 'uuid', 'integer'],
  'service_role', array['EXECUTE']::text[], 'service role can verify a payment transactionally'
);
select function_privs_are(
  'public', 'reject_student_payment', array['uuid', 'uuid', 'integer', 'text'],
  'authenticated', array[]::text[], 'authenticated users cannot reject payments directly'
);
select function_privs_are(
  'public', 'reject_student_payment', array['uuid', 'uuid', 'integer', 'text'],
  'service_role', array['EXECUTE']::text[], 'service role can reject a payment transactionally'
);
select function_privs_are(
  'public', 'decide_leave_request', array['uuid', 'uuid', 'text', 'text', 'text'],
  'authenticated', array[]::text[], 'authenticated users cannot bypass the server leave-decision boundary'
);
select function_privs_are(
  'public', 'decide_leave_request', array['uuid', 'uuid', 'text', 'text', 'text'],
  'service_role', array['EXECUTE']::text[], 'service role can decide leave transactionally'
);
select function_privs_are(
  'public', 'claim_leave_notification_batch', array['uuid', 'integer', 'integer'],
  'authenticated', array[]::text[], 'authenticated users cannot claim notification deliveries'
);
select function_privs_are(
  'public', 'claim_leave_notification_batch', array['uuid', 'integer', 'integer'],
  'service_role', array['EXECUTE']::text[], 'service role can claim notification deliveries'
);
select function_privs_are(
  'public', 'complete_leave_notification_delivery', array['uuid', 'uuid', 'uuid', 'boolean', 'text', 'text'],
  'authenticated', array[]::text[], 'authenticated users cannot complete notification deliveries'
);
select function_privs_are(
  'public', 'complete_leave_notification_delivery', array['uuid', 'uuid', 'uuid', 'boolean', 'text', 'text'],
  'service_role', array['EXECUTE']::text[], 'service role can complete notification deliveries'
);
select function_privs_are(
  'public', 'retry_leave_notification', array['uuid', 'uuid'],
  'authenticated', array[]::text[], 'authenticated users cannot retry notification deliveries'
);
select function_privs_are(
  'public', 'retry_leave_notification', array['uuid', 'uuid'],
  'service_role', array['EXECUTE']::text[], 'service role can retry notification deliveries'
);

select policies_are(
  'public', 'student_payments', array['student_payments_select_authorized']::name[],
  'student payments expose one SELECT-only authorization policy'
);
select policies_are(
  'public', 'payment_settings', array['payment_settings_select_active']::name[],
  'payment settings expose one active-user SELECT policy'
);
select policies_are(
  'public', 'leave_notification_deliveries', array['leave_notifications_select_authorized']::name[],
  'leave notifications expose one SELECT-only authorization policy'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'group-one@example.com', '', now(), '{"role":"student"}', '{"full_name":"Legacy Student","joined_on":"2026-01-01"}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'group-two@example.com', '', now(), '{"role":"student"}', '{"full_name":"Krishna Student","joined_on":"2026-01-01","student_group":"krishna_home"}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'group-mentor@example.com', '', now(), '{"role":"admin"}', '{"full_name":"Group Mentor","student_group":"krishna_home"}', now(), now()),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'group-owner@example.com', '', now(), '{"role":"super_admin"}', '{"full_name":"Group Owner","student_group":"krishna_home"}', now(), now()),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive@example.com', '', now(), '{"role":"student"}', '{"full_name":"Inactive Student","joined_on":"2026-01-01"}', now(), now()),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invalid-address', '', now(), '{"role":"student"}', '{"full_name":"Invalid Email Student","joined_on":"2026-01-01"}', now(), now()),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'replacement-mentor@example.com', '', now(), '{"role":"admin"}', '{"full_name":"Replacement Mentor"}', now(), now());

update public.profiles
set mentor_id = '10000000-0000-4000-8000-000000000003'
where id = '10000000-0000-4000-8000-000000000001';
update public.profiles
set is_active = false
where id = '10000000-0000-4000-8000-000000000005';

select is(
  (select student_group::text from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'abhay_hostel',
  'legacy student creation defaults to Abhay Hostel'
);
select is(
  (select student_group::text from public.profiles where id = '10000000-0000-4000-8000-000000000002'),
  'krishna_home',
  'explicit student group metadata is preserved'
);
select is(
  (select student_group::text from public.profiles where id = '10000000-0000-4000-8000-000000000005'),
  'abhay_hostel',
  'inactive students retain the Abhay Hostel migration default'
);
select is(
  (select student_group::text from public.profiles where id = '10000000-0000-4000-8000-000000000003'),
  null,
  'Mentor profiles never receive a student group'
);
select is(
  (select student_group::text from public.profiles where id = '10000000-0000-4000-8000-000000000004'),
  null,
  'Super Admin profiles never receive a student group'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
insert into public.daily_entries (
  student_id, entry_date, sleep_time, wake_time, study_minutes, chanting_rounds, gita_class_status
) values (
  '10000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date,
  '22:00', '05:00', 360, 2, 'present'
);
insert into public.gita_class_attendance (student_id, attendance_date, status, recorded_by)
values (
  '10000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date,
  'present', '10000000-0000-4000-8000-000000000004'
);
select set_config('request.jwt.claim.sub', '', true);

insert into public.leave_requests (
  id, student_id, start_date, end_date, reason, status, decided_by, decided_at, decision_version
) values
  ('10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', current_date + 10, current_date + 11, 'Existing decided leave', 'approved', '10000000-0000-4000-8000-000000000004', now(), 1),
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', current_date + 20, current_date + 21, 'Future decision leave', 'pending', null, null, 0),
  ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000006', current_date + 30, current_date + 31, 'Invalid email leave', 'pending', null, null, 0);

insert into public.audit_events (actor_id, action, target_id, metadata)
values ('10000000-0000-4000-8000-000000000004', 'account_created', '10000000-0000-4000-8000-000000000001', '{}'::jsonb);

select lives_ok(
  $$
    insert into public.audit_events (actor_id, action, target_id, metadata)
    select null, historical_action, null, '{}'::jsonb
    from unnest(array[
      'account_created', 'account_deactivated', 'account_reactivated', 'credential_reset',
      'settings_updated', 'score_settings_updated', 'report_exported', 'super_admin_bootstrapped',
      'mentor_assigned', 'entry_corrected', 'resource_created', 'resource_updated',
      'weekly_program_created', 'weekly_program_closed', 'weekly_program_reopened',
      'attendance_person_created', 'attendance_event_created', 'attendance_recorded',
      'leave_approved', 'leave_rejected', 'student_birthdate_updated',
      'cleanup_settings_updated', 'cleanup_history_completed', 'cleanup_history_partial',
      'student_deletion_completed', 'student_deletion_partial'
    ]::text[]) as historical_actions(historical_action)
  $$,
  'every historical audit action remains accepted'
);

create temporary table task1_counts as
select
  (select count(*) from public.profiles where role = 'student') as student_count,
  (select count(*) from public.daily_entries) as daily_entry_count,
  (select count(*) from public.leave_requests) as leave_count,
  ((select count(*) from public.gita_class_attendance)
    + (select count(*) from public.attendance_records)
    + (select count(*) from public.weekly_program_entries)) as attendance_count,
  (select count(*) from public.audit_events) as audit_count;

select is(
  (select decision_version from public.leave_requests where id = '10000000-0000-4000-8000-000000000010'),
  1,
  'an existing decided leave has a nonzero decision version'
);
select is(
  (select count(*)::integer from public.leave_notification_deliveries where leave_request_id = '10000000-0000-4000-8000-000000000010'),
  0,
  'an existing decided leave receives no retrospective notification'
);

insert into public.leave_requests (id, student_id, start_date, end_date, reason)
values (
  '10000000-0000-4000-8000-000000000013',
  '10000000-0000-4000-8000-000000000002',
  current_date + 40,
  current_date + 41,
  'Retention constraint fixture'
);
insert into public.leave_notification_deliveries (
  leave_request_id, student_id, decision_version, decision, recipient_email,
  student_name, leave_start_date, leave_end_date, status, idempotency_key, sent_at
) values (
  '10000000-0000-4000-8000-000000000013',
  '10000000-0000-4000-8000-000000000002',
  1,
  'approved',
  'group-two@example.com',
  'Krishna Student',
  current_date + 40,
  current_date + 41,
  'sent',
  'leave-decision:10000000-0000-4000-8000-000000000013:1',
  now()
);
select throws_ok(
  $$ delete from public.leave_requests where id = '10000000-0000-4000-8000-000000000013' $$,
  '23503', null, 'notification history restricts deletion of its leave request'
);

select is(
  (public.update_student_group(
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'krishna_home'::public.student_group
  )).student_group::text,
  'krishna_home',
  'Super Admin can change a student group transactionally'
);
select is(
  (select metadata ->> 'old_group' from public.audit_events where action = 'student_group_updated' order by id desc limit 1),
  'abhay_hostel',
  'student group audit captures the old group'
);
select is(
  (select metadata ->> 'new_group' from public.audit_events where action = 'student_group_updated' order by id desc limit 1),
  'krishna_home',
  'student group audit captures the new group'
);
select throws_ok(
  $$ select public.update_student_group('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'abhay_hostel') $$,
  '42501', 'active super admin required', 'Mentor cannot change a student group'
);

select is(
  (public.update_payment_settings(
    '10000000-0000-4000-8000-000000000004',
    'payment-qr-1725000000000.png',
    'Scan the QR and submit your UTR.'
  )).instructions,
  'Scan the QR and submit your UTR.',
  'payment settings and their audit write commit through one RPC'
);
select is(
  (select count(*)::integer from public.audit_events where action = 'payment_settings_updated'),
  1,
  'payment settings update writes one audit event'
);

create temporary table task1_payment_ids (
  label text primary key,
  payment_id uuid not null,
  payment_version integer not null
);

insert into task1_payment_ids
select 'student-one-september', result.id, result.version
from public.submit_student_payment(
  '10000000-0000-4000-8000-000000000001', date '2026-09-01', 125050,
  date '2026-08-30', 'utrstudentone01', 'September fee'
) as result;
insert into task1_payment_ids
select 'student-one-october', result.id, result.version
from public.submit_student_payment(
  '10000000-0000-4000-8000-000000000001', date '2026-10-01', 125050,
  date '2026-08-30', 'UTRSTUDENTONE02', null
) as result;
insert into task1_payment_ids
select 'student-two-september', result.id, result.version
from public.submit_student_payment(
  '10000000-0000-4000-8000-000000000002', date '2026-09-01', 125050,
  date '2026-08-30', 'UTRSTUDENTTWO01', null
) as result;

select is(
  (select status::text from public.student_payments where id = (select payment_id from task1_payment_ids where label = 'student-one-september')),
  'pending',
  'a submitted payment starts pending'
);
select is(
  (select utr from public.student_payments where id = (select payment_id from task1_payment_ids where label = 'student-one-september')),
  'UTRSTUDENTONE01',
  'submitted UTR values are normalized to uppercase'
);
select throws_ok(
  $$ select public.submit_student_payment('10000000-0000-4000-8000-000000000001', date '2026-09-01', 90000, date '2026-08-30', 'DIFFERENTUTR01', null) $$,
  '23505', 'payment submission conflicts with an existing record', 'one payment per student and fee month is enforced'
);
select throws_ok(
  $$ select public.submit_student_payment('10000000-0000-4000-8000-000000000002', date '2026-10-01', 90000, date '2026-08-30', 'UTRSTUDENTONE01', null) $$,
  '23505', 'payment submission conflicts with an existing record', 'UTR uniqueness is global without leaking another student'
);

select is(
  (public.verify_student_payment(
    '10000000-0000-4000-8000-000000000003',
    (select payment_id from task1_payment_ids where label = 'student-one-september'), 1
  )).status::text,
  'verified',
  'assigned Mentor can verify a pending payment'
);
select is(
  (select reviewed_by from public.student_payments where id = (select payment_id from task1_payment_ids where label = 'student-one-september')),
  '10000000-0000-4000-8000-000000000003'::uuid,
  'payment verification records the reviewer'
);

select is(
  (public.reject_student_payment(
    '10000000-0000-4000-8000-000000000004',
    (select payment_id from task1_payment_ids where label = 'student-one-october'), 1,
    'The bank reference is unreadable.'
  )).status::text,
  'rejected',
  'Super Admin can reject a pending payment with a reason'
);
select is(
  (select rejection_reason from public.student_payments where id = (select payment_id from task1_payment_ids where label = 'student-one-october')),
  'The bank reference is unreadable.',
  'payment rejection persists its reason'
);
select throws_ok(
  format(
    'select public.verify_student_payment(%L, %L, 1)',
    '10000000-0000-4000-8000-000000000004',
    (select payment_id from task1_payment_ids where label = 'student-one-october')
  ),
  '40001', 'payment changed before review', 'stale payment review is rejected by compare-and-set'
);
select throws_ok(
  format(
    'select public.verify_student_payment(%L, %L, null)',
    '10000000-0000-4000-8000-000000000004',
    (select payment_id from task1_payment_ids where label = 'student-one-october')
  ),
  '40001', 'payment changed before review', 'a null payment version cannot bypass compare-and-set'
);

update task1_payment_ids
set payment_version = 2
where label = 'student-one-october';
select is(
  (public.resubmit_student_payment(
    '10000000-0000-4000-8000-000000000001',
    (select payment_id from task1_payment_ids where label = 'student-one-october'), 2,
    date '2026-10-01', 125050, date '2026-08-30', 'UTRSTUDENTONE03', 'Corrected proof'
  )).status::text,
  'pending',
  'a student can correct and resubmit a rejected payment'
);
select ok(
  (select reviewed_by is null and reviewed_at is null and rejection_reason is null
   from public.student_payments where id = (select payment_id from task1_payment_ids where label = 'student-one-october')),
  'resubmission clears the previous review fields'
);
select is(
  (select version from public.student_payments where id = (select payment_id from task1_payment_ids where label = 'student-one-october')),
  3,
  'payment version increments on rejection and resubmission'
);
select is(
  (public.verify_student_payment(
    '10000000-0000-4000-8000-000000000004',
    (select payment_id from task1_payment_ids where label = 'student-one-october'), 3
  )).status::text,
  'verified',
  'the corrected payment can be verified at its current version'
);
select throws_ok(
  $$ select public.cleanup_preview_history('10000000-0000-4000-8000-000000000004', 90, array['student_payments']::text[]) $$,
  '22023', 'unsupported cleanup category', 'student payments are excluded from automatic cleanup'
);

select is(
  (public.decide_leave_request(
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000011', 'pending', 'approved', null
  ) ->> 'decision_version')::integer,
  1,
  'the first future leave decision receives version one'
);
select is(
  (select count(*)::integer from public.leave_notification_deliveries where leave_request_id = '10000000-0000-4000-8000-000000000011'),
  1,
  'a future leave decision creates one notification snapshot'
);
select throws_ok(
  $$ select public.decide_leave_request('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000012', null, 'approved', null) $$,
  '40001', 'leave request changed before decision', 'a null leave status cannot bypass compare-and-set'
);
select is(
  (public.decide_leave_request(
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000011', 'approved', 'approved', null
  ) ->> 'changed')::boolean,
  false,
  'a repeated no-op leave decision reports no change'
);
select is(
  (select count(*)::integer from public.leave_notification_deliveries where leave_request_id = '10000000-0000-4000-8000-000000000011'),
  1,
  'a repeated no-op leave decision creates no duplicate email'
);

create temporary table task1_notification_ids as
select decision_version, id
from public.leave_notification_deliveries
where leave_request_id = '10000000-0000-4000-8000-000000000011';

select throws_ok(
  $$ select public.claim_leave_notification_batch(null, 1, 60) $$,
  '22023', 'notification worker is required', 'notification claims reject a null worker'
);
select throws_ok(
  $$ select public.claim_leave_notification_batch('10000000-0000-4000-8000-000000000099', null, 60) $$,
  '22023', 'invalid notification batch size', 'notification claims reject a null batch size'
);
select throws_ok(
  $$ select public.claim_leave_notification_batch('10000000-0000-4000-8000-000000000099', 1, null) $$,
  '22023', 'invalid notification lease duration', 'notification claims reject a null lease duration'
);

create temporary table task1_claim_tokens (
  label text primary key,
  lease_token uuid not null,
  claimed_status text not null
);
insert into task1_claim_tokens
select
  'first',
  (claim_result -> 0 ->> 'lease_token')::uuid,
  claim_result -> 0 ->> 'status'
from (
  select public.claim_leave_notification_batch(
    '10000000-0000-4000-8000-000000000099', 1, 60
  ) as claim_result
) claimed;
select is(
  (select claimed_status from task1_claim_tokens where label = 'first'),
  'sending',
  'notification delivery can be claimed with a server lease'
);
update public.leave_notification_deliveries
set lease_expires_at = clock_timestamp() - interval '1 second'
where id = (select id from task1_notification_ids where decision_version = 1);
insert into task1_claim_tokens
select
  'second',
  (claim_result -> 0 ->> 'lease_token')::uuid,
  claim_result -> 0 ->> 'status'
from (
  select public.claim_leave_notification_batch(
    '10000000-0000-4000-8000-000000000099', 1, 60
  ) as claim_result
) claimed;
select isnt(
  (select lease_token from task1_claim_tokens where label = 'first'),
  (select lease_token from task1_claim_tokens where label = 'second'),
  'an expired delivery claim receives a new lease token'
);
select throws_ok(
  format(
    'select public.complete_leave_notification_delivery(%L, %L, %L, true, %L, null)',
    (select id from task1_notification_ids where decision_version = 1),
    '10000000-0000-4000-8000-000000000099',
    (select lease_token from task1_claim_tokens where label = 'first'),
    'stale-provider-message'
  ),
  '40001', 'notification delivery lease is stale', 'an earlier lease token cannot complete a later claim'
);
select is(
  public.complete_leave_notification_delivery(
    (select id from task1_notification_ids where decision_version = 1),
    '10000000-0000-4000-8000-000000000099',
    (select lease_token from task1_claim_tokens where label = 'second'),
    true, 'provider-message-1', null
  ),
  true,
  'a claimed notification can be marked sent'
);
select is(
  (select count(*)::integer from public.audit_events where action = 'leave_notification_claimed'),
  2,
  'every successful notification claim writes an audit event'
);
select is(
  (select count(*)::integer from public.audit_events where action = 'leave_notification_lease_expired'),
  1,
  'expired notification lease recovery writes an audit event'
);
select is(
  (select count(*)::integer from public.audit_events where action = 'leave_notification_sent'),
  1,
  'successful notification completion writes an audit event'
);

select is(
  (public.decide_leave_request(
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000011', 'approved', 'rejected', 'Plans were not approved.'
  ) ->> 'decision_version')::integer,
  2,
  'approved leave can be changed to rejected with a new version'
);
select is(
  (select count(*)::integer from public.leave_notification_deliveries where leave_request_id = '10000000-0000-4000-8000-000000000011'),
  2,
  'each real leave decision version has one notification row'
);
insert into task1_notification_ids
select decision_version, id
from public.leave_notification_deliveries
where leave_request_id = '10000000-0000-4000-8000-000000000011' and decision_version = 2;
insert into task1_claim_tokens
select
  'third',
  (claim_result -> 0 ->> 'lease_token')::uuid,
  claim_result -> 0 ->> 'status'
from (
  select public.claim_leave_notification_batch(
    '10000000-0000-4000-8000-000000000099', 1, 60
  ) as claim_result
) claimed;
select is(
  (select claimed_status from task1_claim_tokens where label = 'third'),
  'sending',
  'the second decision notification can be claimed independently'
);
select is(
  public.complete_leave_notification_delivery(
    (select id from task1_notification_ids where decision_version = 2),
    '10000000-0000-4000-8000-000000000099',
    (select lease_token from task1_claim_tokens where label = 'third'),
    false, null, 'resend unavailable'
  ),
  true,
  'a claimed notification can be marked failed without rolling back its decision'
);
select is(
  (select count(*)::integer from public.audit_events where action = 'leave_notification_failed'),
  1,
  'failed notification completion writes an audit event'
);
update public.leave_notification_deliveries
set attempt_count = 20
where id = (select id from task1_notification_ids where decision_version = 2);
select is(
  public.retry_leave_notification(
    '10000000-0000-4000-8000-000000000004',
    (select id from task1_notification_ids where decision_version = 2)
  ),
  true,
  'Super Admin can return a failed notification to the retry queue'
);
select is(
  (select attempt_count from public.leave_notification_deliveries where id = (select id from task1_notification_ids where decision_version = 2)),
  0,
  'Super Admin retry resets exhausted delivery attempts'
);
insert into task1_claim_tokens
select
  'fourth',
  (claim_result -> 0 ->> 'lease_token')::uuid,
  claim_result -> 0 ->> 'status'
from (
  select public.claim_leave_notification_batch(
    '10000000-0000-4000-8000-000000000099', 1, 60
  ) as claim_result
) claimed;
select is(
  (select claimed_status from task1_claim_tokens where label = 'fourth'),
  'sending',
  'an exhausted failed notification becomes claimable after Super Admin retry'
);

alter table public.profiles alter column email drop not null;
update public.profiles
set email = null
where id = '10000000-0000-4000-8000-000000000006';
select is(
  (public.decide_leave_request(
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000012', 'pending', 'approved', null
  ) ->> 'decision_version')::integer,
  1,
  'a decision still commits when the student email is missing'
);
select is(
  (select status from public.leave_notification_deliveries where leave_request_id = '10000000-0000-4000-8000-000000000012'),
  'failed',
  'a missing recipient creates a failed retryable notification'
);
select is(
  (select recipient_email from public.leave_notification_deliveries where leave_request_id = '10000000-0000-4000-8000-000000000012'),
  null,
  'a failed notification durably snapshots the missing recipient'
);

insert into public.student_payments (
  student_id, fee_month, amount_paise, payment_date, utr
) values (
  '10000000-0000-4000-8000-000000000005', date '2026-09-01', 125050,
  date '2026-08-30', 'INACTIVESTUDENT01'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.student_payments), 2, 'Student sees only their own payment history');
select is((select count(*)::integer from public.leave_notification_deliveries), 2, 'Student sees only their own leave notifications');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.student_payments), 1, 'second Student sees only their own payment history');
select is((select count(*)::integer from public.leave_notification_deliveries), 1, 'second Student sees only their own retained notification');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select is((select count(*)::integer from public.student_payments), 0, 'inactive Student cannot read their own retained payment');
select is((select count(*)::integer from public.payment_settings), 0, 'inactive Student cannot read payment settings');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.student_payments), 2, 'Mentor sees payments only for currently assigned Students');
select is((select count(*)::integer from public.leave_notification_deliveries), 2, 'Mentor sees notifications only for currently assigned Students');

reset role;
update public.profiles
set mentor_id = '10000000-0000-4000-8000-000000000007'
where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.student_payments), 0, 'previous Mentor loses payment access after reassignment');
select is((select count(*)::integer from public.leave_notification_deliveries), 0, 'previous Mentor loses notification access after reassignment');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000007', true);
select is((select count(*)::integer from public.student_payments), 2, 'replacement Mentor gains payment access after reassignment');
select is((select count(*)::integer from public.leave_notification_deliveries), 2, 'replacement Mentor gains notification access after reassignment');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.student_payments), 4, 'Super Admin sees all student payments');
select is((select count(*)::integer from public.leave_notification_deliveries), 4, 'Super Admin sees all leave notifications');

reset role;
select cmp_ok(
  (select count(*) from public.profiles where role = 'student'), '>=',
  (select student_count from task1_counts),
  'student rows are not lost'
);
select cmp_ok(
  (select count(*) from public.daily_entries), '>=',
  (select daily_entry_count from task1_counts),
  'daily-entry rows are not lost'
);
select cmp_ok(
  (select count(*) from public.leave_requests), '>=',
  (select leave_count from task1_counts),
  'leave rows are not lost'
);
select cmp_ok(
  ((select count(*) from public.gita_class_attendance)
    + (select count(*) from public.attendance_records)
    + (select count(*) from public.weekly_program_entries)), '>=',
  (select attendance_count from task1_counts),
  'attendance rows are not lost'
);
select cmp_ok(
  (select count(*) from public.audit_events), '>=',
  (select audit_count from task1_counts),
  'audit rows are not lost'
);

select * from finish();
rollback;
