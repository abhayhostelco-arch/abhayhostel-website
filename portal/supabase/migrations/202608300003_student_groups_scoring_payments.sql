begin;

create temporary table student_scoring_migration_counts on commit drop as
select
  (select count(*) from public.profiles where role = 'student') as student_count,
  (select count(*) from public.daily_entries) as daily_entry_count,
  (select count(*) from public.leave_requests) as leave_count,
  (
    (select count(*) from public.gita_class_attendance)
    + (select count(*) from public.attendance_records)
    + (select count(*) from public.weekly_program_entries)
  ) as attendance_count,
  (select count(*) from public.audit_events) as audit_count;

create type public.student_group as enum ('abhay_hostel', 'krishna_home');
create type public.payment_status as enum ('pending', 'verified', 'rejected');

alter table public.profiles
  add column student_group public.student_group;

update public.profiles
set student_group = 'abhay_hostel'
where role = 'student';

alter table public.profiles
  add constraint profiles_student_group_matches_role check (
    (role = 'student' and student_group is not null)
    or (role <> 'student' and student_group is null)
  );

create index profiles_student_group_active_idx
  on public.profiles (student_group, is_active)
  where role = 'student';

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role public.app_role;
  assigned_group public.student_group;
  creator uuid;
begin
  assigned_role := coalesce(new.raw_app_meta_data ->> 'role', 'student')::public.app_role;
  assigned_group := case
    when assigned_role = 'student' then coalesce(
      nullif(new.raw_user_meta_data ->> 'student_group', '')::public.student_group,
      'abhay_hostel'::public.student_group
    )
    else null
  end;
  creator := nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid;

  insert into public.profiles (
    id, role, full_name, email, phone, academy_label, joined_on,
    is_active, must_change_password, created_by, student_group
  ) values (
    new.id,
    assigned_role,
    btrim(coalesce(new.raw_user_meta_data ->> 'full_name', 'Portal user')),
    lower(new.email),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'academy_label'), ''),
    case
      when assigned_role = 'student' then
        coalesce(
          nullif(new.raw_user_meta_data ->> 'joined_on', '')::date,
          (now() at time zone 'Asia/Kolkata')::date
        )
      else null
    end,
    true,
    true,
    creator,
    assigned_group
  );
  return new;
end;
$$;

create table public.payment_settings (
  id boolean primary key default true check (id),
  qr_path text,
  instructions text not null default '' check (char_length(instructions) <= 4000),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint payment_settings_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete restrict,
  constraint payment_settings_qr_path_valid check (
    qr_path is null or (
      char_length(qr_path) between 1 and 240
      and qr_path !~ '(^|/)\.\.(/|$)'
      and qr_path ~* '^[a-z0-9/_-]+\.(jpg|jpeg|png|webp)$'
    )
  )
);

insert into public.payment_settings (id) values (true);

create table public.student_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id uuid not null,
  fee_month date not null,
  amount_paise bigint not null check (amount_paise > 0),
  payment_date date not null check (payment_date <= (now() at time zone 'Asia/Kolkata')::date),
  utr text not null check (
    utr = upper(utr)
    and utr ~ '^[A-Z0-9]{6,40}$'
  ),
  note text check (note is null or char_length(note) <= 500),
  status public.payment_status not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text check (
    rejection_reason is null or char_length(rejection_reason) between 1 and 500
  ),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_payments_student_id_fkey
    foreign key (student_id) references public.profiles(id) on delete restrict,
  constraint student_payments_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles(id) on delete restrict,
  constraint student_payments_student_month_key unique (student_id, fee_month),
  constraint student_payments_utr_key unique (utr),
  constraint student_payments_fee_month_first_day check (
    fee_month = date_trunc('month', fee_month)::date
  ),
  constraint student_payments_review_state_valid check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'verified' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null)
  )
);

create index student_payments_status_date_idx
  on public.student_payments (status, payment_date desc, id);
create index student_payments_student_date_idx
  on public.student_payments (student_id, payment_date desc, id);

create function private.validate_student_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.student_id and role = 'student'
  ) then
    raise exception 'payments can only belong to a student' using errcode = '22023';
  end if;

  new.utr := upper(btrim(new.utr));
  new.note := nullif(btrim(new.note), '');
  new.rejection_reason := nullif(btrim(new.rejection_reason), '');
  return new;
end;
$$;

create trigger payment_settings_touch_updated
before update on public.payment_settings
for each row execute function private.touch_updated_at();

create trigger student_payments_validate
before insert or update on public.student_payments
for each row execute function private.validate_student_payment();

create trigger student_payments_touch_updated
before update on public.student_payments
for each row execute function private.touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-qr',
  'payment-qr',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
);

create function private.require_payment_reviewer(p_actor_uuid uuid, p_student_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles actor
    where actor.id = p_actor_uuid
      and actor.is_active
      and (
        actor.role = 'super_admin'
        or (
          actor.role = 'admin'
          and exists (
            select 1
            from public.profiles student
            where student.id = p_student_uuid
              and student.role = 'student'
              and student.is_active
              and student.mentor_id = actor.id
          )
        )
      )
  ) then
    raise exception 'payment reviewer is not authorized' using errcode = '42501';
  end if;
end;
$$;

create function public.update_student_group(
  p_actor_uuid uuid,
  p_student_uuid uuid,
  p_student_group public.student_group
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_group public.student_group;
  result public.profiles%rowtype;
begin
  perform private.require_active_super_admin(p_actor_uuid);

  select student_group
  into previous_group
  from public.profiles
  where id = p_student_uuid and role = 'student'
  for update;

  if not found then
    raise exception 'student profile not found' using errcode = '22023';
  end if;

  if previous_group is not distinct from p_student_group then
    select * into result from public.profiles where id = p_student_uuid;
    return result;
  end if;

  update public.profiles
  set student_group = p_student_group
  where id = p_student_uuid and role = 'student'
  returning * into result;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    p_actor_uuid,
    'student_group_updated',
    p_student_uuid,
    jsonb_build_object(
      'old_group', previous_group,
      'new_group', p_student_group
    )
  );

  return result;
end;
$$;

create function public.reactivate_student_profile(
  p_actor_uuid uuid,
  p_student_uuid uuid,
  p_student_group public.student_group,
  p_restored_during_creation boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.app_role;
  previous_group public.student_group;
  assigned_mentor uuid;
  was_active boolean;
  result public.profiles%rowtype;
begin
  select role
  into actor_role
  from public.profiles
  where id = p_actor_uuid and is_active;

  if not found or actor_role not in ('super_admin', 'admin') then
    raise exception 'reactivation actor is not authorized' using errcode = '42501';
  end if;

  select student_group, mentor_id, is_active
  into previous_group, assigned_mentor, was_active
  from public.profiles student
  where student.id = p_student_uuid and student.role = 'student'
  for update;

  if not found then
    raise exception 'student profile not found' using errcode = '22023';
  end if;
  if actor_role = 'admin' and assigned_mentor is distinct from p_actor_uuid then
    raise exception 'reactivation actor is not authorized' using errcode = '42501';
  end if;
  if actor_role = 'admin' and previous_group is distinct from p_student_group then
    raise exception 'only a super admin can change a student group' using errcode = '42501';
  end if;
  if was_active then
    if previous_group is distinct from p_student_group then
      raise exception 'student profile is already active in a different group' using errcode = '22023';
    end if;
    select * into result from public.profiles where id = p_student_uuid;
    return result;
  end if;

  update public.profiles
  set student_group = p_student_group, is_active = true
  where id = p_student_uuid and role = 'student'
  returning * into result;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    p_actor_uuid,
    'account_reactivated',
    p_student_uuid,
    jsonb_build_object(
      'role', 'student',
      'old_group', previous_group,
      'new_group', p_student_group,
      'restored_during_creation', p_restored_during_creation
    )
  );

  return result;
end;
$$;

create function public.update_payment_settings(
  p_actor_uuid uuid,
  p_qr_path text,
  p_instructions text
)
returns public.payment_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_path text;
  result public.payment_settings%rowtype;
begin
  perform private.require_active_super_admin(p_actor_uuid);

  select qr_path
  into previous_path
  from public.payment_settings
  where id
  for update;

  update public.payment_settings
  set
    qr_path = nullif(btrim(p_qr_path), ''),
    instructions = btrim(coalesce(p_instructions, '')),
    updated_by = p_actor_uuid
  where id
  returning * into result;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    p_actor_uuid,
    'payment_settings_updated',
    null,
    jsonb_build_object(
      'old_qr_path', previous_path,
      'new_qr_path', result.qr_path
    )
  );

  return result;
end;
$$;

create function public.submit_student_payment(
  p_actor_uuid uuid,
  p_fee_month date,
  p_amount_paise bigint,
  p_payment_date date,
  p_utr text,
  p_note text
)
returns public.student_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.student_payments%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_uuid and role = 'student' and is_active
  ) then
    raise exception 'active student required' using errcode = '42501';
  end if;

  insert into public.student_payments (
    student_id, fee_month, amount_paise, payment_date, utr, note
  ) values (
    p_actor_uuid,
    p_fee_month,
    p_amount_paise,
    p_payment_date,
    upper(btrim(p_utr)),
    nullif(btrim(p_note), '')
  )
  returning * into result;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    p_actor_uuid,
    'payment_submitted',
    result.id,
    jsonb_build_object(
      'student_id', result.student_id,
      'fee_month', result.fee_month,
      'amount_paise', result.amount_paise
    )
  );

  return result;
exception
  when unique_violation then
    raise exception 'payment submission conflicts with an existing record'
      using errcode = '23505';
end;
$$;

create function public.resubmit_student_payment(
  p_actor_uuid uuid,
  p_payment_uuid uuid,
  p_expected_version integer,
  p_fee_month date,
  p_amount_paise bigint,
  p_payment_date date,
  p_utr text,
  p_note text
)
returns public.student_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_payment public.student_payments%rowtype;
  result public.student_payments%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_uuid and role = 'student' and is_active
  ) then
    raise exception 'active student required' using errcode = '42501';
  end if;

  select *
  into current_payment
  from public.student_payments
  where id = p_payment_uuid and student_id = p_actor_uuid
  for update;

  if not found then
    raise exception 'payment not found' using errcode = '22023';
  end if;
  if current_payment.version is distinct from p_expected_version then
    raise exception 'payment changed before resubmission' using errcode = '40001';
  end if;
  if current_payment.status = 'verified' then
    raise exception 'verified payments are immutable' using errcode = '22023';
  end if;

  update public.student_payments
  set
    fee_month = p_fee_month,
    amount_paise = p_amount_paise,
    payment_date = p_payment_date,
    utr = upper(btrim(p_utr)),
    note = nullif(btrim(p_note), ''),
    status = 'pending',
    reviewed_by = null,
    reviewed_at = null,
    rejection_reason = null,
    version = current_payment.version + 1
  where id = p_payment_uuid
  returning * into result;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    p_actor_uuid,
    'payment_resubmitted',
    result.id,
    jsonb_build_object(
      'student_id', result.student_id,
      'fee_month', result.fee_month,
      'previous_status', current_payment.status,
      'version', result.version
    )
  );

  return result;
exception
  when unique_violation then
    raise exception 'payment submission conflicts with an existing record'
      using errcode = '23505';
end;
$$;

create function public.verify_student_payment(
  p_actor_uuid uuid,
  p_payment_uuid uuid,
  p_expected_version integer
)
returns public.student_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_payment public.student_payments%rowtype;
  result public.student_payments%rowtype;
begin
  select *
  into current_payment
  from public.student_payments
  where id = p_payment_uuid
  for update;

  if not found then
    raise exception 'payment not found' using errcode = '22023';
  end if;

  perform private.require_payment_reviewer(p_actor_uuid, current_payment.student_id);

  if current_payment.version is distinct from p_expected_version then
    raise exception 'payment changed before review' using errcode = '40001';
  end if;
  if current_payment.status <> 'pending' then
    raise exception 'only pending payments can be reviewed' using errcode = '22023';
  end if;

  update public.student_payments
  set
    status = 'verified',
    reviewed_by = p_actor_uuid,
    reviewed_at = clock_timestamp(),
    rejection_reason = null,
    version = current_payment.version + 1
  where id = p_payment_uuid
  returning * into result;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    p_actor_uuid,
    'payment_verified',
    result.id,
    jsonb_build_object(
      'student_id', result.student_id,
      'fee_month', result.fee_month,
      'version', result.version
    )
  );

  return result;
end;
$$;

create function public.reject_student_payment(
  p_actor_uuid uuid,
  p_payment_uuid uuid,
  p_expected_version integer,
  p_rejection_reason text
)
returns public.student_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_payment public.student_payments%rowtype;
  result public.student_payments%rowtype;
  normalized_reason text := nullif(btrim(p_rejection_reason), '');
begin
  if normalized_reason is null or char_length(normalized_reason) > 500 then
    raise exception 'rejection reason is required and must be at most 500 characters'
      using errcode = '22023';
  end if;

  select *
  into current_payment
  from public.student_payments
  where id = p_payment_uuid
  for update;

  if not found then
    raise exception 'payment not found' using errcode = '22023';
  end if;

  perform private.require_payment_reviewer(p_actor_uuid, current_payment.student_id);

  if current_payment.version is distinct from p_expected_version then
    raise exception 'payment changed before review' using errcode = '40001';
  end if;
  if current_payment.status <> 'pending' then
    raise exception 'only pending payments can be reviewed' using errcode = '22023';
  end if;

  update public.student_payments
  set
    status = 'rejected',
    reviewed_by = p_actor_uuid,
    reviewed_at = clock_timestamp(),
    rejection_reason = normalized_reason,
    version = current_payment.version + 1
  where id = p_payment_uuid
  returning * into result;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    p_actor_uuid,
    'payment_rejected',
    result.id,
    jsonb_build_object(
      'student_id', result.student_id,
      'fee_month', result.fee_month,
      'version', result.version
    )
  );

  return result;
end;
$$;

alter table public.leave_requests
  add column decision_version integer not null default 0;

update public.leave_requests
set decision_version = 1
where status in ('approved', 'rejected');

alter table public.leave_requests
  add constraint leave_requests_decision_version_valid check (
    (status in ('approved', 'rejected') and decision_version >= 1)
    or (status in ('pending', 'withdrawn') and decision_version = 0)
  );

create table public.leave_notification_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  leave_request_id uuid not null,
  student_id uuid not null,
  decision_version integer not null check (decision_version >= 1),
  decision text not null check (decision in ('approved', 'rejected')),
  recipient_email text check (recipient_email is null or char_length(recipient_email) <= 254),
  student_name text not null check (char_length(student_name) between 2 and 120),
  leave_start_date date not null,
  leave_end_date date not null check (leave_end_date >= leave_start_date),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 160),
  lease_owner uuid,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 500),
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_notification_deliveries_leave_request_id_fkey
    foreign key (leave_request_id) references public.leave_requests(id) on delete restrict,
  constraint leave_notification_deliveries_student_id_fkey
    foreign key (student_id) references public.profiles(id) on delete restrict,
  constraint leave_notification_deliveries_request_version_key
    unique (leave_request_id, decision_version),
  constraint leave_notification_deliveries_lease_valid check (
    (status = 'sending' and lease_owner is not null and lease_token is not null and lease_expires_at is not null)
    or (status <> 'sending' and lease_owner is null and lease_token is null and lease_expires_at is null)
  ),
  constraint leave_notification_deliveries_sent_valid check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index leave_notifications_status_attempt_idx
  on public.leave_notification_deliveries (status, next_attempt_at, created_at, id);
create index leave_notifications_student_created_idx
  on public.leave_notification_deliveries (student_id, created_at desc, id);

create trigger leave_notifications_touch_updated
before update on public.leave_notification_deliveries
for each row execute function private.touch_updated_at();

create function public.decide_leave_request(
  p_actor_uuid uuid,
  p_request_uuid uuid,
  p_expected_status text,
  p_decision text,
  p_decision_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  leave_row public.leave_requests%rowtype;
  student_row public.profiles%rowtype;
  normalized_note text := nullif(btrim(p_decision_note), '');
  next_version integer;
  notification_status text;
  notification_error text;
  notification_uuid uuid;
begin
  perform private.require_active_super_admin(p_actor_uuid);

  if p_decision not in ('approved', 'rejected') then
    raise exception 'unsupported leave decision' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and normalized_note is null then
    raise exception 'rejection reason is required' using errcode = '22023';
  end if;
  if normalized_note is not null and char_length(normalized_note) > 1000 then
    raise exception 'decision note must be at most 1000 characters' using errcode = '22023';
  end if;

  select *
  into leave_row
  from public.leave_requests
  where id = p_request_uuid
  for update;

  if not found then
    raise exception 'leave request not found' using errcode = '22023';
  end if;

  if leave_row.status = p_decision and leave_row.status in ('approved', 'rejected') then
    return jsonb_build_object(
      'changed', false,
      'leave_request_id', leave_row.id,
      'status', leave_row.status,
      'decision_version', leave_row.decision_version
    );
  end if;

  if leave_row.status is distinct from p_expected_status then
    raise exception 'leave request changed before decision' using errcode = '40001';
  end if;
  if not (
    (leave_row.status = 'pending' and p_decision in ('approved', 'rejected'))
    or (leave_row.status = 'approved' and p_decision = 'rejected')
  ) then
    raise exception 'unsupported leave decision transition' using errcode = '22023';
  end if;

  select *
  into student_row
  from public.profiles
  where id = leave_row.student_id and role = 'student';

  if not found then
    raise exception 'leave student profile not found' using errcode = '22023';
  end if;

  next_version := leave_row.decision_version + 1;

  update public.leave_requests
  set
    status = p_decision,
    decision_note = case when p_decision = 'rejected' then normalized_note else null end,
    decided_by = p_actor_uuid,
    decided_at = clock_timestamp(),
    decision_version = next_version
  where id = leave_row.id;

  if student_row.email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    notification_status := 'pending';
    notification_error := null;
  else
    notification_status := 'failed';
    notification_error := 'recipient email is missing or invalid';
  end if;

  insert into public.leave_notification_deliveries (
    leave_request_id,
    student_id,
    decision_version,
    decision,
    recipient_email,
    student_name,
    leave_start_date,
    leave_end_date,
    decision_note,
    status,
    idempotency_key,
    last_error,
    next_attempt_at
  ) values (
    leave_row.id,
    leave_row.student_id,
    next_version,
    p_decision,
    student_row.email,
    student_row.full_name,
    leave_row.start_date,
    leave_row.end_date,
    case when p_decision = 'rejected' then normalized_note else null end,
    notification_status,
    format('leave-decision:%s:%s', leave_row.id, next_version),
    notification_error,
    case when notification_status = 'failed' then clock_timestamp() else null end
  )
  returning id into notification_uuid;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    p_actor_uuid,
    case when p_decision = 'approved' then 'leave_approved' else 'leave_rejected' end,
    leave_row.id,
    jsonb_build_object(
      'student_id', leave_row.student_id,
      'decision_version', next_version,
      'notification_id', notification_uuid
    )
  );

  return jsonb_build_object(
    'changed', true,
    'leave_request_id', leave_row.id,
    'status', p_decision,
    'decision_version', next_version,
    'notification_id', notification_uuid,
    'notification_status', notification_status
  );
end;
$$;

create function public.claim_leave_notification_batch(
  p_worker_uuid uuid,
  p_limit integer,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery public.leave_notification_deliveries%rowtype;
  result jsonb;
begin
  if p_worker_uuid is null then
    raise exception 'notification worker is required' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'invalid notification batch size' using errcode = '22023';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'invalid notification lease duration' using errcode = '22023';
  end if;

  for delivery in
    select *
    from public.leave_notification_deliveries
    where status = 'sending' and lease_expires_at <= clock_timestamp()
    order by created_at, id
    for update skip locked
  loop
    update public.leave_notification_deliveries
    set
      status = 'failed',
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      last_error = 'delivery lease expired',
      next_attempt_at = clock_timestamp()
    where id = delivery.id;

    insert into public.audit_events (actor_id, action, target_id, metadata)
    values (
      null,
      'leave_notification_lease_expired',
      delivery.id,
      jsonb_build_object(
        'student_id', delivery.student_id,
        'leave_request_id', delivery.leave_request_id,
        'decision_version', delivery.decision_version,
        'worker_id', delivery.lease_owner,
        'lease_token', delivery.lease_token,
        'attempt_count', delivery.attempt_count
      )
    );
  end loop;

  result := '[]'::jsonb;
  for delivery in
    select *
    from public.leave_notification_deliveries
    where status in ('pending', 'failed')
      and attempt_count < 20
      and (next_attempt_at is null or next_attempt_at <= clock_timestamp())
    order by created_at, id
    limit p_limit
    for update skip locked
  loop
    update public.leave_notification_deliveries
    set
      status = 'sending',
      attempt_count = delivery.attempt_count + 1,
      lease_owner = p_worker_uuid,
      lease_token = extensions.gen_random_uuid(),
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      last_error = null,
      next_attempt_at = null
    where id = delivery.id
    returning * into delivery;

    insert into public.audit_events (actor_id, action, target_id, metadata)
    values (
      null,
      'leave_notification_claimed',
      delivery.id,
      jsonb_build_object(
        'student_id', delivery.student_id,
        'leave_request_id', delivery.leave_request_id,
        'decision_version', delivery.decision_version,
        'worker_id', delivery.lease_owner,
        'lease_token', delivery.lease_token,
        'attempt_count', delivery.attempt_count
      )
    );

    result := result || jsonb_build_array(to_jsonb(delivery));
  end loop;

  return result;
end;
$$;

create function public.complete_leave_notification_delivery(
  p_notification_uuid uuid,
  p_worker_uuid uuid,
  p_lease_token uuid,
  p_succeeded boolean,
  p_provider_message_id text,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery public.leave_notification_deliveries%rowtype;
begin
  update public.leave_notification_deliveries
  set
    status = case when p_succeeded then 'sent' else 'failed' end,
    lease_owner = null,
    lease_token = null,
    lease_expires_at = null,
    provider_message_id = case
      when p_succeeded then nullif(btrim(p_provider_message_id), '')
      else null
    end,
    last_error = case
      when p_succeeded then null
      else coalesce(nullif(btrim(p_error), ''), 'delivery failed')
    end,
    next_attempt_at = case
      when p_succeeded then null
      else clock_timestamp() + interval '5 minutes'
    end,
    sent_at = case when p_succeeded then clock_timestamp() else null end
  where id = p_notification_uuid
    and status = 'sending'
    and lease_owner = p_worker_uuid
    and lease_token = p_lease_token
    and lease_expires_at > clock_timestamp()
  returning * into delivery;

  if not found then
    raise exception 'notification delivery lease is stale' using errcode = '40001';
  end if;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    null,
    case when p_succeeded then 'leave_notification_sent' else 'leave_notification_failed' end,
    delivery.id,
    jsonb_build_object(
      'student_id', delivery.student_id,
      'leave_request_id', delivery.leave_request_id,
      'decision_version', delivery.decision_version,
      'worker_id', p_worker_uuid,
      'lease_token', p_lease_token,
      'attempt_count', delivery.attempt_count,
      'provider_message_id', delivery.provider_message_id,
      'error', delivery.last_error
    )
  );

  return true;
end;
$$;

create function public.retry_leave_notification(
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
begin
  perform private.require_active_super_admin(p_actor_uuid);

  update public.leave_notification_deliveries
  set
    status = 'pending',
    attempt_count = 0,
    lease_owner = null,
    lease_token = null,
    lease_expires_at = null,
    next_attempt_at = clock_timestamp()
  where id = p_notification_uuid and status = 'failed'
  returning * into delivery;

  if not found then
    return false;
  end if;

  insert into public.audit_events (actor_id, action, target_id, metadata)
  values (
    p_actor_uuid,
    'leave_notification_retried',
    delivery.id,
    jsonb_build_object(
      'leave_request_id', delivery.leave_request_id,
      'decision_version', delivery.decision_version
    )
  );

  return true;
end;
$$;

alter table public.payment_settings enable row level security;
alter table public.payment_settings force row level security;
alter table public.student_payments enable row level security;
alter table public.student_payments force row level security;
alter table public.leave_notification_deliveries enable row level security;
alter table public.leave_notification_deliveries force row level security;

create policy payment_settings_select_active
on public.payment_settings for select to authenticated
using (private.current_user_is_active());

create policy student_payments_select_authorized
on public.student_payments for select to authenticated
using (
  (student_id = (select auth.uid()) and private.current_role() = 'student')
  or private.current_role() = 'super_admin'
  or private.current_mentor_manages(student_id)
);

create policy leave_notifications_select_authorized
on public.leave_notification_deliveries for select to authenticated
using (
  (student_id = (select auth.uid()) and private.current_role() = 'student')
  or private.current_role() = 'super_admin'
  or private.current_mentor_manages(student_id)
);

revoke all on table public.payment_settings, public.student_payments,
  public.leave_notification_deliveries from public, anon, authenticated;
grant select on table public.payment_settings, public.student_payments,
  public.leave_notification_deliveries to authenticated;
revoke insert, update, delete on table public.payment_settings, public.student_payments,
  public.leave_notification_deliveries from service_role;
grant select on table public.payment_settings, public.student_payments,
  public.leave_notification_deliveries to service_role;
revoke update on table public.profiles from service_role;
grant update (
  role, full_name, email, phone, academy_label, joined_on, is_active,
  must_change_password, created_by, mentor_id, birth_date, avatar_path,
  deletion_pending_at
) on table public.profiles to service_role;

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (action in (
  'account_created', 'account_deactivated', 'account_reactivated', 'credential_reset',
  'settings_updated', 'score_settings_updated', 'report_exported', 'super_admin_bootstrapped',
  'mentor_assigned', 'entry_corrected', 'resource_created', 'resource_updated',
  'weekly_program_created', 'weekly_program_closed', 'weekly_program_reopened',
  'attendance_person_created', 'attendance_event_created', 'attendance_recorded',
  'leave_approved', 'leave_rejected', 'student_birthdate_updated',
  'cleanup_settings_updated', 'cleanup_history_completed', 'cleanup_history_partial',
  'student_deletion_completed', 'student_deletion_partial',
  'student_group_updated', 'payment_settings_updated', 'payment_submitted',
  'payment_resubmitted', 'payment_verified', 'payment_rejected',
  'leave_notification_claimed', 'leave_notification_lease_expired',
  'leave_notification_sent', 'leave_notification_failed',
  'leave_notification_retried'
));

revoke execute on function private.validate_student_payment(),
  private.require_payment_reviewer(uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.reactivate_student_profile(uuid, uuid, public.student_group, boolean)
  from public, anon, authenticated;
grant execute on function public.reactivate_student_profile(uuid, uuid, public.student_group, boolean)
  to service_role;

revoke execute on function public.update_student_group(uuid, uuid, public.student_group),
  public.update_payment_settings(uuid, text, text),
  public.submit_student_payment(uuid, date, bigint, date, text, text),
  public.resubmit_student_payment(uuid, uuid, integer, date, bigint, date, text, text),
  public.verify_student_payment(uuid, uuid, integer),
  public.reject_student_payment(uuid, uuid, integer, text),
  public.decide_leave_request(uuid, uuid, text, text, text),
  public.claim_leave_notification_batch(uuid, integer, integer),
  public.complete_leave_notification_delivery(uuid, uuid, uuid, boolean, text, text),
  public.retry_leave_notification(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.update_student_group(uuid, uuid, public.student_group),
  public.update_payment_settings(uuid, text, text),
  public.submit_student_payment(uuid, date, bigint, date, text, text),
  public.resubmit_student_payment(uuid, uuid, integer, date, bigint, date, text, text),
  public.verify_student_payment(uuid, uuid, integer),
  public.reject_student_payment(uuid, uuid, integer, text),
  public.decide_leave_request(uuid, uuid, text, text, text),
  public.claim_leave_notification_batch(uuid, integer, integer),
  public.complete_leave_notification_delivery(uuid, uuid, uuid, boolean, text, text),
  public.retry_leave_notification(uuid, uuid)
  to service_role;

do $$
declare
  before_counts record;
begin
  select * into before_counts from student_scoring_migration_counts;

  if (select count(*) from public.profiles where role = 'student') < before_counts.student_count then
    raise exception 'student row count decreased during migration';
  end if;
  if (select count(*) from public.daily_entries) < before_counts.daily_entry_count then
    raise exception 'daily-entry row count decreased during migration';
  end if;
  if (select count(*) from public.leave_requests) < before_counts.leave_count then
    raise exception 'leave row count decreased during migration';
  end if;
  if (
    (select count(*) from public.gita_class_attendance)
    + (select count(*) from public.attendance_records)
    + (select count(*) from public.weekly_program_entries)
  ) < before_counts.attendance_count then
    raise exception 'attendance row count decreased during migration';
  end if;
  if (select count(*) from public.audit_events) < before_counts.audit_count then
    raise exception 'audit row count decreased during migration';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
