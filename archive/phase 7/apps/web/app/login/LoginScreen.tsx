'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/Button';
import { focusRing } from '@/components/classes';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { MESSAGES } from '@/components/messages';
import { OfflineBanner } from '@/components/OfflineBanner';
import { TextField } from '@/components/TextField';
import { useOnlineStatus } from '@/components/useOnlineStatus';

export type LoginError = 'server' | 'credentials' | 'locked' | 'session';

interface LoginScreenProps {
  /** Loading: the button reads "Logging in..." and is disabled. */
  status?: 'normal' | 'loading';
  error?: LoginError;
  /** Forces the Offline state. Left out, the browser's online status decides. */
  offline?: boolean;
  initialEmail?: string;
  onSubmit: (values: { email: string; password: string }) => void;
  onOpenPrivacy: () => void;
}

const ERROR_TEXT: Record<LoginError, string> = {
  server: MESSAGES.serverProblem,
  credentials: 'Email or password is not correct. Try again.',
  locked: 'Too many tries. Wait 60 seconds and try again.',
  session: MESSAGES.sessionEnded,
};

const EMAIL_MESSAGE = 'Enter your email address, for example name@clinic.co.za';
const PASSWORD_MESSAGE = 'Enter your password.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

/** S1 Log in. The log-in call itself is wired in Phase 3. */
export function LoginScreen({ status = 'normal', error, offline, initialEmail = '', onSubmit, onOpenPrivacy }: LoginScreenProps) {
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();

  const loading = status === 'loading';
  const buttonDisabled = isOffline || error === 'locked';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const emailProblem =
      trimmedEmail.length > 0 && trimmedEmail.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(trimmedEmail)
        ? undefined
        : EMAIL_MESSAGE;
    const passwordProblem = password.length > 0 ? undefined : PASSWORD_MESSAGE;
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    if (emailProblem || passwordProblem) return;
    onSubmit({ email: trimmedEmail, password });
  };

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <OfflineBanner message={MESSAGES.offlineStaff} offline={isOffline} />
      <div className="flex flex-1 items-center justify-center px-s3 py-s4">
        <div className="flex w-full max-w-md flex-col gap-s3 rounded-card border border-borderLight bg-surface p-s4 shadow-card">
          <div className="flex flex-col items-center gap-s1 text-center">
            <Logo />
            <p className="text-staff-body text-textSecondary">Clinic Management System</p>
          </div>

          <h1 className="text-staff-title text-text">Log in</h1>

          <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-s2">
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="name@clinic.co.za"
              error={emailError}
              autoFocus
              autoComplete="username"
              maxLength={EMAIL_MAX_LENGTH}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Your password"
              error={passwordError}
              autoComplete="current-password"
            />

            <div className="min-h-s3">
              {error ? (
                <p role="alert" className="flex items-center gap-s1 text-staff-body text-error">
                  <Icon name="alert-circle" size={20} />
                  <span>{ERROR_TEXT[error]}</span>
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
              loadingLabel="Logging in..."
              disabled={buttonDisabled}
            >
              Log in
            </Button>
          </form>

          <p className="text-center text-staff-body text-textSecondary">
            Forgot your password? Ask your Manager to reset it.
          </p>

          <footer className="flex items-center justify-between text-staff-small text-textSecondary">
            <button
              type="button"
              onClick={onOpenPrivacy}
              className={`min-h-touch px-s1 font-bold text-primary underline ${focusRing}`}
            >
              Privacy Notice
            </button>
            <span>Pholo CMS v0.1</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
