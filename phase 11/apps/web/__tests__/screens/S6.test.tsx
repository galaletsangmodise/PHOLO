import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import QueuePage from '@/app/queue/page';
import { QueueScreen } from '@/app/queue/QueueScreen';
import { ApiError } from '@/components/api';
import { setApiReachable } from '@/components/apiStatus';
import { setFlash } from '@/components/flash';
import type { QueueCounts, QueueVisit } from '@/components/queueApi';
import * as queueApi from '@/components/queueApi';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('next/navigation', () => ({
  usePathname: () => '/queue',
  useRouter: () => mockRouter,
  useParams: () => ({}),
}));
jest.mock('@/components/queueApi');
const api = queueApi as jest.Mocked<typeof queueApi>;

// 27 Oct 2026, 08:00 UTC is 10:00 in SAST.
const NOW = Date.parse('2026-10-27T08:00:00Z');
const minutesBefore = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function visit(fields: Partial<QueueVisit>): QueueVisit {
  return {
    id: 'v-x',
    patientId: 'p-x',
    queueNumber: 1,
    firstName: 'Test',
    surname: 'Patient',
    dateOfBirth: '1990-01-01',
    reasonCategory: 'Test or screening',
    urgent: false,
    assisted: false,
    status: 'Waiting',
    paperFileStatus: 'No paper file',
    checkinAt: minutesBefore(30),
    calledAt: null,
    completedAt: null,
    leftAt: null,
    ...fields,
  };
}

/** The sample rows of PRD 8.2, in BR2 order. */
const SIPHO = visit({
  id: 'v-2', patientId: 'p-2', queueNumber: 2, firstName: 'Sipho', surname: 'Nkosi', dateOfBirth: '1986-03-02',
  reasonCategory: 'Feeling sick or injured', status: 'In consultation', checkinAt: minutesBefore(70), calledAt: minutesBefore(20),
});
const PALESA = visit({
  id: 'v-4', patientId: 'p-4', queueNumber: 4, firstName: 'Palesa', surname: 'Molefe', dateOfBirth: '2025-01-09',
  reasonCategory: 'Baby or child care', urgent: true, checkinAt: minutesBefore(43),
});
const THANDI = visit({
  id: 'v-3', patientId: 'p-3', queueNumber: 3, firstName: 'Thandi', surname: 'Dlamini', dateOfBirth: '1997-08-14',
  reasonCategory: 'Test or screening', checkinAt: minutesBefore(54),
});
const SAMPLE = [SIPHO, PALESA, THANDI];
const COUNTS: QueueCounts = { waiting: 2, inConsultation: 1, completed: 1, uncalled: 2 };

const ROW_COUNTS = (visits: QueueVisit[]): QueueCounts => ({
  waiting: visits.filter((v) => v.status === 'Waiting' || v.status === 'Called').length,
  inConsultation: visits.filter((v) => v.status === 'In consultation').length,
  completed: 0,
  uncalled: visits.filter((v) => v.status === 'Waiting').length,
});

const noop = () => undefined;
type ScreenProps = React.ComponentProps<typeof QueueScreen>;
function showScreen(props: Partial<ScreenProps> = {}) {
  return render(
    <QueueScreen
      role="Clinical"
      fullName="Nomsa Khumalo"
      tab="active"
      state={{ kind: 'ready', visits: SAMPLE, counts: COUNTS }}
      nowMs={NOW}
      offline={false}
      onTab={noop}
      onCallNext={noop}
      onMarkLeft={noop}
      onStart={noop}
      onContinue={noop}
      onRefresh={noop}
      onTryAgain={noop}
      onToastDone={noop}
      onLogout={noop}
      {...props}
    />,
  );
}

function showPage(role: keyof typeof PROFILES = 'clinical') {
  return render(
    <WithSession value={fakeSession({ status: 'in', profile: PROFILES[role] })}>
      <QueuePage />
    </WithSession>,
  );
}
const rowOf = (name: RegExp | string) => screen.getByRole('link', { name }).closest('li') as HTMLElement;

beforeEach(() => {
  jest.clearAllMocks();
  setApiReachable(true);
  api.getQueue.mockResolvedValue({ visits: SAMPLE, counts: COUNTS });
  api.callNext.mockResolvedValue({ noneWaiting: false, visitId: 'v-4', queueNumber: 4, firstName: 'Palesa', surname: 'Molefe' });
  api.markLeft.mockResolvedValue(undefined);
});

describe('S6 Queue: layout and roles', () => {
  it('T-S6-1 the Clinical view shows the header, the heading, the date, "Call next patient", the chips, the tabs and the list', () => {
    showScreen();
    expect(screen.getByRole('link', { name: 'Queue' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { name: "Today's queue" })).toBeTruthy();
    expect(screen.getByText('27 Oct 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Call next patient' })).toBeTruthy();
    expect(screen.getByText('Waiting 2')).toBeTruthy();
    expect(screen.getByText('In consultation 1')).toBeTruthy();
    expect(screen.getByText('Completed 1')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Active' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Done today' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it('T-S6-2 the Reception view has no "Call next patient", "Start consultation" or "Continue", but has "Mark as left"', () => {
    showScreen({ role: 'Reception', state: { kind: 'ready', visits: [...SAMPLE, visit({ id: 'v-9', queueNumber: 9, status: 'Called', surname: 'Called' })], counts: COUNTS } });
    expect(screen.queryByRole('button', { name: 'Call next patient' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start consultation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Mark as left' }).length).toBe(3);
  });

  it('T-S6-4 the chips show Waiting 2, In consultation 1 and Completed 1 (no Called chip)', () => {
    showScreen();
    expect(screen.queryByText(/^Called/)).toBeNull();
    expect(screen.getByText('Waiting 2')).toBeTruthy();
  });

  it('T-US6-2 with nobody to call "Call next patient" is disabled and "No one is waiting." shows next to it', () => {
    showScreen({ state: { kind: 'ready', visits: [SIPHO], counts: { waiting: 0, inConsultation: 1, completed: 0, uncalled: 0 } } });
    expect((screen.getByRole('button', { name: 'Call next patient' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('No one is waiting.')).toBeTruthy();
  });

  it('"Call next patient" is enabled and has no hint while someone is waiting', () => {
    showScreen();
    expect((screen.getByRole('button', { name: 'Call next patient' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText('No one is waiting.')).toBeNull();
  });
});

describe('S6 Queue: rows', () => {
  it('T-S6-3, T-S6-10 the sample rows show number, name, age, reason, wait, badge and buttons in the given order', () => {
    showScreen();
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Nkosi, Sipho');
    expect(items[1].textContent).toContain('Molefe, Palesa');
    expect(items[2].textContent).toContain('Dlamini, Thandi');

    const sipho = rowOf('Nkosi, Sipho');
    expect(within(sipho).getByTestId('queue-number').textContent).toBe('2');
    expect(sipho.textContent).toContain('40 yrs');
    expect(sipho.textContent).toContain('Feeling sick or injured');
    expect(within(sipho).getByText('In consultation')).toBeTruthy();
    expect(within(sipho).getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(within(sipho).queryByRole('button', { name: 'Mark as left' })).toBeNull();
    expect(sipho.textContent).not.toContain('Waited');

    const palesa = rowOf('Molefe, Palesa');
    expect(within(palesa).getByTestId('queue-number').textContent).toBe('4');
    expect(palesa.textContent).toContain('1 yr');
    expect(palesa.textContent).toContain('Baby or child care');
    expect(palesa.textContent).toContain('Waited 43 min');
    expect(within(palesa).getByText('Waiting')).toBeTruthy();
    expect(within(palesa).getByText('Urgent')).toBeTruthy();
    expect(within(palesa).getByRole('button', { name: 'Mark as left' })).toBeTruthy();

    const thandi = rowOf('Dlamini, Thandi');
    expect(thandi.textContent).toContain('29 yrs');
    expect(thandi.textContent).toContain('Waited 54 min');
    expect(within(thandi).queryByText('Urgent')).toBeNull();
  });

  it('T-S6-3 a Called row shows "Waited", "Start consultation" (Clinical) and "Mark as left"; the badges Paper file and Helped show when they apply', () => {
    const called = visit({ id: 'v-5', queueNumber: 5, surname: 'Mokoena', firstName: 'Joseph', status: 'Called', paperFileStatus: 'Paper file - not yet digitised', assisted: true, calledAt: minutesBefore(2) });
    showScreen({ state: { kind: 'ready', visits: [called], counts: COUNTS } });
    const row = rowOf('Mokoena, Joseph');
    expect(row.textContent).toContain('Waited 30 min');
    expect(within(row).getByText('Called')).toBeTruthy();
    expect(within(row).getByText('Paper file')).toBeTruthy();
    expect(within(row).getByText('Helped')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Start consultation' })).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Mark as left' })).toBeTruthy();
  });

  it('T-S6-3 "Paper file - digitised" and "No paper file" show no Paper file badge', () => {
    showScreen({ state: { kind: 'ready', visits: [visit({ paperFileStatus: 'Paper file - digitised' })], counts: COUNTS } });
    expect(screen.queryByText('Paper file')).toBeNull();
  });

  it('T-S6-11 a name links to S8; "Start consultation" and "Continue" open S9', () => {
    const onStart = jest.fn();
    const onContinue = jest.fn();
    const called = visit({ id: 'v-5', patientId: 'p-5', queueNumber: 5, surname: 'Mokoena', firstName: 'Joseph', status: 'Called' });
    showScreen({ state: { kind: 'ready', visits: [SIPHO, called], counts: COUNTS }, onStart, onContinue });
    expect(screen.getByRole('link', { name: 'Nkosi, Sipho' }).getAttribute('href')).toBe('/patients/p-2');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith('v-2');
    fireEvent.click(screen.getByRole('button', { name: 'Start consultation' }));
    expect(onStart).toHaveBeenCalledWith('v-5');
  });

  it('T-S6-5 the Done today tab shows number, name, reason, badge and the time, with no buttons', () => {
    const completed = visit({ id: 'v-7', queueNumber: 7, surname: 'Nkosi', firstName: 'Sipho', status: 'Completed', completedAt: '2026-10-27T07:42:00Z' });
    const left = visit({ id: 'v-8', queueNumber: 8, surname: 'Zulu', firstName: 'Anele', status: 'Left', leftAt: '2026-10-27T06:10:00Z' });
    showScreen({ tab: 'done', state: { kind: 'ready', visits: [completed, left], counts: COUNTS } });
    const done = rowOf('Nkosi, Sipho');
    expect(within(done).getByTestId('queue-number').textContent).toBe('7');
    expect(done.textContent).toContain('Test or screening');
    expect(within(done).getByText('Completed')).toBeTruthy();
    expect(done.textContent).toContain('09:42');
    const gone = rowOf('Zulu, Anele');
    expect(within(gone).getByText('Left')).toBeTruthy();
    expect(gone.textContent).toContain('08:10');
    expect(screen.queryByRole('button', { name: 'Mark as left' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('tapping a tab asks for it', () => {
    const onTab = jest.fn();
    showScreen({ onTab });
    fireEvent.click(screen.getByRole('tab', { name: 'Done today' }));
    expect(onTab).toHaveBeenCalledWith('done');
  });
});

describe('S6 Queue: states', () => {
  it('T-S6-6 Empty shows the message, the hint and "Refresh"; an empty Done today shows its own message', () => {
    const onRefresh = jest.fn();
    const { unmount } = showScreen({ state: { kind: 'ready', visits: [], counts: { waiting: 0, inConsultation: 0, completed: 0, uncalled: 0 } }, onRefresh });
    expect(screen.getByText('No patients in the queue right now.')).toBeTruthy();
    expect(screen.getByText('New check-ins appear here by themselves.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    unmount();
    showScreen({ tab: 'done', state: { kind: 'ready', visits: [], counts: COUNTS } });
    expect(screen.getByText('No patients finished yet today.')).toBeTruthy();
  });

  it('T-S6-7 Loading shows 5 grey placeholder rows', () => {
    showScreen({ state: { kind: 'loading' } });
    expect(screen.getAllByTestId('placeholder-block')).toHaveLength(5);
  });

  it('T-S6-8 Error shows the message and "Try again"', () => {
    const onTryAgain = jest.fn();
    showScreen({ state: { kind: 'error' }, onTryAgain });
    expect(screen.getByText('We could not load the queue. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });

  it('T-US7-2 Offline shows the banner', () => {
    showScreen({ offline: true });
    expect(screen.getByText('No internet connection. The queue may be out of date.')).toBeTruthy();
  });

  it('T-S6-9 a toast shows for 3 seconds', () => {
    jest.useFakeTimers();
    try {
      const onToastDone = jest.fn();
      showScreen({ toast: 'Calling number 4: Palesa Molefe', onToastDone });
      expect(screen.getByText('Calling number 4: Palesa Molefe')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(onToastDone).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('T-S6-12 the rows are one list that turns into a table on desktop and cards on a phone', () => {
    showScreen();
    const list = screen.getByRole('list', { name: 'Queue' });
    expect(list.className).toContain('tablet:');
  });
});

describe('S6 Queue: the page', () => {
  it('asks for the Active list and shows it', async () => {
    showPage();
    expect(screen.getAllByTestId('placeholder-block')).toHaveLength(5);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Molefe, Palesa' })).toBeTruthy());
    expect(api.getQueue).toHaveBeenCalledWith('active');
  });

  it('T-US7-1, T-S6-12 asks again every 5 seconds and shows a new row', async () => {
    jest.useFakeTimers();
    try {
      api.getQueue.mockResolvedValueOnce({ visits: [SIPHO], counts: ROW_COUNTS([SIPHO]) });
      showPage();
      await act(async () => {});
      expect(screen.queryByRole('link', { name: 'Molefe, Palesa' })).toBeNull();
      expect(api.getQueue).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(api.getQueue).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('link', { name: 'Molefe, Palesa' })).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('T-US7-2 when the computer goes offline the banner shows and the refresh pauses', async () => {
    jest.useFakeTimers();
    try {
      showPage();
      await act(async () => {});
      api.getQueue.mockClear();
      act(() => setApiReachable(false));
      expect(screen.getByText('No internet connection. The queue may be out of date.')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(20_000);
      });
      expect(api.getQueue).not.toHaveBeenCalled();
      act(() => setApiReachable(true));
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(api.getQueue).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('T-S6-8 a failed load shows the error and "Try again" loads again', async () => {
    api.getQueue.mockRejectedValueOnce(new Error('down'));
    showPage();
    await waitFor(() => expect(screen.getByText('We could not load the queue. Please try again.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Molefe, Palesa' })).toBeTruthy());
  });

  it('opening Done today asks for the done list', async () => {
    showPage();
    await waitFor(() => screen.getByRole('link', { name: 'Molefe, Palesa' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Done today' }));
    await waitFor(() => expect(api.getQueue).toHaveBeenCalledWith('done'));
  });

  it('T-US6-1 "Call next patient" calls the next Visit, shows the toast and loads the list again', async () => {
    showPage();
    await waitFor(() => screen.getByRole('link', { name: 'Molefe, Palesa' }));
    api.getQueue.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Call next patient' }));
    await waitFor(() => expect(screen.getByText('Calling number 4: Palesa Molefe')).toBeTruthy());
    expect(api.callNext).toHaveBeenCalledTimes(1);
    expect(api.getQueue).toHaveBeenCalled();
  });

  it('when nobody is waiting any more no toast shows and the list is loaded again', async () => {
    api.callNext.mockResolvedValueOnce({ noneWaiting: true });
    showPage();
    await waitFor(() => screen.getByRole('link', { name: 'Molefe, Palesa' }));
    api.getQueue.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Call next patient' }));
    await waitFor(() => expect(api.getQueue).toHaveBeenCalled());
    expect(screen.queryByText(/Calling number/)).toBeNull();
  });

  it('T-US8-1, T-M4-7 "Mark as left" opens M4; "Yes, mark as left" marks it, closes M4 and shows the toast', async () => {
    showPage('reception');
    await waitFor(() => screen.getByRole('link', { name: 'Dlamini, Thandi' }));
    fireEvent.click(within(rowOf('Dlamini, Thandi')).getByRole('button', { name: 'Mark as left' }));
    expect(screen.getByText('Mark this patient as left?')).toBeTruthy();
    expect(screen.getByText('Number 3: Thandi Dlamini will move to Done today. This cannot be undone.')).toBeTruthy();

    api.getQueue.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, mark as left' }));
    await waitFor(() => expect(screen.getByText('Marked as left.')).toBeTruthy());
    expect(api.markLeft).toHaveBeenCalledWith('v-3');
    expect(screen.queryByText('Mark this patient as left?')).toBeNull();
    expect(api.getQueue).toHaveBeenCalled();
  });

  it('T-US8-2, T-M4-7 "Cancel" closes M4 and the Visit is unchanged', async () => {
    showPage('reception');
    await waitFor(() => screen.getByRole('link', { name: 'Dlamini, Thandi' }));
    fireEvent.click(within(rowOf('Dlamini, Thandi')).getByRole('button', { name: 'Mark as left' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Mark this patient as left?')).toBeNull();
    expect(api.markLeft).not.toHaveBeenCalled();
  });

  it('T-EDGE-5 a Called Patient who does not come can be marked as left and moves to Done today', async () => {
    const called = visit({ id: 'v-6', patientId: 'p-6', queueNumber: 6, surname: 'Zulu', firstName: 'Anele', status: 'Called' });
    api.getQueue.mockResolvedValueOnce({ visits: [called], counts: { waiting: 1, inConsultation: 0, completed: 0, uncalled: 0 } });
    showPage();
    await waitFor(() => screen.getByRole('link', { name: 'Zulu, Anele' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark as left' }));
    api.getQueue.mockResolvedValueOnce({ visits: [], counts: { waiting: 0, inConsultation: 0, completed: 0, uncalled: 0 } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes, mark as left' }));
    await waitFor(() => expect(screen.getByText('Marked as left.')).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'Zulu, Anele' })).toBeNull();
  });

  it('a server problem in M4 shows the red text and keeps M4 open', async () => {
    api.markLeft.mockRejectedValueOnce(new Error('down'));
    showPage('reception');
    await waitFor(() => screen.getByRole('link', { name: 'Dlamini, Thandi' }));
    fireEvent.click(within(rowOf('Dlamini, Thandi')).getByRole('button', { name: 'Mark as left' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, mark as left' }));
    await waitFor(() => expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy());
    expect(screen.getByText('Mark this patient as left?')).toBeTruthy();
  });

  it('T-S6-9 arriving from S9 shows the toast "Visit completed."', async () => {
    setFlash('Visit completed.');
    showPage();
    await waitFor(() => expect(screen.getByText('Visit completed.')).toBeTruthy());
  });

  it('T-S6-11 "Continue" opens S9 of that Visit; "Start consultation" first starts it (OP7) and then opens S9', async () => {
    const called = visit({ id: 'v-5', patientId: 'p-5', queueNumber: 5, surname: 'Mokoena', firstName: 'Joseph', status: 'Called' });
    api.getQueue.mockResolvedValue({ visits: [SIPHO, called], counts: COUNTS });
    showPage();
    await waitFor(() => screen.getByRole('link', { name: 'Mokoena, Joseph' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/visits/v-2');
    expect(api.startConsultation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start consultation' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/visits/v-5'));
    expect(api.startConsultation).toHaveBeenCalledWith('v-5');
  });

  it('a Visit that cannot be started (someone else started or finished it) shows the message, stays on S6 and loads the list again', async () => {
    const called = visit({ id: 'v-5', patientId: 'p-5', queueNumber: 5, surname: 'Mokoena', firstName: 'Joseph', status: 'Called' });
    api.getQueue.mockResolvedValue({ visits: [called], counts: COUNTS });
    api.startConsultation.mockRejectedValueOnce(new ApiError(409, 'This visit cannot be started.'));
    showPage();
    await waitFor(() => screen.getByRole('link', { name: 'Mokoena, Joseph' }));
    mockRouter.push.mockClear();
    api.getQueue.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Start consultation' }));
    await waitFor(() => expect(screen.getByText('This visit cannot be started.')).toBeTruthy());
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(api.getQueue).toHaveBeenCalled();
  });

  it('the Check-in role sees nothing on S6', () => {
    const { container } = showPage('checkin');
    expect(container.textContent).toBe('');
    expect(api.getQueue).not.toHaveBeenCalled();
  });
});
