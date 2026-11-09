import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import CheckinStartPage from '@/app/checkin/page';
import DetailsPage from '@/app/checkin/details/page';
import VisitPage from '@/app/checkin/visit/page';
import DonePage from '@/app/checkin/done/page';
import { setApiReachable } from '@/components/apiStatus';
import { CheckinProvider } from '@/components/CheckinProvider';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';
import { JOSEPH, PALESA, THANDI, fillDetails } from '../checkinTestUtils';

const mockNav: { path: string; go: (path: string) => void } = { path: '/checkin', go: () => undefined };
jest.mock('next/navigation', () => ({
  usePathname: () => mockNav.path,
  useRouter: () => ({ push: (path: string) => mockNav.go(path), replace: (path: string) => mockNav.go(path) }),
}));
jest.mock('@/components/accessToken', () => ({ getAccessToken: async () => 'tablet-token' }));

const fetchMock = jest.fn();

function answerWith(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
}

function Harness({ start = '/checkin' }: { start?: string }) {
  const [path, setPath] = useState(start);
  mockNav.path = path;
  mockNav.go = setPath;
  return (
    <WithSession value={fakeSession({ status: 'in', profile: PROFILES.checkin })}>
      <CheckinProvider>
        {path === '/checkin' ? <CheckinStartPage /> : null}
        {path === '/checkin/details' ? <DetailsPage /> : null}
        {path === '/checkin/visit' ? <VisitPage /> : null}
        {path === '/checkin/done' ? <DonePage /> : null}
        {path === '/login' ? <p>S1 Log in</p> : null}
      </CheckinProvider>
    </WithSession>
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  setApiReachable(true);
});

const choose = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

async function finishS4(reason: string, urgent: 'Yes' | 'No') {
  choose(reason);
  choose(urgent);
  fireEvent.click(screen.getByLabelText('I agree to the Privacy Notice'));
  fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
}

describe('Flow 1 and 2: Check in on the tablet (S2 to S5)', () => {
  it('T-US1-1 S2, S3, S4 filled in correctly, "Check in" shows S5 with the Queue number and sends the answers', async () => {
    answerWith({ queue_number: 14, already_checked_in: false, urgent: false, has_file: false });
    render(<Harness />);
    choose('Check in');
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeTruthy();
    fillDetails(THANDI);
    choose('Next');
    expect(screen.getByRole('heading', { name: 'Why are you here today?' })).toBeTruthy();
    await finishS4('Test or screening', 'No');

    await waitFor(() => expect(screen.getByRole('heading', { name: "You're checked in." })).toBeTruthy());
    expect(screen.getByTestId('queue-number').textContent).toBe('14');
    expect(screen.getByText('We have made a digital file for you. You do not need a paper file.')).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/checkin');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tablet-token');
    expect(JSON.parse(init.body)).toEqual({
      first_name: 'Thandi',
      surname: 'Dlamini',
      date_of_birth: '1997-08-14',
      id_number: '9708140234088',
      cellphone: '+27825550147',
      has_file: false,
      assisted: false,
      reason_category: 'Test or screening',
      urgent: false,
      consent_given: true,
    });
  });

  it('T-US2-1 "Check in with help" for Joseph Mokoena shows his Queue number and sends assisted = Yes', async () => {
    answerWith({ queue_number: 2, already_checked_in: false, urgent: false, has_file: true });
    render(<Harness />);
    choose('Check in with help');
    expect(screen.getByText('The Door Assistant will help you.')).toBeTruthy();
    fillDetails(JOSEPH);
    choose('Next');
    await finishS4('Collecting medication', 'No');
    await waitFor(() => expect(screen.getByTestId('queue-number').textContent).toBe('2'));
    expect(screen.getByText('Please keep your paper file with you and give it to the nurse.')).toBeTruthy();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.assisted).toBe(true);
    expect(body.cellphone).toBeNull();
    expect(body.has_file).toBe(true);
  });

  it('T-US3-1 Palesa Molefe, urgent Yes, shows the red card', async () => {
    answerWith({ queue_number: 4, already_checked_in: false, urgent: true, has_file: false });
    render(<Harness />);
    choose('Check in');
    fillDetails(PALESA);
    choose('Next');
    await finishS4('Baby or child care', 'Yes');
    await waitFor(() => expect(screen.getByText('Please tell the Door Assistant or a nurse now. Your number is marked urgent.')).toBeTruthy());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).urgent).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).id_number).toBeNull();
  });

  it('T-BR3-5 an answer of "already checked in" shows the existing number', async () => {
    answerWith({ queue_number: 3, already_checked_in: true, urgent: false, has_file: false });
    render(<Harness />);
    choose('Check in');
    fillDetails(THANDI);
    choose('Next');
    await finishS4('Test or screening', 'No');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'You are already checked in.' })).toBeTruthy());
    expect(screen.getByTestId('queue-number').textContent).toBe('3');
  });

  it('T-BR14-5 the Too many Check-ins message shows and the user stays on S4', async () => {
    const message = 'Too many Check-ins at once. Please wait one minute and try again.';
    answerWith({ message }, 429);
    render(<Harness />);
    choose('Check in');
    fillDetails(THANDI);
    choose('Next');
    await finishS4('Test or screening', 'No');
    await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
    expect(screen.getByRole('heading', { name: 'Why are you here today?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check in' })).toBeTruthy();
  });

  it('T-S4-6 a server problem shows the message and "Try again", which sends the answers again', async () => {
    answerWith({ message: 'Something went wrong on our side. Please try again.' }, 500);
    render(<Harness />);
    choose('Check in');
    fillDetails(THANDI);
    choose('Next');
    await finishS4('Test or screening', 'No');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy());

    answerWith({ queue_number: 9, already_checked_in: false, urgent: false, has_file: false });
    choose('Try again');
    await waitFor(() => expect(screen.getByTestId('queue-number').textContent).toBe('9'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('T-S4-8 "Back" on S4 shows S3 with the answers kept; "Back" on S3 shows S2 and erases everything', () => {
    render(<Harness />);
    choose('Check in');
    fillDetails(THANDI);
    choose('Next');
    choose('Back');
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Thandi');
    expect(screen.getByRole('button', { name: 'No, I do not have a file' }).getAttribute('aria-pressed')).toBe('true');

    choose('Back');
    expect(screen.getByRole('heading', { name: 'Welcome. Check in here.' })).toBeTruthy();
    choose('Check in');
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('');
  });

  it('T-S5 after "Done" the screen is S2 and no answers are left', async () => {
    answerWith({ queue_number: 14, already_checked_in: false, urgent: false, has_file: false });
    render(<Harness />);
    choose('Check in');
    fillDetails(THANDI);
    choose('Next');
    await finishS4('Test or screening', 'No');
    await waitFor(() => screen.getByRole('button', { name: 'Done' }));
    choose('Done');
    expect(screen.getByRole('heading', { name: 'Welcome. Check in here.' })).toBeTruthy();
    choose('Check in');
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('');
  });

  it('a lost connection on S4 shows the offline banner and the answers stay', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<Harness />);
    choose('Check in');
    fillDetails(THANDI);
    choose('Next');
    await finishS4('Test or screening', 'No');
    await waitFor(() => expect(screen.getByText('No internet. Check-in is paused. Please tell a staff member.')).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Check in' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Test or screening' }).getAttribute('aria-pressed')).toBe('true');
  });
});
