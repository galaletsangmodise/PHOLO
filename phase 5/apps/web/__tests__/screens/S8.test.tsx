import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PatientFilePage from '@/app/patients/[id]/page';
import { PatientFileScreen } from '@/app/patients/[id]/PatientFileScreen';
import { setApiReachable } from '@/components/apiStatus';
import { setFlash } from '@/components/flash';
import type { PatientRecord, PatientVisit } from '@/components/patientsApi';
import type { Profile } from '@/components/SessionProvider';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParams = { id: 'p-3' };
jest.mock('next/navigation', () => ({
  usePathname: () => '/patients/p-3',
  useRouter: () => mockRouter,
  useParams: () => mockParams,
}));
jest.mock('@/components/accessToken', () => ({ getAccessToken: async () => 'staff-token' }));
const fetchMock = jest.fn();
const answerWith = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });

/** PRD 8.2 S8 sample content (1) to (3). */
const JOSEPH: PatientRecord = {
  id: 'p-1', fileNumber: 'PH-000001', firstName: 'Joseph', surname: 'Mokoena', dateOfBirth: '1954-05-03',
  idNumber: '5405035121082', cellphone: null, paperFileStatus: 'Paper file - digitised',
  chronicConditions: null, allergies: 'Penicillin', currentMedication: 'Amlodipine 5 mg once a day',
};
const THANDI: PatientRecord = {
  id: 'p-3', fileNumber: 'PH-000003', firstName: 'Thandi', surname: 'Dlamini', dateOfBirth: '1997-08-14',
  idNumber: '9708140234088', cellphone: '+27825550147', paperFileStatus: 'No paper file',
  chronicConditions: null, allergies: null, currentMedication: null,
};
const SIPHO: PatientRecord = {
  id: 'p-2', fileNumber: 'PH-000002', firstName: 'Sipho', surname: 'Nkosi', dateOfBirth: '1985-11-22',
  idNumber: '8511225876083', cellphone: '+27825550123', paperFileStatus: 'Paper file - not yet digitised',
  chronicConditions: null, allergies: null, currentMedication: null,
};
const THANDI_VISIT: PatientVisit = {
  id: 'v3', queueNumber: 3, checkinAt: '2026-10-27T05:20:00Z', reasonCategory: 'Test or screening', status: 'Waiting', urgent: false,
};
const SIPHO_VISIT: PatientVisit = {
  id: 'v2', queueNumber: 2, checkinAt: '2026-10-27T05:12:00Z', reasonCategory: 'Feeling sick or injured', status: 'In consultation', urgent: false,
};

const apiPatient = (p: PatientRecord) => ({
  id: p.id, file_number: p.fileNumber, first_name: p.firstName, surname: p.surname, date_of_birth: p.dateOfBirth,
  id_number: p.idNumber, cellphone: p.cellphone, paper_file_status: p.paperFileStatus,
  chronic_conditions: p.chronicConditions, allergies: p.allergies, current_medication: p.currentMedication,
});
const apiVisit = (v: PatientVisit) => ({
  id: v.id, queue_number: v.queueNumber, checkin_at: v.checkinAt, reason_category: v.reasonCategory, status: v.status, urgent: v.urgent,
});

const noop = () => undefined;
type ScreenProps = React.ComponentProps<typeof PatientFileScreen>;
const showScreen = (props: Partial<ScreenProps> = {}) =>
  render(
    <PatientFileScreen
      role="Reception"
      fullName="Busisiwe Naidoo"
      state={{ kind: 'ready', patient: THANDI, visits: [THANDI_VISIT] }}
      offline={false}
      onBack={noop}
      onTryAgain={noop}
      onEdit={noop}
      onRecordHistory={noop}
      onToastDone={noop}
      onLogout={noop}
      {...props}
    />,
  );
const rowText = (label: string) => screen.getByTestId(`row-${label}`).textContent;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  setApiReachable(true);
});

describe('S8 Patient File: the screen', () => {
  it('T-S8-1, T-S8-9 Normal (1): header, "← Back", the Patient card with the full ID number and "None", the paper file history and "Visits"', () => {
    showScreen({ state: { kind: 'ready', patient: JOSEPH, visits: [] } });
    expect(screen.getByRole('link', { name: 'Find patient' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '← Back' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mokoena, Joseph' })).toBeTruthy();
    expect(screen.getByText('File PH-000001')).toBeTruthy();
    expect(screen.getByText('Paper file - digitised')).toBeTruthy();
    expect(rowText('Date of birth')).toBe('Date of birth3 May 1954');
    expect(rowText('ID number')).toBe('ID number5405035121082');
    expect(rowText('Cellphone number')).toBe('Cellphone numberNone');
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'History from paper file' })).toBeTruthy();
    expect(rowText('Allergies')).toBe('AllergiesPenicillin');
    expect(rowText('Current medication')).toBe('Current medicationAmlodipine 5 mg once a day');
    expect(screen.queryByTestId('row-Chronic conditions')).toBeNull();
    expect(screen.queryByText('Nothing recorded yet.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Record paper file history' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Visits' })).toBeTruthy();
  });

  it('T-S8-9 Normal (2): "Nothing recorded yet." when there is no history, an ID number and a cellphone number shown in full', () => {
    showScreen();
    expect(screen.getByRole('heading', { name: 'Dlamini, Thandi' })).toBeTruthy();
    expect(screen.getByText('Nothing recorded yet.')).toBeTruthy();
    expect(rowText('ID number')).toBe('ID number9708140234088');
    expect(rowText('Cellphone number')).toBe('Cellphone number+27825550147');
    expect(rowText('Date of birth')).toBe('Date of birth14 Aug 1997');
    expect(screen.getByText('No paper file')).toBeTruthy();
  });

  it('T-S8-9 an empty ID number also shows "None"', () => {
    showScreen({ state: { kind: 'ready', patient: { ...THANDI, idNumber: null }, visits: [] } });
    expect(rowText('ID number')).toBe('ID numberNone');
  });

  it('T-S8-2 a Visit card: date and time of Check-in, "Queue number 3", the reason and the Status badge', () => {
    showScreen({ state: { kind: 'ready', patient: SIPHO, visits: [SIPHO_VISIT, THANDI_VISIT] } });
    const cards = screen.getAllByTestId('visit-card');
    expect(cards).toHaveLength(2);
    const first = within(cards[0]);
    expect(first.getByText('27 Oct 2026 07:12')).toBeTruthy();
    expect(first.getByText('Queue number 2')).toBeTruthy();
    expect(first.getByText('Feeling sick or injured')).toBeTruthy();
    expect(first.getByText('In consultation')).toBeTruthy();
    expect(within(cards[1]).getByText('27 Oct 2026 07:20')).toBeTruthy();
    expect(within(cards[1]).getByText('Waiting')).toBeTruthy();
    expect(within(cards[1]).getByText('Queue number 3')).toBeTruthy();
  });

  it('an urgent Visit shows the "Urgent" badge', () => {
    showScreen({ state: { kind: 'ready', patient: THANDI, visits: [{ ...THANDI_VISIT, urgent: true }] } });
    expect(within(screen.getByTestId('visit-card')).getByText('Urgent')).toBeTruthy();
  });

  it('T-S8-3, T-US12-1 Reception: no "Show details" button, and none of the clinical words', () => {
    showScreen();
    expect(screen.queryByText('Show details')).toBeNull();
    const text = document.body.textContent ?? '';
    for (const word of ['Symptoms', 'Notes', 'ICD-10', 'Outcome']) expect(text).not.toContain(word);
  });

  it('T-S8-4 Empty: "No visits yet for this patient."', () => {
    showScreen({ state: { kind: 'ready', patient: THANDI, visits: [] } });
    expect(screen.getByText('No visits yet for this patient.')).toBeTruthy();
  });

  it('T-S8-5 Loading: grey placeholder blocks for the card and the first 2 Visits', () => {
    showScreen({ state: { kind: 'loading' } });
    expect(screen.getAllByTestId('placeholder-block')).toHaveLength(3);
  });

  it('T-S8-6 Error: the message with "Try again" and "← Back"', () => {
    const onTryAgain = jest.fn();
    const onBack = jest.fn();
    showScreen({ state: { kind: 'error' }, onTryAgain, onBack });
    expect(screen.getByText('We could not open this file. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('T-S8-7 Offline: the banner shows and "Edit details" and "Record paper file history" are disabled', () => {
    showScreen({ offline: true });
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Edit details' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Record paper file history' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(['Details saved.', 'Patient file created.', 'Paper file history saved.'])('T-S8-8 the toast "%s" shows for 3 seconds', (message) => {
    jest.useFakeTimers();
    try {
      const onToastDone = jest.fn();
      showScreen({ toast: message, onToastDone });
      expect(screen.getByText(message)).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(onToastDone).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onToastDone).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('T-S8-9 "← Back", "Edit details" and "Record paper file history" call their handlers (the last one is a placeholder until Phase 9)', () => {
    const onBack = jest.fn();
    const onEdit = jest.fn();
    showScreen({ onBack, onEdit });
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe('S8 Patient File: the page (OP10, OP12)', () => {
  const show = (profile: Profile = PROFILES.reception) =>
    render(
      <WithSession value={fakeSession({ status: 'in', profile })}>
        <PatientFilePage />
      </WithSession>,
    );

  it('opens the file with the token, shows Loading first, then the Patient and the Visits', async () => {
    answerWith({ patient: apiPatient(THANDI), visits: [apiVisit(THANDI_VISIT)] });
    show();
    expect(screen.getAllByTestId('placeholder-block')).toHaveLength(3);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dlamini, Thandi' })).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/patients\/p-3$/);
    expect(init.headers.Authorization).toBe('Bearer staff-token');
    expect(screen.getByText('Queue number 3')).toBeTruthy();
  });

  it('T-US12-1 Reception: each Visit shows only its date, reason and status', async () => {
    answerWith({ patient: apiPatient(THANDI), visits: [apiVisit(THANDI_VISIT)] });
    show();
    await waitFor(() => screen.getByTestId('visit-card'));
    const card = within(screen.getByTestId('visit-card'));
    expect(card.getByText('27 Oct 2026 07:20')).toBeTruthy();
    expect(card.getByText('Test or screening')).toBeTruthy();
    expect(card.getByText('Waiting')).toBeTruthy();
    expect(screen.queryByText('Show details')).toBeNull();
    for (const word of ['Symptoms', 'Notes', 'ICD-10', 'Outcome']) expect(document.body.textContent).not.toContain(word);
  });

  it('a file that cannot be opened shows the error state, and "Try again" loads it again', async () => {
    answerWith({ message: 'We could not open this file. Please try again.' }, 404);
    show();
    await waitFor(() => expect(screen.getByText('We could not open this file. Please try again.')).toBeTruthy());
    answerWith({ patient: apiPatient(THANDI), visits: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dlamini, Thandi' })).toBeTruthy());
  });

  it('T-S8-9 "← Back" goes back to the screen the user came from', async () => {
    answerWith({ patient: apiPatient(THANDI), visits: [] });
    show();
    await waitFor(() => screen.getByRole('heading', { name: 'Dlamini, Thandi' }));
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('T-S8-8 after "New patient" the toast "Patient file created." shows on the new file', async () => {
    setFlash('Patient file created.');
    answerWith({ patient: apiPatient(THANDI), visits: [] });
    show();
    await waitFor(() => expect(screen.getByText('Patient file created.')).toBeTruthy());
  });

  it('T-US5-1 changing the cellphone number in M2 and tapping "Save" shows the new number and the toast "Details saved."', async () => {
    answerWith({ patient: apiPatient(THANDI), visits: [apiVisit(THANDI_VISIT)] });
    show();
    await waitFor(() => screen.getByRole('button', { name: 'Edit details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    expect(screen.getByRole('dialog', { name: 'Edit patient details' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Cellphone number'), { target: { value: '082 555 0199' } });
    answerWith({ ...apiPatient(THANDI), cellphone: '+27825550199' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Details saved.')).toBeTruthy());
    expect(rowText('Cellphone number')).toBe('Cellphone number+27825550199');
    expect(screen.queryByRole('dialog')).toBeNull();
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toMatch(/\/patients\/p-3$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({
      first_name: 'Thandi', surname: 'Dlamini', date_of_birth: '1997-08-14', id_number: '9708140234088', cellphone: '+27825550199',
    });
    expect(screen.getByText('Queue number 3')).toBeTruthy(); // the Visits stay
    expect(fetchMock).toHaveBeenCalledTimes(2); // the file is not opened a second time (one opened_patient_file row only)
  });

  it('T-US5-2 an ID number that belongs to another Patient: M2 shows the message and "Open their file" goes to that file; the file is unchanged', async () => {
    answerWith({ patient: apiPatient(THANDI), visits: [] });
    show();
    await waitFor(() => screen.getByRole('button', { name: 'Edit details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '03' } });
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '05' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '1954' } });
    fireEvent.change(screen.getByLabelText('ID number'), { target: { value: '5405035121082' } });
    answerWith(
      { message: 'A patient with this ID number already exists. Open their file instead.', field: 'id_number', existing_patient_id: 'p-1' },
      409,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('A patient with this ID number already exists. Open their file instead.')).toBeTruthy());
    expect(screen.queryByText('Details saved.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open their file' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/patients/p-1');
  });

  it('Clinical can edit the details of a file too', async () => {
    answerWith({ patient: apiPatient(THANDI), visits: [] });
    show(PROFILES.clinical);
    await waitFor(() => screen.getByRole('button', { name: 'Edit details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    expect(screen.getByRole('dialog', { name: 'Edit patient details' })).toBeTruthy();
  });
});
