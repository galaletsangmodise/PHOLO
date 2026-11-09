'use client';

import type { ReactNode } from 'react';
import { AppShell } from './AppShell';
import { SessionProvider } from './SessionProvider';

/** The session and the route guard around every screen. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
