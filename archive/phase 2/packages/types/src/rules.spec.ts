import {
  isValidSaId,
  isValidCellphone,
  normaliseCellphone,
  validateIcd10Codes,
  validateName,
  validateDateOfBirth,
  canTransition,
} from './rules';

// A valid South African ID for 1990-05-15 (Luhn checked): built below by helper.
function buildId(yymmdd: string, tail = '0000', citizen = '0', race = '8'): string {
  const base = `${yymmdd}${tail}${citizen}${race}`;
  const digits = base.split('').map(Number);
  let sum = 0;
  digits.forEach((d, i) => {
    // Positions counted from the right of the full 13-digit number: the check digit is position 1.
    const posFromRight = digits.length - i + 1;
    let v = d;
    if (posFromRight % 2 === 0) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  });
  return `${base}${(10 - (sum % 10)) % 10}`;
}

describe('BR5 South African ID number', () => {
  it('T-BR5-1 accepts 9708140234088 with 14 Aug 1997', () => {
    expect(isValidSaId('9708140234088', '1997-08-14')).toBe(true);
  });
  it('T-BR5-2 refuses 12 or 14 digits and letters', () => {
    expect(isValidSaId('970814023408', '1997-08-14')).toBe(false);
    expect(isValidSaId('97081402340881', '1997-08-14')).toBe(false);
    expect(isValidSaId('970814023408A', '1997-08-14')).toBe(false);
  });
  it('T-BR5-3 refuses when the first 6 digits are not YYMMDD of the date of birth', () => {
    expect(isValidSaId('9708140234088', '1997-08-15')).toBe(false);
  });
  it('T-BR5-4 refuses a last digit that fails the Luhn test', () => {
    expect(isValidSaId('9708140234089', '1997-08-14')).toBe(false);
  });
  it('T-BR5-5 accepts an empty ID number', () => {
    expect(isValidSaId('', '1997-08-14')).toBe(true);
    expect(isValidSaId(null, '1997-08-14')).toBe(true);
  });
  it('T-BR5-6 accepts the made-up IDs of PRD 8.4', () => {
    expect(isValidSaId('5405035121082', '1954-05-03')).toBe(true);
    expect(isValidSaId('8511225876083', '1985-11-22')).toBe(true);
    expect(isValidSaId('9708140234088', '1997-08-14')).toBe(true);
  });
  it('refuses an impossible date', () => {
    expect(isValidSaId(buildId('900230'), '1990-02-30')).toBe(false);
  });
});

describe('BR6 cellphone number', () => {
  it('T-BR6-1 accepts "082 555 0147", "0825550147" and "+27825550147"', () => {
    for (const n of ['082 555 0147', '0825550147', '+27825550147']) expect(isValidCellphone(n)).toBe(true);
  });
  it('T-BR6-2 stores "082 555 0147" as "+27825550147"', () => {
    expect(normaliseCellphone('082 555 0147')).toBe('+27825550147');
    expect(normaliseCellphone('27825550147')).toBe('+27825550147');
  });
  it('T-BR6-3 refuses 8 or 10 digits, letters, or another country code', () => {
    for (const n of ['08255501', '082555014700', '082555abcd', '+44 7911 123456']) {
      expect(isValidCellphone(n)).toBe(false);
      expect(normaliseCellphone(n)).toBeNull();
    }
  });
  it('T-BR6-4 accepts an empty cellphone', () => {
    expect(isValidCellphone('')).toBe(true);
    expect(isValidCellphone(null)).toBe(true);
    expect(normaliseCellphone('')).toBeNull();
  });
});

describe('Names and date of birth', () => {
  it('accepts letters, spaces, hyphens and apostrophes up to 40 characters', () => {
    expect(validateName("Mary-Anne O'Neil")).toBe(true);
    expect(validateName('Zoë Nkosi')).toBe(true);
  });
  it('rejects empty, digits and over-long names', () => {
    expect(validateName('')).toBe(false);
    expect(validateName('Sipho1')).toBe(false);
    expect(validateName('a'.repeat(41))).toBe(false);
  });
  it('rejects dates before 1900 and in the future', () => {
    expect(validateDateOfBirth('1899-12-31', '2026-11-06')).toBe(false);
    expect(validateDateOfBirth('2026-11-07', '2026-11-06')).toBe(false);
    expect(validateDateOfBirth('2026-11-06', '2026-11-06')).toBe(true);
    expect(validateDateOfBirth('1900-01-01', '2026-11-06')).toBe(true);
  });
});

describe('BR8 ICD-10 codes', () => {
  it('T-BR8-2 accepts "J06.9", "A09" and "J06.9, R50.9" and blank', () => {
    for (const c of ['', 'J06.9', 'A09', 'J06.9, R50.9']) expect(validateIcd10Codes(c)).toBe(true);
  });
  it('T-BR8-3 refuses "J069x" and "j06.9"', () => {
    expect(validateIcd10Codes('J069x')).toBe(false);
    expect(validateIcd10Codes('j06.9')).toBe(false);
  });
  it('T-BR8-4 accepts 5 codes and refuses 6', () => {
    expect(validateIcd10Codes('A01, A02, A03, A04, A05')).toBe(true);
    expect(validateIcd10Codes('A01, A02, A03, A04, A05, A06')).toBe(false);
  });
});

describe('Status transitions (plan 8.3)', () => {
  it('lets Clinical call, start and complete', () => {
    expect(canTransition('Waiting', 'Called', 'Clinical')).toBe(true);
    expect(canTransition('Called', 'In consultation', 'Clinical')).toBe(true);
    expect(canTransition('In consultation', 'Completed', 'Clinical')).toBe(true);
  });
  it('lets Reception only mark Waiting or Called as Left', () => {
    expect(canTransition('Waiting', 'Left', 'Reception')).toBe(true);
    expect(canTransition('Called', 'Left', 'Reception')).toBe(true);
    expect(canTransition('Waiting', 'Called', 'Reception')).toBe(false);
    expect(canTransition('In consultation', 'Left', 'Reception')).toBe(false);
  });
  it('locks Completed and Left', () => {
    expect(canTransition('Completed', 'Waiting', 'Clinical')).toBe(false);
    expect(canTransition('Left', 'Called', 'Clinical')).toBe(false);
  });
  it('does not allow skipping steps', () => {
    expect(canTransition('Waiting', 'Completed', 'Clinical')).toBe(false);
  });
});
