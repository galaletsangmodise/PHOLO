import { act, fireEvent, render, screen } from '@testing-library/react';
import { LoginContainer } from '@/app/login/LoginContainer';
import { LoginScreen } from '@/app/login/LoginScreen';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/login',
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const noop = () => {};

describe('S1 Log in', () => {
  it('T-S1-1 shows the logo, the title, the form, the hint, the Privacy Notice link and the version', () => {
    render(<LoginScreen onSubmit={noop} onOpenPrivacy={noop} />);
    expect(screen.getByTestId('logo')).toBeTruthy();
    expect(screen.getByText('Clinic Management System')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeTruthy();

    const email = screen.getByLabelText('Email') as HTMLInputElement;
    expect(email.placeholder).toBe('name@clinic.co.za');
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.placeholder).toBe('Your password');

    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(screen.getByText('Forgot your password? Ask your Manager to reset it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Privacy Notice' })).toBeTruthy();
    expect(screen.getByText('Pholo CMS v0.1')).toBeTruthy();
  });

  it('T-S1-1 puts the cursor in Email and opens the Privacy Notice from its link', () => {
    const onOpenPrivacy = jest.fn();
    render(<LoginScreen onSubmit={noop} onOpenPrivacy={onOpenPrivacy} />);
    expect(document.activeElement).toBe(screen.getByLabelText('Email'));
    fireEvent.click(screen.getByRole('button', { name: 'Privacy Notice' }));
    expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
  });

  it('T-S1-1 has no Forgot password screen or link, only the text', () => {
    render(<LoginScreen onSubmit={noop} onOpenPrivacy={noop} />);
    expect(screen.queryByRole('link', { name: /forgot/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /forgot/i })).toBeNull();
  });

  it('T-S1-2 shows the password text when "Show" is tapped and the toggle reads "Hide"', () => {
    render(<LoginScreen onSubmit={noop} onOpenPrivacy={noop} />);
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(password.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide' })).toBeTruthy();
  });

  it('T-S1-3 shows both field messages for empty fields and does not submit', () => {
    const onSubmit = jest.fn();
    render(<LoginScreen onSubmit={onSubmit} onOpenPrivacy={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Enter your email address, for example name@clinic.co.za')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('T-S1-3 keeps the typed text when a field message shows', () => {
    render(<LoginScreen onSubmit={noop} onOpenPrivacy={noop} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Enter your email address, for example name@clinic.co.za')).toBeTruthy();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('not-an-email');
  });

  it('T-S1-3 submits the typed email and password when both are filled in', () => {
    const onSubmit = jest.fn();
    render(<LoginScreen onSubmit={onSubmit} onOpenPrivacy={noop} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nomsa.khumalo@ubuntu-clinic.example' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'nomsa.khumalo@ubuntu-clinic.example',
      password: 'a-test-password',
    });
  });

  it('T-S1-4 Loading: the button reads "Logging in..." and is disabled', () => {
    render(<LoginScreen status="loading" onSubmit={noop} onOpenPrivacy={noop} />);
    const button = screen.getByRole('button', { name: 'Logging in...' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('T-S1-5 Error: shows the server problem message', () => {
    render(<LoginScreen error="server" onSubmit={noop} onOpenPrivacy={noop} />);
    expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy();
  });

  it('T-S1-5 Error: shows the wrong details message and keeps the email', () => {
    const { rerender } = render(<LoginScreen onSubmit={noop} onOpenPrivacy={noop} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'busisiwe.naidoo@ubuntu-clinic.example' } });
    rerender(<LoginScreen error="credentials" onSubmit={noop} onOpenPrivacy={noop} />);

    expect(screen.getByText('Email or password is not correct. Try again.')).toBeTruthy();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('busisiwe.naidoo@ubuntu-clinic.example');
  });

  it('T-S1-5 Error: after too many tries shows the wait message and disables the button', () => {
    render(<LoginScreen error="locked" onSubmit={noop} onOpenPrivacy={noop} />);
    expect(screen.getByText('Too many tries. Wait 60 seconds and try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('T-S1-6 Offline: shows the banner and disables "Log in"', () => {
    render(<LoginScreen offline onSubmit={noop} onOpenPrivacy={noop} />);
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('S1 wired to log in (OP1)', () => {
  const WRONG = 'Email or password is not correct. Try again.';
  const LOCKED = 'Too many tries. Wait 60 seconds and try again.';

  type Login = ReturnType<typeof fakeSession>['login'];
  const wrong = () => ({ ok: false as const, error: 'credentials' as const });

  function setup(login: Login, extra = {}) {
    const session = fakeSession({ login, ...extra });
    render(
      <WithSession value={session}>
        <LoginContainer />
      </WithSession>,
    );
    return session;
  }

  async function tryLogin(email = 'nomsa.khumalo@ubuntu-clinic.example', password = 'wrong-password-1') {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    mockReplace.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('T-US11-1 Clinical logs in and lands on S6', async () => {
    const login = jest.fn(async () => ({ ok: true as const, profile: PROFILES.clinical }));
    setup(login as Login);
    await tryLogin('nomsa.khumalo@ubuntu-clinic.example', 'a-valid-password-1');
    expect(login).toHaveBeenCalledWith('nomsa.khumalo@ubuntu-clinic.example', 'a-valid-password-1');
    expect(mockReplace).toHaveBeenCalledWith('/queue');
  });

  it.each([
    ['Check-in', PROFILES.checkin, '/checkin'],
    ['Reception', PROFILES.reception, '/queue'],
    ['Manager', PROFILES.manager, '/summary'],
  ] as const)('T-NAV-2 %s lands on %s', async (_role, profile, main) => {
    setup((async () => ({ ok: true as const, profile })) as Login);
    await tryLogin();
    expect(mockReplace).toHaveBeenCalledWith(main);
  });

  it('T-US11-2 a wrong password shows the message and keeps the email', async () => {
    setup(jest.fn(async () => wrong()));
    await tryLogin('busisiwe.naidoo@ubuntu-clinic.example');
    expect(screen.getByText(WRONG)).toBeTruthy();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('busisiwe.naidoo@ubuntu-clinic.example');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('T-US11-3 / T-BR12-1 after 5 wrong passwords the message shows and the button is disabled', async () => {
    const login = jest.fn(async () => wrong());
    setup(login);
    for (let i = 0; i < 4; i += 1) await tryLogin();
    expect(screen.getByText(WRONG)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(false);
    await tryLogin();
    expect(screen.getByText(LOCKED)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(true);
    expect(login).toHaveBeenCalledTimes(5);
  });

  it('T-BR12-2 after the 60 seconds the button works and the count starts again', async () => {
    const login = jest.fn(async () => wrong());
    setup(login);
    for (let i = 0; i < 5; i += 1) await tryLogin();
    act(() => {
      jest.advanceTimersByTime(59_000);
    });
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(true);
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(false);
    for (let i = 0; i < 4; i += 1) await tryLogin();
    expect(screen.queryByText(LOCKED)).toBeNull();
    await tryLogin();
    expect(screen.getByText(LOCKED)).toBeTruthy();
  });

  it('T-BR12-3 4 wrong passwords then a correct 5th logs in and resets the count', async () => {
    const login = jest
      .fn()
      .mockResolvedValueOnce(wrong())
      .mockResolvedValueOnce(wrong())
      .mockResolvedValueOnce(wrong())
      .mockResolvedValueOnce(wrong())
      .mockResolvedValueOnce({ ok: true, profile: PROFILES.clinical });
    setup(login);
    for (let i = 0; i < 5; i += 1) await tryLogin();
    expect(mockReplace).toHaveBeenCalledWith('/queue');
    expect(screen.queryByText(LOCKED)).toBeNull();
  });

  it('T-AUTH-7 the server lock (a 6th try refused by the API) also disables the button for 60 seconds', async () => {
    setup(jest.fn(async () => ({ ok: false as const, error: 'locked' as const })));
    await tryLogin();
    expect(screen.getByText(LOCKED)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(true);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the server problem message when the API fails', async () => {
    setup(jest.fn(async () => ({ ok: false as const, error: 'server' as const })));
    await tryLogin();
    expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy();
  });

  it('T-BR11-1 shows "Your session has ended. Please log in again." in the error area', () => {
    setup(jest.fn(), { sessionEnded: true });
    expect(screen.getByText('Your session has ended. Please log in again.')).toBeTruthy();
  });

  it('T-AUTH-6 has no Forgot password link, only the text', () => {
    setup(jest.fn());
    expect(screen.getByText('Forgot your password? Ask your Manager to reset it.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /forgot/i })).toBeNull();
  });
});
