import { PatientsService } from './patients.service';
import type { AuthUser } from '../auth/auth.types';
import type { SupabaseService } from '../auth/supabase.service';

/**
 * A stand-in for Supabase so the rules of OP9 to OP12 are checked without a project.
 * Each from(table) call takes the next scripted answer; the calls made on it are recorded.
 */
interface Step {
  table: string;
  result: { data: unknown; error: { code?: string; message: string } | null };
  calls: Array<[string, unknown[]]>;
}
function fake(script: Array<{ table: string; data?: unknown; error?: { code?: string; message: string } | null }>) {
  const steps: Step[] = script.map((s) => ({ table: s.table, result: { data: s.data ?? null, error: s.error ?? null }, calls: [] }));
  let next = 0;
  const rpc = jest.fn(async () => ({ data: null, error: null }));
  const builder = (step: Step) => {
    const proxy: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'ilike', 'order', 'limit', 'insert', 'update', 'single', 'maybeSingle', 'neq', 'in']) {
      proxy[name] = (...args: unknown[]) => {
        step.calls.push([name, args]);
        return proxy;
      };
    }
    proxy.then = (resolve: (value: unknown) => void) => resolve(step.result);
    return proxy;
  };
  const supabase = {
    forToken: () => ({
      from: (table: string) => {
        const step = steps[next];
        next += 1;
        if (!step) throw new Error(`Unexpected query on ${table}`);
        expect(table).toBe(step.table);
        return builder(step);
      },
    }),
    admin: () => ({ rpc }),
  } as unknown as SupabaseService;
  return { supabase, steps, rpc, used: () => next };
}

const FILE_ID = '7c0e6a0e-6b1f-4f3c-8a7e-0a1b2c3d4e5f';
const reception: AuthUser = { id: 'u-rec', role: 'Reception', fullName: 'Busisiwe Naidoo', facilityId: 'f-1', facilityName: 'Ubuntu', token: 't' };
const clinical: AuthUser = { ...reception, id: 'u-cli', role: 'Clinical', fullName: 'Nomsa Khumalo' };

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'p-3', file_number: 'PH-000003', first_name: 'Thandi', surname: 'Dlamini', date_of_birth: '1997-08-14',
  id_number: '9708140234088', cellphone: '+27825550147', paper_file_status: 'No paper file',
  chronic_conditions: null, allergies: null, current_medication: null, ...overrides,
});
const call = (step: Step, name: string) => step.calls.find(([n]) => n === name)?.[1];
const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: { getResponse(): unknown; getStatus(): number }) => ({ status: error.getStatus(), body: error.getResponse() as Record<string, unknown> }));

describe('OP9 search (BR13)', () => {
  it('T-BR13-1 fewer than 2 characters comes back with the message and asks the database nothing', async () => {
    const { supabase, used } = fake([]);
    const service = new PatientsService(supabase);
    for (const text of ['', 'a', '  a  ', undefined]) {
      const refused = await rejection(service.search(reception, text));
      expect(refused).toEqual({ status: 400, body: expect.objectContaining({ message: 'Type at least 2 characters to search.' }) });
    }
    expect(used()).toBe(0);
  });

  it('T-BR13-2 a name is a prefix match on surname and on first name, with % and _ taken as plain characters', async () => {
    const { supabase, steps } = fake([
      { table: 'patients', data: [row({ id: 'a', surname: 'Dlamini', first_name: 'Thandi' })] },
      { table: 'patients', data: [row({ id: 'b', surname: 'Zulu', first_name: 'Dlamini' })] },
    ]);
    const result = await new PatientsService(supabase).search(reception, 'Dl%_');
    expect(call(steps[0], 'ilike')).toEqual(['surname', 'Dl\\%\\_%']);
    expect(call(steps[1], 'ilike')).toEqual(['first_name', 'Dl\\%\\_%']);
    expect(result.patients.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('T-BR13-3 an exact 13-digit ID number is searched by ID number only, and only its last 4 digits come back', async () => {
    const { supabase, steps, used } = fake([{ table: 'patients', data: [row()] }]);
    const result = await new PatientsService(supabase).search(reception, '9708140234088');
    expect(call(steps[0], 'eq')).toEqual(['id_number', '9708140234088']);
    expect(used()).toBe(1);
    expect(result.patients).toEqual([
      { id: 'p-3', file_number: 'PH-000003', first_name: 'Thandi', surname: 'Dlamini', date_of_birth: '1997-08-14', id_number_last4: '4088', paper_file_status: 'No paper file' },
    ]);
    expect(JSON.stringify(result)).not.toContain('9708140234088');
  });

  it('T-BR13-4 an exact file number is searched by file number, ignoring capitals', async () => {
    const { supabase, steps } = fake([{ table: 'patients', data: [row()] }]);
    await new PatientsService(supabase).search(reception, 'ph-000003');
    expect(call(steps[0], 'eq')).toEqual(['file_number', 'PH-000003']);
  });

  it('T-BR13-5, T-BR13-6 at most 20 come back, sorted by surname and then first name, each Patient once', async () => {
    const many = Array.from({ length: 12 }, (_, i) => row({ id: `s${i}`, surname: 'Sithole', first_name: `Name${String(11 - i).padStart(2, '0')}` }));
    const others = Array.from({ length: 12 }, (_, i) => row({ id: `a${i}`, surname: 'Abrahams', first_name: `Si${String(i).padStart(2, '0')}` }));
    const { supabase } = fake([{ table: 'patients', data: [...many, many[0]] }, { table: 'patients', data: others }]);
    const result = await new PatientsService(supabase).search(reception, 'si');
    expect(result.patients).toHaveLength(20);
    expect(new Set(result.patients.map((p) => p.id)).size).toBe(20);
    expect(result.patients[0].surname).toBe('Abrahams');
    expect(result.patients[11].surname).toBe('Abrahams');
    expect(result.patients[12]).toMatchObject({ surname: 'Sithole', first_name: 'Name00' });
  });

  it('a database error is a server problem', async () => {
    const { supabase } = fake([{ table: 'patients', error: { message: 'boom' } }, { table: 'patients' }]);
    const refused = await rejection(new PatientsService(supabase).search(reception, 'Dla'));
    expect(refused).toEqual({ status: 500, body: expect.objectContaining({ message: 'Search did not work. Please try again.' }) });
  });
});

describe('OP10 open a Patient File (BR16, SEC11)', () => {
  it('T-INT-5 the Patient and the Visits come from the view for Reception, and opened_patient_file is written', async () => {
    const visits = [{ id: 'v1', queue_number: 3, checkin_at: '2026-10-27T05:20:00Z', reason_category: 'Test or screening', status: 'Waiting', urgent: false }];
    const { supabase, steps, rpc } = fake([{ table: 'patients', data: row({ id: FILE_ID }) }, { table: 'visits_for_reception', data: visits }]);
    const result = await new PatientsService(supabase).getFile(reception, FILE_ID);
    expect(result.patient.id).toBe(FILE_ID);
    expect(result.visits).toEqual(visits);
    expect(call(steps[1], 'select')).toEqual(['id, queue_number, checkin_at, reason_category, status, urgent']);
    expect(call(steps[1], 'order')).toEqual(['checkin_at', { ascending: false }]);
    expect(rpc).toHaveBeenCalledWith('write_audit', {
      p_facility_id: 'f-1', p_actor_id: 'u-rec', p_action: 'opened_patient_file', p_entity_type: 'Patient', p_entity_id: FILE_ID,
    });
  });

  it('T-S8-10 Clinical gets symptoms, notes, ICD-10 codes, outcome and the clinician name from the visits table; Reception never does', async () => {
    const visits = [
      { id: 'v1', queue_number: 3, checkin_at: '2026-10-27T05:20:00Z', reason_category: 'Test or screening', status: 'Completed', urgent: false,
        symptoms: 'Cough', notes: 'Chest clear.', icd10_codes: 'J06.9', outcome: 'Treated and sent home', clinician: 'u-cli' },
      { id: 'v2', queue_number: 5, checkin_at: '2026-10-28T05:20:00Z', reason_category: 'Something else', status: 'Left', urgent: false,
        symptoms: null, notes: null, icd10_codes: null, outcome: null, clinician: null },
    ];
    const { supabase, steps, rpc } = fake([
      { table: 'patients', data: row({ id: FILE_ID }) },
      { table: 'visits', data: visits },
      { table: 'staff_profiles', data: [{ id: 'u-cli', full_name: 'Nomsa Khumalo' }] },
    ]);
    const result = await new PatientsService(supabase).getFile(clinical, FILE_ID);
    expect(call(steps[1], 'select')).toEqual([expect.stringContaining('symptoms, notes, icd10_codes, outcome, clinician')]);
    expect(result.visits[0]).toEqual({
      id: 'v1', queue_number: 3, checkin_at: '2026-10-27T05:20:00Z', reason_category: 'Test or screening', status: 'Completed', urgent: false,
      symptoms: 'Cough', notes: 'Chest clear.', icd10_codes: 'J06.9', outcome: 'Treated and sent home', clinician_name: 'Nomsa Khumalo',
    });
    expect(result.visits[1]).toMatchObject({ symptoms: null, clinician_name: null });
    expect(result.visits[0]).not.toHaveProperty('clinician');
    expect(rpc).toHaveBeenCalledWith('write_audit', expect.objectContaining({ p_action: 'opened_patient_file' }));
  });

  it('a Reception answer has none of the clinical keys', async () => {
    const visits = [{ id: 'v1', queue_number: 3, checkin_at: '2026-10-27T05:20:00Z', reason_category: 'Test or screening', status: 'Completed', urgent: false }];
    const { supabase } = fake([{ table: 'patients', data: row({ id: FILE_ID }) }, { table: 'visits_for_reception', data: visits }]);
    const result = await new PatientsService(supabase).getFile(reception, FILE_ID);
    expect(JSON.stringify(result.visits)).not.toMatch(/symptoms|notes|icd10|outcome|clinician/);
  });

  it('a Patient that cannot be found (or is not a valid id) is "We could not open this file." and writes nothing', async () => {
    const { supabase, rpc } = fake([{ table: 'patients', data: null }]);
    const missing = await rejection(new PatientsService(supabase).getFile(clinical, '7c0e6a0e-6b1f-4f3c-8a7e-0a1b2c3d4e5f'));
    expect(missing).toEqual({ status: 404, body: expect.objectContaining({ message: 'We could not open this file. Please try again.' }) });
    const notAnId = await rejection(new PatientsService(fake([]).supabase).getFile(clinical, 'not-an-id'));
    expect(notAnId?.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('OP11 create a Patient (BR4, BR5, BR6, BR16)', () => {
  const body = { first_name: ' Nomvula ', surname: 'Pillay', date_of_birth: '1990-03-11', id_number: '', cellphone: '083 555 0198', paper_file_status: 'Paper file - not yet digitised' };

  it('T-INT-13 every fault comes back with its exact message and the field', async () => {
    const service = new PatientsService(fake([]).supabase);
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ first_name: '' }, 'first_name', 'Please enter the first name.'],
      [{ surname: '' }, 'surname', 'Please enter the surname.'],
      [{ date_of_birth: '' }, 'date_of_birth', 'Please enter a real date of birth, for example 14 / 08 / 1997.'],
      [{ id_number: '123' }, 'id_number', 'This ID number does not look right. Check it, or leave it empty if the patient does not have one.'],
      [{ cellphone: '12' }, 'cellphone', 'Enter a South African cellphone number, for example 083 555 0198, or leave it empty.'],
      [{ paper_file_status: '' }, 'paper_file_status', 'Please choose a paper file status.'],
      [{ paper_file_status: 'Paper file - digitised' }, 'paper_file_status', 'Please choose a paper file status.'],
    ];
    for (const [patch, field, message] of cases) {
      const refused = await rejection(service.create(reception, { ...body, ...patch }));
      expect(refused).toEqual({ status: 400, body: expect.objectContaining({ message, field }) });
    }
  });

  it('T-INT-6 saves with the Facility of the user, the cellphone as +27..., an empty ID as null, then writes created_patient', async () => {
    const { supabase, steps, rpc } = fake([{ table: 'patients', data: row({ id: 'p-9', file_number: 'PH-000009', first_name: 'Nomvula', surname: 'Pillay', id_number: null, cellphone: '+27835550198', paper_file_status: 'Paper file - not yet digitised' }) }]);
    const result = await new PatientsService(supabase).create(reception, body);
    expect(call(steps[0], 'insert')).toEqual([{
      facility_id: 'f-1', first_name: 'Nomvula', surname: 'Pillay', date_of_birth: '1990-03-11', id_number: null,
      cellphone: '+27835550198', paper_file_status: 'Paper file - not yet digitised',
    }]);
    expect(result.file_number).toBe('PH-000009');
    expect(rpc).toHaveBeenCalledWith('write_audit', expect.objectContaining({ p_action: 'created_patient', p_entity_type: 'Patient', p_entity_id: 'p-9', p_actor_id: 'u-rec' }));
  });

  it('T-US5-2 a second Patient with the same ID number is refused with the message and the id of the existing file; nothing is audited', async () => {
    const id = '9708140234088';
    const { supabase, rpc } = fake([
      { table: 'patients', error: { code: '23505', message: 'duplicate key value violates unique constraint "patients_facility_id_number_key"' } },
      { table: 'patients', data: { id: 'p-3' } },
    ]);
    const refused = await rejection(new PatientsService(supabase).create(reception, { ...body, date_of_birth: '1997-08-14', id_number: id }));
    expect(refused).toEqual({
      status: 409,
      body: expect.objectContaining({ message: 'A patient with this ID number already exists. Open their file instead.', field: 'id_number', existing_patient_id: 'p-3' }),
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a row-level security refusal is "You are not allowed to open this page."', async () => {
    const { supabase } = fake([{ table: 'patients', error: { code: '42501', message: 'new row violates row-level security policy' } }]);
    const refused = await rejection(new PatientsService(supabase).create(reception, body));
    expect(refused).toEqual({ status: 403, body: expect.objectContaining({ message: 'You are not allowed to open this page.' }) });
  });
});

describe('OP12 edit details (BR5, BR6, BR16)', () => {
  const id = '7c0e6a0e-6b1f-4f3c-8a7e-0a1b2c3d4e5f';
  const body = { first_name: 'Thandi', surname: 'Dlamini', date_of_birth: '1997-08-14', id_number: '9708140234088', cellphone: '082 555 0147', file_number: 'PH-999999', paper_file_status: 'Paper file - digitised' };

  it('T-INT-7 updates only the five details (never the file number or paper file status), then writes updated_patient', async () => {
    const { supabase, steps, rpc } = fake([{ table: 'patients', data: row({ id }) }]);
    const result = await new PatientsService(supabase).update(clinical, id, body);
    expect(call(steps[0], 'update')).toEqual([{
      first_name: 'Thandi', surname: 'Dlamini', date_of_birth: '1997-08-14', id_number: '9708140234088', cellphone: '+27825550147',
    }]);
    expect(call(steps[0], 'eq')).toEqual(['id', id]);
    expect(result.file_number).toBe('PH-000003');
    expect(rpc).toHaveBeenCalledWith('write_audit', expect.objectContaining({ p_action: 'updated_patient', p_entity_id: id, p_actor_id: 'u-cli' }));
  });

  it('T-INT-13 invalid input comes back with the exact message', async () => {
    const refused = await rejection(new PatientsService(fake([]).supabase).update(reception, id, { ...body, cellphone: 'abc' }));
    expect(refused).toEqual({ status: 400, body: expect.objectContaining({ field: 'cellphone', message: 'Enter a South African cellphone number, for example 083 555 0198, or leave it empty.' }) });
  });

  it('T-US5-2 an ID number that belongs to another Patient is refused and nothing is audited', async () => {
    const { supabase, rpc } = fake([
      { table: 'patients', error: { code: '23505', message: 'duplicate key value violates unique constraint "patients_facility_id_number_key"' } },
      { table: 'patients', data: { id: 'p-1' } },
    ]);
    const refused = await rejection(new PatientsService(supabase).update(reception, id, body));
    expect(refused).toEqual({ status: 409, body: expect.objectContaining({ field: 'id_number', existing_patient_id: 'p-1' }) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a Patient that cannot be found is "We could not open this file."', async () => {
    const { supabase } = fake([{ table: 'patients', data: null }]);
    const refused = await rejection(new PatientsService(supabase).update(reception, id, body));
    expect(refused?.status).toBe(404);
  });
});

describe('OP13 record paper file history (BR18, BR16)', () => {
  const id = '7c0e6a0e-6b1f-4f3c-8a7e-0a1b2c3d4e5f';
  const body = { chronic_conditions: 'Hypertension', allergies: ' Penicillin ', current_medication: '', mark_digitised: true, file_number: 'PH-999999', paper_file_status: 'No paper file' };

  it('T-US15-1 saves the three texts (trimmed, empty as null) with the status "Paper file - digitised" when the box is ticked, then writes recorded_paper_history', async () => {
    const { supabase, steps, rpc } = fake([{ table: 'patients', data: row({ id, paper_file_status: 'Paper file - digitised', allergies: 'Penicillin', chronic_conditions: 'Hypertension' }) }]);
    const result = await new PatientsService(supabase).recordPaperHistory(reception, id, body);
    expect(call(steps[0], 'update')).toEqual([
      { chronic_conditions: 'Hypertension', allergies: 'Penicillin', current_medication: null, paper_file_status: 'Paper file - digitised' },
    ]);
    expect(call(steps[0], 'eq')).toEqual(['id', id]);
    expect(result.paper_file_status).toBe('Paper file - digitised');
    expect(rpc).toHaveBeenCalledWith('write_audit', expect.objectContaining({
      p_action: 'recorded_paper_history', p_entity_type: 'Patient', p_entity_id: id, p_actor_id: 'u-rec', p_facility_id: 'f-1',
    }));
  });

  it('T-BR18-4 the file number and the status sent in the request are never used; without the box the status is not touched', async () => {
    const { supabase, steps } = fake([{ table: 'patients', data: row({ id }) }]);
    await new PatientsService(supabase).recordPaperHistory(clinical, id, { ...body, mark_digitised: false });
    expect(call(steps[0], 'update')).toEqual([{ chronic_conditions: 'Hypertension', allergies: 'Penicillin', current_medication: null }]);
    expect(JSON.stringify(steps[0].calls)).not.toContain('PH-999999');
  });

  it('T-US15-2, T-BR18-1 the box ticked with all three fields empty is refused with the exact message and nothing is saved or audited', async () => {
    const { supabase, rpc, used } = fake([]);
    const refused = await rejection(new PatientsService(supabase).recordPaperHistory(reception, id, { chronic_conditions: '', allergies: '  ', current_medication: null, mark_digitised: true }));
    expect(refused).toEqual({
      status: 400,
      body: expect.objectContaining({ message: 'Add at least one item from the paper file before marking it as digitised.', field: 'mark_digitised' }),
    });
    expect(used()).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('T-INT-13 a text that is too long comes back with its exact message and field', async () => {
    const service = new PatientsService(fake([]).supabase);
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ chronic_conditions: 'x'.repeat(501) }, 'chronic_conditions', 'Chronic conditions can be at most 500 characters.'],
      [{ allergies: 'x'.repeat(301) }, 'allergies', 'Allergies can be at most 300 characters.'],
      [{ current_medication: 'x'.repeat(501) }, 'current_medication', 'Current medication can be at most 500 characters.'],
    ];
    for (const [patch, field, message] of cases) {
      const refused = await rejection(service.recordPaperHistory(reception, id, { ...body, ...patch }));
      expect(refused).toEqual({ status: 400, body: expect.objectContaining({ message, field }) });
    }
  });

  it('T-BR18-2 the database trigger (patients_guard) refusing the status change comes back as 400 and nothing is audited', async () => {
    const { supabase, rpc } = fake([{ table: 'patients', error: { code: '23514', message: 'Add at least one item from the paper file before marking it as digitised.' } }]);
    const refused = await rejection(new PatientsService(supabase).recordPaperHistory(reception, id, body));
    expect(refused).toEqual({ status: 400, body: expect.objectContaining({ field: 'mark_digitised', message: 'Add at least one item from the paper file before marking it as digitised.' }) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a row-level security refusal is "You are not allowed to open this page."', async () => {
    const { supabase } = fake([{ table: 'patients', error: { code: '42501', message: 'row-level security' } }]);
    const refused = await rejection(new PatientsService(supabase).recordPaperHistory(reception, id, body));
    expect(refused).toEqual({ status: 403, body: expect.objectContaining({ message: 'You are not allowed to open this page.' }) });
  });

  it('another database error is the server problem', async () => {
    const { supabase } = fake([{ table: 'patients', error: { message: 'boom' } }]);
    const refused = await rejection(new PatientsService(supabase).recordPaperHistory(reception, id, body));
    expect(refused).toEqual({ status: 500, body: expect.objectContaining({ message: 'Something went wrong on our side. Please try again.' }) });
  });

  it('a Patient that cannot be found (or is not a valid id) is "We could not open this file." and nothing is audited', async () => {
    const { supabase, rpc } = fake([{ table: 'patients', data: null }]);
    expect((await rejection(new PatientsService(supabase).recordPaperHistory(reception, id, body)))?.status).toBe(404);
    expect((await rejection(new PatientsService(fake([]).supabase).recordPaperHistory(reception, 'nope', body)))?.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a missing or odd body is treated as empty fields and no box', async () => {
    const { supabase, steps } = fake([{ table: 'patients', data: row({ id }) }]);
    await new PatientsService(supabase).recordPaperHistory(reception, id, undefined);
    expect(call(steps[0], 'update')).toEqual([{ chronic_conditions: null, allergies: null, current_medication: null }]);
  });
});
