-- Phase 2, migration 7: write_audit, checkin, call_next_patient, close_stale_visits, daily_summary, admin_correct_visit
-- (plus mark_visit_left, see docs/PHASE-2-PROGRESS.md decision 3)

create or replace function public.write_audit(
  p_facility_id uuid, p_actor_id uuid, p_action text, p_entity_type text, p_entity_id uuid
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_logs (facility_id, actor_id, action, entity_type, entity_id)
  values (p_facility_id, p_actor_id, p_action, p_entity_type, p_entity_id)
$$;

-- OP4 Check-in (BR1, BR3, BR4, BR5, BR6, BR14, BR17). Called by the API with the service role.
create or replace function public.checkin(
  p_tablet_id uuid,
  p_first_name text,
  p_surname text,
  p_date_of_birth date,
  p_id_number text,
  p_cellphone text,
  p_has_file boolean,
  p_assisted boolean,
  p_reason_category text,
  p_urgent boolean,
  p_consent_given boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_facility uuid;
  v_patient public.patients;
  v_visit public.visits;
  v_id text := nullif(btrim(coalesce(p_id_number, '')), '');
  v_phone text := public.normalise_cellphone(p_cellphone);
  v_queue int;
  v_recent int;
begin
  select facility_id into v_facility
  from public.staff_profiles
  where id = p_tablet_id and role = 'Check-in' and active;
  if v_facility is null then
    raise exception 'This tablet is not allowed to check patients in.' using errcode = '42501';
  end if;

  if p_consent_given is distinct from true then
    raise exception 'Consent is needed to check in.' using errcode = '23514';
  end if;

  -- BR14: at most 40 Check-ins from one tablet in 10 minutes
  select count(*) into v_recent from public.audit_logs
  where actor_id = p_tablet_id and action = 'checked_in' and created_at > now() - interval '10 minutes';
  if v_recent >= 40 then
    raise exception 'Too many Check-ins at once. Please wait one minute and try again.' using errcode = '54000';
  end if;

  if p_date_of_birth is null or p_date_of_birth < date '1900-01-01' or p_date_of_birth > public.sast_date(now()) then
    raise exception 'Enter a valid date of birth.' using errcode = '23514';
  end if;
  if v_id is not null and not public.is_valid_sa_id(v_id, p_date_of_birth) then
    raise exception 'Enter a valid South African ID number.' using errcode = '23514';
  end if;
  if v_phone is not null and v_phone !~ '^\+27[0-9]{9}$' then
    raise exception 'Enter a valid cellphone number.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtext('checkin:' || v_facility::text));

  -- BR4: the ID number wins; otherwise first name, surname and date of birth (capital letters ignored)
  if v_id is not null then
    select * into v_patient from public.patients where facility_id = v_facility and id_number = v_id;
  end if;
  if v_patient.id is null then
    select * into v_patient from public.patients
    where facility_id = v_facility
      and lower(first_name) = lower(btrim(p_first_name))
      and lower(surname) = lower(btrim(p_surname))
      and date_of_birth = p_date_of_birth
      and (v_id is null or id_number is null)
    order by created_at
    limit 1;
  end if;

  if v_patient.id is not null then
    -- BR3: already checked in? Return the same number; no second Visit.
    select * into v_visit from public.visits
    where patient_id = v_patient.id and status in ('Waiting', 'Called', 'In consultation');
    if v_visit.id is not null then
      return jsonb_build_object(
        'queue_number', v_visit.queue_number,
        'already_checked_in', true,
        'urgent', v_visit.urgent,
        'has_file', v_patient.paper_file_status <> 'No paper file'
      );
    end if;
  else
    insert into public.patients (facility_id, first_name, surname, date_of_birth, id_number, cellphone, paper_file_status)
    values (v_facility, btrim(p_first_name), btrim(p_surname), p_date_of_birth, v_id, v_phone,
            case when p_has_file then 'Paper file - not yet digitised' else 'No paper file' end)
    returning * into v_patient;
  end if;

  select coalesce(max(queue_number), 0) + 1 into v_queue
  from public.visits
  where facility_id = v_facility and public.sast_date(checkin_at) = public.sast_date(now());

  insert into public.visits (facility_id, patient_id, queue_number, reason_category, urgent, assisted, consent_given)
  values (v_facility, v_patient.id, v_queue, p_reason_category, coalesce(p_urgent, false), coalesce(p_assisted, false), true)
  returning * into v_visit;

  perform public.write_audit(v_facility, p_tablet_id, 'checked_in', 'Visit', v_visit.id);

  return jsonb_build_object(
    'queue_number', v_visit.queue_number,
    'already_checked_in', false,
    'urgent', v_visit.urgent,
    'has_file', v_patient.paper_file_status <> 'No paper file'
  );
end;
$$;

-- OP6 Call next patient (BR2): urgent first, then earliest Check-in. Clinical only.
create or replace function public.call_next_patient()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit public.visits;
  v_patient public.patients;
begin
  if public.current_staff_role() is distinct from 'Clinical' then
    raise exception 'Only Clinical staff can call the next patient.' using errcode = '42501';
  end if;

  select * into v_visit from public.visits
  where facility_id = public.current_facility_id() and status = 'Waiting'
  order by urgent desc, checkin_at asc
  limit 1
  for update skip locked;

  if v_visit.id is null then
    return jsonb_build_object('none_waiting', true);
  end if;

  update public.visits set status = 'Called' where id = v_visit.id returning * into v_visit;
  select * into v_patient from public.patients where id = v_visit.patient_id;

  perform public.write_audit(v_visit.facility_id, auth.uid(), 'called_next', 'Visit', v_visit.id);

  return jsonb_build_object(
    'none_waiting', false,
    'visit_id', v_visit.id,
    'queue_number', v_visit.queue_number,
    'patient_id', v_patient.id,
    'first_name', v_patient.first_name,
    'surname', v_patient.surname
  );
end;
$$;

-- Mark as left (SEC15). A function, because Reception has no direct read of Visits (SEC11)
-- and an update needs a read policy to find its row.
create or replace function public.mark_visit_left(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit public.visits;
begin
  if public.current_staff_role() not in ('Reception', 'Clinical') then
    raise exception 'You are not allowed to do this.' using errcode = '42501';
  end if;
  select * into v_visit from public.visits
  where id = p_visit_id and facility_id = public.current_facility_id();
  if v_visit.id is null then
    raise exception 'Visit not found.' using errcode = 'P0002';
  end if;
  update public.visits set status = 'Left' where id = v_visit.id;
  perform public.write_audit(v_visit.facility_id, auth.uid(), 'marked_left', 'Visit', v_visit.id);
end;
$$;

-- OP5 / BR7: Visits still open from an earlier SAST day become Left (left_at set, AuditLog for the caller)
create or replace function public.close_stale_visits()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  if public.current_staff_role() not in ('Reception', 'Clinical') then
    raise exception 'You are not allowed to do this.' using errcode = '42501';
  end if;
  perform set_config('pholo.stale_close', 'on', true);
  for v_row in
    update public.visits set status = 'Left'
    where facility_id = public.current_facility_id()
      and status in ('Waiting', 'Called', 'In consultation')
      and public.sast_date(checkin_at) < public.sast_date(now())
    returning id, facility_id
  loop
    v_count := v_count + 1;
    perform public.write_audit(v_row.facility_id, auth.uid(), 'marked_left', 'Visit', v_row.id);
  end loop;
  perform set_config('pholo.stale_close', 'off', true);
  return v_count;
end;
$$;

-- OP17 / BR15: counts and averages for today (SAST). Manager only.
create or replace function public.daily_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_facility uuid := public.current_facility_id();
  v_result jsonb;
begin
  if public.current_staff_role() is distinct from 'Manager' then
    raise exception 'Only a Manager can see the daily summary.' using errcode = '42501';
  end if;

  with today as (
    select * from public.visits
    where facility_id = v_facility and public.sast_date(checkin_at) = public.sast_date(now())
  ),
  waits as (
    select floor(extract(epoch from (called_at - checkin_at)) / 60)::int as minutes from today where called_at is not null
  ),
  reasons as (
    select r.reason, (select count(*) from today t where t.reason_category = r.reason) as n
    from (values ('Feeling sick or injured'), ('Collecting medication'), ('Baby or child care'),
                 ('Pregnancy or family planning'), ('Test or screening'), ('Something else')) as r(reason)
  )
  select jsonb_build_object(
    'checked_in', (select count(*) from today),
    'completed', (select count(*) from today where status = 'Completed'),
    'still_waiting', (select count(*) from today where status in ('Waiting', 'Called')),
    'left', (select count(*) from today where status = 'Left'),
    'average_wait_minutes', (select case when count(*) = 0 then null else floor(avg(minutes) + 0.5)::int end from waits),
    'waited_over_3_hours', (select count(*) from today
        where floor(extract(epoch from (coalesce(called_at, now()) - checkin_at)) / 60) > 180),
    'helped_by_door_assistant', (select count(*) from today where assisted),
    'reasons', (select jsonb_object_agg(reason, n) from reasons)
  ) into v_result;
  return v_result;
end;
$$;

-- BR9 / Section 18 #15: the administrator corrects a finished Visit for a Manager's request.
create or replace function public.admin_correct_visit(p_visit_id uuid, p_manager_id uuid, p_field text, p_value text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visit public.visits;
begin
  select v.* into v_visit from public.visits v
  join public.staff_profiles s on s.facility_id = v.facility_id and s.id = p_manager_id and s.role = 'Manager' and s.active
  where v.id = p_visit_id;
  if v_visit.id is null then
    raise exception 'Visit not found.' using errcode = 'P0002';
  end if;
  if p_field not in ('symptoms', 'notes', 'icd10_codes', 'outcome') then
    raise exception 'That field cannot be corrected.' using errcode = '23514';
  end if;

  perform set_config('pholo.admin_correction', 'on', true);
  execute format('update public.visits set %I = $1 where id = $2', p_field) using nullif(p_value, ''), p_visit_id;
  perform set_config('pholo.admin_correction', 'off', true);

  perform public.write_audit(v_visit.facility_id, p_manager_id, 'corrected_visit', 'Visit', v_visit.id);
end;
$$;

-- Used by the staff_profiles policy (SEC3): names of staff linked to Visits the caller can see
create or replace function public.staff_linked_to_visit(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.visits v
    where v.facility_id = public.current_facility_id()
      and (v.called_by = p_staff_id or v.clinician = p_staff_id)
  )
$$;
