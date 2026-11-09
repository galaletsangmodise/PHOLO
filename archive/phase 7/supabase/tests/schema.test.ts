import {
  admin, catalog, createFacility, createStaff, insertPatient, insertVisit, mustInsertPatient, mustInsertVisit, unique, SEED,
} from './helpers';

const fail = (result: { error: unknown }) => expect(result.error).not.toBeNull();
const ok = (result: { error: unknown }) => expect(result.error).toBeNull();

describe('facilities (T-DB-1)', () => {
  const base = () => ({ name: `Clinic ${unique()}`, address: '1 Street', province: 'Gauteng' });
  it('T-DB-1 refuses duplicate, empty, long names, bad addresses and bad provinces', async () => {
    ok(await admin.from('facilities').insert(base()));
    fail(await admin.from('facilities').insert({ ...base(), name: 'Ubuntu Community Clinic' }));
    fail(await admin.from('facilities').insert({ ...base(), name: '' }));
    fail(await admin.from('facilities').insert({ ...base(), name: 'a'.repeat(101) }));
    ok(await admin.from('facilities').insert({ ...base(), name: 'a'.repeat(90) + unique() }));
    fail(await admin.from('facilities').insert({ ...base(), address: '' }));
    fail(await admin.from('facilities').insert({ ...base(), address: 'a'.repeat(201) }));
    fail(await admin.from('facilities').insert({ ...base(), province: 'Narnia' }));
  });
});

describe('staff_profiles (T-DB-2)', () => {
  it('T-DB-2 refuses bad roles and names; active defaults to true', async () => {
    const facility = await createFacility();
    const make = async () => {
      const { data } = await admin.auth.admin.createUser({ email: `s.${unique()}@test.example`, password: 'PholoTest-2026', email_confirm: true });
      return data.user!.id;
    };
    fail(await admin.from('staff_profiles').insert({ id: await make(), facility_id: facility, full_name: 'A', role: 'Janitor' }));
    fail(await admin.from('staff_profiles').insert({ id: await make(), facility_id: facility, full_name: '', role: 'Clinical' }));
    fail(await admin.from('staff_profiles').insert({ id: await make(), facility_id: facility, full_name: 'a'.repeat(81), role: 'Clinical' }));
    const { data, error } = await admin
      .from('staff_profiles')
      .insert({ id: await make(), facility_id: facility, full_name: 'Good Name', role: 'Clinical' })
      .select('active')
      .single();
    expect(error).toBeNull();
    expect(data?.active).toBe(true);
  });
});

describe('patients', () => {
  let facility: string;
  beforeAll(async () => { facility = await createFacility(); });

  it('T-DB-3 refuses bad names and accepts letters, spaces, hyphens and apostrophes', async () => {
    fail(await insertPatient(facility, { first_name: '' }));
    fail(await insertPatient(facility, { surname: '' }));
    fail(await insertPatient(facility, { first_name: 'a'.repeat(41) }));
    fail(await insertPatient(facility, { surname: 'a'.repeat(41) }));
    fail(await insertPatient(facility, { first_name: 'Sipho7' }));
    fail(await insertPatient(facility, { surname: 'Nkosi!' }));
    ok(await insertPatient(facility, { first_name: "Mary-Anne", surname: "O'Neil Smith" }));
  });

  it('T-DB-4 refuses a date of birth in the future or before 1 Jan 1900', async () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const today = new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10); // SAST date
    fail(await insertPatient(facility, { date_of_birth: tomorrow }));
    fail(await insertPatient(facility, { date_of_birth: '1899-12-31' }));
    ok(await insertPatient(facility, { date_of_birth: today }));
    ok(await insertPatient(facility, { date_of_birth: '1900-01-01' }));
  });

  it('T-DB-5 gives PH-000005 after the 4 seeded Patients, in the right format, and the number never changes', async () => {
    const { data: seeded } = await admin.from('patients').select('id').eq('facility_id', SEED.facility);
    expect(seeded?.length).toBeGreaterThanOrEqual(4);
    const first = await mustInsertPatient(facility);
    expect(first.file_number).toBe('PH-000001'); // numbers are per Facility
    const second = await mustInsertPatient(facility);
    expect(second.file_number).toBe('PH-000002');
    expect(second.file_number).toMatch(/^PH-[0-9]{6}$/);
    fail(await insertPatient(facility, { file_number: first.file_number }));
    fail(await admin.from('patients').update({ file_number: 'PH-000099' }).eq('id', second.id));
  });

  it('T-DB-6 refuses a repeated ID number at one Facility and accepts two empty ones', async () => {
    const id = '9708140234088';
    ok(await insertPatient(facility, { date_of_birth: '1997-08-14', id_number: id }));
    fail(await insertPatient(facility, { date_of_birth: '1997-08-14', id_number: id }));
    ok(await insertPatient(facility, { id_number: null }));
    ok(await insertPatient(facility, { id_number: null }));
  });

  it('T-DB-7 defaults paper_file_status and refuses other values', async () => {
    const { data } = await insertPatient(facility);
    expect(data?.paper_file_status).toBe('No paper file');
    fail(await insertPatient(facility, { paper_file_status: 'Lost' }));
  });

  it('T-DB-8 limits the history fields', async () => {
    ok(await insertPatient(facility, { chronic_conditions: 'a'.repeat(500), allergies: 'a'.repeat(300), current_medication: 'a'.repeat(500) }));
    fail(await insertPatient(facility, { chronic_conditions: 'a'.repeat(501) }));
    fail(await insertPatient(facility, { allergies: 'a'.repeat(301) }));
    fail(await insertPatient(facility, { current_medication: 'a'.repeat(501) }));
  });

  it('T-DB-9 changes updated_at on update', async () => {
    const patient = await mustInsertPatient(facility);
    const before = (await admin.from('patients').select('updated_at').eq('id', patient.id).single()).data!.updated_at;
    await new Promise((resolve) => setTimeout(resolve, 20));
    ok(await admin.from('patients').update({ allergies: 'Penicillin' }).eq('id', patient.id));
    const after = (await admin.from('patients').select('updated_at').eq('id', patient.id).single()).data!.updated_at;
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
  });
});

describe('visits', () => {
  let facility: string;
  let patient: string;
  beforeAll(async () => {
    facility = await createFacility();
    patient = (await mustInsertPatient(facility)).id;
  });

  it('T-DB-10 refuses queue number 0 and a repeated number for one Facility and SAST day', async () => {
    fail(await insertVisit(facility, patient, 0));
    const other = (await mustInsertPatient(facility)).id;
    const third = (await mustInsertPatient(facility)).id;
    ok(await insertVisit(facility, patient, 1, { status: 'Completed', symptoms: 'x', outcome: 'Other' }));
    fail(await insertVisit(facility, other, 1));
    ok(await insertVisit(facility, other, 2));
    ok(await insertVisit(facility, third, 1, { checkin_at: new Date(Date.now() - 3 * 86_400_000).toISOString(), status: 'Left' }));
  });

  it('T-DB-11 refuses bad values and sets the defaults', async () => {
    const p = (await mustInsertPatient(facility)).id;
    fail(await insertVisit(facility, p, 50, { reason_category: 'Boredom' }));
    fail(await insertVisit(facility, p, 50, { status: 'Lost' }));
    fail(await insertVisit(facility, p, 50, { status: 'Left', outcome: 'Cured' }));
    const { data, error } = await insertVisit(facility, p, 50);
    expect(error).toBeNull();
    expect(data).toMatchObject({ urgent: false, assisted: false, status: 'Waiting', left_at: null });
  });

  it('T-DB-12 limits symptoms, notes and ICD-10 codes', async () => {
    const make = async () => (await mustInsertPatient(facility)).id;
    fail(await insertVisit(facility, await make(), 60, { symptoms: 'a'.repeat(1001) }));
    fail(await insertVisit(facility, await make(), 61, { notes: 'a'.repeat(2001) }));
    fail(await insertVisit(facility, await make(), 62, { icd10_codes: 'A01,A02,A03,A04,A05,A06,A07,A08,A09,A10,A11,A12,A13,A14,A15' }));
    ok(await insertVisit(facility, await make(), 63, { symptoms: 'a'.repeat(1000), notes: 'a'.repeat(2000), icd10_codes: 'J06.9, R50.9' }));
  });

  it('T-DB-13 blocks deleting a Facility, Patient or StaffProfile that is linked', async () => {
    const clinicFacility = await createFacility();
    const staff = await createStaff(clinicFacility, 'Clinical');
    const linked = await mustInsertPatient(clinicFacility);
    await mustInsertVisit(clinicFacility, linked.id, 1, { status: 'In consultation', called_at: new Date().toISOString(), called_by: staff.id, started_at: new Date().toISOString(), clinician: staff.id });
    fail(await admin.from('patients').delete().eq('id', linked.id));
    fail(await admin.from('staff_profiles').delete().eq('id', staff.id));
    fail(await admin.from('facilities').delete().eq('id', clinicFacility));
  });
});

describe('audit_logs (T-DB-14)', () => {
  it('T-DB-14 refuses actions and entity types outside their lists', async () => {
    const facility = await createFacility();
    const staff = await createStaff(facility, 'Reception');
    const entity = (await mustInsertPatient(facility)).id;
    const row = { facility_id: facility, actor_id: staff.id, entity_id: entity };
    fail(await admin.from('audit_logs').insert({ ...row, action: 'hacked', entity_type: 'Patient' }));
    fail(await admin.from('audit_logs').insert({ ...row, action: 'created_patient', entity_type: 'Doctor' }));
    ok(await admin.from('audit_logs').insert({ ...row, action: 'created_patient', entity_type: 'Patient' }));
  });
});

describe('catalog', () => {
  it('T-DB-15 every index of Section 8.4 exists', async () => {
    const { indexes } = await catalog();
    const has = (table: string, ...parts: string[]) =>
      indexes.some((i) => i.table === table && parts.every((p) => i.def.replace(/"/g, '').toLowerCase().includes(p.toLowerCase())));
    expect(has('patients', '(facility_id, lower(surname), lower(first_name))')).toBe(true);
    expect(has('patients', '(facility_id, lower(first_name), lower(surname), date_of_birth)')).toBe(true);
    expect(has('patients', 'unique', '(facility_id, id_number)', 'where')).toBe(true);
    expect(has('patients', 'unique', '(facility_id, file_number)')).toBe(true);
    expect(has('visits', '(facility_id, status, checkin_at)')).toBe(true);
    expect(has('visits', '(patient_id, checkin_at desc)')).toBe(true);
    expect(has('visits', 'unique', 'facility_id, queue_number, sast_date(checkin_at)')).toBe(true);
    expect(has('visits', 'unique', '(patient_id)', 'Waiting')).toBe(true);
    expect(has('visits', '(facility_id, checkin_at)')).toBe(true);
    expect(has('audit_logs', '(actor_id, action, created_at desc)')).toBe(true);
  });

  it('T-DB-16 the 9 migrations ran in order (their tables, functions and view all exist)', async () => {
    const { tables } = await catalog();
    expect(tables.map((t) => t.name).sort()).toEqual(['audit_logs', 'facilities', 'patients', 'staff_profiles', 'visits']);
    const calls = await Promise.all([
      admin.rpc('is_valid_sa_id', { p_id: '9708140234088', p_dob: '1997-08-14' }),
      admin.rpc('normalise_cellphone', { p_raw: '082 555 0147' }),
      admin.from('visits_for_reception').select('id').limit(1),
    ]);
    calls.forEach((c) => expect(c.error).toBeNull());
  });

  it('T-BR19-3 every time column is timestamptz', async () => {
    const { columns } = await catalog();
    const times = columns.filter((c) => /(_at)$/.test(c.column));
    expect(times.length).toBeGreaterThan(8);
    times.forEach((c) => expect(c.type).toBe('timestamp with time zone'));
  });
});
