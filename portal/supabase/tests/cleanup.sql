begin;

create extension if not exists pgtap with schema extensions;
select plan(65);

select has_table('public', 'cleanup_settings', 'cleanup settings persist the automatic toggle');
select has_table('public', 'cleanup_runs', 'cleanup runs persist durable state');
select has_table('public', 'cleanup_candidates', 'cleanup candidates persist exact historical selection');
select has_table('public', 'cleanup_object_tasks', 'cleanup object tasks persist deletion work');
select has_column('public', 'profiles', 'deletion_pending_at', 'profiles expose deletion-pending state');
select has_column('public', 'audit_events', 'cleanup_run_id', 'audit events can correlate a cleanup run');

select is(
  (select automatic_enabled from public.cleanup_settings where id),
  false,
  'automatic cleanup is disabled by default'
);
select is(
  (select deletion_pending_at from public.profiles limit 1),
  null,
  'existing profiles begin without deletion pending state'
);

select policies_are('public', 'cleanup_settings', array[]::name[], 'cleanup settings have no browser RLS policies');
select policies_are('public', 'cleanup_runs', array[]::name[], 'cleanup runs have no browser RLS policies');
select is((select relforcerowsecurity from pg_class where oid = 'public.cleanup_settings'::regclass), true, 'cleanup settings force RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.cleanup_runs'::regclass), true, 'cleanup runs force RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.cleanup_candidates'::regclass), true, 'cleanup candidates force RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.cleanup_object_tasks'::regclass), true, 'cleanup object tasks force RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.cleanup_global_lease'::regclass), true, 'global cleanup lease forces RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.cleanup_path_reservations'::regclass), true, 'cleanup path reservations force RLS');

select function_privs_are(
  'public', 'cleanup_get_settings', '{}', 'anon', array[]::text[],
  'anonymous users cannot call cleanup settings RPC'
);
select function_privs_are(
  'public', 'cleanup_get_settings', '{}', 'authenticated', array[]::text[],
  'authenticated users cannot call cleanup settings RPC'
);
select function_privs_are(
  'public', 'cleanup_get_settings', '{}', 'service_role', array['EXECUTE']::text[],
  'service role can call cleanup settings RPC'
);
select function_privs_are(
  'public', 'cleanup_update_auto', array['uuid', 'boolean'], 'anon', array[]::text[],
  'anonymous users cannot change cleanup settings'
);
select function_privs_are(
  'public', 'cleanup_update_auto', array['uuid', 'boolean'], 'authenticated', array[]::text[],
  'authenticated users cannot change cleanup settings'
);
select function_privs_are(
  'public', 'cleanup_update_auto', array['uuid', 'boolean'], 'service_role', array['EXECUTE']::text[],
  'service role can change cleanup settings'
);
select function_privs_are('public', 'cleanup_claim_lease', array['uuid', 'uuid'], 'anon', array[]::text[], 'anonymous users cannot claim the cleanup lease');
select function_privs_are('public', 'cleanup_claim_lease', array['uuid', 'uuid'], 'authenticated', array[]::text[], 'authenticated users cannot claim the cleanup lease');
select function_privs_are('public', 'cleanup_claim_lease', array['uuid', 'uuid'], 'service_role', array['EXECUTE']::text[], 'service role can claim the cleanup lease');
select function_privs_are('public', 'cleanup_release_lease', array['uuid', 'uuid', 'bigint'], 'anon', array[]::text[], 'anonymous users cannot release the cleanup lease');
select function_privs_are('public', 'cleanup_release_lease', array['uuid', 'uuid', 'bigint'], 'authenticated', array[]::text[], 'authenticated users cannot release the cleanup lease');
select function_privs_are('public', 'cleanup_release_lease', array['uuid', 'uuid', 'bigint'], 'service_role', array['EXECUTE']::text[], 'service role can release the cleanup lease');
select function_privs_are('public', 'cleanup_get_run', array['uuid'], 'anon', array[]::text[], 'anonymous users cannot load a cleanup run');
select function_privs_are('public', 'cleanup_get_run', array['uuid'], 'authenticated', array[]::text[], 'authenticated users cannot load a cleanup run');
select function_privs_are('public', 'cleanup_get_run', array['uuid'], 'service_role', array['EXECUTE']::text[], 'service role can load a cleanup run');
select function_privs_are('public', 'cleanup_resume_run', array['uuid', 'uuid'], 'anon', array[]::text[], 'anonymous users cannot resume cleanup');
select function_privs_are('public', 'cleanup_resume_run', array['uuid', 'uuid'], 'authenticated', array[]::text[], 'authenticated users cannot resume cleanup');
select function_privs_are('public', 'cleanup_resume_run', array['uuid', 'uuid'], 'service_role', array['EXECUTE']::text[], 'service role can resume cleanup');
select function_privs_are('public', 'cleanup_cancel_expired_previews', '{}', 'anon', array[]::text[], 'anonymous users cannot cancel expired previews');
select function_privs_are('public', 'cleanup_cancel_expired_previews', '{}', 'authenticated', array[]::text[], 'authenticated users cannot cancel expired previews');
select function_privs_are('public', 'cleanup_cancel_expired_previews', '{}', 'service_role', array['EXECUTE']::text[], 'service role can cancel expired previews');
select function_privs_are('public', 'cleanup_finalize_run', array['uuid', 'uuid', 'bigint', 'text', 'jsonb'], 'anon', array[]::text[], 'anonymous users cannot finalize cleanup');
select function_privs_are('public', 'cleanup_finalize_run', array['uuid', 'uuid', 'bigint', 'text', 'jsonb'], 'authenticated', array[]::text[], 'authenticated users cannot finalize cleanup');
select function_privs_are('public', 'cleanup_finalize_run', array['uuid', 'uuid', 'bigint', 'text', 'jsonb'], 'service_role', array['EXECUTE']::text[], 'service role can finalize cleanup');
select function_privs_are('public', 'cleanup_housekeep_terminal_runs', '{}', 'anon', array[]::text[], 'anonymous users cannot housekeep cleanup runs');
select function_privs_are('public', 'cleanup_housekeep_terminal_runs', '{}', 'authenticated', array[]::text[], 'authenticated users cannot housekeep cleanup runs');
select function_privs_are('public', 'cleanup_housekeep_terminal_runs', '{}', 'service_role', array['EXECUTE']::text[], 'service role can housekeep cleanup runs');

select has_function('public', 'cleanup_preview_history', array['uuid', 'integer', 'text[]'], 'historical cleanup creates an exact preview');
select like(
  pg_get_functiondef('public.cleanup_preview_history(uuid, integer, text[])'::regprocedure),
  '%jsonb_object_agg(counts.cleanup_category, counts.candidate_count)%',
  'preview impact qualifies its category column to avoid PL/pgSQL ambiguity'
);
select has_function('public', 'cleanup_enqueue_auto', array['uuid'], 'automatic cleanup enqueue is available');
select has_function('public', 'cleanup_confirm_preview', array['uuid', 'uuid'], 'preview confirmation is available');
select has_function('public', 'cleanup_process_database_batch', array['uuid', 'uuid', 'bigint', 'integer'], 'database batches are lease-fenced');
select has_function('public', 'cleanup_claim_object_batch', array['uuid', 'uuid', 'bigint', 'integer'], 'object batches are lease-fenced');
select has_function('public', 'cleanup_complete_object_tasks', array['uuid', 'uuid', 'bigint', 'jsonb'], 'object completion is lease-fenced');
select has_function('public', 'cleanup_dispatch_due_runs', '{}', 'due cleanup runs can be dispatched');

select function_privs_are('public', 'cleanup_preview_history', array['uuid', 'integer', 'text[]'], 'anon', array[]::text[], 'anonymous users cannot preview cleanup');
select function_privs_are('public', 'cleanup_preview_history', array['uuid', 'integer', 'text[]'], 'authenticated', array[]::text[], 'authenticated users cannot preview cleanup');
select function_privs_are('public', 'cleanup_preview_history', array['uuid', 'integer', 'text[]'], 'service_role', array['EXECUTE']::text[], 'service role can preview cleanup');
select function_privs_are('public', 'cleanup_enqueue_auto', array['uuid'], 'anon', array[]::text[], 'anonymous users cannot enqueue automatic cleanup');
select function_privs_are('public', 'cleanup_enqueue_auto', array['uuid'], 'authenticated', array[]::text[], 'authenticated users cannot enqueue automatic cleanup');
select function_privs_are('public', 'cleanup_enqueue_auto', array['uuid'], 'service_role', array['EXECUTE']::text[], 'service role can enqueue automatic cleanup');
select function_privs_are('public', 'cleanup_confirm_preview', array['uuid', 'uuid'], 'anon', array[]::text[], 'anonymous users cannot confirm cleanup');
select function_privs_are('public', 'cleanup_confirm_preview', array['uuid', 'uuid'], 'authenticated', array[]::text[], 'authenticated users cannot confirm cleanup');
select function_privs_are('public', 'cleanup_confirm_preview', array['uuid', 'uuid'], 'service_role', array['EXECUTE']::text[], 'service role can confirm cleanup');
select function_privs_are('public', 'cleanup_process_database_batch', array['uuid', 'uuid', 'bigint', 'integer'], 'anon', array[]::text[], 'anonymous users cannot process cleanup batches');
select function_privs_are('public', 'cleanup_claim_object_batch', array['uuid', 'uuid', 'bigint', 'integer'], 'authenticated', array[]::text[], 'authenticated users cannot claim cleanup objects');
select function_privs_are('public', 'cleanup_complete_object_tasks', array['uuid', 'uuid', 'bigint', 'jsonb'], 'service_role', array['EXECUTE']::text[], 'service role can complete cleanup objects');
select function_privs_are('public', 'cleanup_dispatch_due_runs', '{}', 'service_role', array['EXECUTE']::text[], 'service role can dispatch due cleanup runs');

select is(
  has_table_privilege('public', 'public.cleanup_runs', 'select'),
  false,
  'PUBLIC cannot read cleanup runs directly'
);

insert into public.cleanup_runs (id, mode, status, requested_by, categories, next_work_at)
values ('00000000-0000-4000-8000-000000000099', 'manual', 'running', null, array['daily_entries'], now());
update public.cleanup_global_lease
set active_run_id = '00000000-0000-4000-8000-000000000099',
    lease_owner = '00000000-0000-4000-8000-000000000098',
    lease_generation = 1,
    lease_expires_at = now() + interval '17 minutes'
where id;
select lives_ok(
  $$ select public.cleanup_finalize_run('00000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000098', 1, 'completed', '{}'::jsonb) $$,
  'a running cleanup run can be finalized once'
);
select throws_ok(
  $$ select public.cleanup_finalize_run('00000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000098', 1, 'completed', '{}'::jsonb) $$,
  '22023', 'cleanup run is not running', 'a terminal cleanup run cannot be finalized again'
);

select * from finish();
rollback;
