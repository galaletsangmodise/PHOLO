'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mainScreenFor } from '@/components/roles';
import { useSession } from '@/components/SessionProvider';
import { LoginScreen, type LoginError } from './LoginScreen';

const MAX_WRONG_PASSWORDS = 5;
const LOCK_MS = 60_000;

/** S1 wired to log in (OP1). The server also keeps the 60-second lock; this one makes the button wait at once (BR12). */
export function LoginContainer() {
  const router = useRouter();
  const { login, sessionEnded } = useSession();
  const [error, setError] = useState<LoginError | undefined>();
  const [loading, setLoading] = useState(false);
  const wrongInARow = useRef(0);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    },
    [],
  );

  const lock = useCallback(() => {
    setError('locked');
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => {
      unlockTimer.current = null;
      wrongInARow.current = 0; // the count starts again after the 60 seconds
      setError(undefined);
    }, LOCK_MS);
  }, []);

  const handleSubmit = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      setLoading(true);
      setError(undefined);
      const result = await login(email, password);
      setLoading(false);
      if (result.ok) {
        wrongInARow.current = 0;
        router.replace(mainScreenFor(result.profile.role));
        return;
      }
      if (result.error === 'credentials') {
        wrongInARow.current += 1;
        if (wrongInARow.current >= MAX_WRONG_PASSWORDS) lock();
        else setError('credentials');
      } else if (result.error === 'locked') {
        lock();
      } else {
        setError('server');
      }
    },
    [login, router, lock],
  );

  const shownError = error ?? (sessionEnded ? 'session' : undefined);
  return (
    <LoginScreen
      status={loading ? 'loading' : 'normal'}
      error={shownError}
      onSubmit={handleSubmit}
      onOpenPrivacy={() => {}}
    />
  );
}
