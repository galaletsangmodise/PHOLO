import { fireEvent, render, screen } from '@testing-library/react';
import { LoginScreen } from '@/app/login/LoginScreen';

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
