import { act, render, screen } from '@testing-library/react';
import { AppShell } from '@/components/AppShell';
import { SessionProvider, type SessionBackend } from '@/components/SessionProvider';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';

const mockReplace = jest.fn();
let mockPath = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const NOT_ALLOWED = 'You are not allowed to open this page.';

beforeEach(() => {
  mockReplace.mockClear();
});

function renderShell(path: string, session: ReturnType<typeof fakeSession>) {
  mockPath = path;
  return render(
    <WithSession value={session}>
      <AppShell>
        <p data-testid="page">page</p>
      </AppShell>
    </WithSession>,
  );
}

const loggedIn = (profile: (typeof PROFILES)[keyof typeof PROFILES], extra = {}) =>
  fakeSession({ status: 'in', profile, ...extra });

describe('Navigation rules (plan Section 11)', () => {
  it.each(['/queue', '/patients', '/patients/abc', '/visits/abc', '/summary', '/checkin', '/checkin/details'])(
    'T-NAV-1 a logged-out visitor opening %s goes to S1',
    (path) => {
      renderShell(path, fakeSession({ status: 'out' }));
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.queryByTestId('page')).toBeNull();
    },
  );

  it('T-NAV-1 a logged-out visitor can open S1', () => {
    renderShell('/login', fakeSession({ status: 'out' }));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId('page')).toBeTruthy();
  });

  it('shows a loading placeholder, and no page, while the session is being checked', () => {
    renderShell('/queue', fakeSession({ status: 'loading' }));
    expect(screen.queryByTestId('page')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each([
    ['Check-in', PROFILES.checkin, '/checkin'],
    ['Reception', PROFILES.reception, '/queue'],
    ['Clinical', PROFILES.clinical, '/queue'],
    ['Manager', PROFILES.manager, '/summary'],
  ] as const)('T-NAV-2 / T-NAV-3 %s lands on, and is sent from S1 to, %s', (_role, profile, main) => {
    renderShell('/login', loggedIn(profile));
    expect(mockReplace).toHaveBeenCalledWith(main);
  });

  const ALLOWED: Array<[string, (typeof PROFILES)[keyof typeof PROFILES], string[]]> = [
    ['Check-in', PROFILES.checkin, ['/checkin', '/checkin/details', '/checkin/visit', '/checkin/done']],
    ['Reception', PROFILES.reception, ['/queue', '/patients', '/patients/abc']],
    ['Clinical', PROFILES.clinical, ['/queue', '/patients', '/patients/abc', '/visits/abc']],
    ['Manager', PROFILES.manager, ['/summary']],
  ];
  const ALL = ['/checkin', '/checkin/details', '/checkin/visit', '/checkin/done', '/queue', '/patients', '/patients/abc', '/visits/abc', '/summary'];
  const MAIN: Record<string, string> = { 'Check-in': '/checkin', Reception: '/queue', Clinical: '/queue', Manager: '/summary' };

  describe.each(ALLOWED)('%s', (role, profile, allowed) => {
    it.each(allowed)('can open %s', (path) => {
      const session = loggedIn(profile);
      renderShell(path, session);
      expect(mockReplace).not.toHaveBeenCalled();
      expect(session.flagNotAllowed).not.toHaveBeenCalled();
      expect(screen.getByTestId('page')).toBeTruthy();
    });

    it.each(ALL.filter((path) => !allowed.includes(path)))('T-NAV-4 cannot open %s: goes to its main screen with the not-allowed message', (path) => {
      const session = loggedIn(profile);
      renderShell(path, session);
      expect(session.flagNotAllowed).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith(MAIN[role]);
      expect(screen.queryByTestId('page')).toBeNull();
    });
  });

  it('T-US12-2 Reception typing the address of S9 sees the not-allowed message and goes back to S6', () => {
    const session = loggedIn(PROFILES.reception);
    renderShell('/visits/123', session);
    expect(session.flagNotAllowed).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/queue');
  });

  it('T-NAV-4 shows the message as a toast on the main screen', () => {
    renderShell('/queue', loggedIn(PROFILES.reception, { notAllowed: true }));
    expect(screen.getByRole('status').textContent).toBe(NOT_ALLOWED);
  });

  it('T-NAV-4 clears the message after the toast is dismissed', () => {
    jest.useFakeTimers();
    const session = loggedIn(PROFILES.reception, { notAllowed: true });
    renderShell('/queue', session);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(session.clearNotAllowed).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('works with the real provider: a logged-out visitor on S9 goes to S1', async () => {
    mockPath = '/visits/1';
    const backend: SessionBackend = { restore: jest.fn(async () => null), login: jest.fn(), logout: jest.fn() };
    render(
      <SessionProvider backend={backend}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </SessionProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
