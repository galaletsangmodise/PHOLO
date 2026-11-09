-- Phase 2, migration 5: the remaining indexes of plan 8.4
-- (unique ones on patients file_number, patients id_number, visits queue number and visits open Visit are made with their tables)
create unique index patients_facility_id_number_key on public.patients (facility_id, id_number) where id_number is not null;
create index patients_facility_name_idx on public.patients (facility_id, lower(surname), lower(first_name));
create index patients_facility_name_dob_idx on public.patients (facility_id, lower(first_name), lower(surname), date_of_birth);
create index visits_facility_status_checkin_idx on public.visits (facility_id, status, checkin_at);
create index visits_patient_checkin_idx on public.visits (patient_id, checkin_at desc);
create index visits_facility_checkin_idx on public.visits (facility_id, checkin_at);
create index audit_logs_actor_action_created_idx on public.audit_logs (actor_id, action, created_at desc);
