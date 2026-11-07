'use client';

import { StaffHeader } from '@/components/StaffHeader';
import { useSession } from '@/components/SessionProvider';
import type { StaffRole } from '@/components/StaffHeader';

/** S6 Queue: an empty shell in Phase 3 (only its title). Replaced by the real screen in Phase 6. */
export default function QueuePage() {
  const { profile, logout } = useSession();
  if (!profile || profile.role === 'Check-in') return null;
  return (
    <main>
      <StaffHeader role={profile.role as StaffRole} fullName={profile.fullName} activeLink="queue" onLogout={logout} />
      <h1 className="p-s3 text-staff-title text-text">Queue</h1>
    </main>
  );
}
