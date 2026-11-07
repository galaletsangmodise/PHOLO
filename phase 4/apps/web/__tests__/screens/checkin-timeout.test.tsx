import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import CheckinStartPage from '@/app/checkin/page';
import DetailsPage from '@/app/checkin/details/page';
import VisitPage from '@/app/checkin/visit/page';
import DonePage from '@/app/checkin/done/page';
import { setApiReachable } from '@/components/apiStatus';
import { CheckinProvider, type CheckinResult } from '@/components/CheckinProvider';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';
import { THANDI, fillDetails } from '../checkinTestUtils';

const mockNav: { path: string; go: (path: string) => void } = { path: '/checkin', go: () => undefined };
jest.mock('next/navigation', () => ({
  usePathname: () => mockNav.path,
  useRouter: () => ({ push: (path: string) => mockNav.go(path), replace: (path: string) => mockNav.go(path) }),
}));
jest.mock('@/components/accessToken', () => ({ getAccessToken: async () => 'tablet-token' }));

const RESULT: CheckinResult = { queueNumber: 14, alreadyCheckedIn: false, urgent: false, hasFile: false };

function Harness({ start = '/checkin', started = false, result = null }: { start?: string; started?: boolean; result?: CheckinResult | null }) {
  const [path, setPath] = useState(start);
  mockNav.path = path;
  mockNav.go = setPath;
  return (
    <WithSession value={fakeSession({ status: 'in', profile: PROFILES.checkin })}>
      <CheckinProvider initialStarted={started} initialResult={result}>
        {path === '/checkin' ? <CheckinStartPage /> : null}
        {path === '/checkin/details' ? <DetailsPage /> : null}
        {path === '/checkin/visit' ? <VisitPage /> : null}
        {path === '/checkin/done' ? <DonePage /> : null}
      </CheckinProvider>
    </WithSession>
  );
}

const WELCOME = 'Welcome. Check in here.';
const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => {
  jest.useFakeTimers();
  setApiReachable(true);
});
afterEach(() => jest.useRealTimers());

describe('Timers and nothing kept (BR10)', () => {
  it('T-BR10-1 on S5, after 15 seconds S2 shows empty', () => {
    render(<Harness start="/checkin/done" started result={RESULT} />);
    expect(screen.getByTestId('queue-number').textContent).toBe('14');
    advance(14_000);
    expect(screen.queryByRole('heading', { name: WELCOME })).toBeNull();
    advance(1_000);
    expect(screen.getByRole('heading', { name: WELCOME })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('');
  });

  it('T-BR10-1 on S5, "Done" shows S2 at once', () => {
    render(<Harness start="/checkin/done" started result={RESULT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('heading', { name: WELCOME })).toBeTruthy();
  });

  it('T-BR10-2 on S3 with typed answers, 2 minutes without a touch show S2 and erase everything', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    fillDetails(THANDI);
    advance(119_000);
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeTruthy();
    advance(1_000);
    expect(screen.getByRole('heading', { name: WELCOME })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/ID number/) as HTMLInputElement).value).toBe('');
  });

  it('T-BR10-2 on S4, 2 minutes without a touch show S2', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    fillDetails(THANDI);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Why are you here today?' })).toBeTruthy();
    advance(120_000);
    expect(screen.getByRole('heading', { name: WELCOME })).toBeTruthy();
  });

  it('T-BR10-3 a touch at 1 minute 50 seconds restarts the 2-minute timer', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    advance(110_000);
    fireEvent.pointerDown(document.body);
    advance(119_000);
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeTruthy();
    advance(1_000);
    expect(screen.getByRole('heading', { name: WELCOME })).toBeTruthy();
  });

  it('T-BR10-3 typing also counts as a touch', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    advance(110_000);
    fireEvent.keyDown(screen.getByLabelText('First name'), { key: 'T' });
    advance(119_000);
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeTruthy();
  });

  it('T-BR10-4 S5 holds only the Queue number, never a name or a reason', () => {
    render(<Harness start="/checkin/done" started result={RESULT} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('14');
    for (const word of ['Thandi', 'Dlamini', 'Test or screening']) expect(text).not.toContain(word);
  });

  it('T-EDGE-2 when the tablet reloads on S3, S4 or S5 nothing typed was kept and S2 shows', () => {
    for (const path of ['/checkin/details', '/checkin/visit', '/checkin/done']) {
      const { unmount } = render(<Harness start={path} started={false} />);
      expect(screen.getByRole('heading', { name: WELCOME })).toBeTruthy();
      unmount();
    }
  });

  it('T-EDGE-2 answers are not written to browser storage', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    fillDetails(THANDI);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
