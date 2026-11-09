import { PATIENT_MESSAGES, patientFormErrors, type PatientFormValues } from './patients';

const TODAY = '2026-10-27';
const valid: PatientFormValues = {
  first_name: 'Nomvula',
  surname: 'Pillay',
  date_of_birth: '1990-03-11',
  id_number: '',
  cellphone: '083 555 0198',
  paper_file_status: 'Paper file - not yet digitised',
};
const errorsFor = (patch: Partial<PatientFormValues>, creating = true) => patientFormErrors({ ...valid, ...patch }, TODAY, creating);

describe('M2 field messages (PRD 8.2 M2, BR5, BR6)', () => {
  it('a valid Patient has no errors', () => {
    expect(errorsFor({})).toEqual({});
  });
  it('first name and surname', () => {
    expect(errorsFor({ first_name: '' }).first_name).toBe('Please enter the first name.');
    expect(errorsFor({ surname: '  ' }).surname).toBe('Please enter the surname.');
    expect(errorsFor({ first_name: 'N0mvula' }).first_name).toBe(PATIENT_MESSAGES.firstName);
  });
  it('date of birth: empty, not real, in the future, before 1900', () => {
    const message = 'Please enter a real date of birth, for example 14 / 08 / 1997.';
    expect(errorsFor({ date_of_birth: '' }).date_of_birth).toBe(message);
    expect(errorsFor({ date_of_birth: '1990-02-30' }).date_of_birth).toBe(message);
    expect(errorsFor({ date_of_birth: '2026-10-28' }).date_of_birth).toBe(message);
    expect(errorsFor({ date_of_birth: '1899-12-31' }).date_of_birth).toBe(message);
  });
  it('ID number: wrong ones are refused (BR5), empty is allowed', () => {
    const message = 'This ID number does not look right. Check it, or leave it empty if the patient does not have one.';
    expect(errorsFor({ id_number: '123' }).id_number).toBe(message);
    expect(errorsFor({ id_number: '9708140234088' }).id_number).toBe(message); // does not match 1990-03-11
    expect(errorsFor({ id_number: '', date_of_birth: '1990-03-11' }).id_number).toBeUndefined();
    expect(errorsFor({ id_number: '9708140234088', date_of_birth: '1997-08-14' }).id_number).toBeUndefined();
  });
  it('an ID number is not judged while the date of birth is wrong', () => {
    const result = errorsFor({ id_number: '123', date_of_birth: '' });
    expect(result.date_of_birth).toBeDefined();
    expect(result.id_number).toBeUndefined();
  });
  it('cellphone (BR6): 0 or +27 forms are fine, anything else gets the M2 example number', () => {
    const message = 'Enter a South African cellphone number, for example 083 555 0198, or leave it empty.';
    expect(errorsFor({ cellphone: '0835550198' }).cellphone).toBeUndefined();
    expect(errorsFor({ cellphone: '+27835550198' }).cellphone).toBeUndefined();
    expect(errorsFor({ cellphone: '' }).cellphone).toBeUndefined();
    expect(errorsFor({ cellphone: '12345' }).cellphone).toBe(message);
  });
  it('paper file status: only when creating, only the two start values', () => {
    expect(errorsFor({ paper_file_status: '' }).paper_file_status).toBe('Please choose a paper file status.');
    expect(errorsFor({ paper_file_status: 'Paper file - digitised' }).paper_file_status).toBe('Please choose a paper file status.');
    expect(errorsFor({ paper_file_status: 'No paper file' }).paper_file_status).toBeUndefined();
    expect(errorsFor({ paper_file_status: undefined }, false).paper_file_status).toBeUndefined();
  });
});
