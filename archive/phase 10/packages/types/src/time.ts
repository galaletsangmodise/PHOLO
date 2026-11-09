/**
 * BR19: all times are saved in UTC and shown in SAST (UTC+2, no daylight saving),
 * in 24-hour format, with dates like "27 Oct 2026".
 */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type TimeInput = string | number | Date;

function toSast(input: TimeInput): Date {
  const instant = new Date(input);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Not a valid date or time: ${String(input)}`);
  }
  // Shift the instant by +2 hours, then read it with the UTC getters.
  return new Date(instant.getTime() + SAST_OFFSET_MS);
}

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** For example "07:05". */
export function formatSastTime(input: TimeInput): string {
  const sast = toSast(input);
  return `${twoDigits(sast.getUTCHours())}:${twoDigits(sast.getUTCMinutes())}`;
}

/** For example "27 Oct 2026". */
export function formatSastDate(input: TimeInput): string {
  const sast = toSast(input);
  return `${sast.getUTCDate()} ${MONTHS[sast.getUTCMonth()]} ${sast.getUTCFullYear()}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** For example "Tue" (S2 header, Section 18 #20). */
export function formatSastWeekday(input: TimeInput): string {
  return WEEKDAYS[toSast(input).getUTCDay()];
}

/** The SAST date as "2026-10-27", the form used to compare dates of birth with today. */
export function sastIsoDate(input: TimeInput): string {
  const sast = toSast(input);
  return `${sast.getUTCFullYear()}-${twoDigits(sast.getUTCMonth() + 1)}-${twoDigits(sast.getUTCDate())}`;
}

/** Whole years on the given SAST day ("YYYY-MM-DD"): the birthday itself counts. */
export function ageInYears(dateOfBirth: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  return today.slice(5) < dateOfBirth.slice(5) ? years - 1 : years;
}

/** "29 yrs", "1 yr", and "0 yrs" under one year (Section 18, #24). */
export function formatAge(dateOfBirth: string, today: string): string {
  const years = ageInYears(dateOfBirth, today);
  return years === 1 ? '1 yr' : `${years} yrs`;
}
