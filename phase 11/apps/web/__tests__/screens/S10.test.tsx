import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SummaryPage from '@/app/summary/page';
import { SummaryScreen } from '@/app/summary/SummaryScreen';
import { setApiReachable } from '@/components/apiStatus';
import * as summaryApi from '@/components/summaryApi';
import type { Summary } from '@/components/summaryApi';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('next/navigation', () => ({
  usePathname: () => '/summary',
  useRouter: () => mockRouter,
  useParams: () => ({}),
}));
jest.mock('@/components/accessToken', () => ({ getAccessToken: async () => 'manager-token' }));
jest.mock('@/components/summaryApi');
const api = summaryApi as jest.Mocked<typeof summaryApi>;

// 27 Oct 2026, 06:14 UTC is 08:14 in SAST.
const NOW = Date.parse('2026-10-27T06:14:00Z');

/** PRD 8.2 S10 sample content: 4, 1, 2, 0, 47 min, 0 and 1, and the six reasons. */
const SAMPLE: Summary = {
  checkedIn: 4, completed: 1, stillWaiting: 2, left: 0, averageWaitMinutes: 47, waitedOver3Hours: 0, helpedByDoorAssistant: 1,
  reasons: [
    { reason: 'Feeling sick or injured', count: 1 }, { reason: 'Collecting medication', count: 1 }, { reason: 'Baby or child care', count: 1 },
    { reason: 'Test or screening', count: 1 }, { reason: 'Pregnancy or family planning', count: 0 }, { reason: 'Something else', count: 0 },
  ],
};

const noop = () => undefined;
type ScreenProps = React.ComponentProps<typeof SummaryScreen>;
const showScreen = (props: Partial<ScreenProps> = {}) =>
  render(
    <SummaryScreen
      fullName="Farouk Patel"
      facilityName="Ubuntu Community Clinic"
      state={{ kind: 'ready', summary: SAMPLE, updatedAtMs: NOW }}
      offline={false}
      onRefresh={noop}
      onTryAgain={noop}
      onLogout={noop}
      {...props}
    />,
  );
/** A stat card: its label and its number. */
const card = (label: string) => screen.getByText(label).closest('[data-testid="stat-card"]') as HTMLElement;

describe('S10 Daily summary: the screen', () => {
  it('T-S10-1 Normal: the Staff Header with "Summary" active and the Manager, the heading, the date and the seven cards', () => {
    showScreen();
    expect(screen.getByText('Farouk Patel')).toBeTruthy();
    expect(screen.getByText('Manager')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Summary' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { name: 'Today at Ubuntu Community Clinic' })).toBeTruthy();
    expect(screen.getByText('27 Oct 2026')).toBeTruthy();
    for (const label of ['Checked in', 'Completed', 'Still waiting', 'Left before being seen', 'Average waiting time', 'Waited over 3 hours', 'Helped by the Door Assistant']) {
      expect(card(label)).toBeTruthy();
    }
    expect(screen.getAllByTestId('stat-card')).toHaveLength(7);
  });

  it('T-US13-1, T-S10-2 the sample numbers are 4, 1, 2, 0, 47 min, 0 and 1', () => {
    showScreen();
    const numbers = [
      ['Checked in', '4'], ['Completed', '1'], ['Still waiting', '2'], ['Left before being seen', '0'],
      ['Average waiting time', '47 min'], ['Waited over 3 hours', '0'], ['Helped by the Door Assistant', '1'],
    ];
    for (const [label, value] of numbers) expect(within(card(label)).getByText(value)).toBeTruthy();
  });

  it('T-S10-2 with Check-ins but no Visit called, the average card shows "—"', () => {
    showScreen({ state: { kind: 'ready', summary: { ...SAMPLE, averageWaitMinutes: null }, updatedAtMs: NOW } });
    expect(within(card('Average waiting time')).getByText('—')).toBeTruthy();
  });

  it('T-S10-3 the table "Reasons for visit today" has one row per reason with its number (6 rows)', () => {
    showScreen();
    expect(screen.getByText('Reasons for visit today')).toBeTruthy();
    const rows = within(screen.getByRole('table')).getAllByRole('row').filter((row) => within(row).queryAllByRole('cell').length > 0);
    expect(rows).toHaveLength(6);
    expect(within(rows[0]).getByText('Feeling sick or injured')).toBeTruthy();
    expect(within(rows[0]).getByText('1')).toBeTruthy();
    expect(within(rows[4]).getByText('Pregnancy or family planning')).toBeTruthy();
    expect(within(rows[4]).getByText('0')).toBeTruthy();
  });

  it('T-S10-4 the footer shows "Updated at 08:14" and "Refresh"; "Refresh" calls the handler', () => {
    const onRefresh = jest.fn();
    showScreen({ onRefresh });
    expect(screen.getByText('Updated at 08:14')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('T-US13-2 Empty: nobody has checked in today', () => {
    showScreen({ state: { kind: 'ready', summary: { ...SAMPLE, checkedIn: 0, completed: 0, stillWaiting: 0, helpedByDoorAssistant: 0, averageWaitMinutes: null, reasons: SAMPLE.reasons.map((r) => ({ ...r, count: 0 })) }, updatedAtMs: NOW } });
    expect(screen.getByText('No check-ins yet today. Numbers will appear after the first patient checks in.')).toBeTruthy();
    expect(screen.queryAllByTestId('stat-card')).toHaveLength(0);
  });

  it('T-S10-5 Loading: 7 grey placeholder cards', () => {
    showScreen({ state: { kind: 'loading' } });
    expect(screen.getAllByTestId('placeholder-block')).toHaveLength(7);
    expect(screen.queryAllByTestId('stat-card')).toHaveLength(0);
  });

  it('T-S10-6 Error: the message with "Try again"', () => {
    const onTryAgain = jest.fn();
    showScreen({ state: { kind: 'error' }, onTryAgain });
    expect(screen.getByText('We could not load the summary. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });

  it('T-S10-7 Offline: the banner shows', () => {
    showScreen({ offline: true });
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
  });

  it('T-S10-8 when read in full, no Patient name appears anywhere', () => {
    showScreen();
    const text = document.body.textContent ?? '';
    for (const name of ['Mokoena', 'Nkosi', 'Dlamini', 'Molefe', 'Joseph', 'Sipho', 'Thandi', 'Palesa']) expect(text).not.toContain(name);
  });

  it('Log out calls its handler', () => {
    const onLogout = jest.fn();
    showScreen({ onLogout });
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('S10 Daily summary: the page (OP17)', () => {
  const show = (role: keyof typeof PROFILES = 'manager') =>
    render(
      <WithSession value={fakeSession({ status: 'in', profile: PROFILES[role] })}>
        <SummaryPage />
      </WithSession>,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    setApiReachable(true);
    api.getSummary.mockResolvedValue(SAMPLE);
  });

  it('loads the summary on open: Loading first, then the numbers', async () => {
    show();
    expect(screen.getAllByTestId('placeholder-block')).toHaveLength(7);
    await waitFor(() => expect(screen.getByText('47 min')).toBeTruthy());
    expect(api.getSummary).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Today at Ubuntu Community Clinic' })).toBeTruthy();
  });

  it.each(['reception', 'clinical', 'checkin'] as const)('%s sees nothing and asks the server nothing', (role) => {
    show(role);
    expect(screen.queryByText('Reasons for visit today')).toBeNull();
    expect(api.getSummary).not.toHaveBeenCalled();
  });

  it('T-S10-4 "Refresh" loads the numbers again and keeps the cards on screen', async () => {
    show();
    await waitFor(() => screen.getByText('47 min'));
    api.getSummary.mockResolvedValueOnce({ ...SAMPLE, checkedIn: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.queryAllByTestId('placeholder-block')).toHaveLength(0);
    await waitFor(() => expect(within(card('Checked in')).getByText('5')).toBeTruthy());
    expect(api.getSummary).toHaveBeenCalledTimes(2);
  });

  it('T-S10-9 every 5 seconds the numbers are fetched again', async () => {
    jest.useFakeTimers();
    try {
      show();
      await act(async () => {});
      expect(api.getSummary).toHaveBeenCalledTimes(1);
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(api.getSummary).toHaveBeenCalledTimes(2);
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(api.getSummary).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('T-S10-7 offline: the banner shows, the refresh pauses, and it resumes when the connection is back', async () => {
    jest.useFakeTimers();
    try {
      show();
      await act(async () => {});
      api.getSummary.mockClear();
      act(() => setApiReachable(false));
      expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(20_000);
      });
      expect(api.getSummary).not.toHaveBeenCalled();
      act(() => setApiReachable(true));
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(api.getSummary).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('T-S10-6 a failed first load shows the error; "Try again" loads it again', async () => {
    api.getSummary.mockRejectedValueOnce(new Error('down'));
    show();
    await waitFor(() => screen.getByText('We could not load the summary. Please try again.'));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => screen.getByText('47 min'));
    expect(api.getSummary).toHaveBeenCalledTimes(2);
  });

  it('a failed background refresh keeps the numbers that are on screen', async () => {
    show();
    await waitFor(() => screen.getByText('47 min'));
    api.getSummary.mockRejectedValueOnce(new Error('blip'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(api.getSummary).toHaveBeenCalledTimes(2));
    expect(screen.getByText('47 min')).toBeTruthy();
    expect(screen.queryByText('We could not load the summary. Please try again.')).toBeNull();
  });
});

describe('summaryApi (OP17)', () => {
  const real = jest.requireActual<typeof import('@/components/summaryApi')>('@/components/summaryApi');
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  it('maps the answer, orders the reasons by number then as listed, and drops anything that is not a number or a reason', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        checked_in: 4, completed: 1, still_waiting: 2, left: 0, average_wait_minutes: null, waited_over_3_hours: 0, helped_by_door_assistant: 1,
        patient_name: 'Thandi Dlamini',
        reasons: { 'Feeling sick or injured': 0, 'Collecting medication': 2, 'Baby or child care': 0, 'Pregnancy or family planning': 0, 'Test or screening': 1, 'Something else': 0, 'Thandi Dlamini': 5 },
      }),
    });
    const summary = await real.getSummary();
    expect(summary).toMatchObject({ checkedIn: 4, stillWaiting: 2, averageWaitMinutes: null, helpedByDoorAssistant: 1 });
    expect(summary.reasons.map((r) => r.reason)).toEqual([
      'Collecting medication', 'Test or screening', 'Feeling sick or injured', 'Baby or child care', 'Pregnancy or family planning', 'Something else',
    ]);
    expect(JSON.stringify(summary)).not.toContain('Dlamini');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/summary$/);
  });
});
