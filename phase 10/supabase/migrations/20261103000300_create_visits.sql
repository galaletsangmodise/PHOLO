-- Phase 2, migration 3: visits with its constraints and unique indexes
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  queue_number integer not null check (queue_number >= 1),
  checkin_at timestamptz not null default now(),
  reason_category text not null check (reason_category in ('Feeling sick or injured', 'Collecting medication',
    'Baby or child care', 'Pregnancy or family planning', 'Test or screening', 'Something else')),
  urgent boolean not null default false,
  assisted boolean not null default false,
  consent_given boolean not null check (consent_given = true),
  status text not null default 'Waiting' check (status in ('Waiting', 'Called', 'In consultation', 'Completed', 'Left')),
  called_at timestamptz,
  called_by uuid references public.staff_profiles (id) on delete restrict,
  started_at timestamptz,
  clinician uuid references public.staff_profiles (id) on delete restrict,
  completed_at timestamptz,
  left_at timestamptz,
  symptoms text check (symptoms is null or char_length(symptoms) between 1 and 1000),
  notes text check (notes is null or char_length(notes) <= 2000),
  icd10_codes text check (
    icd10_codes is null or (
      char_length(icd10_codes) <= 60
      and icd10_codes ~ '^[A-Z][0-9]{2}(\.[A-Za-z0-9]{1,2})?(, ?[A-Z][0-9]{2}(\.[A-Za-z0-9]{1,2})?){0,4}$'
    )
  ),
  outcome text check (outcome is null or outcome in ('Treated and sent home', 'Medication given',
    'Referred to hospital', 'Follow-up needed', 'Other')),
  created_at timestamptz not null default now(),
  constraint visits_completed_needs_symptoms_and_outcome check (status <> 'Completed' or (symptoms is not null and outcome is not null))
);

-- BR1: one queue number per Facility per SAST day. BR3: one open Visit per Patient.
create unique index visits_facility_queue_day_key on public.visits (facility_id, queue_number, public.sast_date(checkin_at));
create unique index visits_patient_open_key on public.visits (patient_id) where status in ('Waiting', 'Called', 'In consultation');
