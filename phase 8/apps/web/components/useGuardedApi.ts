'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { ApiError } from './api';
import { useSession } from './SessionProvider';

/** Runs an API call; when the session has ended (401) the user is logged out and sent to S1 (PRD 12.2). */
export function useGuardedApi(): <T>(run: () => Promise<T>) => Promise<T> {
  const router = useRouter();
  const { logout } = useSession();
  return useCallback(
    async <T,>(run: () => Promise<T>): Promise<T> => {
      try {
        return await run();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await logout();
          router.replace('/login');
        }
        throw error;
      }
    },
    [logout, router],
  );
}
