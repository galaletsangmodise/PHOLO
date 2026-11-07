import { execSync } from 'child_process';
import path from 'path';
import { admin, SEED } from './helpers';

const REASONS: Record<string, string> = { v1: 'Collecting medication', v2: 'Feeling sick or injured', v3: 'Test or screening', v4: 'Baby or child care' };

async function snapshot() {
  const [facilities, staff, patients, visits] = await Promise.all([
    admin.from('facilities').select('*').eq('id', SEED.facility),
    admin.from('staff_profiles').select('*').eq('facility_id', SEED.facility).order('full_name'),
    admin.from('patients').select('*').eq('facility_id', SEED.facility).order('file_number'),
    admin.from('visits').select('*').eq('facility_id', SEED.facility).order('queue_number'),
  ]);
  const strip = (rows: Record<string, unknown>[] | null) =>
    (rows ?? []).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'created_at' && key !== 'updated_at')));
  return { facilities: strip(facilities.data), staff: strip(staff.data), patients: strip(patients.data), visits: strip(visits.data) };
}

describe('seed data (PRD 8.4)', () => {
  it('T-DB-18 holds exactly the Facility, 4 staff, 4 Patients and 4 Visits of PRD 8.4', async () => {
    const s = await snapshot();
    expect(s.facilities).toEqual([{ id: SEED.facility, name: 'Ubuntu Community Clinic', address: '12 Vilakazi Street, Soweto, Johannesburg', province: 'Gauteng' }]);
    expect(s.staff.map((x) => [x.full_name, x.role]).sort()).toEqual([
      ['Busisiwe Naidoo', 'Reception'], ['Farouk Patel', 'Manager'], ['Nomsa Khumalo', 'Clinical'], ['Ubuntu Clinic Tablet 1', 'Check-in'],
    ]);
    expect(s.patients.map((x) => [x.file_number, x.first_name, x.surname, x.date_of_birth, x.id_number, x.cellphone, x.paper_file_status])).toEqual([
      ['PH-000001', 'Joseph', 'Mokoena', '1954-05-03', '5405035121082', null, 'Paper file - digitised'],
      ['PH-000002', 'Sipho', 'Nkosi', '1985-11-22', '8511225876083', '+27825550123', 'Paper file - not yet digitised'],
      ['PH-000003', 'Thandi', 'Dlamini', '1997-08-14', '9708140234088', '+27825550147', 'No paper file'],
      ['PH-000004', 'Palesa', 'Molefe', '2025-01-09', null, null, 'No paper file'],
    ]);
    expect(s.patients[0]).toMatchObject({ chronic_conditions: 'Hypertension', allergies: 'Penicillin', current_medication: 'Amlodipine 5 mg once a day' });
    expect(s.patients[1]).toMatchObject({ chronic_conditions: null, allergies: 'None known', current_medication: null });
    expect(s.visits.map((v) => [v.queue_number, v.reason_category, v.urgent, v.assisted, v.status])).toEqual([
      [1, REASONS.v1, false, true, 'Completed'], [2, REASONS.v2, false, false, 'In consultation'],
      [3, REASONS.v3, false, false, 'Waiting'], [4, REASONS.v4, true, false, 'Waiting'],
    ]);
    expect(s.visits[0]).toMatchObject({ called_by: SEED.clinical, clinician: SEED.clinical, symptoms: 'Monthly medication check. No new complaints.', icd10_codes: 'I10', outcome: 'Medication given' });
    expect(s.visits[1]).toMatchObject({ called_by: SEED.clinical, clinician: SEED.clinical });
  });

  it('T-DB-18 the Visit times are today (SAST) at the PRD clock times', async () => {
    const { data } = await admin.from('visits').select('queue_number, checkin_at, called_at, completed_at').eq('facility_id', SEED.facility).order('queue_number');
    const sast = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 2 * 3_600_000).toISOString().slice(11, 16) : null);
    expect(data?.map((v) => [sast(v.checkin_at), sast(v.called_at), sast(v.completed_at)])).toEqual([
      ['07:05', '07:48', '08:06'], ['07:12', '08:02', null], ['07:20', null, null], ['07:31', null, null],
    ]);
  });

  it('T-DB-19 two resets in a row leave identical data', () => {
    // npm run db:reset resets the linked development project (it asks for confirmation, so "y" is sent).
    const reset = () => execSync('npm run db:reset', { cwd: path.resolve(__dirname, '../..'), input: 'y\n', stdio: ['pipe', 'pipe', 'pipe'], timeout: 240_000 });
    reset();
    return snapshot().then((first) => { reset(); return snapshot().then((second) => expect(second).toEqual(first)); });
  }, 600_000);
});
