import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/components/api';
import { PaperFileHistoryModal } from '@/components/PaperFileHistoryModal';
import type { PatientRecord } from '@/components/patientsApi';

/** PRD 8.2 M3 sample content: (1) Joseph, all three fields and the box ticked; (2) Sipho, allergies only; (3) all empty with the box ticked. */
const NOT_DIGITISED: PatientRecord = {
  id: 'p-2', fileNumber: 'PH-000002', firstName: 'Sipho', surname: 'Nkosi', dateOfBirth: '1985-11-22',
  idNumber: '8511225876083', cellphone: '+27825550123', paperFileStatus: 'Paper file - not yet digitised',
  chronicConditions: null, allergies: null, currentMedication: null,
};
const DIGITISED: PatientRecord = {
  ...NOT_DIGITISED, id: 'p-1', fileNumber: 'PH-000001', firstName: 'Joseph', surname: 'Mokoena', paperFileStatus: 'Paper file - digitised',
  chronicConditions: 'Hypertension', allergies: 'Penicillin', currentMedication: 'Amlodipine 5 mg once a day',
};

const onCancel = jest.fn();
const onSubmit = jest.fn(async () => undefined);
beforeEach(() => jest.clearAllMocks());

const show = (patient: PatientRecord = NOT_DIGITISED, extra: Partial<React.ComponentProps<typeof PaperFileHistoryModal>> = {}) =>
  render(<PaperFileHistoryModal patient={patient} onSubmit={onSubmit} onCancel={onCancel} {...extra} />);
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const value = (label: string) => (screen.getByLabelText(label) as HTMLTextAreaElement).value;
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));
const BOX = 'Mark the paper file as digitised';
const MARK_MESSAGE = 'Add at least one item from the paper file before marking it as digitised.';

describe('M3 Paper file history', () => {
  it('T-M3-1 Normal: the title, the three fields with their placeholders, Cancel and Save, filled with what is stored', () => {
    show(DIGITISED);
    expect(screen.getByRole('dialog', { name: 'Paper file history' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Paper file history' })).toBeTruthy();
    expect(value('Chronic conditions')).toBe('Hypertension');
    expect(value('Allergies')).toBe('Penicillin');
    expect(value('Current medication')).toBe('Amlodipine 5 mg once a day');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('T-M3-4 Empty: the fields are empty and show their placeholders', () => {
    show();
    expect(value('Chronic conditions')).toBe('');
    expect(value('Allergies')).toBe('');
    expect(value('Current medication')).toBe('');
    expect(screen.getByPlaceholderText('For example Hypertension')).toBeTruthy();
    expect(screen.getByPlaceholderText('For example Penicillin')).toBeTruthy();
    expect(screen.getByPlaceholderText('For example Amlodipine 5 mg once a day')).toBeTruthy();
  });

  it('T-M3-2 the checkbox shows only when the status is "Paper file - not yet digitised", and is unticked by default', () => {
    show();
    const box = screen.getByLabelText(BOX) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });

  it.each(['Paper file - digitised', 'No paper file'] as const)('T-M3-2 the checkbox is not shown when the status is "%s"', (status) => {
    show({ ...NOT_DIGITISED, paperFileStatus: status });
    expect(screen.queryByLabelText(BOX)).toBeNull();
  });

  it('T-M3-3 each text over its limit shows its exact message and nothing is sent', () => {
    show();
    type('Chronic conditions', 'x'.repeat(501));
    type('Allergies', 'x'.repeat(301));
    type('Current medication', 'x'.repeat(501));
    save();
    expect(screen.getByText('Chronic conditions can be at most 500 characters.')).toBeTruthy();
    expect(screen.getByText('Allergies can be at most 300 characters.')).toBeTruthy();
    expect(screen.getByText('Current medication can be at most 500 characters.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('T-M3-3 the fields do not stop typing at the limit (the message does that), and exactly the limits are accepted', async () => {
    show();
    type('Chronic conditions', 'x'.repeat(500));
    type('Allergies', 'x'.repeat(300));
    type('Current medication', 'x'.repeat(500));
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/can be at most/)).toBeNull();
  });

  it('T-US15-2, T-M3-7 (3) all three fields empty with the box ticked: the BR18 message shows and nothing is sent', () => {
    show();
    fireEvent.click(screen.getByLabelText(BOX));
    save();
    expect(screen.getByText(MARK_MESSAGE)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('T-US15-2 fields with only spaces count as empty', () => {
    show();
    type('Allergies', '   ');
    fireEvent.click(screen.getByLabelText(BOX));
    save();
    expect(screen.getByText(MARK_MESSAGE)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('T-US15-1 "Penicillin" under Allergies with the box ticked is sent with mark_digitised true and empty texts as null', async () => {
    show();
    type('Allergies', 'Penicillin');
    fireEvent.click(screen.getByLabelText(BOX));
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ chronic_conditions: null, allergies: 'Penicillin', current_medication: null, mark_digitised: true });
  });

  it('T-M3-7 (2) the box not ticked: the history is sent with mark_digitised false', async () => {
    show();
    type('Allergies', ' None known ');
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ chronic_conditions: null, allergies: 'None known', current_medication: null, mark_digitised: false });
  });

  it('T-M3-7 (1) all three fields filled with the box ticked are sent as typed', async () => {
    show();
    type('Chronic conditions', 'Hypertension');
    type('Allergies', 'Penicillin');
    type('Current medication', 'Amlodipine 5 mg once a day');
    fireEvent.click(screen.getByLabelText(BOX));
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      chronic_conditions: 'Hypertension', allergies: 'Penicillin', current_medication: 'Amlodipine 5 mg once a day', mark_digitised: true,
    });
  });

  it('a digitised file is saved without a box: mark_digitised is false', async () => {
    show(DIGITISED);
    type('Allergies', 'Penicillin, sulfa');
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ allergies: 'Penicillin, sulfa', mark_digitised: false }));
  });

  it('T-M3-5 Loading: "Save" reads "Saving..." and is disabled', async () => {
    onSubmit.mockImplementationOnce(() => new Promise<undefined>(() => undefined));
    show();
    type('Allergies', 'Penicillin');
    save();
    const button = await screen.findByRole('button', { name: 'Saving...' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('T-M3-6 Error: the server problem message shows and the typed text stays', async () => {
    onSubmit.mockRejectedValueOnce(new ApiError(500, 'Something went wrong on our side. Please try again.'));
    show();
    type('Allergies', 'Penicillin');
    fireEvent.click(screen.getByLabelText(BOX));
    save();
    await waitFor(() => expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy());
    expect(value('Allergies')).toBe('Penicillin');
    expect((screen.getByLabelText(BOX) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a message from the server about a field (400) shows under that field', async () => {
    onSubmit.mockRejectedValueOnce(new ApiError(400, MARK_MESSAGE, { field: 'mark_digitised' }));
    show();
    type('Allergies', 'Penicillin');
    fireEvent.click(screen.getByLabelText(BOX));
    save();
    await waitFor(() => expect(screen.getByText(MARK_MESSAGE)).toBeTruthy());
    expect(value('Allergies')).toBe('Penicillin');
    onSubmit.mockRejectedValueOnce(new ApiError(400, 'Allergies can be at most 300 characters.', { field: 'allergies' }));
    save();
    await waitFor(() => expect(screen.getByText('Allergies can be at most 300 characters.')).toBeTruthy());
  });

  it('T-M3-6 Offline: the banner shows and "Save" is disabled', () => {
    show(NOT_DIGITISED, { offline: true });
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a lost connection during Save (status 0) shows the offline banner message and keeps the text', async () => {
    onSubmit.mockRejectedValueOnce(new ApiError(0, 'No internet connection. Check your Wi-Fi and try again.'));
    show();
    type('Allergies', 'Penicillin');
    save();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false));
    expect(value('Allergies')).toBe('Penicillin');
    expect(screen.queryByText('Something went wrong on our side. Please try again.')).toBeNull();
  });

  it('T-M3-7 "Cancel" closes the modal and sends nothing', () => {
    show();
    type('Allergies', 'Penicillin');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
