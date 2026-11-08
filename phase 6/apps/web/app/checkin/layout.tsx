import type { ReactNode } from 'react';
import { CheckinProvider } from '@/components/CheckinProvider';

/** S2 to S5 share one set of answers. They live in memory only, so a reload erases them (BR10). */
export default function CheckinLayout({ children }: { children: ReactNode }) {
  return <CheckinProvider>{children}</CheckinProvider>;
}
