'use client';

import Link from 'next/link';
import { formatAge, formatSastDate, formatSastTime, sastIsoDate } from '@pholo/types';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { focusRing } from '@/components/classes';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { MESSAGES } from '@/components/messages';
import { OfflineBanner } from '@/components/OfflineBanner';
import type { QueueCounts, QueueTab, QueueVisit } from '@/components/queueApi';
import { StaffHeader } from '@/components/StaffHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Toast } from '@/components/Toast';
import { useOnlineStatus } from '@/components/useOnlineStatus';

export type QueueState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; visits: QueueVisit[]; counts: QueueCounts };

interface QueueScreenProps {
  role: 'Reception' | 'Clinical';
  fullName: string;
  tab: QueueTab;
  state: QueueState;
  /** The time the list was read, for the ages and "Waited" (milliseconds). */
  nowMs: number;
  /** Forces the Offline state. Left out, the browser and API status decide. */
  offline?: boolean;
  toast?: string;
  /** "Call next patient" is busy while the call is running. */
  calling?: boolean;
  onTab: (tab: QueueTab) => void;
  onCallNext: () => void;
  onMarkLeft: (visit: QueueVisit) => void;
  onStart: (visitId: string) => void;
  onContinue: (visitId: string) => void;
  onRefresh: () => void;
  onTryAgain: () => void;
  onToastDone: () => void;
  onLogout: () => void;
}

const TABS: ReadonlyArray<{ key: QueueTab; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done today' },
];

/** S6 Queue. Reception and Clinical see the same list; the buttons depend on the role (SEC14, SEC15, SEC23). */
export function QueueScreen(props: QueueScreenProps) {
  const { role, fullName, tab, state, nowMs, toast, calling = false, onTab, onCallNext, onMarkLeft, onStart, onContinue, onRefresh, onTryAgain, onToastDone, onLogout } = props;
  const online = useOnlineStatus();
  const isOffline = props.offline ?? !online;
  const now = new Date(nowMs);
  const today = sastIsoDate(now);
  const clinical = role === 'Clinical';
  const nobodyToCall = state.kind === 'ready' && state.counts.uncalled === 0;

  const minutesWaited = (visit: QueueVisit) => Math.max(0, Math.floor((nowMs - Date.parse(visit.checkinAt)) / 60_000));

  const activeRow = (visit: QueueVisit) => {
    const open = visit.status === 'Waiting' || visit.status === 'Called';
    return (
      <>
        <div className="flex flex-wrap items-center gap-s1 tablet:w-72">
          <StatusBadge status={visit.status} />
          {visit.urgent ? <StatusBadge status="Urgent" /> : null}
          {visit.paperFileStatus === 'Paper file - not yet digitised' ? <StatusBadge status="Paper file" /> : null}
          {visit.assisted ? <StatusBadge status="Helped" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-s1 tablet:ml-auto">
          {clinical && visit.status === 'Called' ? <Button onClick={() => onStart(visit.id)}>Start consultation</Button> : null}
          {clinical && visit.status === 'In consultation' ? <Button onClick={() => onContinue(visit.id)}>Continue</Button> : null}
          {open ? (
            <Button variant="secondary" onClick={() => onMarkLeft(visit)}>
              Mark as left
            </Button>
          ) : null}
        </div>
      </>
    );
  };

  const doneRow = (visit: QueueVisit) => (
    <>
      <div className="tablet:w-72">
        <StatusBadge status={visit.status} />
      </div>
      <p className="text-staff-body text-textSecondary tablet:ml-auto">{formatSastTime(visit.completedAt ?? visit.leftAt ?? visit.checkinAt)}</p>
    </>
  );

  let body;
  if (state.kind === 'loading') {
    body = <LoadingPlaceholder rows={5} />;
  } else if (state.kind === 'error') {
    body = <EmptyState icon="alert-circle" message="We could not load the queue. Please try again." actionLabel="Try again" onAction={onTryAgain} />;
  } else if (state.visits.length === 0) {
    body =
      tab === 'active' ? (
        <EmptyState icon="calendar" message="No patients in the queue right now." hint="New check-ins appear here by themselves." actionLabel="Refresh" onAction={onRefresh} />
      ) : (
        <EmptyState icon="calendar" message="No patients finished yet today." />
      );
  } else {
    body = (
      <ul aria-label="Queue" className="flex flex-col gap-s2 tablet:gap-0 tablet:divide-y tablet:divide-borderLight">
        {state.visits.map((visit) => (
          <li
            key={visit.id}
            className="flex flex-col gap-s1 rounded-card border border-borderLight bg-surface p-s2 tablet:flex-row tablet:items-center tablet:gap-s3 tablet:rounded-none tablet:border-0 tablet:px-s2"
          >
            <span data-testid="queue-number" className="w-16 text-staff-title font-bold text-primary">
              {visit.queueNumber}
            </span>
            <div className="flex flex-col gap-s1 tablet:w-80">
              <Link href={`/patients/${visit.patientId}`} className={`text-staff-heading font-bold text-text underline ${focusRing}`}>
                {`${visit.surname}, ${visit.firstName}`}
              </Link>
              <p className="text-staff-body text-textSecondary">
                {tab === 'active' ? `${formatAge(visit.dateOfBirth, today)} · ${visit.reasonCategory}` : visit.reasonCategory}
              </p>
              {tab === 'active' && (visit.status === 'Waiting' || visit.status === 'Called') ? (
                <p className="text-staff-small text-textSecondary">{`Waited ${minutesWaited(visit)} min`}</p>
              ) : null}
            </div>
            {tab === 'active' ? activeRow(visit) : doneRow(visit)}
          </li>
        ))}
      </ul>
    );
  }

  const chips =
    state.kind === 'ready'
      ? [`Waiting ${state.counts.waiting}`, `In consultation ${state.counts.inConsultation}`, `Completed ${state.counts.completed}`]
      : [];

  return (
    <main>
      <StaffHeader role={role} fullName={fullName} activeLink="queue" onLogout={onLogout} />
      <OfflineBanner message={MESSAGES.offlineQueue} offline={isOffline} />
      <div className="mx-auto flex max-w-content-staff flex-col gap-s3 p-s3">
        <div className="flex flex-wrap items-center justify-between gap-s2">
          <div className="flex flex-col gap-s1">
            <h1 className="text-staff-title text-text">Today&apos;s queue</h1>
            <p className="text-staff-body text-textSecondary">{formatSastDate(now)}</p>
          </div>
          {clinical ? (
            <div className="flex items-center gap-s2">
              {nobodyToCall ? <p className="text-staff-body text-textSecondary">No one is waiting.</p> : null}
              <Button disabled={nobodyToCall || state.kind !== 'ready' || calling || isOffline} loading={calling} onClick={onCallNext}>
                Call next patient
              </Button>
            </div>
          ) : null}
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-s1">
            {chips.map((chip) => (
              <span key={chip} className="rounded-badge bg-tint px-s2 py-s1 text-staff-body font-bold text-text">
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        <div role="tablist" aria-label="Queue lists" className="flex gap-s1 border-b border-borderLight">
          {TABS.map(({ key, label }) => {
            const selected = key === tab;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTab(key)}
                className={`min-h-touch border-b-focus px-s3 text-staff-body font-bold text-text ${selected ? 'border-primary' : 'border-transparent'} ${focusRing}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {body}
      </div>
      {toast ? <Toast message={toast} onDismiss={onToastDone} /> : null}
    </main>
  );
}
