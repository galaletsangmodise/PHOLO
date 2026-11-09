import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/components/api';
import { PatientDetailsModal } from '@/components/PatientDetailsModal';
import type { PatientRecord } from '@/components/patientsApi';

const THANDI: PatientRecord = {
  id: 'p-3', fileNumber: 'PH-000003', firstName: 'Thandi', surname: 'Dlamini', dateOfBirth: '1997-08-14',
  idNumber: '9708140234088', cellphone: '+27825550147', paperFileStatus: 'No paper file',
  chronicConditions: null, allergies: null, currentMedication: null,
};

const onCancel = jest.fn();
const onOpenExisting = jest.fn();
const onSubmit = jest.fn(async () => undefined);

beforeEach(() => jest.clearAllMocks());

const showCreate = (extra: Partial<React.ComponentProps<typeof PatientDetailsModal>> = {}) =>
  render(<PatientDetailsModal mode="create" onSubmit={onSubmit} onCancel={onCancel} onOpenExisting={onOpenExisting} {...extra} />);
const showEdit = (extra: Partial<React.ComponentProps<typeof PatientDetailsModal>> = {}) =>
  render(<PatientDetailsModal mode="edit" patient={THANDI} onSubmit={onSubmit} onCancel={onCancel} onOpenExisting={onOpenExisting} {...extra} />);

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));
function fillNomvula() {
  type('First name', 'Nomvula');
  type('Surname', 'Pillay');
  type('Day', '11');
  type('Month', '03');
  type('Year', '1990');
  type('Cellphone number', '083 555 0198');
  fireEvent.change(screen.getByLabelText('Paper file status'), { target: { value: 'Paper file - not yet digitised' } });
}

describe('M2 Patient details', () => {
  it('T-M2-1 create: the title, the five fields with their placeholders, the dropdown, Cancel and Save', () => {
    showCreate();
    expect(screen.getByRole('dialog', { name: 'New patient' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'New patient' })).toBeTruthy();
    for (const label of ['First name', 'Surname', 'ID number', 'Cellphone number', 'Paper file status']) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByText('Date of birth')).toBeTruthy();
    expect(screen.getByPlaceholderText('For example Nomvula')).toBeTruthy();
    expect(screen.getByPlaceholderText('For example Pillay')).toBeTruthy();
    expect(screen.getByPlaceholderText('DD')).toBeTruthy();
    expect(screen.getByPlaceholderText('MM')).toBeTruthy();
    expect(screen.getByPlaceholderText('YYYY')).toBeTruthy();
    expect(screen.getByPlaceholderText('13 digits, if the patient has one')).toBeTruthy();
    expect(screen.getByPlaceholderText('For example 083 555 0198')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('');
  });

  it('T-M2-2 edit: the title, the fields filled with the stored details, and the status as plain text', () => {
    showEdit();
    expect(screen.getByRole('heading', { name: 'Edit patient details' })).toBeTruthy();
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Thandi');
    expect((screen.getByLabelText('Surname') as HTMLInputElement).value).toBe('Dlamini');
    expect((screen.getByLabelText('Day') as HTMLInputElement).value).toBe('14');
    expect((screen.getByLabelText('Month') as HTMLInputElement).value).toBe('08');
    expect((screen.getByLabelText('Year') as HTMLInputElement).value).toBe('1997');
    expect((screen.getByLabelText('ID number') as HTMLInputElement).value).toBe('9708140234088');
    expect((screen.getByLabelText('Cellphone number') as HTMLInputElement).value).toBe('+27825550147');
    expect(screen.queryByLabelText('Paper file status')).toBeNull(); // no dropdown
    expect(screen.getByText('No paper file')).toBeTruthy();
  });

  it('T-M2-3 each field fault shows its exact message and nothing is sent', () => {
    showCreate();
    type('ID number', '123');
    type('Cellphone number', '555');
    save();
    expect(screen.getByText('Please enter the first name.')).toBeTruthy();
    expect(screen.getByText('Please enter the surname.')).toBeTruthy();
    expect(screen.getByText('Please enter a real date of birth, for example 14 / 08 / 1997.')).toBeTruthy();
    expect(screen.getByText('Enter a South African cellphone number, for example 083 555 0198, or leave it empty.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    type('Day', '11');
    type('Month', '03');
    type('Year', '1990');
    save();
    expect(screen.getByText('This ID number does not look right. Check it, or leave it empty if the patient does not have one.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('T-US5-2, T-M2-4 a duplicate ID number shows the message and "Open their file", which opens the existing file', async () => {
    onSubmit.mockRejectedValueOnce(
      new ApiError(409, 'A patient with this ID number already exists. Open their file instead.', { field: 'id_number', existing_patient_id: 'p-1' }),
    );
    showEdit();
    type('ID number', '5405035121082');
    type('Day', '03');
    type('Month', '05');
    type('Year', '1954');
    save();
    await waitFor(() => expect(screen.getByText('A patient with this ID number already exists. Open their file instead.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Open their file' }));
    expect(onOpenExisting).toHaveBeenCalledWith('p-1');
    expect((screen.getByLabelText('ID number') as HTMLInputElement).value).toBe('5405035121082'); // nothing is lost
  });

  it('T-M2-5 create: the dropdown starts on "No paper file", offers the two statuses, and an empty value shows the message', () => {
    showCreate();
    const select = screen.getByLabelText('Paper file status') as HTMLSelectElement;
    expect(select.value).toBe('No paper file');
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toEqual(['Choose a status', 'No paper file', 'Paper file - not yet digitised']);
    fireEvent.change(select, { target: { value: '' } });
    save();
    expect(screen.getByText('Please choose a paper file status.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('T-M2-5 the message does not show while a status is chosen', () => {
    showCreate();
    save();
    expect(screen.queryByText('Please choose a paper file status.')).toBeNull();
  });

  it('T-M2-6 Loading: "Save" reads "Saving..." and is disabled', async () => {
    onSubmit.mockImplementationOnce(() => new Promise<undefined>(() => undefined));
    showCreate();
    fillNomvula();
    save();
    const button = await screen.findByRole('button', { name: 'Saving...' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('T-M2-7 Error: the server problem message shows and the typed text stays', async () => {
    onSubmit.mockRejectedValueOnce(new ApiError(500, 'Something went wrong on our side. Please try again.'));
    showCreate();
    fillNomvula();
    save();
    await waitFor(() => expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy());
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Nomvula');
    expect((screen.getByLabelText('Cellphone number') as HTMLInputElement).value).toBe('083 555 0198');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('T-M2-8 Offline: the banner shows and "Save" is disabled', () => {
    showCreate({ offline: true });
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('T-M2-9 create: a valid form is sent with the cellphone as +27..., an empty ID as null and the chosen status', async () => {
    showCreate();
    fillNomvula();
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      first_name: 'Nomvula', surname: 'Pillay', date_of_birth: '1990-03-11', id_number: null, cellphone: '+27835550198',
      paper_file_status: 'Paper file - not yet digitised',
    });
  });

  it('T-M2-9 edit: the five details are sent and no paper file status', async () => {
    showEdit();
    type('Cellphone number', '082 555 0147');
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      first_name: 'Thandi', surname: 'Dlamini', date_of_birth: '1997-08-14', id_number: '9708140234088', cellphone: '+27825550147',
    });
  });

  it('T-M2-9 "Cancel" closes the modal and sends nothing', () => {
    showEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
