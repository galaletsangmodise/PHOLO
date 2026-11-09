'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { type NewPatientInput } from '@pholo/types';
import { setFlash } from '@/components/flash';
import { PatientDetailsModal } from '@/components/PatientDetailsModal';
import { createPatient, searchPatients } from '@/components/patientsApi';
import { useSession } from '@/components/SessionProvider';
import { useGuardedApi } from '@/components/useGuardedApi';
import { FindPatientScreen, type SearchState } from './FindPatientScreen';

/** S7 Find patient wired to OP9 (search) and OP11 (create, through M2). */
export default function FindPatientPage() {
  const router = useRouter();
  const { profile, logout } = useSession();
  const guarded = useGuardedApi();
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const [creating, setCreating] = useState(false);
  const lastQuery = useRef('');
  const latest = useRef(0);

  const search = useCallback(
    async (query: string) => {
      lastQuery.current = query;
      latest.current += 1;
      const mine = latest.current;
      setState({ kind: 'loading' });
      try {
        const patients = await guarded(() => searchPatients(query));
        if (mine === latest.current) setState({ kind: 'results', query, patients });
      } catch {
        if (mine === latest.current) setState({ kind: 'error' });
      }
    },
    [guarded],
  );

  if (!profile || (profile.role !== 'Reception' && profile.role !== 'Clinical')) return null;

  const create = async (body: NewPatientInput) => {
    const patient = await guarded(() => createPatient(body));
    setFlash('Patient file created.');
    router.push(`/patients/${patient.id}`);
  };

  return (
    <>
      <FindPatientScreen
        role={profile.role}
        fullName={profile.fullName}
        state={state}
        onSearch={search}
        onTryAgain={() => search(lastQuery.current)}
        onOpen={(id) => router.push(`/patients/${id}`)}
        onNewPatient={() => setCreating(true)}
        onLogout={logout}
      />
      {creating && profile.role === 'Reception' ? (
        <PatientDetailsModal
          mode="create"
          onSubmit={(body) => create(body as NewPatientInput)}
          onCancel={() => setCreating(false)}
          onOpenExisting={(id) => router.push(`/patients/${id}`)}
        />
      ) : null}
    </>
  );
}
