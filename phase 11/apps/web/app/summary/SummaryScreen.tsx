'use client';

import { SUMMARY_MESSAGES, formatSastDate, formatSastTime } from '@pholo/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { MESSAGES } from '@/components/messages';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StaffHeader } from '@/components/StaffHeader';
import type { Summary } from '@/components/summaryApi';
import { useOnlineStatus } from '@/components/useOnlineStatus';

export type SummaryState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; summary: Summary; updatedAtMs: number };

interface SummaryScreenProps {
  fullName: string;
  facilityName: string;
  state: SummaryState;
  /** Forces the Offline state. Left out, the browser and API status decide. */
  offline?: boolean;
  onRefresh: () => void;
  onTryAgain: () => void;
  onLogout: () => void;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div data-testid="stat-card">
      <Card className="flex flex-col gap-s1">
        <p className="text-staff-body text-textSecondary">{label}</p>
        <p className="text-staff-title font-bold text-text">{value}</p>
      </Card>
    </div>
  );
}

/** S10 Daily summary (Manager only): today's numbers, the average waiting time and the reasons. No Patient name appears (SEC12, SEC22). */
export function SummaryScreen({ fullName, facilityName, state, offline, onRefresh, onTryAgain, onLogout }: SummaryScreenProps) {
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;

  let content;
  if (state.kind === 'loading') {
    content = (
      <div role="status" aria-busy="true" aria-label="Loading" className="grid gap-s2 tablet:grid-cols-2 desktop:grid-cols-4">
        {Array.from({ length: 7 }, (_, index) => (
          <LoadingPlaceholder key={index} rows={1} />
        ))}
      </div>
    );
  } else if (state.kind === 'error') {
    content = <EmptyState icon="alert-circle" message={SUMMARY_MESSAGES.loadFailed} actionLabel="Try again" onAction={onTryAgain} />;
  } else if (state.summary.checkedIn === 0) {
    content = <EmptyState icon="calendar" message={SUMMARY_MESSAGES.noCheckins} />;
  } else {
    const { summary } = state;
    content = (
      <>
        <div className="grid gap-s2 tablet:grid-cols-2 desktop:grid-cols-4">
          <StatCard label="Checked in" value={String(summary.checkedIn)} />
          <StatCard label="Completed" value={String(summary.completed)} />
          <StatCard label="Still waiting" value={String(summary.stillWaiting)} />
          <StatCard label="Left before being seen" value={String(summary.left)} />
          <StatCard label="Average waiting time" value={summary.averageWaitMinutes === null ? '—' : `${summary.averageWaitMinutes} min`} />
          <StatCard label="Waited over 3 hours" value={String(summary.waitedOver3Hours)} />
          <StatCard label="Helped by the Door Assistant" value={String(summary.helpedByDoorAssistant)} />
        </div>
        <Card className="flex flex-col gap-s2">
          <h2 className="text-staff-heading text-text">Reasons for visit today</h2>
          <table className="w-full text-staff-body text-text">
            <thead className="text-left text-textSecondary">
              <tr>
                <th scope="col" className="py-s1 font-normal">Reason</th>
                <th scope="col" className="py-s1 text-right font-normal">Patients</th>
              </tr>
            </thead>
            <tbody>
              {summary.reasons.map(({ reason, count }) => (
                <tr key={reason} className="border-t border-borderLight">
                  <td className="py-s1">{reason}</td>
                  <td className="py-s1 text-right font-bold">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </>
    );
  }

  return (
    <main>
      <StaffHeader role="Manager" fullName={fullName} activeLink="summary" onLogout={onLogout} />
      <OfflineBanner message={MESSAGES.offlineStaff} offline={isOffline} />
      <div className="mx-auto flex max-w-content-staff flex-col gap-s3 p-s3">
        <div className="flex flex-col gap-s1">
          <h1 className="text-staff-title text-text">{`Today at ${facilityName}`}</h1>
          <p className="text-staff-body text-textSecondary">{formatSastDate(state.kind === 'ready' ? state.updatedAtMs : Date.now())}</p>
        </div>
        {content}
        {state.kind === 'ready' ? (
          <div className="flex flex-wrap items-center gap-s2">
            <p className="text-staff-body text-textSecondary">{`Updated at ${formatSastTime(state.updatedAtMs)}`}</p>
            <Button variant="secondary" onClick={onRefresh}>
              Refresh
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
