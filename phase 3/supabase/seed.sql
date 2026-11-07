-- Sample data set of PRD 8.4: 1 Facility, 4 staff with logins, 4 Patients, 4 Visits.
-- The Visits get today's date (SAST) at the PRD clock times. Run `npm run db:reset` before each demo day.
-- The four logins use the test-only password of PRD 10.4 (see the README). Never use it with real accounts.

insert into public.facilities (id, name, address, province) values
  ('00000000-0000-4000-8000-000000000001', 'Ubuntu Community Clinic', '12 Vilakazi Street, Soweto, Johannesburg', 'Gauteng');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated',
   'tablet1@ubuntu-clinic.example', crypt('PholoTest-2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated',
   'busisiwe.naidoo@ubuntu-clinic.example', crypt('PholoTest-2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated',
   'nomsa.khumalo@ubuntu-clinic.example', crypt('PholoTest-2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated',
   'farouk.patel@ubuntu-clinic.example', crypt('PholoTest-2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', u.id::text, now(), now(), now()
from auth.users u
where u.email like '%@ubuntu-clinic.example';

insert into public.staff_profiles (id, facility_id, full_name, role) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'Ubuntu Clinic Tablet 1', 'Check-in'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'Busisiwe Naidoo', 'Reception'),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'Nomsa Khumalo', 'Clinical'),
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000001', 'Farouk Patel', 'Manager');

insert into public.patients (id, facility_id, file_number, first_name, surname, date_of_birth, id_number, cellphone,
                             paper_file_status, chronic_conditions, allergies, current_medication) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'PH-000001', 'Joseph', 'Mokoena',
   '1954-05-03', '5405035121082', null, 'Paper file - digitised', 'Hypertension', 'Penicillin', 'Amlodipine 5 mg once a day'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'PH-000002', 'Sipho', 'Nkosi',
   '1985-11-22', '8511225876083', '+27825550123', 'Paper file - not yet digitised', null, 'None known', null),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000000001', 'PH-000003', 'Thandi', 'Dlamini',
   '1997-08-14', '9708140234088', '+27825550147', 'No paper file', null, null, null),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-000000000001', 'PH-000004', 'Palesa', 'Molefe',
   '2025-01-09', null, null, 'No paper file', null, null, null);

-- Clock times are today's SAST date plus the PRD time, stored in UTC.
create function pg_temp.sast_today_at(t time) returns timestamptz language sql as
  $$ select (public.sast_date(now()) + t) at time zone 'Africa/Johannesburg' $$;

insert into public.visits (id, facility_id, patient_id, queue_number, checkin_at, reason_category, urgent, assisted,
                           consent_given, status, called_at, called_by, started_at, clinician, completed_at,
                           symptoms, notes, icd10_codes, outcome) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1',
   1, pg_temp.sast_today_at('07:05'), 'Collecting medication', false, true, true, 'Completed',
   pg_temp.sast_today_at('07:48'), '00000000-0000-4000-8000-0000000000a3',
   pg_temp.sast_today_at('07:48'), '00000000-0000-4000-8000-0000000000a3', pg_temp.sast_today_at('08:06'),
   'Monthly medication check. No new complaints.', 'Blood pressure 138/86. Repeat prescription for 28 days.', 'I10',
   'Medication given'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2',
   2, pg_temp.sast_today_at('07:12'), 'Feeling sick or injured', false, false, true, 'In consultation',
   pg_temp.sast_today_at('08:02'), '00000000-0000-4000-8000-0000000000a3',
   pg_temp.sast_today_at('08:02'), '00000000-0000-4000-8000-0000000000a3', null, null, null, null, null),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b3',
   3, pg_temp.sast_today_at('07:20'), 'Test or screening', false, false, true, 'Waiting',
   null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b4',
   4, pg_temp.sast_today_at('07:31'), 'Baby or child care', true, false, true, 'Waiting',
   null, null, null, null, null, null, null, null, null);
