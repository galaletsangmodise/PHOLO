import { createClinic, mustInsertPatient, mustInsertVisit, TestClinic } from './helpers';

let clinic: TestClinic;
beforeEach(async () => { clinic = await createClinic(); });

const MINUTE = 60_000;
/** 00:00 SAST of today, as milliseconds since 1970 (SAST is UTC+2 all year). */
const sastMidnight = (): number => {
  const now = Date.now();
  const sastNow = now + 2 * 3_600_000;
  return sastNow - (sastNow % 86_400_000) - 2 * 3_600_000;
};
const at = (offsetMinutes: number): string => new Date(sastMidnight() + offsetMinutes * MINUTE).toISOString();
const sastMinutesNow = (): number => Math.floor((Date.now() - sastMidnight()) / MINUTE);

let counter = 0;
const visit = async (extra: Record<string, unknown>) => {
  counter += 1;
  const patient = await mustInsertPatient(clinic.facilityId, { first_name: `P${'x'.repeat(counter % 30)}`, surname: `S${'y'.repeat(Math.floor(counter / 30) + 1)}` });
  return mustInsertVisit(clinic.facilityId, patient.id, counter, extra);
};
const summary = async () => {
  const r = await clinic.manager.client.rpc('daily_summary');
  expect(r.error).toBeNull();
  return r.data;
};

describe('BR15 daily summary', () => {
  it('T-BR15-1 the PRD 8.4 pattern gives Checked in 4, Completed 1, Still waiting 2, Left 0, over 3 hours 0, Door Assistant 1', async () => {
    // Same pattern as the seed. Times are placed on today's SAST date relative to midnight so the test
    // gives the same answer at any time of day (the seed uses fixed morning clock times).
    await visit({ checkin_at: at(1), assisted: true, reason_category: 'Collecting medication', status: 'Completed', called_at: at(44), called_by: clinic.clinical.id, started_at: at(44), clinician: clinic.clinical.id, completed_at: at(62), symptoms: 'x', outcome: 'Medication given' });
    await visit({ checkin_at: at(1), reason_category: 'Feeling sick or injured', status: 'In consultation', called_at: at(51), called_by: clinic.clinical.id, started_at: at(51), clinician: clinic.clinical.id });
    await visit({ reason_category: 'Test or screening' });
    await visit({ reason_category: 'Baby or child care', urgent: true });
    const s = await summary();
    expect(s).toMatchObject({ checked_in: 4, completed: 1, still_waiting: 2, left: 0, waited_over_3_hours: 0, helped_by_door_assistant: 1 });
    expect(s.reasons).toEqual({
      'Feeling sick or injured': 1, 'Collecting medication': 1, 'Baby or child care': 1,
      'Pregnancy or family planning': 0, 'Test or screening': 1, 'Something else': 0,
    });
  });

  it('T-BR15-2 "today" is 00:00 to 23:59 SAST', async () => {
    await visit({ checkin_at: at(-1) }); // 23:59 yesterday
    await visit({ checkin_at: at(0) });  // 00:00 today
    const s = await summary();
    expect(s.checked_in).toBe(1);
  });

  it('T-BR15-3 waits of 43 and 50 minutes average 47 (46.5 rounds up)', async () => {
    await visit({ checkin_at: at(1), status: 'Called', called_at: at(44), called_by: clinic.clinical.id });
    await visit({ checkin_at: at(1), status: 'Called', called_at: at(51), called_by: clinic.clinical.id });
    expect((await summary()).average_wait_minutes).toBe(47);
  });

  it('T-BR15-4 a Visit not yet called after more than 180 minutes counts; with no called Visit the average is null', async () => {
    const s0 = await summary();
    expect(s0.average_wait_minutes).toBeNull();
    if (sastMinutesNow() < 190) {
      console.warn('T-BR15-4 (over 3 hours) skipped: it needs the clock to be past 03:10 SAST.');
      return;
    }
    await visit({ checkin_at: at(5) });
    const s = await summary();
    expect(s.waited_over_3_hours).toBe(1);
    expect(s.average_wait_minutes).toBeNull();
  });

  it('counts only the Manager\'s own Facility', async () => {
    const other = await createClinic();
    const patient = await mustInsertPatient(other.facilityId);
    await mustInsertVisit(other.facilityId, patient.id, 1);
    expect((await summary()).checked_in).toBe(0);
  });
});
