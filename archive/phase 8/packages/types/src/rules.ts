import type { StaffRole, VisitStatus } from './domain';

function realDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** BR5 (an empty ID number is accepted): 13 digits, first six = date of birth (YYMMDD), Luhn check digit correct. */
export function isValidSaId(id: string | null | undefined, dateOfBirth: string): boolean {
  if (id === null || id === undefined || id === '') return true; // the ID number is optional
  if (!/^[0-9]{13}$/.test(id) || !realDate(dateOfBirth)) return false;
  const expected = `${dateOfBirth.slice(2, 4)}${dateOfBirth.slice(5, 7)}${dateOfBirth.slice(8, 10)}`;
  if (id.slice(0, 6) !== expected) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    let v = Number(id[12 - i]);
    if (i % 2 === 1) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  }
  return sum % 10 === 0;
}

/** BR6: true for an empty cellphone or one that can be written as +27 and 9 digits. */
export function isValidCellphone(raw: string | null | undefined): boolean {
  return raw === null || raw === undefined || raw.trim() === '' || normaliseCellphone(raw) !== null;
}

/** BR6: returns +27 followed by 9 digits, or null when the number is empty or not valid. */
export function normaliseCellphone(raw: string): string | null {
  const cleaned = raw.replace(/[\s-]/g, '');
  let national: string;
  if (/^\+27[0-9]{9}$/.test(cleaned)) national = cleaned.slice(3);
  else if (/^27[0-9]{9}$/.test(cleaned)) national = cleaned.slice(2);
  else if (/^0[0-9]{9}$/.test(cleaned)) national = cleaned.slice(1);
  else return null;
  return `+27${national}`;
}

export function validateName(name: string): boolean {
  return name.length >= 1 && name.length <= 40 && /^[\p{L} '-]+$/u.test(name);
}

/** Not before 1900-01-01 and not after today (today passed in as a SAST date). */
export function validateDateOfBirth(dob: string, today: string): boolean {
  return realDate(dob) && dob >= '1900-01-01' && dob <= today;
}

/** BR8: blank, or up to five comma-separated ICD-10 codes such as I10 or E11.9. */
export function validateIcd10Codes(value: string): boolean {
  if (value.trim() === '') return true;
  const codes = value.split(',').map((c) => c.trim());
  return codes.length <= 5 && codes.every((c) => /^[A-Z][0-9]{2}(\.[A-Za-z0-9]{1,2})?$/.test(c));
}

/** Allowed status changes by role (plan 8.3). Completed and Left are final. */
export function canTransition(from: VisitStatus, to: VisitStatus, role: StaffRole): boolean {
  if (role === 'Clinical') {
    if (from === 'Waiting' && to === 'Called') return true;
    if (from === 'Called' && to === 'In consultation') return true;
    if (from === 'In consultation' && to === 'Completed') return true;
  }
  if ((role === 'Clinical' || role === 'Reception') && (from === 'Waiting' || from === 'Called') && to === 'Left') {
    return true;
  }
  return false;
}
