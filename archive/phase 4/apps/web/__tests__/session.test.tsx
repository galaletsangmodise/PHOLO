import { act, fireEvent, render, screen } from '@testing-library/react';
import { SessionProvider, useSession, type SessionBackend } from '@/components/SessionProvider';
import { LoginContainer } from '@/app/login/LoginContainer';
import { PROFILES } from './sessionTestUtils';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/login',
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const MINUTE = 60_000;

function backendFor(profile: (typeof PROFILES)[keyof typeof PROFILES]): SessionBackend {
  return {
    restore: jest.fn(async () => profile),
    login: jest.fn(async () => ({ ok: true as const, profile })),
    logout: jest.fn(async () => {}),
  };
}

function Probe() {
  const { status, profile } = useSession();
  return <p data-testid="probe">{`${status}:${profile?.role ?? 'none'}`}</p>;
}

async function renderSession(backend: SessionBackend, withLogin = false) {
  render(
    <SessionProvider backend={backend}>
      <Probe />
      {withLogin ? <LoginContainer /> : null}
    </SessionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockReplace.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Inactivity timer (BR11)', () => {
  it('T-BR11-1 signs Reception out after 15 minutes without activity and S1 shows the session message', async () => {
    const backend = backendFor(PROFILES.reception);
    await renderSession(backend, true);
    expect(screen.getByTestId('probe').textContent).toBe('in:Reception');

    await act(async () => {
      jest.advanceTimersByTime(15 * MINUTE);
    });
    expect(backend.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('probe').textContent).toBe('out:none');
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.getByText('Your session has ended. Please log in again.')).toBeTruthy();
  });

  it.each([['Clinical', PROFILES.clinical], ['Manager', PROFILES.manager]] as const)(
    'T-BR11-1 signs %s out after 15 minutes',
    async (_role, profile) => {
      const backend = backendFor(profile);
      await renderSession(backend);
      await act(async () => {
        jest.advanceTimersByTime(15 * MINUTE);
      });
      expect(backend.logout).toHaveBeenCalledTimes(1);
    },
  );

  it('T-BR11-2 a key press after 14 minutes restarts the timer', async () => {
    const backend = backendFor(PROFILES.clinical);
    await renderSession(backend);
    await act(async () => {
      jest.advanceTimersByTime(14 * MINUTE);
    });
    fireEvent.keyDown(document, { key: 'a' });
    await act(async () => {
      jest.advanceTimersByTime(14 * MINUTE);
    });
    expect(backend.logout).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1 * MINUTE);
    });
    expect(backend.logout).toHaveBeenCalledTimes(1);
  });

  it.each(['mousemove', 'touchstart', 'pointerdown'])('T-BR11-1 a %s also counts as activity', async (eventName) => {
    const backend = backendFor(PROFILES.reception);
    await renderSession(backend);
    await act(async () => {
      jest.advanceTimersByTime(14 * MINUTE);
    });
    fireEvent(document, new Event(eventName, { bubbles: true }));
    await act(async () => {
      jest.advanceTimersByTime(14 * MINUTE);
    });
    expect(backend.logout).not.toHaveBeenCalled();
  });

  it('T-BR11-3 the Check-in account is not signed out after 15 minutes (or a day)', async () => {
    const backend = backendFor(PROFILES.checkin);
    await renderSession(backend);
    await act(async () => {
      jest.advanceTimersByTime(24 * 60 * MINUTE);
    });
    expect(backend.logout).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe').textContent).toBe('in:Check-in');
  });

  it('T-EDGE-6 when the session ends while the user is typing, S1 shows the session message', async () => {
    const backend = backendFor(PROFILES.clinical);
    await renderSession(backend, true);
    fireEvent.keyDown(document, { key: 'a' });
    await act(async () => {
      jest.advanceTimersByTime(15 * MINUTE);
    });
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.getByText('Your session has ended. Please log in again.')).toBeTruthy();
  });
});

describe('Session start', () => {
  it('stays logged out when there is no saved session', async () => {
    const backend: SessionBackend = { restore: jest.fn(async () => null), login: jest.fn(), logout: jest.fn() };
    await renderSession(backend);
    expect(screen.getByTestId('probe').textContent).toBe('out:none');
  });
});
