-- Phase 2, migration 8: Reception reads Visits only through this view (SEC11).
-- It has no symptoms, notes, icd10_codes or outcome, and shows only the caller's Facility.
create view public.visits_for_reception as
  select v.id, v.facility_id, v.patient_id, v.queue_number, v.checkin_at, v.reason_category, v.urgent, v.assisted,
         v.status, v.called_at, v.called_by, v.started_at, v.clinician, v.completed_at, v.left_at, v.created_at
  from public.visits v
  where v.facility_id = public.current_facility_id()
    and public.current_staff_role() in ('Reception', 'Clinical');
