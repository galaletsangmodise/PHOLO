import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FindPatientPage from '@/app/patients/page';
import { FindPatientScreen } from '@/app/patients/FindPatientScreen';
import { setApiReachable } from '@/components/apiStatus';
import type { PatientSummary } from '@/components/patientsApi';
import type { Profile } from '@/components/SessionProvider';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('next/navigation', () => ({
  usePathname: () => '/patients',
  useRouter: () => mockRouter,
  useParams: () => ({}),
}));
jest.mock('@/components/accessToken', () => ({ getAccessToken: async () => 'staff-token' }));
const fetchMock = jest.fn();
const answerWith = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });

const THANDI: PatientSummary = {
  id: 'p-3', fileNumber: 'PH-000003', firstName: 'Thandi', surname: 'Dlamini', dateOfBirth: '1997-08-14',
  idNumberLast4: '4088', paperFileStatus: 'No paper file',
};
const JOSEPH: PatientSummary = {
  id: 'p-1', fileNumber: 'PH-000001', firstName: 'Joseph', surname: 'Mokoena', dateOfBirth: '1954-05-03',
  idNumberLast4: '1082', paperFileStatus: 'Paper file - digitised',
};
const PALESA: PatientSummary = {
  id: 'p-4', fileNumber: 'PH-000004', firstName: 'Palesa', surname: 'Molefe', dateOfBirth: '2025-01-09',
  idNumberLast4: null, paperFileStatus: 'No paper file',
};
const apiPatient = (p: PatientSummary) => ({
  id: p.id, file_number: p.fileNumber, first_name: p.firstName, surname: p.surname, date_of_birth: p.dateOfBirth,
  id_number_last4: p.idNumberLast4, paper_file_status: p.paperFileStatus,
});

const noop = () => undefined;
type ScreenProps = React.ComponentProps<typeof FindPatientScreen>;
const showScreen = (props: Partial<ScreenProps> = {}) =>
  render(
    <FindPatientScreen
      role="Reception"
      fullName="Busisiwe Naidoo"
      state={{ kind: 'idle' }}
      today="2026-10-27"
      offline={false}
      onSearch={noop}
      onTryAgain={noop}
      onOpen={noop}
      onNewPatient={noop}
      onLogout={noop}
      {...props}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  setApiReachable(true);
});

describe('S7 Find patient: the screen', () => {
  it('T-S7-1 Normal: the Staff Header with "Find patient" active, the heading, the search field with a magnifier, "Search" and (Reception) "New patient"', () => {
    const { container } = showScreen();
    expect(screen.getByRole('link', { name: 'Find patient' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Queue' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Find a patient' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Name, ID number or file number')).toBeTruthy();
    expect(container.querySelector('[data-icon="search"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New patient' })).toBeTruthy();
  });

  it('T-S7-1 Clinical has no "New patient" button', () => {
    showScreen({ role: 'Clinical', fullName: 'Nomsa Khumalo' });
    expect(screen.queryByRole('button', { name: 'New patient' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
  });

  it('T-S7-2 fewer than 2 characters shows "Type at least 2 characters to search." and no search runs', () => {
    const onSearch = jest.fn();
    showScreen({ onSearch });
    fireEvent.change(screen.getByPlaceholderText('Name, ID number or file number'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByText('Type at least 2 characters to search.')).toBeTruthy();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('T-S7-3 the Enter key runs the search with the typed text', () => {
    const onSearch = jest.fn();
    showScreen({ onSearch });
    const field = screen.getByPlaceholderText('Name, ID number or file number');
    fireEvent.change(field, { target: { value: ' Dlamini ' } });
    fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('Dlamini');
  });

  it('T-S7-4 a result card: name, born and age and file number, ID number ending, paper file badge and "Open file"', () => {
    const onOpen = jest.fn();
    showScreen({ state: { kind: 'results', query: 'Dla', patients: [THANDI, PALESA] }, onOpen });
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(2);
    const first = within(cards[0]);
    expect(first.getByText('Dlamini, Thandi')).toBeTruthy();
    expect(first.getByText('Born 14 Aug 1997 (29 yrs) · File PH-000003')).toBeTruthy();
    expect(first.getByText('ID number ending 4088')).toBeTruthy();
    expect(first.getByText('No paper file')).toBeTruthy();
    fireEvent.click(first.getByRole('button', { name: 'Open file' }));
    expect(onOpen).toHaveBeenCalledWith('p-3');
    const second = within(cards[1]);
    expect(second.getByText('Born 9 Jan 2025 (1 yr) · File PH-000004')).toBeTruthy();
    expect(second.getByText('No ID number')).toBeTruthy();
  });

  it('T-S7-4 shows every card it is given (the API gives at most 20), and the paper file status as a badge', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => ({ ...JOSEPH, id: `p-${i}` }));
    showScreen({ state: { kind: 'results', query: 'Mok', patients: twenty } });
    expect(screen.getAllByRole('button', { name: 'Open file' })).toHaveLength(20);
    expect(screen.getAllByText('Paper file - digitised')).toHaveLength(20);
  });

  it('T-S7-5 Empty before a search: "Type a name, ID number or file number to find a patient."', () => {
    showScreen();
    expect(screen.getByText('Type a name, ID number or file number to find a patient.')).toBeTruthy();
  });

  it('T-S7-6 no results: Reception sees the add-a-new-patient text and a "New patient" button in the list area', () => {
    const onNewPatient = jest.fn();
    showScreen({ state: { kind: 'results', query: 'Mokoeni', patients: [] }, onNewPatient });
    expect(screen.getByText('No patient found for “Mokoeni”. Check the spelling or add a new patient.')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'New patient' });
    expect(buttons).toHaveLength(2); // the title row and the list area
    fireEvent.click(buttons[1]);
    expect(onNewPatient).toHaveBeenCalledTimes(1);
  });

  it('T-S7-6 no results: Clinical sees the short text, no button and no "New patient" in the title row', () => {
    showScreen({ role: 'Clinical', fullName: 'Nomsa Khumalo', state: { kind: 'results', query: 'Mokoeni', patients: [] } });
    expect(screen.getByText('No patient found for “Mokoeni”. Check the spelling.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New patient' })).toBeNull();
  });

  it('T-S7-7 Loading: 3 grey placeholder cards', () => {
    showScreen({ state: { kind: 'loading' } });
    expect(screen.getAllByTestId('placeholder-block')).toHaveLength(3);
  });

  it('T-S7-8 Error: "Search did not work. Please try again." and "Try again"', () => {
    const onTryAgain = jest.fn();
    showScreen({ state: { kind: 'error' }, onTryAgain });
    expect(screen.getByText('Search did not work. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });

  it('T-S7-9 Offline: the banner shows and "Search" is disabled', () => {
    showScreen({ offline: true });
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Search' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('S7 Find patient: the page (OP9)', () => {
  const show = (profile: Profile = PROFILES.reception) =>
    render(
      <WithSession value={fakeSession({ status: 'in', profile })}>
        <FindPatientPage />
      </WithSession>,
    );
  const search = (text: string) => {
    fireEvent.change(screen.getByPlaceholderText('Name, ID number or file number'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  };

  it('T-US4-1 typing "Dlamini" asks the API with the token and lists "Dlamini, Thandi" with her file number', async () => {
    answerWith({ patients: [apiPatient(THANDI)] });
    show();
    search('Dlamini');
    expect(screen.getAllByTestId('placeholder-block')).toHaveLength(3); // Loading first
    await waitFor(() => expect(screen.getByText('Dlamini, Thandi')).toBeTruthy());
    expect(screen.getByText(/File PH-000003/)).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/patients?q=Dlamini');
    expect(init.headers.Authorization).toBe('Bearer staff-token');
  });

  it('T-US4-2 typing "Zzzz" shows "No patient found for “Zzzz”. Check the spelling or add a new patient."', async () => {
    answerWith({ patients: [] });
    show();
    search('Zzzz');
    await waitFor(() => expect(screen.getByText('No patient found for “Zzzz”. Check the spelling or add a new patient.')).toBeTruthy());
  });

  it('"Open file" goes to S8 of that Patient', async () => {
    answerWith({ patients: [apiPatient(JOSEPH)] });
    show();
    search('Mok');
    await waitFor(() => screen.getByText('Mokoena, Joseph'));
    fireEvent.click(screen.getByRole('button', { name: 'Open file' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/patients/p-1');
  });

  it('a failed search shows the error state, and "Try again" searches the same text again', async () => {
    answerWith({ message: 'Something went wrong on our side. Please try again.' }, 500);
    show();
    search('Dlamini');
    await waitFor(() => expect(screen.getByText('Search did not work. Please try again.')).toBeTruthy());
    answerWith({ patients: [apiPatient(THANDI)] });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Dlamini, Thandi')).toBeTruthy());
    expect(String(fetchMock.mock.calls[1][0])).toContain('/patients?q=Dlamini');
  });

  it('a call that cannot reach the server shows the error state and the offline banner', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    show();
    search('Dlamini');
    await waitFor(() => expect(screen.getByText('Search did not work. Please try again.')).toBeTruthy());
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
  });

  it('T-US14-1 "New patient" opens M2; Save creates the Patient and goes to S8 of the new file', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'New patient' }));
    expect(screen.getByRole('dialog', { name: 'New patient' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nomvula' } });
    fireEvent.change(screen.getByLabelText('Surname'), { target: { value: 'Pillay' } });
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '03' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '1990' } });
    fireEvent.change(screen.getByLabelText('Cellphone number'), { target: { value: '083 555 0198' } });
    fireEvent.change(screen.getByLabelText('Paper file status'), { target: { value: 'Paper file - not yet digitised' } });
    answerWith({ id: 'p-9', file_number: 'PH-000009' }, 201);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/patients/p-9'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/patients$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      first_name: 'Nomvula', surname: 'Pillay', date_of_birth: '1990-03-11', id_number: null, cellphone: '+27835550198',
      paper_file_status: 'Paper file - not yet digitised',
    });
  });

  it('T-US14-2 an empty date of birth in M2 shows the message and nothing is sent', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'New patient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Please enter a real date of birth, for example 14 / 08 / 1997.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Clinical sees no "New patient" button on the page', () => {
    show(PROFILES.clinical);
    expect(screen.queryByRole('button', { name: 'New patient' })).toBeNull();
  });
});
