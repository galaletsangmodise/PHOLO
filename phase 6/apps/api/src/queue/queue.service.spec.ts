import { HttpException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import type { SupabaseService } from '../auth/supabase.service';
import { QueueService } from './queue.service';

const USER: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'Reception',
  fullName: 'Busisiwe Naidoo',
  facilityId: '00000000-0000-4000-8000-000000000001',
  facilityName: 'Ubuntu Community Clinic',
  token: 'token',
};
const VISIT_ID = '22222222-2222-4222-8222-222222222222';

type Answer = { data?: unknown; error?: { code?: string; message: string } | null };

/** A fake database client: tables answer with fixed rows, functions with fixed answers. Every call is written to `calls`. */
function fakeDb(tables: Record<string, Answer>, functions: Record<string, Answer>) {
  const calls: string[] = [];
  const db = {
    rpc: jest.fn(async (name: string, args?: unknown) => {
      calls.push(`rpc:${name}`);
      const answer = functions[name] ?? {};
      return { data: answer.data ?? null, error: answer.error ?? null, args };
    }),
    from: (table: string) => {
      calls.push(`from:${table}`);
      const answer = tables[table] ?? {};
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'gte', 'in', 'eq', 'order']) builder[method] = () => builder;
      builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: answer.data ?? [], error: answer.error ?? null });
      return builder;
    },
  };
  const service = new QueueService({ forToken: () => db } as unknown as SupabaseService);
  return { service, db, calls };
}

async function refusal(promise: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await promise;
  } catch (error) {
    const exception = error as HttpException;
    return { status: exception.getStatus(), message: (exception.getResponse() as { message: string }).message };
  }
  throw new Error('Expected a refusal.');
}

const VISIT = {
  id: VISIT_ID,
  patient_id: 'p-1',
  queue_number: 4,
  reason_category: 'Baby or child care',
  urgent: true,
  assisted: false,
  status: 'Waiting',
  checkin_at: '2026-10-27T07:00:00Z',
  called_at: null,
  completed_at: null,
  left_at: null,
  symptoms: 'must never be returned',
};
const PATIENT = { id: 'p-1', first_name: 'Palesa', surname: 'Molefe', date_of_birth: '2025-01-09', paper_file_status: 'No paper file' };

describe('OP5 list the Queue', () => {
  it('T-BR7-6 closes earlier days first, then reads the Visits', async () => {
    const { service, calls } = fakeDb({ visits_for_reception: { data: [VISIT] }, patients: { data: [PATIENT] } }, { close_stale_visits: { data: 0 } });
    await service.list(USER, 'active');
    expect(calls[0]).toBe('rpc:close_stale_visits');
    expect(calls.indexOf('from:visits_for_reception')).toBeGreaterThan(0);
  });

  it('T-INT-3 rows hold the Queue fields and no clinical field', async () => {
    const { service } = fakeDb({ visits_for_reception: { data: [VISIT] }, patients: { data: [PATIENT] } }, { close_stale_visits: { data: 0 } });
    const { visits, counts } = await service.list(USER, 'active');
    expect(visits).toHaveLength(1);
    expect(Object.keys(visits[0]).sort()).toEqual(
      ['assisted', 'called_at', 'checkin_at', 'completed_at', 'date_of_birth', 'first_name', 'id', 'left_at', 'paper_file_status', 'patient_id', 'queue_number', 'reason_category', 'status', 'surname', 'urgent'],
    );
    expect(visits[0]).toMatchObject({ first_name: 'Palesa', surname: 'Molefe', queue_number: 4, urgent: true });
    expect(JSON.stringify(visits)).not.toContain('must never be returned');
    expect(counts).toEqual({ waiting: 1, in_consultation: 0, completed: 0, uncalled: 1 });
  });

  it('the Done today tab lists the finished Visits and the counts still cover the whole day', async () => {
    const done = { ...VISIT, id: 'v-9', status: 'Completed', completed_at: '2026-10-27T08:00:00Z' };
    const { service } = fakeDb({ visits_for_reception: { data: [VISIT, done] }, patients: { data: [PATIENT] } }, { close_stale_visits: { data: 0 } });
    const answer = await service.list(USER, 'done');
    expect(answer.visits.map((v) => v.id)).toEqual(['v-9']);
    expect(answer.counts).toEqual({ waiting: 1, in_consultation: 0, completed: 1, uncalled: 1 });
  });

  it('an empty day answers an empty list without asking for Patients', async () => {
    const { service, calls } = fakeDb({ visits_for_reception: { data: [] } }, { close_stale_visits: { data: 0 } });
    expect(await service.list(USER, 'active')).toEqual({ visits: [], counts: { waiting: 0, in_consultation: 0, completed: 0, uncalled: 0 } });
    expect(calls).not.toContain('from:patients');
  });

  it('a database problem answers "We could not load the queue. Please try again."', async () => {
    const { service } = fakeDb({ visits_for_reception: { error: { message: 'secret detail' } } }, { close_stale_visits: { data: 0 } });
    expect(await refusal(service.list(USER, 'active'))).toEqual({ status: 500, message: 'We could not load the queue. Please try again.' });
  });
});

describe('OP6 call next patient', () => {
  it('T-INT-14 returns the Visit that was called', async () => {
    const answer = { none_waiting: false, visit_id: VISIT_ID, queue_number: 4, patient_id: 'p-1', first_name: 'Palesa', surname: 'Molefe' };
    const { service, db } = fakeDb({}, { call_next_patient: { data: answer } });
    expect(await service.callNext(USER)).toEqual(answer);
    expect(db.rpc).toHaveBeenCalledWith('call_next_patient');
  });

  it('answers "none waiting" when nobody is waiting', async () => {
    const { service } = fakeDb({}, { call_next_patient: { data: { none_waiting: true } } });
    expect(await service.callNext(USER)).toEqual({ none_waiting: true });
  });

  it('a role the database does not allow is answered with the not-allowed message', async () => {
    const { service } = fakeDb({}, { call_next_patient: { error: { code: '42501', message: 'Only Clinical staff can call the next patient.' } } });
    expect(await refusal(service.callNext(USER))).toEqual({ status: 403, message: 'You are not allowed to open this page.' });
  });

  it('any other database error answers with the server problem message', async () => {
    const { service } = fakeDb({}, { call_next_patient: { error: { code: 'XX000', message: 'secret' } } });
    expect(await refusal(service.callNext(USER))).toEqual({ status: 500, message: 'Something went wrong on our side. Please try again.' });
  });
});

describe('OP8 mark as left', () => {
  it('T-INT-15 calls the database function for the Visit', async () => {
    const { service, db } = fakeDb({}, { mark_visit_left: { data: null } });
    expect(await service.markLeft(USER, VISIT_ID)).toEqual({ status: 'Left' });
    expect(db.rpc).toHaveBeenCalledWith('mark_visit_left', { p_visit_id: VISIT_ID });
  });

  it('T-INT-15 a Completed Visit is refused (409)', async () => {
    const { service } = fakeDb({}, { mark_visit_left: { error: { code: '23514', message: 'A finished Visit cannot be changed.' } } });
    expect(await refusal(service.markLeft(USER, VISIT_ID))).toEqual({ status: 409, message: 'This visit can no longer be marked as left.' });
  });

  it('an unknown or foreign Visit is not found (404)', async () => {
    const { service } = fakeDb({}, { mark_visit_left: { error: { code: 'P0002', message: 'Visit not found.' } } });
    expect(await refusal(service.markLeft(USER, VISIT_ID))).toEqual({ status: 404, message: 'We could not find this visit.' });
  });

  it('a text that is not an id is not found and asks the database nothing', async () => {
    const { service, db } = fakeDb({}, {});
    expect((await refusal(service.markLeft(USER, 'not-an-id'))).status).toBe(404);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
