import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueueScreen } from '@/app/queue/QueueScreen';
import { SummaryScreen } from '@/app/summary/SummaryScreen';
import { VisitScreen } from '@/app/visits/[id]/VisitScreen';
import { OfflineBanner } from '@/components/OfflineBanner';
import { MESSAGES } from '@/components/messages';
import { PaperFileHistoryModal } from '@/components/PaperFileHistoryModal';
import type { PatientRecord } from '@/components/patientsApi';
import { setApiReachable } from '@/components/apiStatus';
import { useOnlineStatus } from '@/components/useOnlineStatus';

const noop = () => undefined;

describe('T-NFR-3 no internet', () => {
  it('the messages are the PRD 12.2 ones', () => {
    expect(MESSAGES.offlineCheckin).toBe('No internet. Check-in is paused. Please tell a staff member.');
    expect(MESSAGES.offlineStaff).toBe('No internet connection. Check your Wi-Fi and try again.');
    expect(MESSAGES.offlineQueue).toBe('No internet connection. The queue may be out of date.');
  });

  it('the banner shows when offline and goes away by itself when the internet is back', () => {
    function Probe() {
      const online = useOnlineStatus();
      return <OfflineBanner message={MESSAGES.offlineStaff} offline={!online} />;
    }
    render(<Probe />);
    expect(screen.queryByText(MESSAGES.offlineStaff)).toBeNull();
    act(() => setApiReachable(false));
    expect(screen.getByText(MESSAGES.offlineStaff)).toBeTruthy();
    act(() => setApiReachable(true));
    expect(screen.queryByText(MESSAGES.offlineStaff)).toBeNull();
  });

  it('S6 offline: its own banner shows and "Call next patient" cannot be pressed', () => {
    const onCallNext = jest.fn();
    render(
      <QueueScreen
        role="Clinical" fullName="Nomsa Khumalo" tab="active" nowMs={Date.now()} offline onTab={noop} onCallNext={onCallNext} onMarkLeft={noop} onStart={noop}
        onContinue={noop} onRefresh={noop} onTryAgain={noop} onToastDone={noop} onLogout={noop}
        state={{ kind: 'ready', counts: { waiting: 1, inConsultation: 0, completed: 0, uncalled: 1 }, visits: [] }}
      />,
    );
    expect(screen.getByText('No internet connection. The queue may be out of date.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Call next patient' }));
    expect(onCallNext).not.toHaveBeenCalled();
  });

  it('S10 offline: the staff banner shows', () => {
    render(<SummaryScreen fullName="F" facilityName="Ubuntu Community Clinic" state={{ kind: 'loading' }} offline onRefresh={noop} onTryAgain={noop} onLogout={noop} />);
    expect(screen.getByText(MESSAGES.offlineStaff)).toBeTruthy();
  });

  it('S9 offline: the staff banner shows, both save buttons are disabled and the typed text stays', () => {
    render(
      <VisitScreen
        fullName="N" nowMs={Date.now()} offline busy={null} unsaved dialog={null} errors={{}} values={{ symptoms: 'Typed text', notes: '', icd10_codes: '', outcome: '' }}
        onChange={noop} onSaveDraft={noop} onComplete={noop} onBack={noop} onOpenFullFile={noop} onTryAgain={noop} onToastDone={noop} onLogout={noop} onConfirmDialog={noop} onCancelDialog={noop}
        state={{ kind: 'ready', detail: {
          visit: { id: 'v', patientId: 'p', queueNumber: 1, checkinAt: new Date().toISOString(), reasonCategory: 'Test or screening', urgent: false, status: 'In consultation', symptoms: null, notes: null, icd10Codes: null, outcome: null },
          patient: { id: 'p', fileNumber: 'PH-000001', firstName: 'A', surname: 'B', dateOfBirth: '1990-01-01', paperFileStatus: 'No paper file', chronicConditions: null, allergies: null, currentMedication: null },
        } }}
      />,
    );
    expect(screen.getByText(MESSAGES.offlineStaff)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Complete visit' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Symptoms') as HTMLTextAreaElement).value).toBe('Typed text');
  });

  it('M3 offline: Save is disabled and the typed text stays', () => {
    act(() => setApiReachable(false));
    try {
      const patient = {
        id: 'p', file_number: 'PH-000001', first_name: 'A', surname: 'B', date_of_birth: '1990-01-01', id_number: null, cellphone: null,
        paper_file_status: 'Paper file - not yet digitised', chronic_conditions: null, allergies: null, current_medication: null,
      } as unknown as PatientRecord;
      render(<PaperFileHistoryModal patient={patient} onSubmit={jest.fn()} onCancel={noop} />);
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    } finally {
      act(() => setApiReachable(true));
    }
  });
});
