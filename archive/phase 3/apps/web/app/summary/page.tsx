'use client';

import { StaffHeader } from '@/components/StaffHeader';
import { useSession } from '@/components/SessionProvider';

/** S10 Daily summary: an empty shell in Phase 3 (only its title). Replaced by the real screen in Phase 8. */
export default function SummaryPage() {
  const { profile, logout } = useSession();
  if (!profile || profile.role !== 'Manager') return null;
  return (
    <main>
      <StaffHeader role="Manager" fullName={profile.fullName} activeLink="summary" onLogout={logout} />
      <h1 className="p-s3 text-staff-title text-text">Daily summary</h1>
    </main>
  );
}
