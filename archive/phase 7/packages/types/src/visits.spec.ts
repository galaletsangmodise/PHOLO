import { VISIT_FIELD_ORDER, VISIT_MESSAGES, draftErrors, visitFormErrors, type VisitFormValues } from './visits';

const FULL: VisitFormValues = { symptoms: 'Cough for 5 days', notes: '', icd10_codes: 'J06.9', outcome: 'Treated and sent home' };

describe('visitFormErrors (BR8, PRD S9)', () => {
  it('T-BR8-1 a complete form has no fault', () => {
    expect(visitFormErrors(FULL)).toEqual({});
  });

  it('T-US9-2 empty symptoms: the exact message', () => {
    expect(visitFormErrors({ ...FULL, symptoms: '  ' }).symptoms).toBe("Please write the patient's symptoms before completing the visit.");
  });

  it('symptoms of 1000 characters pass, 1001 do not', () => {
    expect(visitFormErrors({ ...FULL, symptoms: 'a'.repeat(1000) }).symptoms).toBeUndefined();
    expect(visitFormErrors({ ...FULL, symptoms: 'a'.repeat(1001) }).symptoms).toBe(VISIT_MESSAGES.symptomsTooLong);
  });

  it('T-BR8-4 notes of 2000 characters pass, 2001 do not', () => {
    expect(visitFormErrors({ ...FULL, notes: 'n'.repeat(2000) }).notes).toBeUndefined();
    expect(visitFormErrors({ ...FULL, notes: 'n'.repeat(2001) }).notes).toBe('Notes can be at most 2000 characters.');
  });

  it.each(['J069x', 'j06.9', 'J06.9,', 'J06.9 R50.9', 'A01, A02, A03, A04, A05, A06'])('T-US9-3 "%s" is refused with the exact message', (codes) => {
    expect(visitFormErrors({ ...FULL, icd10_codes: codes }).icd10_codes).toBe('Use codes like J06.9, separated by commas. Maximum 5 codes.');
  });

  it.each(['', 'J06.9', 'J06.9, R50.9', 'I10', 'A01,A02,A03,A04,A05'])('"%s" is accepted (blank, or up to 5 codes)', (codes) => {
    expect(visitFormErrors({ ...FULL, icd10_codes: codes }).icd10_codes).toBeUndefined();
  });

  it('a missing outcome: "Please choose an outcome."; a made-up outcome is also refused', () => {
    expect(visitFormErrors({ ...FULL, outcome: '' }).outcome).toBe('Please choose an outcome.');
    expect(visitFormErrors({ ...FULL, outcome: 'Went home' }).outcome).toBe('Please choose an outcome.');
  });

  it('the first fault by screen order is Symptoms, Notes, ICD-10 codes, Outcome', () => {
    expect(VISIT_FIELD_ORDER).toEqual(['symptoms', 'notes', 'icd10_codes', 'outcome']);
  });
});

describe('draftErrors (BR8: a draft needs no required field)', () => {
  it('T-S9-4, T-BR8-6 every field empty is fine', () => {
    expect(draftErrors({ symptoms: '', notes: '', icd10_codes: '', outcome: '' })).toEqual({});
  });

  it('the limits still hold, and the outcome must be one of the five when given', () => {
    expect(draftErrors({ symptoms: 'a'.repeat(1001), notes: 'n'.repeat(2001), icd10_codes: 'x', outcome: 'Nope' })).toEqual({
      symptoms: VISIT_MESSAGES.symptomsTooLong,
      notes: VISIT_MESSAGES.notesTooLong,
      icd10_codes: VISIT_MESSAGES.icd10Invalid,
      outcome: VISIT_MESSAGES.outcomeRequired,
    });
  });
});
