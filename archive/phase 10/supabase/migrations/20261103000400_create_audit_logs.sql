-- Phase 2, migration 4: audit_logs and trigger audit_logs_append_only (BR16)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete restrict,
  actor_id uuid not null references public.staff_profiles (id) on delete restrict,
  action text not null check (action in ('checked_in', 'opened_patient_file', 'created_patient', 'updated_patient',
    'recorded_paper_history', 'called_next', 'started_consultation', 'saved_draft', 'completed_visit', 'marked_left',
    'corrected_visit')),
  entity_type text not null check (entity_type in ('Patient', 'Visit')),
  entity_id uuid not null,
  created_at timestamptz not null default now()
);

create or replace function public.audit_logs_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit log can only be added to.' using errcode = '42501';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_append_only();
