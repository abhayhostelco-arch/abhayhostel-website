begin;

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (action in (
  'account_created', 'account_deactivated', 'account_reactivated', 'credential_reset',
  'settings_updated', 'score_settings_updated', 'report_exported', 'super_admin_bootstrapped',
  'mentor_assigned', 'entry_corrected', 'resource_created', 'resource_updated',
  'weekly_program_created', 'weekly_program_closed', 'weekly_program_reopened',
  'attendance_person_created', 'attendance_event_created', 'attendance_recorded',
  'leave_approved', 'leave_rejected', 'student_birthdate_updated',
  'cleanup_settings_updated', 'cleanup_history_completed', 'cleanup_history_partial',
  'student_deletion_completed', 'student_deletion_partial', 'student_group_updated',
  'payment_settings_updated', 'payment_submitted', 'payment_resubmitted',
  'payment_verified', 'payment_rejected', 'payment_cancelled',
  'leave_notification_claimed', 'leave_notification_lease_expired',
  'leave_notification_sent', 'leave_notification_failed', 'leave_notification_retried'
));

create or replace function public.cancel_student_payment(
  p_actor_uuid uuid,
  p_payment_uuid uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.student_payments%rowtype;
begin
  select * into payment_row
  from public.student_payments
  where id = p_payment_uuid and student_id = p_actor_uuid
  for update;

  if not found or payment_row.status = 'verified' then
    raise exception 'payment cannot be cancelled' using errcode = '22023';
  end if;

  delete from public.student_payments where id = payment_row.id;
  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (p_actor_uuid, 'payment_cancelled', payment_row.id,
    jsonb_build_object('student_id', p_actor_uuid, 'fee_month', payment_row.fee_month, 'previous_status', payment_row.status));
  return true;
end;
$$;

revoke execute on function public.cancel_student_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_student_payment(uuid, uuid) to authenticated;

commit;
