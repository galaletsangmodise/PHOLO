import { formatSastDate, formatSastTime, formatSastWeekday, sastIsoDate } from './time';

describe('BR19: times are stored in UTC and shown in SAST', () => {
  const instant = '2026-10-27T05:05:00Z';

  it('T-BR19-1 shows a UTC instant as 24-hour SAST time', () => {
    expect(formatSastTime(instant)).toBe('07:05');
  });

  it('T-BR19-2 shows the same instant as a date like "27 Oct 2026"', () => {
    expect(formatSastDate(instant)).toBe('27 Oct 2026');
  });
});

describe('Weekday and ISO date in SAST (S2 header, BR19)', () => {
  it('shows the weekday as "Tue"', () => {
    expect(formatSastWeekday('2026-10-27T05:05:00Z')).toBe('Tue');
  });
  it('moves to the next SAST day after 22:00 UTC', () => {
    expect(formatSastWeekday('2026-10-27T22:30:00Z')).toBe('Wed');
    expect(sastIsoDate('2026-10-27T22:30:00Z')).toBe('2026-10-28');
  });
  it('writes the SAST date as YYYY-MM-DD', () => {
    expect(sastIsoDate('2026-10-27T05:05:00Z')).toBe('2026-10-27');
  });
});
