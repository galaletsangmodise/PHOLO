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
