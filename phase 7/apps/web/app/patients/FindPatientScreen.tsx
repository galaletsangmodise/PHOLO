'use client';

import { useState } from 'react';
import { PATIENT_MESSAGES, SEARCH_MIN_LENGTH, formatAge, formatSastDate, sastIsoDate } from '@pholo/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FieldError } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { MESSAGES } from '@/components/messages';
import { OfflineBanner } from '@/components/OfflineBanner';
import type { PatientSummary } from '@/components/patientsApi';
import { StaffHeader } from '@/components/StaffHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { fieldClasses } from '@/components/classes';
import { useOnlineStatus } from '@/components/useOnlineStatus';

export type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; query: string; patients: PatientSummary[] }
  | { kind: 'error' };

interface FindPatientScreenProps {
  role: 'Reception' | 'Clinical';
  fullName: string;
  state: SearchState;
  /** Forces the Offline state. Left out, the browser's online status decides. */
  offline?: boolean;
  /** Today as "YYYY-MM-DD" (SAST), for the ages. Left out, it is read from the clock. */
  today?: string;
  onSearch: (query: string) => void;
  onTryAgain: () => void;
  onOpen: (patientId: string) => void;
  onNewPatient: () => void;
  onLogout: () => void;
}

/** S7 Find patient. "New patient" is for Reception only (SEC6). */
export function FindPatientScreen({ role, fullName, state, offline, today, onSearch, onTryAgain, onOpen, onNewPatient, onLogout }: FindPatientScreenProps) {
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const reception = role === 'Reception';
  const todayIso = today ?? sastIsoDate(new Date());

  const search = () => {
    const query = text.trim();
    if (query.length < SEARCH_MIN_LENGTH) {
      setFieldError(PATIENT_MESSAGES.searchTooShort);
      return;
    }
    setFieldError(undefined);
    onSearch(query);
  };

  let list;
  if (state.kind === 'loading') {
    list = <LoadingPlaceholder rows={3} />;
  } else if (state.kind === 'error') {
    list = <EmptyState icon="alert-circle" message={PATIENT_MESSAGES.searchFailed} actionLabel="Try again" onAction={onTryAgain} />;
  } else if (state.kind === 'idle') {
    list = <EmptyState icon="search" message="Type a name, ID number or file number to find a patient." />;
  } else if (state.patients.length === 0) {
    list = (
      <EmptyState
        icon="search"
        message={`No patient found for “${state.query}”. Check the spelling${reception ? ' or add a new patient.' : '.'}`}
        actionLabel={reception ? 'New patient' : undefined}
        onAction={onNewPatient}
      />
    );
  } else {
    list = (
      <ul className="flex flex-col gap-s2">
        {state.patients.map((patient) => (
          <li key={patient.id}>
            <Card className="flex flex-wrap items-center justify-between gap-s2">
              <div className="flex flex-col gap-s1">
                <p className="text-staff-heading text-text">{`${patient.surname}, ${patient.firstName}`}</p>
                <p className="text-staff-body text-textSecondary">
                  {`Born ${formatSastDate(patient.dateOfBirth)} (${formatAge(patient.dateOfBirth, todayIso)}) · File ${patient.fileNumber}`}
                </p>
                <p className="text-staff-body text-textSecondary">
                  {patient.idNumberLast4 ? `ID number ending ${patient.idNumberLast4}` : 'No ID number'}
                </p>
              </div>
              <div className="flex items-center gap-s2">
                <StatusBadge status={patient.paperFileStatus} />
                <Button variant="secondary" onClick={() => onOpen(patient.id)}>
                  Open file
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main>
      <StaffHeader role={role} fullName={fullName} activeLink="patients" onLogout={onLogout} />
      <OfflineBanner message={MESSAGES.offlineStaff} offline={isOffline} />
      <div className="mx-auto flex max-w-content-staff flex-col gap-s3 p-s3">
        <div className="flex flex-wrap items-center justify-between gap-s2">
          <h1 className="text-staff-title text-text">Find a patient</h1>
          {reception ? (
            <Button variant="secondary" onClick={onNewPatient}>
              New patient
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-s1">
          <div className="flex items-start gap-s2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-s2 flex items-center text-textSecondary">
                <Icon name="search" size={20} />
              </span>
              <input
                type="text"
                value={text}
                placeholder="Name, ID number or file number"
                aria-label="Name, ID number or file number"
                aria-invalid={fieldError ? true : undefined}
                autoComplete="off"
                onChange={(event) => {
                  setText(event.target.value);
                  setFieldError(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !isOffline) search();
                }}
                className={`${fieldClasses(!!fieldError)} pl-s6`}
              />
            </div>
            <Button onClick={search} disabled={isOffline}>
              Search
            </Button>
          </div>
          {fieldError ? <FieldError message={fieldError} /> : null}
        </div>
        {list}
      </div>
    </main>
  );
}
