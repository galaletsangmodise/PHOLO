import { act, fireEvent, render, screen } from '@testing-library/react';
import CheckinStartPage from '@/app/checkin/page';
import { StartScreen } from '@/app/checkin/StartScreen';
import { setApiReachable } from '@/components/apiStatus';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';
import { WithCheckin } from '../checkinTestUtils';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/checkin',
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const OFFLINE = 'No internet. Check-in is paused. Please tell a staff member.';
// 27 Oct 2026, 05:05 UTC is 07:05 in SAST.
const NOW = new Date('2026-10-27T05:05:00Z');

const baseProps = {
  facilityName: 'Ubuntu Community Clinic',
  dateTimeText: 'Tue 27 Oct 2026 · 07:05',
  onCheckIn: jest.fn(),
  onCheckInWithHelp: jest.fn(),
  onOpenPrivacy: jest.fn(),
  onLogoLongPress: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  setApiReachable(true);
});

describe('S2 Check-in start', () => {
  it('T-S2-1 shows the header, the welcome text, both buttons and the Privacy Notice link', () => {
    render(<StartScreen {...baseProps} />);
    expect(screen.getByTestId('logo')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Welcome. Check in here.' })).toBeTruthy();
    expect(screen.getByText('It takes about 1 minute. You do not need a card.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check in with help' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Privacy Notice' })).toBeTruthy();
  });

  it('T-S2-2 shows the facility name, the weekday, the date and the time, and the time moves on every minute', () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    try {
      render(
        <WithSession value={fakeSession({ status: 'in', profile: PROFILES.checkin })}>
          <WithCheckin started={false}>
            <CheckinStartPage />
          </WithCheckin>
        </WithSession>,
      );
      expect(screen.getByText('Ubuntu Community Clinic')).toBeTruthy();
      expect(screen.getByText('Tue 27 Oct 2026 · 07:05')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByText('Tue 27 Oct 2026 · 07:06')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('T-S2-3 "Check in" starts with assisted = No and "Check in with help" with assisted = Yes', () => {
    render(<StartScreen {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect(baseProps.onCheckIn).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Check in with help' }));
    expect(baseProps.onCheckInWithHelp).toHaveBeenCalledTimes(1);
  });

  it('T-S2-3 the page opens S3 with assisted = No or Yes', () => {
    render(
      <WithSession value={fakeSession({ status: 'in', profile: PROFILES.checkin })}>
        <WithCheckin started={false}>
          <CheckinStartPage />
        </WithCheckin>
      </WithSession>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check in with help' }));
    expect(mockPush).toHaveBeenCalledWith('/checkin/details');
  });

  it('T-S2-4 pressing the logo for 3 seconds opens M4; a shorter press does nothing', () => {
    jest.useFakeTimers();
    try {
      render(<StartScreen {...baseProps} />);
      const logo = screen.getByTestId('logo-hold-target');
      fireEvent.pointerDown(logo);
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      fireEvent.pointerUp(logo);
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(baseProps.onLogoLongPress).not.toHaveBeenCalled();

      fireEvent.pointerDown(logo);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(baseProps.onLogoLongPress).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('T-US2-2, T-EDGE-1, T-S2-5 offline: the red banner shows and both buttons are disabled', () => {
    render(<StartScreen {...baseProps} offline />);
    const banner = screen.getByText(OFFLINE).closest('[role="status"]') as HTMLElement;
    expect(banner.className).toContain('bg-errorBg');
    expect((screen.getByRole('button', { name: 'Check in' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Check in with help' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('T-US2-2 the page goes offline when the API cannot be reached', () => {
    render(
      <WithSession value={fakeSession({ status: 'in', profile: PROFILES.checkin })}>
        <WithCheckin started={false}>
          <CheckinStartPage />
        </WithCheckin>
      </WithSession>,
    );
    expect(screen.queryByText(OFFLINE)).toBeNull();
    act(() => setApiReachable(false));
    expect(screen.getByText(OFFLINE)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Check in' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('T-M4-6 "Yes, log out" logs out and goes to S1; "Cancel" keeps S2', async () => {
    jest.useFakeTimers();
    const session = fakeSession({ status: 'in', profile: PROFILES.checkin });
    try {
      render(
        <WithSession value={session}>
          <WithCheckin started={false}>
            <CheckinStartPage />
          </WithCheckin>
        </WithSession>,
      );
      const hold = () => {
        fireEvent.pointerDown(screen.getByTestId('logo-hold-target'));
        act(() => {
          jest.advanceTimersByTime(3000);
        });
      };
      hold();
      expect(screen.getByText('Log out of this tablet?')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText('Log out of this tablet?')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Welcome. Check in here.' })).toBeTruthy();
      expect(session.logout).not.toHaveBeenCalled();

      hold();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Yes, log out' }));
      });
      expect(session.logout).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/login');
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens the Privacy Notice (M1) and "Close" returns to S2', () => {
    render(
      <WithSession value={fakeSession({ status: 'in', profile: PROFILES.checkin })}>
        <WithCheckin started={false}>
          <CheckinStartPage />
        </WithCheckin>
      </WithSession>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Privacy Notice' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Welcome. Check in here.' })).toBeTruthy();
  });
});
