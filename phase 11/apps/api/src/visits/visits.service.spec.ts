import { HttpException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import type { SupabaseService } from '../auth/supabase.service';
import { VisitsService } from './visits.service';

const CLINICAL: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'Clinical',
  fullName: 'Nomsa Khumalo',
  facilityId: '00000000-0000-4000-8000-000000000001',
  facilityName: 'Ubuntu Community Clinic',
  token: 'token',
};
const VISIT_ID = '22222222-2222-4222-8222-222222222222';
const PATIENT_ID = '33333333-3333-4333-8333-333333333333';

type Answer = { data?: unknown; error?: { code?: string; message: string } | null };
interface Op { table: string; method: string; args: unknown[] }

/** A fake database client: each table answers its calls in order. Every chained call is written to `ops`. */
function fakeDb(tables: Record<string, Answer[]>, auditError: { message: string } | null = null) {
  const ops: Op[] = [];
  const audits: unknown[] = [];
  const queues = new Map(Object.entries(tables).map(([name, answers]) => [name, [...answers]]));
  const db = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'update', 'eq', 'in', 'order']) {
        builder[method] = (...args: unknown[]) => {
          ops.push({ table, method, args });
          return builder;
        };
      }
      const next = () => {
        const answer = queues.get(table)?.shift() ?? {};
        return { data: answer.data ?? null, error: answer.error ?? null };
      };
      builder.maybeSingle = async () => next();
      builder.then = (resolve: (value: unknown) => unknown) => resolve(next());
      return builder;
    },
  };
  const admin = { rpc: jest.fn(async (name: string, args: unknown) => { audits.push({ name, args }); return { error: auditError }; }) };
  const service = new VisitsService({ forToken: () => db, admin: () => admin } as unknown as SupabaseService);
  return { service, ops, audits };
}

async function refusal(promise: Promise<unknown>): Promise<{ status: number; message: string; field?: string }> {
  try {
    await promise;
  } catch (error) {
    const exception = error as HttpException;
    const body = exception.getResponse() as { message: string; field?: string };
    return { status: exception.getStatus(), message: body.message, field: body.field };
  }
  throw new Error('Expected a refusal.');
}

const FORM = { symptoms: 'Cough for 5 days', notes: 'Chest clear.', icd10_codes: 'J06.9', outcome: 'Treated and sent home' };
const VISIT_ROW = {
  id: VISIT_ID, patient_id: PATIENT_ID, queue_number: 2, checkin_at: '2026-10-27T07:05:00Z', reason_category: 'Feeling sick or injured',
  urgent: true, status: 'In consultation', symptoms: 'Cough', notes: null, icd10_codes: null, outcome: null,
};
const PATIENT_ROW = {
  id: PATIENT_ID, file_number: 'PH-000002', first_name: 'Sipho', surname: 'Nkosi', date_of_birth: '1986-04-01',
  paper_file_status: 'Paper file - digitised', chronic_conditions: 'Asthma', allergies: 'Penicillin', current_medication: null,
};

describe('OP14 get Visit (for S9)', () => {
  it('T-INT-8 returns the Visit with its draft and the Patient with the paper file history', async () => {
    const { service, audits } = fakeDb({ visits: [{ data: VISIT_ROW }], patients: [{ data: PATIENT_ROW }] });
    const answer = await service.get(CLINICAL, VISIT_ID);
    expect(answer.visit.symptoms).toBe('Cough');
    expect(answer.visit.status).toBe('In consultation');
    expect(answer.patient.allergies).toBe('Penicillin');
    expect(audits).toHaveLength(0);
  });

  it('answers a Visit that is not In consultation too (the screen then goes to S6 or S8, no message)', async () => {
    const { service } = fakeDb({ visits: [{ data: { ...VISIT_ROW, status: 'Completed' } }], patients: [{ data: PATIENT_ROW }] });
    expect((await service.get(CLINICAL, VISIT_ID)).visit.status).toBe('Completed');
  });

  it('an unknown or invalid id is 404', async () => {
    expect((await refusal(fakeDb({ visits: [{ data: null }] }).service.get(CLINICAL, VISIT_ID))).status).toBe(404);
    expect((await refusal(fakeDb({}).service.get(CLINICAL, 'nope'))).status).toBe(404);
  });

  it('a database error is the server problem message', async () => {
    const answer = await refusal(fakeDb({ visits: [{ error: { message: 'x' } }] }).service.get(CLINICAL, VISIT_ID));
    expect(answer).toEqual({ status: 500, message: 'Something went wrong on our side. Please try again.', field: undefined });
  });
});

describe('OP7 start consultation (BR7)', () => {
  it('T-INT-4 updates a Called Visit to In consultation and writes started_consultation', async () => {
    const { service, ops, audits } = fakeDb({ visits: [{ data: [{ id: VISIT_ID }] }] });
    expect(await service.start(CLINICAL, VISIT_ID)).toEqual({ status: 'In consultation' });
    expect(ops).toContainEqual({ table: 'visits', method: 'update', args: [{ status: 'In consultation' }] });
    expect(ops).toContainEqual({ table: 'visits', method: 'eq', args: ['status', 'Called'] });
    expect(audits).toEqual([{ name: 'write_audit', args: {
      p_facility_id: CLINICAL.facilityId, p_actor_id: CLINICAL.id, p_action: 'started_consultation', p_entity_type: 'Visit', p_entity_id: VISIT_ID,
    } }]);
  });

  it('a Visit that is already In consultation just opens (no second audit row)', async () => {
    const { service, audits } = fakeDb({ visits: [{ data: [] }, { data: { status: 'In consultation' } }] });
    expect(await service.start(CLINICAL, VISIT_ID)).toEqual({ status: 'In consultation' });
    expect(audits).toHaveLength(0);
  });

  it('a Waiting, Completed or Left Visit cannot be started (409)', async () => {
    for (const status of ['Waiting', 'Completed', 'Left']) {
      const answer = await refusal(fakeDb({ visits: [{ data: [] }, { data: { status } }] }).service.start(CLINICAL, VISIT_ID));
      expect(answer).toMatchObject({ status: 409, message: 'This visit cannot be started.' });
    }
  });

  it('an unknown Visit is 404', async () => {
    expect((await refusal(fakeDb({ visits: [{ data: [] }, { data: null }] }).service.start(CLINICAL, VISIT_ID))).status).toBe(404);
  });

  it('the policy refusing the update (42501) is 403', async () => {
    const answer = await refusal(fakeDb({ visits: [{ error: { code: '42501', message: 'x' } }] }).service.start(CLINICAL, VISIT_ID));
    expect(answer).toMatchObject({ status: 403, message: 'You are not allowed to open this page.' });
  });
});

describe('OP15 save draft (BR8, BR16)', () => {
  it('T-INT-16, T-US10-1 saves the four fields in the user token, keeps the status, and writes saved_draft', async () => {
    const { service, ops, audits } = fakeDb({ visits: [{ data: [{ id: VISIT_ID }] }] });
    expect(await service.saveDraft(CLINICAL, VISIT_ID, FORM)).toEqual({ saved: true });
    expect(ops).toContainEqual({ table: 'visits', method: 'update', args: [{ symptoms: 'Cough for 5 days', notes: 'Chest clear.', icd10_codes: 'J06.9', outcome: 'Treated and sent home' }] });
    expect(ops).toContainEqual({ table: 'visits', method: 'eq', args: ['status', 'In consultation'] });
    expect((audits[0] as { args: { p_action: string } }).args.p_action).toBe('saved_draft');
  });

  it('T-BR8-6 a draft with every field empty saves; empty texts are stored as nothing (null)', async () => {
    const { service, ops } = fakeDb({ visits: [{ data: [{ id: VISIT_ID }] }] });
    await service.saveDraft(CLINICAL, VISIT_ID, { symptoms: '', notes: '', icd10_codes: '', outcome: '' });
    expect(ops).toContainEqual({ table: 'visits', method: 'update', args: [{ symptoms: null, notes: null, icd10_codes: null, outcome: null }] });
  });

  it('a draft over a limit is 400 with the field message and nothing is saved', async () => {
    const { service, audits } = fakeDb({});
    expect(await refusal(service.saveDraft(CLINICAL, VISIT_ID, { ...FORM, notes: 'n'.repeat(2001) }))).toEqual({ status: 400, message: 'Notes can be at most 2000 characters.', field: 'notes' });
    expect(audits).toHaveLength(0);
  });

  it('T-BR9-3 a Completed Visit is refused with 409 and writes no audit row', async () => {
    const { service, audits } = fakeDb({ visits: [{ data: [] }, { data: { status: 'Completed' } }] });
    expect(await refusal(service.saveDraft(CLINICAL, VISIT_ID, FORM))).toMatchObject({ status: 409, message: 'This visit can no longer be changed.' });
    expect(audits).toHaveLength(0);
  });

  it('the database guard refusing a finished Visit (23514) is 409', async () => {
    const answer = await refusal(fakeDb({ visits: [{ error: { code: '23514', message: 'A finished Visit cannot be changed.' } }] }).service.saveDraft(CLINICAL, VISIT_ID, FORM));
    expect(answer).toMatchObject({ status: 409, message: 'This visit can no longer be changed.' });
  });
});

describe('OP16 complete visit (BR8, BR9, BR16)', () => {
  it('T-US9-1, T-INT-16 sets the fields and the status Completed, and writes completed_visit', async () => {
    const { service, ops, audits } = fakeDb({ visits: [{ data: [{ id: VISIT_ID }] }] });
    expect(await service.complete(CLINICAL, VISIT_ID, FORM)).toEqual({ status: 'Completed' });
    expect(ops).toContainEqual({ table: 'visits', method: 'update', args: [{ symptoms: 'Cough for 5 days', notes: 'Chest clear.', icd10_codes: 'J06.9', outcome: 'Treated and sent home', status: 'Completed' }] });
    expect((audits[0] as { args: { p_action: string } }).args.p_action).toBe('completed_visit');
  });

  it.each([
    ['T-US9-2 empty symptoms', { ...FORM, symptoms: '' }, 'symptoms', "Please write the patient's symptoms before completing the visit."],
    ['T-US9-3 "J069x"', { ...FORM, icd10_codes: 'J069x' }, 'icd10_codes', 'Use codes like J06.9, separated by commas. Maximum 5 codes.'],
    ['T-BR8-3 six codes', { ...FORM, icd10_codes: 'A01, A02, A03, A04, A05, A06' }, 'icd10_codes', 'Use codes like J06.9, separated by commas. Maximum 5 codes.'],
    ['T-BR8-5 2001 characters of notes', { ...FORM, notes: 'n'.repeat(2001) }, 'notes', 'Notes can be at most 2000 characters.'],
    ['no outcome', { ...FORM, outcome: '' }, 'outcome', 'Please choose an outcome.'],
  ])('%s is 400 with the exact message and nothing is saved', async (_name, body, field, message) => {
    const { service, ops, audits } = fakeDb({});
    expect(await refusal(service.complete(CLINICAL, VISIT_ID, body))).toEqual({ status: 400, message, field });
    expect(ops).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('five codes and exactly 2000 characters of notes are accepted', async () => {
    const { service } = fakeDb({ visits: [{ data: [{ id: VISIT_ID }] }] });
    await expect(service.complete(CLINICAL, VISIT_ID, { ...FORM, icd10_codes: 'A01, A02, A03, A04, A05', notes: 'n'.repeat(2000) })).resolves.toEqual({ status: 'Completed' });
  });

  it('T-BR9-3 a Completed Visit is refused (409) and no audit row is written', async () => {
    const { service, audits } = fakeDb({ visits: [{ data: [] }, { data: { status: 'Completed' } }] });
    expect(await refusal(service.complete(CLINICAL, VISIT_ID, FORM))).toMatchObject({ status: 409, message: 'This visit can no longer be changed.' });
    expect(audits).toHaveLength(0);
  });

  it('a Called Visit cannot be completed without a consultation (409); an unknown one is 404', async () => {
    expect((await refusal(fakeDb({ visits: [{ data: [] }, { data: { status: 'Called' } }] }).service.complete(CLINICAL, VISIT_ID, FORM))).status).toBe(409);
    expect((await refusal(fakeDb({ visits: [{ data: [] }, { data: null }] }).service.complete(CLINICAL, VISIT_ID, FORM))).status).toBe(404);
  });

  it('a failed audit row is the server problem message', async () => {
    const { service } = fakeDb({ visits: [{ data: [{ id: VISIT_ID }] }] }, { message: 'x' });
    expect(await refusal(service.complete(CLINICAL, VISIT_ID, FORM))).toMatchObject({ status: 500, message: 'Something went wrong on our side. Please try again.' });
  });
});
