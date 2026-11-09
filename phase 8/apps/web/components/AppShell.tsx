'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { LoadingPlaceholder } from './LoadingPlaceholder';
import { MESSAGES } from './messages';
import { canOpen, mainScreenFor } from './roles';
import { useSession } from './SessionProvider';
import { Toast } from './Toast';

/** The route guard (plan Section 11): logged-out visitors go to S1; a role goes to its main screen; closed screens show the not-allowed toast. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { status, profile, notAllowed, flagNotAllowed, clearNotAllowed } = useSession();
  const onLogin = pathname === '/login';
  const role = profile?.role;

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'out' || !role) {
      if (!onLogin) router.replace('/login');
      return;
    }
    if (onLogin) {
      router.replace(mainScreenFor(role));
      return;
    }
    if (!canOpen(role, pathname)) {
      flagNotAllowed();
      router.replace(mainScreenFor(role));
    }
  }, [status, role, pathname, onLogin, router, flagNotAllowed]);

  let content: ReactNode = children;
  if (status === 'loading') {
    content = <LoadingPlaceholder className="p-s3" />;
  } else if (status === 'out' || !role) {
    content = onLogin ? children : null;
  } else if (onLogin || !canOpen(role, pathname)) {
    content = null;
  }

  return (
    <>
      {content}
      {notAllowed ? <Toast message={MESSAGES.notAllowed} onDismiss={clearNotAllowed} /> : null}
    </>
  );
}
