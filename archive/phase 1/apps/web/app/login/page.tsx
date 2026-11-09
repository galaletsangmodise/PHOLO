'use client';

import { LoginScreen } from './LoginScreen';

/**
 * S1 Log in. In Phase 1 the screen is built with all its states; the log-in call (OP1)
 * and the Privacy Notice (M1) are wired in Phases 3 and 4.
 */
export default function LoginPage() {
  return <LoginScreen onSubmit={() => {}} onOpenPrivacy={() => {}} />;
}
