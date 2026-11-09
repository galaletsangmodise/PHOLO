import { HttpException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import type { SupabaseService } from '../auth/supabase.service';
import { SummaryService } from './summary.service';

const MANAGER: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111', role: 'Manager', fullName: 'Farouk Patel',
  facilityId: '00000000-0000-4000-8000-000000000001', facilityName: 'Ubuntu Community Clinic', token: 'manager-token',
};

const REASONS = {
  'Feeling sick or injured': 1, 'Collecting medication': 1, 'Baby or child care': 1,
  'Pregnancy or family planning': 0, 'Test or screening': 1, 'Something else': 0,
};
/** The PRD 8.2 S10 sample: 4, 1, 2, 0, 47 min, 0 and 1. */
const SAMPLE = { checked_in: 4, completed: 1, still_waiting: 2, left: 0, average_wait_minutes: 47, waited_over_3_hours: 0, helped_by_door_assistant: 1, reasons: REASONS };

function service(answer: { data?: unknown; error?: { code?: string; message: string } | null }) {
  const rpc = jest.fn(async () => ({ data: answer.data ?? null, error: answer.error ?? null }));
  const forToken = jest.fn(() => ({ rpc }));
  return { service: new SummaryService({ forToken } as unknown as SupabaseService), rpc, forToken };
}
async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    const exception = error as HttpException;
    return { status: exception.getStatus(), message: (exception.getResponse() as { message: string }).message };
  }
  throw new Error('Expected a refusal.');
}

describe('OP17 daily summary (BR15, SEC12, SEC22)', () => {
  it('T-US13-1 calls daily_summary with the Manager\'s own token and returns the seven numbers and the reasons', async () => {
    const { service: s, rpc, forToken } = service({ data: SAMPLE });
    expect(await s.get(MANAGER)).toEqual(SAMPLE);
    expect(forToken).toHaveBeenCalledWith('manager-token');
    expect(rpc).toHaveBeenCalledWith('daily_summary');
  });

  it('a null average (nobody called yet) stays null', async () => {
    const { service: s } = service({ data: { ...SAMPLE, average_wait_minutes: null } });
    expect((await s.get(MANAGER)).average_wait_minutes).toBeNull();
  });

  it('T-INT-10 only the known counts and reasons come back: any other key, such as a name, is dropped', async () => {
    const { service: s } = service({ data: { ...SAMPLE, patient_name: 'Thandi Dlamini', reasons: { ...REASONS, 'Thandi Dlamini': 9 } } });
    const answer = await s.get(MANAGER);
    expect(Object.keys(answer).sort()).toEqual(['average_wait_minutes', 'checked_in', 'completed', 'helped_by_door_assistant', 'left', 'reasons', 'still_waiting', 'waited_over_3_hours']);
    expect(Object.keys(answer.reasons)).toHaveLength(6);
    expect(JSON.stringify(answer)).not.toMatch(/Dlamini/);
  });

  it('missing or odd numbers become 0, never a crash', async () => {
    const { service: s } = service({ data: { checked_in: '4', reasons: null } });
    const answer = await s.get(MANAGER);
    expect(answer).toMatchObject({ checked_in: 4, completed: 0, average_wait_minutes: null });
    expect(answer.reasons['Test or screening']).toBe(0);
  });

  it('the database refusing a non-Manager (42501) is 403 with the not-allowed message', async () => {
    const answer = await refusal(service({ error: { code: '42501', message: 'x' } }).service.get(MANAGER));
    expect(answer).toEqual({ status: 403, message: 'You are not allowed to open this page.' });
  });

  it('any other failure is the summary message', async () => {
    const answer = await refusal(service({ error: { message: 'boom' } }).service.get(MANAGER));
    expect(answer).toEqual({ status: 500, message: 'We could not load the summary. Please try again.' });
  });
});
