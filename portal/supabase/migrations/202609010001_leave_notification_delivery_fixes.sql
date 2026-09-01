create function public.claim_leave_notification(
  p_worker_uuid uuid,
  p_notification_uuid uuid,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery public.leave_notification_deliveries%rowtype;
begin
  if p_worker_uuid is null then
    raise exception 'notification worker is required' using errcode = '22023';
  end if;
  if p_notification_uuid is null then
    raise exception 'notification delivery is required' using errcode = '22023';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'invalid notification lease duration' using errcode = '22023';
  end if;

  select * into delivery
  from public.leave_notification_deliveries
  where id = p_notification_uuid
  for update skip locked;

  if not found then
    return null;
  end if;

  if delivery.status = 'sending' and delivery.lease_expires_at <= clock_timestamp() then
    update public.leave_notification_deliveries
    set status = 'failed', lease_owner = null, lease_token = null, lease_expires_at = null,
      last_error = 'delivery lease expired', next_attempt_at = clock_timestamp()
    where id = delivery.id;

    insert into public.audit_events (actor_id, action, target_id, metadata)
    values (null, 'leave_notification_lease_expired', delivery.id, jsonb_build_object(
      'student_id', delivery.student_id, 'leave_request_id', delivery.leave_request_id,
      'decision_version', delivery.decision_version, 'worker_id', delivery.lease_owner,
      'lease_token', delivery.lease_token, 'attempt_count', delivery.attempt_count
    ));
  end if;

  update public.leave_notification_deliveries
  set status = 'sending', attempt_count = attempt_count + 1, lease_owner = p_worker_uuid,
    lease_token = extensions.gen_random_uuid(), lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
    last_error = null, next_attempt_at = null
  where id = p_notification_uuid and status in ('pending', 'failed') and attempt_count < 20
    and (next_attempt_at is null or next_attempt_at <= clock_timestamp())
  returning * into delivery;

  if not found then
    return null;
  end if;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (null, 'leave_notification_claimed', delivery.id, jsonb_build_object(
    'student_id', delivery.student_id, 'leave_request_id', delivery.leave_request_id,
    'decision_version', delivery.decision_version, 'worker_id', delivery.lease_owner,
    'lease_token', delivery.lease_token, 'attempt_count', delivery.attempt_count
  ));

  return to_jsonb(delivery);
end;
$$;

create or replace function public.retry_leave_notification(
  p_actor_uuid uuid,
  p_notification_uuid uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery public.leave_notification_deliveries%rowtype;
  current_email text;
  notification_status text;
  notification_error text;
begin
  perform private.require_active_super_admin(p_actor_uuid);

  select email into current_email
  from public.profiles
  where id = (select student_id from public.leave_notification_deliveries where id = p_notification_uuid)
    and role = 'student';

  if current_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    notification_status := 'pending';
    notification_error := null;
  else
    notification_status := 'failed';
    notification_error := 'recipient email is missing or invalid';
  end if;

  update public.leave_notification_deliveries
  set status = notification_status, recipient_email = current_email, attempt_count = 0,
    lease_owner = null, lease_token = null, lease_expires_at = null,
    last_error = notification_error, next_attempt_at = clock_timestamp()
  where id = p_notification_uuid and status = 'failed'
  returning * into delivery;

  if not found then
    return false;
  end if;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (p_actor_uuid, 'leave_notification_retried', delivery.id, jsonb_build_object(
    'leave_request_id', delivery.leave_request_id, 'decision_version', delivery.decision_version
  ));

  return true;
end;
$$;

revoke execute on function public.claim_leave_notification(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_leave_notification(uuid, uuid, integer) to service_role;
