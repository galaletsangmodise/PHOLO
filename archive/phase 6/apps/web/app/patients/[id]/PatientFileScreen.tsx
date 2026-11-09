'use client';

import { PATIENT_MESSAGES, formatSastDate, formatSastTime } from '@pholo/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { MESSAGES } from '@/components/messages';
import { OfflineBanner } from '@/components/OfflineBanner';
import type { PatientRecord, PatientVisit } from '@/components/patientsApi';
import { StaffHeader } from '@/components/StaffHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Toast } from '@/components/Toast';
import { focusRing } from '@/components/classes';
import { useOnlineStatus } from '@/components/useOnlineStatus';

export type FileState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; patient: PatientRecord; visits: PatientVisit[] };

interface PatientFileScreenProps {
  role: 'Reception' | 'Clinical';
  fullName: string;
  state: FileState;
  /** Forces the Offline state. Left out, the browser's online status decides. */
  offline?: boolean;
  /** Success: "Details saved.", "Patient file created." or "Paper file history saved." */
  toast?: string;
  onToastDone: () => void;
  onBack: () => void;
  onTryAgain: () => void;
  onEdit: () => void;
  /** A placeholder until Phase 9 (M3). */
  onRecordHistory: () => void;
  onLogout: () => void;
}

/** A label and its value. An empty value shows "None" (Section 18, #24). */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div data-testid={`row-${label}`} className="flex flex-wrap justify-between gap-s2">
      <dt className="text-staff-body text-textSecondary">{label}</dt>
      <dd className="text-staff-body font-bold text-text">{value && value !== '' ? value : 'None'}</dd>
    </div>
  );
}

const HISTORY_ROWS = [
  ['Chronic conditions', 'chronicConditions'],
  ['Allergies', 'allergies'],
  ['Current medication', 'currentMedication'],
] as const;

/** S8 Patient File: the Patient card, the history from the paper file and the Visits (Reception and Clinical views). */
export function PatientFileScreen({ role, fullName, state, offline, toast, onToastDone, onBack, onTryAgain, onEdit, onRecordHistory, onLogout }: PatientFileScreenProps) {
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;

  const back = (
    <button type="button" onClick={onBack} className={`self-start min-h-touch text-staff-body font-bold text-primary ${focusRing}`}>
      ← Back
    </button>
  );

  let content;
  if (state.kind === 'loading') {
    content = (
      <div className="grid gap-s3 desktop:grid-cols-2">
        <LoadingPlaceholder rows={1} />
        <LoadingPlaceholder rows={2} />
      </div>
    );
  } else if (state.kind === 'error') {
    content = <EmptyState icon="alert-circle" message={PATIENT_MESSAGES.fileNotOpened} actionLabel="Try again" onAction={onTryAgain} />;
  } else {
    const { patient, visits } = state;
    const history = HISTORY_ROWS.filter(([, key]) => (patient[key] ?? '') !== '');
    content = (
      <div className="grid items-start gap-s3 desktop:grid-cols-2">
        <div className="flex flex-col gap-s3">
          <Card className="flex flex-col gap-s2">
            <div className="flex flex-col gap-s1">
              <h1 className="text-staff-title text-text">{`${patient.surname}, ${patient.firstName}`}</h1>
              <p className="text-staff-body text-textSecondary">{`File ${patient.fileNumber}`}</p>
              <div>
                <StatusBadge status={patient.paperFileStatus} />
              </div>
            </div>
            <dl className="flex flex-col gap-s1">
              <Row label="Date of birth" value={formatSastDate(patient.dateOfBirth)} />
              <Row label="ID number" value={patient.idNumber} />
              <Row label="Cellphone number" value={patient.cellphone} />
            </dl>
            <div>
              <Button variant="secondary" onClick={onEdit} disabled={isOffline}>
                Edit details
              </Button>
            </div>
          </Card>
          <Card className="flex flex-col gap-s2">
            <h2 className="text-staff-heading text-text">History from paper file</h2>
            {history.length === 0 ? (
              <p className="text-staff-body text-textSecondary">Nothing recorded yet.</p>
            ) : (
              <dl className="flex flex-col gap-s1">
                {history.map(([label, key]) => (
                  <Row key={key} label={label} value={patient[key]} />
                ))}
              </dl>
            )}
            <div>
              <Button variant="secondary" onClick={onRecordHistory} disabled={isOffline}>
                Record paper file history
              </Button>
            </div>
          </Card>
        </div>
        <section className="flex flex-col gap-s2">
          <h2 className="text-staff-heading text-text">Visits</h2>
          {visits.length === 0 ? (
            <EmptyState icon="calendar" message="No visits yet for this patient." />
          ) : (
            <ul className="flex flex-col gap-s2">
              {visits.map((visit) => (
                <li key={visit.id} data-testid="visit-card">
                  <Card className="flex flex-col gap-s1">
                    <p className="text-staff-body font-bold text-text">{`${formatSastDate(visit.checkinAt)} ${formatSastTime(visit.checkinAt)}`}</p>
                    <p className="text-staff-body text-textSecondary">{`Queue number ${visit.queueNumber}`}</p>
                    <p className="text-staff-body text-text">{visit.reasonCategory}</p>
                    <div className="flex flex-wrap gap-s1">
                      <StatusBadge status={visit.status} />
                      {visit.urgent ? <StatusBadge status="Urgent" /> : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  return (
    <main>
      <StaffHeader role={role} fullName={fullName} activeLink="patients" onLogout={onLogout} />
      <OfflineBanner message={MESSAGES.offlineStaff} offline={isOffline} />
      <div className="mx-auto flex max-w-content-staff flex-col gap-s2 p-s3">
        {back}
        {content}
      </div>
      {toast ? <Toast message={toast} onDismiss={onToastDone} /> : null}
    </main>
  );
}
