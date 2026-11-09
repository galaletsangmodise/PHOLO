-- Phase 2, migration 6: patients_guard, patients_set_updated_at, visits_guard

-- Helpers used by the guards, the functions and the policies
create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select role from public.staff_profiles where id = auth.uid() and active $$;

create or replace function public.current_facility_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select facility_id from public.staff_profiles where id = auth.uid() and active $$;

create or replace function public.patients_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_has_history boolean;
begin
  new.cellphone := public.normalise_cellphone(new.cellphone);

  if new.date_of_birth > public.sast_date(now()) then
    raise exception 'Date of birth cannot be in the future.' using errcode = '23514';
  end if;

  v_has_history := coalesce(btrim(new.chronic_conditions), '') <> ''
                or coalesce(btrim(new.allergies), '') <> ''
                or coalesce(btrim(new.current_medication), '') <> '';

  if tg_op = 'UPDATE' then
    if new.file_number is distinct from old.file_number then
      raise exception 'The file number cannot be changed.' using errcode = '23514';
    end if;
    if new.facility_id is distinct from old.facility_id then
      raise exception 'A Patient cannot move to another Facility.' using errcode = '23514';
    end if;
    if new.paper_file_status is distinct from old.paper_file_status
       and new.paper_file_status = 'Paper file - digitised'
       and not (old.paper_file_status = 'Paper file - not yet digitised' and v_has_history) then
      raise exception 'Add at least one item from the paper file before marking it as digitised.' using errcode = '23514';
    end if;
  elsif new.paper_file_status = 'Paper file - digitised' and not v_has_history then
    raise exception 'Add at least one item from the paper file before marking it as digitised.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger patients_guard
  before insert or update on public.patients
  for each row execute function public.patients_guard();

create or replace function public.patients_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.patients_set_updated_at();

-- visits_guard: only the status changes of plan 8.3, by the roles allowed (BR7, BR9).
-- Three database functions raise a switch for the length of one statement batch:
--   pholo.stale_close      close_stale_visits (BR7)
--   pholo.admin_correction admin_correct_visit (BR9, Section 18 #15)
create or replace function public.visits_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_uid uuid := auth.uid();
  v_admin boolean := coalesce(current_setting('pholo.admin_correction', true), '') = 'on';
  v_stale boolean := coalesce(current_setting('pholo.stale_close', true), '') = 'on';
  v_notes_changed boolean;
  v_times_changed boolean;
begin
  if tg_op = 'DELETE' then
    -- Only the administrator (service role or database owner) may delete, never an app role (SEC17)
    if current_user in ('authenticated', 'anon') then
      raise exception 'Visits cannot be deleted.' using errcode = '42501';
    end if;
    return old;
  end if;

  v_notes_changed := new.symptoms is distinct from old.symptoms
                  or new.notes is distinct from old.notes
                  or new.icd10_codes is distinct from old.icd10_codes
                  or new.outcome is distinct from old.outcome;
  v_times_changed := new.called_at is distinct from old.called_at or new.called_by is distinct from old.called_by
                  or new.started_at is distinct from old.started_at or new.clinician is distinct from old.clinician
                  or new.completed_at is distinct from old.completed_at or new.left_at is distinct from old.left_at;

  if new.id is distinct from old.id or new.facility_id is distinct from old.facility_id
     or new.patient_id is distinct from old.patient_id or new.queue_number is distinct from old.queue_number
     or new.checkin_at is distinct from old.checkin_at or new.reason_category is distinct from old.reason_category
     or new.urgent is distinct from old.urgent or new.assisted is distinct from old.assisted
     or new.consent_given is distinct from old.consent_given or new.created_at is distinct from old.created_at then
    raise exception 'These Visit details cannot be changed.' using errcode = '23514';
  end if;

  -- The administrator corrects the four clinical fields of a finished Visit
  if v_admin then
    if new.status is distinct from old.status or v_times_changed then
      raise exception 'A correction cannot change the status or the times.' using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status in ('Completed', 'Left') then
    raise exception 'A finished Visit cannot be changed.' using errcode = '23514';
  end if;

  -- Visits left open from an earlier day
  if v_stale then
    if new.status <> 'Left' or v_notes_changed then
      raise exception 'Only closing is allowed here.' using errcode = '23514';
    end if;
    new.left_at := now();
    return new;
  end if;

  select s.role into v_role
  from public.staff_profiles s
  where s.id = v_uid and s.active and s.facility_id = old.facility_id;
  if v_role is null then
    raise exception 'You are not allowed to change this Visit.' using errcode = '42501';
  end if;

  if new.status = old.status then
    -- Save draft: Clinical only, during the consultation only
    if v_times_changed then
      raise exception 'Times cannot be changed directly.' using errcode = '23514';
    end if;
    if v_notes_changed and not (v_role = 'Clinical' and old.status = 'In consultation') then
      raise exception 'Notes can only be saved by Clinical during a consultation.' using errcode = '42501';
    end if;
    return new;
  end if;

  if v_notes_changed and not (v_role = 'Clinical' and old.status = 'In consultation' and new.status = 'Completed') then
    raise exception 'Notes can only be saved by Clinical during a consultation.' using errcode = '42501';
  end if;

  if v_role = 'Clinical' and old.status = 'Waiting' and new.status = 'Called' then
    new.called_at := now();
    new.called_by := v_uid;
  elsif v_role = 'Clinical' and old.status = 'Called' and new.status = 'In consultation' then
    new.started_at := now();
    new.clinician := v_uid;
  elsif v_role = 'Clinical' and old.status = 'In consultation' and new.status = 'Completed' then
    new.completed_at := now();
  elsif v_role in ('Clinical', 'Reception') and old.status in ('Waiting', 'Called') and new.status = 'Left' then
    new.left_at := now();
  else
    raise exception 'That status change is not allowed.' using errcode = '23514';
  end if;

  -- Times other than the one set above must stay as they were
  if (new.called_at is distinct from old.called_at and new.status <> 'Called')
     or (new.started_at is distinct from old.started_at and new.status <> 'In consultation')
     or (new.completed_at is distinct from old.completed_at and new.status <> 'Completed')
     or (new.left_at is distinct from old.left_at and new.status <> 'Left')
     or (new.called_by is distinct from old.called_by and new.status <> 'Called')
     or (new.clinician is distinct from old.clinician and new.status <> 'In consultation') then
    raise exception 'Times cannot be changed directly.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger visits_guard
  before update or delete on public.visits
  for each row execute function public.visits_guard();
