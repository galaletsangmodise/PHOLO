import { formatSastDate, formatSastTime } from './time';

describe('BR19: times are stored in UTC and shown in SAST', () => {
  const instant = '2026-10-27T05:05:00Z';

  it('T-BR19-1 shows a UTC instant as 24-hour SAST time', () => {
    expect(formatSastTime(instant)).toBe('07:05');
  });

  it('T-BR19-2 shows the same instant as a date like "27 Oct 2026"', () => {
    expect(formatSastDate(instant)).toBe('27 Oct 2026');
  });
});
