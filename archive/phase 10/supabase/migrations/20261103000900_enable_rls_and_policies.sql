-- Phase 2, migration 9: Row-Level Security on every table, the policies of plan Section 9, and the function permissions.
alter table public.facilities enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.audit_logs enable row level security;

-- Remove the broad default rights, then give back only what is needed.
revoke all on public.facilities, public.staff_profiles, public.patients, public.visits, public.audit_logs from public, anon, authenticated;
revoke all on public.visits_for_reception from public, anon, authenticated;

grant select (id, name) on public.facilities to authenticated;       -- SEC1: only the name is shown
grant select on public.staff_profiles to authenticated;
grant select, insert, update on public.patients to authenticated;
grant select, update on public.visits to authenticated;
grant select on public.visits_for_reception to authenticated;

-- SEC1
create policy facilities_select_own on public.facilities for select to authenticated
  using (id = public.current_facility_id());

-- SEC3
create policy staff_profiles_select on public.staff_profiles for select to authenticated
  using (
    id = auth.uid()
    or (public.current_staff_role() in ('Reception', 'Clinical') and public.staff_linked_to_visit(id))
  );

-- SEC5, SEC6, SEC7
create policy patients_select_reception_clinical on public.patients for select to authenticated
  using (facility_id = public.current_facility_id() and public.current_staff_role() in ('Reception', 'Clinical'));
create policy patients_insert_reception on public.patients for insert to authenticated
  with check (facility_id = public.current_facility_id() and public.current_staff_role() = 'Reception');
create policy patients_update_reception_clinical on public.patients for update to authenticated
  using (facility_id = public.current_facility_id() and public.current_staff_role() in ('Reception', 'Clinical'))
  with check (facility_id = public.current_facility_id() and public.current_staff_role() in ('Reception', 'Clinical'));

-- SEC10, SEC14, SEC15
create policy visits_select_clinical on public.visits for select to authenticated
  using (facility_id = public.current_facility_id() and public.current_staff_role() = 'Clinical');
create policy visits_update_clinical on public.visits for update to authenticated
  using (facility_id = public.current_facility_id() and public.current_staff_role() = 'Clinical')
  with check (facility_id = public.current_facility_id() and public.current_staff_role() = 'Clinical');
create policy visits_update_left on public.visits for update to authenticated
  using (facility_id = public.current_facility_id() and public.current_staff_role() in ('Reception', 'Clinical')
         and status in ('Waiting', 'Called'))
  with check (facility_id = public.current_facility_id() and public.current_staff_role() in ('Reception', 'Clinical')
         and status = 'Left');

-- SEC18, SEC19: nobody in the app reads or writes the audit log directly. The one policy denies everything,
-- so that every table has a policy and none is open by accident (T-DB-17).
create policy audit_logs_no_access on public.audit_logs for all to authenticated
  using (false) with check (false);

-- Function permissions: checkin, write_audit and admin_correct_visit only for the service role (SEC18, SEC21)
revoke all on function public.write_audit(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.checkin(uuid, text, text, date, text, text, boolean, boolean, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.admin_correct_visit(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.write_audit(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.checkin(uuid, text, text, date, text, text, boolean, boolean, text, boolean, boolean) to service_role;
grant execute on function public.admin_correct_visit(uuid, uuid, text, text) to service_role;

revoke all on function public.call_next_patient() from public, anon;
revoke all on function public.mark_visit_left(uuid) from public, anon;
revoke all on function public.close_stale_visits() from public, anon;
revoke all on function public.daily_summary() from public, anon;
revoke all on function public.current_staff_role() from public, anon;
revoke all on function public.current_facility_id() from public, anon;
revoke all on function public.staff_linked_to_visit(uuid) from public, anon;
grant execute on function public.call_next_patient() to authenticated, service_role;
grant execute on function public.mark_visit_left(uuid) to authenticated, service_role;
grant execute on function public.close_stale_visits() to authenticated, service_role;
grant execute on function public.daily_summary() to authenticated, service_role;
grant execute on function public.current_staff_role() to authenticated, service_role;
grant execute on function public.current_facility_id() to authenticated, service_role;
grant execute on function public.staff_linked_to_visit(uuid) to authenticated, service_role;

-- The triggers' helper functions are not callable by the app roles
revoke all on function public.is_valid_sa_id(text, date), public.normalise_cellphone(text),
  public.next_file_number(uuid), public.sast_date(timestamptz) from public, anon;
grant execute on function public.is_valid_sa_id(text, date), public.normalise_cellphone(text),
  public.next_file_number(uuid), public.sast_date(timestamptz) to authenticated, service_role;

-- Read-only report of the catalog for the database tests (T-DB-15, T-DB-17, T-BR19-3). Service role only.
create or replace function public.test_catalog()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tables', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', c.relname, 'rls', c.relrowsecurity,
        'policies', (select count(*) from pg_policy p where p.polrelid = c.oid))), '[]'::jsonb)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'),
    'indexes', (select coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'name', indexname, 'def', indexdef)), '[]'::jsonb)
      from pg_indexes where schemaname = 'public'),
    'columns', (select coalesce(jsonb_agg(jsonb_build_object('table', table_name, 'column', column_name, 'type', data_type)), '[]'::jsonb)
      from information_schema.columns where table_schema = 'public')
  )
$$;
revoke all on function public.test_catalog() from public, anon, authenticated;
grant execute on function public.test_catalog() to service_role;
