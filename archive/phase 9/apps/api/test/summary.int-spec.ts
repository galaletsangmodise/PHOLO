import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TEST_PASSWORD, addVisit, createApp, createClinic, type TestClinic } from './helpers';

let app: INestApplication;
const server = () => app.getHttpServer();
const login = async (email: string): Promise<string> =>
  (await request(server()).post('/auth/login').send({ email, password: TEST_PASSWORD })).body.session.access_token;
const summaryOf = (token: string) => request(server()).get('/summary').set({ Authorization: `Bearer ${token}` });

const MINUTE = 60_000;
/** 00:00 SAST of today, as milliseconds since 1970 (SAST is UTC+2 all year). */
const sastMidnight = (): number => {
  const sastNow = Date.now() + 2 * 3_600_000;
  return sastNow - (sastNow % 86_400_000) - 2 * 3_600_000;
};
/** A time on today's SAST date, in minutes after 00:00, so the answer does not depend on the time of day. */
const at = (minutesAfterMidnight: number): string => new Date(sastMidnight() + minutesAfterMidnight * MINUTE).toISOString();
const sastMinutesNow = (): number => Math.floor((Date.now() - sastMidnight()) / MINUTE);

beforeAll(async () => {
  app = await createApp();
}, 90000);
afterAll(async () => {
  await app.close();
});

/** Each test has its own Facility and Manager, so earlier tests cannot change the counts. */
async function fresh(): Promise<{ own: TestClinic; manager: string }> {
  const own = await createClinic();
  return { own, manager: await login(own.accounts.Manager.email) };
}
let number = 0;
const visit = (own: TestClinic, fields: Record<string, unknown> = {}) => addVisit(own.facilityId, (number += 1), fields);

describe('OP17 daily summary', () => {
  it('T-US13-2 a day with no Check-in gives zeros and no average', async () => {
    const { manager } = await fresh();
    const res = await summaryOf(manager);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ checked_in: 0, completed: 0, still_waiting: 0, left: 0, average_wait_minutes: null, waited_over_3_hours: 0, helped_by_door_assistant: 0 });
    expect(Object.values(res.body.reasons).every((n) => n === 0)).toBe(true);
  });

  it('T-US13-1, T-BR15-1 the PRD pattern: Checked in 4, Completed 1, Still waiting 2, Left 0, over 3 hours 0, Door Assistant 1, and the reasons', async () => {
    const { own, manager } = await fresh();
    const clinician = own.accounts.Clinical.id;
    await visit(own, { checkin_at: at(1), assisted: true, reason_category: 'Collecting medication', status: 'Completed', called_at: at(44), called_by: clinician, started_at: at(44), clinician, completed_at: at(62), symptoms: 'x', outcome: 'Medication given' });
    await visit(own, { checkin_at: at(1), reason_category: 'Feeling sick or injured', status: 'In consultation', called_at: at(51), called_by: clinician, started_at: at(51), clinician });
    await visit(own, { reason_category: 'Test or screening' });
    await visit(own, { reason_category: 'Baby or child care', urgent: true });
    const { body } = await summaryOf(manager);
    expect(body).toMatchObject({ checked_in: 4, completed: 1, still_waiting: 2, left: 0, waited_over_3_hours: 0, helped_by_door_assistant: 1 });
    expect(body.reasons).toEqual({
      'Feeling sick or injured': 1, 'Collecting medication': 1, 'Baby or child care': 1, 'Pregnancy or family planning': 0, 'Test or screening': 1, 'Something else': 0,
    });
  });

  it('T-BR15-2 "today" is 00:00 to 23:59 SAST: 23:59 yesterday is not counted, 00:00 today is', async () => {
    const { own, manager } = await fresh();
    await visit(own, { checkin_at: at(-1), status: 'Left', left_at: at(2) });
    await visit(own, { checkin_at: at(0) });
    expect((await summaryOf(manager)).body.checked_in).toBe(1);
  });

  it('T-BR15-3 waits of 43 and 50 minutes average 47 (46.5 rounds up)', async () => {
    const { own, manager } = await fresh();
    const clinician = own.accounts.Clinical.id;
    await visit(own, { checkin_at: at(1), status: 'Called', called_at: at(44), called_by: clinician });
    await visit(own, { checkin_at: at(1), status: 'Called', called_at: at(51), called_by: clinician });
    expect((await summaryOf(manager)).body.average_wait_minutes).toBe(47);
  });

  it('T-BR15-4 a Visit not called for over 180 minutes counts as "Waited over 3 hours" and does not change the average', async () => {
    if (sastMinutesNow() < 190) {
      console.warn('T-BR15-4 (over 3 hours) skipped: it needs the clock to be past 03:10 SAST.');
      return;
    }
    const { own, manager } = await fresh();
    await visit(own, { checkin_at: at(5) });
    const { body } = await summaryOf(manager);
    expect(body.waited_over_3_hours).toBe(1);
    expect(body.average_wait_minutes).toBeNull();
  });

  it('T-INT-10 the answer holds only counts, the average and the reasons: no name, no id, no time', async () => {
    const { own, manager } = await fresh();
    await visit(own, { firstName: 'Zanele', surname: 'Summarytest', checkin_at: at(1) });
    const { body } = await summaryOf(manager);
    expect(Object.keys(body).sort()).toEqual(['average_wait_minutes', 'checked_in', 'completed', 'helped_by_door_assistant', 'left', 'reasons', 'still_waiting', 'waited_over_3_hours']);
    expect(JSON.stringify(body)).not.toMatch(/Zanele|Summarytest|[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it('T-INT-10 Reception, Clinical and Check-in are refused', async () => {
    const { own } = await fresh();
    for (const role of ['Reception', 'Clinical', 'Check-in'] as const) {
      const res = await summaryOf(await login(own.accounts[role].email));
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('You are not allowed to open this page.');
    }
  });

  it('counts only the Manager\'s own Facility', async () => {
    const { manager } = await fresh();
    const other = await createClinic();
    await visit(other);
    expect((await summaryOf(manager)).body.checked_in).toBe(0);
  });
});
