import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import VisitPage from '@/app/visits/[id]/page';
import { VisitScreen } from '@/app/visits/[id]/VisitScreen';
import { ApiError } from '@/components/api';
import { setApiReachable } from '@/components/apiStatus';
import { takeFlash } from '@/components/flash';
import * as visitsApi from '@/components/visitsApi';
import type { VisitDetail } from '@/components/visitsApi';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParams = { id: 'v-2' };
jest.mock('next/navigation', () => ({
  usePathname: () => '/visits/v-2',
  useRouter: () => mockRouter,
  useParams: () => mockParams,
}));
jest.mock('@/components/visitsApi');
const api = visitsApi as jest.Mocked<typeof visitsApi>;

// 27 Oct 2026, 08:00 UTC is 10:00 in SAST.
const NOW = Date.parse('2026-10-27T08:00:00Z');

/** PRD 8.2 S9 sample content (1): Sipho Nkosi, 40 yrs, File PH-000002, Queue number 2. */
const SIPHO: VisitDetail = {
  visit: {
    id: 'v-2', patientId: 'p-2', queueNumber: 2, checkinAt: '2026-10-27T05:12:00Z', reasonCategory: 'Feeling sick or injured', urgent: false,
    status: 'In consultation', symptoms: null, notes: null, icd10Codes: null, outcome: null,
  },
  patient: {
    id: 'p-2', fileNumber: 'PH-000002', firstName: 'Sipho', surname: 'Nkosi', dateOfBirth: '1986-03-02', paperFileStatus: 'No paper file',
    chronicConditions: null, allergies: null, currentMedication: null,
  },
};
const withVisit = (changes: Partial<VisitDetail['visit']>, patient: Partial<VisitDetail['patient']> = {}): VisitDetail => ({
  visit: { ...SIPHO.visit, ...changes },
  patient: { ...SIPHO.patient, ...patient },
});
const EMPTY = { symptoms: '', notes: '', icd10_codes: '', outcome: '' };
const FILLED = { symptoms: 'Cough for 5 days, fever at night.', notes: 'Temperature 38.2. Chest clear. Advised fluids and rest.', icd10_codes: 'J06.9', outcome: 'Treated and sent home' };

const noop = () => undefined;
type ScreenProps = React.ComponentProps<typeof VisitScreen>;
const showScreen = (props: Partial<ScreenProps> = {}) =>
  render(
    <VisitScreen
      fullName="Nomsa Khumalo"
      state={{ kind: 'ready', detail: SIPHO }}
      values={EMPTY}
      errors={{}}
      nowMs={NOW}
      offline={false}
      busy={null}
      unsaved={false}
      dialog={null}
      onChange={noop}
      onSaveDraft={noop}
      onComplete={noop}
      onBack={noop}
      onOpenFullFile={noop}
      onTryAgain={noop}
      onToastDone={noop}
      onLogout={noop}
      onConfirmDialog={noop}
      onCancelDialog={noop}
      {...props}
    />,
  );

describe('S9 Visit: the screen', () => {
  it('T-S9-1 Normal: Staff Header, "← Back to queue", the Patient strip, the reason and no Urgent badge', () => {
    showScreen();
    expect(screen.getByText('Nomsa Khumalo')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Queue' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: '← Back to queue' })).toBeTruthy();
    expect(screen.getByText('Nkosi, Sipho · 40 yrs · File PH-000002 · Queue number 2')).toBeTruthy();
    expect(screen.getByText('Reason at Check-in: Feeling sick or injured')).toBeTruthy();
    expect(screen.queryByText('Urgent')).toBeNull();
    expect(screen.queryByText('From the paper file')).toBeNull();
  });

  it('T-S9-1 an urgent Visit shows the "Urgent" badge', () => {
    showScreen({ state: { kind: 'ready', detail: withVisit({ urgent: true }) } });
    expect(screen.getByText('Urgent')).toBeTruthy();
  });

  it('T-S9-1 the block "From the paper file" shows the allergies and chronic conditions when history exists', () => {
    showScreen({ state: { kind: 'ready', detail: withVisit({}, { allergies: 'Penicillin', chronicConditions: 'Asthma' }) } });
    const block = within(screen.getByText('From the paper file').closest('section') as HTMLElement);
    expect(block.getByText(/Penicillin/)).toBeTruthy();
    expect(block.getByText(/Asthma/)).toBeTruthy();
  });

  it('T-S9-2 the fields with their placeholders, the 5 outcomes, and the three actions', () => {
    showScreen();
    expect((screen.getByLabelText('Symptoms') as HTMLTextAreaElement).placeholder).toBe('What the patient told you, for example cough for 5 days');
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).placeholder).toBe('Findings, treatment given, advice');
    expect((screen.getByLabelText('ICD-10 codes') as HTMLInputElement).placeholder).toBe('For example J06.9, R50.9');
    const outcome = screen.getByLabelText('Outcome') as HTMLSelectElement;
    expect(within(outcome).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose an outcome', 'Treated and sent home', 'Medication given', 'Referred to hospital', 'Follow-up needed', 'Other',
    ]);
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Complete visit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open full file' })).toBeTruthy();
  });

  it('T-S9-2 the saved draft is shown in the fields', () => {
    showScreen({ values: FILLED });
    expect((screen.getByLabelText('Symptoms') as HTMLTextAreaElement).value).toBe(FILLED.symptoms);
    expect((screen.getByLabelText('Outcome') as HTMLSelectElement).value).toBe('Treated and sent home');
  });

  it('typing and choosing call onChange with the field', () => {
    const onChange = jest.fn();
    showScreen({ onChange });
    fireEvent.change(screen.getByLabelText('Symptoms'), { target: { value: 'Cough' } });
    fireEvent.change(screen.getByLabelText('Outcome'), { target: { value: 'Other' } });
    expect(onChange).toHaveBeenCalledWith('symptoms', 'Cough');
    expect(onChange).toHaveBeenCalledWith('outcome', 'Other');
  });

  it('T-S9-3 each field fault shows its exact message under its field', () => {
    showScreen({
      errors: {
        symptoms: "Please write the patient's symptoms before completing the visit.",
        notes: 'Notes can be at most 2000 characters.',
        icd10_codes: 'Use codes like J06.9, separated by commas. Maximum 5 codes.',
        outcome: 'Please choose an outcome.',
      },
    });
    for (const message of [
      "Please write the patient's symptoms before completing the visit.", 'Notes can be at most 2000 characters.',
      'Use codes like J06.9, separated by commas. Maximum 5 codes.', 'Please choose an outcome.',
    ]) expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByLabelText('Symptoms').getAttribute('aria-invalid')).toBe('true');
  });

  it('the buttons call their handlers', () => {
    const [onSaveDraft, onComplete, onBack, onOpenFullFile] = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
    showScreen({ onSaveDraft, onComplete, onBack, onOpenFullFile });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    fireEvent.click(screen.getByRole('button', { name: '← Back to queue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open full file' }));
    for (const handler of [onSaveDraft, onComplete, onBack, onOpenFullFile]) expect(handler).toHaveBeenCalledTimes(1);
  });

  it('T-S9-5 the dialog "complete" is M4 "Complete this visit?" with "Yes, complete visit" and "Cancel"', () => {
    const [onConfirmDialog, onCancelDialog] = [jest.fn(), jest.fn()];
    showScreen({ dialog: 'complete', onConfirmDialog, onCancelDialog });
    expect(screen.getByText('Complete this visit?')).toBeTruthy();
    expect(screen.getByText('You cannot change it afterwards.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, complete visit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirmDialog).toHaveBeenCalledTimes(1);
    expect(onCancelDialog).toHaveBeenCalledTimes(1);
  });

  it('T-S9-6 the dialog "leave" is M4 "Leave without saving?" with "Leave without saving" and "Stay here"', () => {
    showScreen({ dialog: 'leave' });
    expect(screen.getByText('Leave without saving?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave without saving' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stay here' })).toBeTruthy();
  });

  it('T-S9-7 Loading: grey placeholder blocks for the strip and the form, and no fields yet', () => {
    showScreen({ state: { kind: 'loading' } });
    expect(screen.getAllByTestId('placeholder-block').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByLabelText('Symptoms')).toBeNull();
  });

  it('a Visit that cannot be loaded shows the message with "Try again"', () => {
    const onTryAgain = jest.fn();
    showScreen({ state: { kind: 'error' }, onTryAgain });
    expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onTryAgain).toHaveBeenCalled();
  });

  it('T-S9-8 Error: red text above the buttons and the typed text stays', () => {
    showScreen({ values: FILLED, formError: 'Something went wrong on our side. Please try again.' });
    const message = screen.getByText('Something went wrong on our side. Please try again.');
    const save = screen.getByRole('button', { name: 'Save draft' });
    expect(message.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((screen.getByLabelText('Symptoms') as HTMLTextAreaElement).value).toBe(FILLED.symptoms);
  });

  it('T-S9-9, T-US10-2 Offline: the banner shows, both buttons are disabled and the typed text stays', () => {
    showScreen({ values: FILLED, offline: true });
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Complete visit' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Symptoms') as HTMLTextAreaElement).value).toBe(FILLED.symptoms);
  });

  it('while saving, the button that was tapped is disabled', () => {
    showScreen({ busy: 'draft' });
    expect((screen.getByRole('button', { name: /Save draft|Saving/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a toast shows its message', () => {
    showScreen({ toast: 'Draft saved.' });
    expect(screen.getByText('Draft saved.')).toBeTruthy();
  });
});

describe('S9 Visit: the page (OP14, OP15, OP16)', () => {
  const show = (role: keyof typeof PROFILES = 'clinical', session = fakeSession({ status: 'in', profile: PROFILES[role] })) => {
    render(
      <WithSession value={session}>
        <VisitPage />
      </WithSession>,
    );
    return session;
  };
  const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
  const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
  const fillForm = () => {
    type('Symptoms', FILLED.symptoms);
    type('Notes', FILLED.notes);
    type('ICD-10 codes', FILLED.icd10_codes);
    type('Outcome', FILLED.outcome);
  };
  const ready = async () => {
    show();
    await waitFor(() => screen.getByLabelText('Symptoms'));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    takeFlash();
    setApiReachable(true);
    api.getVisit.mockResolvedValue(SIPHO);
    api.saveDraft.mockResolvedValue(undefined);
    api.completeVisit.mockResolvedValue(undefined);
  });

  it('opens the Visit by the id in the address and shows Loading first', async () => {
    show();
    expect(screen.getAllByTestId('placeholder-block').length).toBeGreaterThanOrEqual(2);
    await waitFor(() => screen.getByLabelText('Symptoms'));
    expect(api.getVisit).toHaveBeenCalledWith('v-2');
  });

  it('only Clinical may open it: other roles see nothing and nothing is asked of the server', () => {
    for (const role of ['reception', 'manager', 'checkin'] as const) {
      const { unmount } = render(
        <WithSession value={fakeSession({ status: 'in', profile: PROFILES[role] })}>
          <VisitPage />
        </WithSession>,
      );
      expect(screen.queryByLabelText('Symptoms')).toBeNull();
      unmount();
    }
    expect(api.getVisit).not.toHaveBeenCalled();
  });

  it('T-S9-11 a Visit that is Waiting or Called goes to S6, with no message', async () => {
    for (const status of ['Waiting', 'Called'] as const) {
      mockRouter.replace.mockClear();
      api.getVisit.mockResolvedValueOnce(withVisit({ status }));
      const { unmount } = render(
        <WithSession value={fakeSession({ status: 'in', profile: PROFILES.clinical })}>
          <VisitPage />
        </WithSession>,
      );
      await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/queue'));
      expect(takeFlash()).toBeUndefined();
      unmount();
    }
  });

  it('T-S9-11, T-BR9-3 a Visit that is Completed or Left goes to S8 of that Patient', async () => {
    for (const status of ['Completed', 'Left'] as const) {
      mockRouter.replace.mockClear();
      api.getVisit.mockResolvedValueOnce(withVisit({ status }));
      const { unmount } = render(
        <WithSession value={fakeSession({ status: 'in', profile: PROFILES.clinical })}>
          <VisitPage />
        </WithSession>,
      );
      await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/patients/p-2'));
      unmount();
    }
  });

  it('T-US10-1 the saved draft fills the fields when the Visit is opened again ("Continue")', async () => {
    api.getVisit.mockResolvedValueOnce(withVisit({ symptoms: FILLED.symptoms, notes: FILLED.notes, icd10Codes: 'J06.9', outcome: 'Treated and sent home' }));
    await ready();
    expect(field('Symptoms').value).toBe(FILLED.symptoms);
    expect(field('ICD-10 codes').value).toBe('J06.9');
    expect(field('Outcome').value).toBe('Treated and sent home');
  });

  it('T-US10-1 "Save draft" saves the typed text, shows "Draft saved." and stays on S9', async () => {
    await ready();
    type('Symptoms', 'Cough');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByText('Draft saved.')).toBeTruthy());
    expect(api.saveDraft).toHaveBeenCalledWith('v-2', { symptoms: 'Cough', notes: '', icd10_codes: '', outcome: '' });
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(field('Symptoms').value).toBe('Cough');
  });

  it('T-S9-4 "Save draft" with every field empty saves without checks', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByText('Draft saved.')).toBeTruthy());
    expect(api.saveDraft).toHaveBeenCalledWith('v-2', EMPTY);
  });

  it('T-US9-2 "Complete visit" with empty symptoms shows the message under the field and M4 does not open', async () => {
    await ready();
    type('Outcome', 'Other');
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    expect(screen.getByText("Please write the patient's symptoms before completing the visit.")).toBeTruthy();
    expect(screen.queryByText('Complete this visit?')).toBeNull();
    expect(api.completeVisit).not.toHaveBeenCalled();
  });

  it('T-US9-3 "J069x" shows the ICD-10 message and M4 does not open', async () => {
    await ready();
    fillForm();
    type('ICD-10 codes', 'J069x');
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    expect(screen.getByText('Use codes like J06.9, separated by commas. Maximum 5 codes.')).toBeTruthy();
    expect(screen.queryByText('Complete this visit?')).toBeNull();
  });

  it('T-S9-3 notes over 2000 characters and a missing outcome show their messages', async () => {
    await ready();
    type('Symptoms', 'Cough');
    type('Notes', 'n'.repeat(2001));
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    expect(screen.getByText('Notes can be at most 2000 characters.')).toBeTruthy();
    expect(screen.getByText('Please choose an outcome.')).toBeTruthy();
  });

  it('T-S9-5 "Complete visit" with valid fields opens M4; "Cancel" returns to S9 and nothing is completed', async () => {
    await ready();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    expect(screen.getByText('Complete this visit?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Complete this visit?')).toBeNull();
    expect(api.completeVisit).not.toHaveBeenCalled();
    expect(field('Symptoms').value).toBe(FILLED.symptoms);
  });

  it('T-US9-1, T-M4-8 "Yes, complete visit" completes the Visit and goes to S6 with the toast "Visit completed."', async () => {
    await ready();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, complete visit' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/queue'));
    expect(api.completeVisit).toHaveBeenCalledWith('v-2', FILLED);
    expect(takeFlash()).toBe('Visit completed.');
  });

  it('a server problem when completing shows the red text in M4 and keeps the typed text', async () => {
    api.completeVisit.mockRejectedValueOnce(new ApiError(500, 'Something went wrong on our side. Please try again.'));
    await ready();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, complete visit' }));
    await waitFor(() => expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy());
    expect(screen.getByText('Complete this visit?')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(field('Symptoms').value).toBe(FILLED.symptoms);
  });

  it('a field message from the server (the same checks run there) closes M4 and shows under the field', async () => {
    api.completeVisit.mockRejectedValueOnce(new ApiError(400, 'Please choose an outcome.', { field: 'outcome' }));
    await ready();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, complete visit' }));
    await waitFor(() => expect(screen.queryByText('Complete this visit?')).toBeNull());
    expect(screen.getByText('Please choose an outcome.')).toBeTruthy();
  });

  it('T-S9-8 a server problem when saving a draft shows the red text above the buttons and keeps the typed text', async () => {
    api.saveDraft.mockRejectedValueOnce(new ApiError(500, 'Something went wrong on our side. Please try again.'));
    await ready();
    type('Symptoms', 'Cough');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy());
    expect(screen.queryByText('Draft saved.')).toBeNull();
    expect(field('Symptoms').value).toBe('Cough');
  });

  it('T-US10-2, T-S9-9 when the computer goes offline the banner shows, both buttons are disabled and the typed text stays', async () => {
    await ready();
    type('Symptoms', 'Cough');
    act(() => setApiReachable(false));
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Complete visit' }) as HTMLButtonElement).disabled).toBe(true);
    expect(field('Symptoms').value).toBe('Cough');
    expect(api.saveDraft).not.toHaveBeenCalled();
  });

  it('T-S9-6 with no unsaved text "← Back to queue" goes straight to S6', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '← Back to queue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/queue');
    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });

  it('T-S9-6 with unsaved text "← Back to queue" opens M4 first; "Stay here" returns, "Leave without saving" goes to S6', async () => {
    await ready();
    type('Symptoms', 'Cough');
    fireEvent.click(screen.getByRole('button', { name: '← Back to queue' }));
    expect(screen.getByText('Leave without saving?')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
    expect(screen.queryByText('Leave without saving?')).toBeNull();
    expect(field('Symptoms').value).toBe('Cough');

    fireEvent.click(screen.getByRole('button', { name: '← Back to queue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/queue');
  });

  it('text that was saved with "Save draft" is no longer unsaved', async () => {
    await ready();
    type('Symptoms', 'Cough');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => screen.getByText('Draft saved.'));
    fireEvent.click(screen.getByRole('button', { name: '← Back to queue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/queue');
  });

  it('T-S9-6 Log out with unsaved text opens M4 first; "Leave without saving" logs out', async () => {
    const session = show();
    await waitFor(() => screen.getByLabelText('Symptoms'));
    type('Symptoms', 'Cough');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByText('Leave without saving?')).toBeTruthy();
    expect(session.logout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }));
    expect(session.logout).toHaveBeenCalled();
  });

  it('T-S9-10 "Open full file" opens S8 of the Patient', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Open full file' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/patients/p-2');
  });

  it('"Open full file" with unsaved text asks first, and "Leave without saving" then opens S8', async () => {
    await ready();
    type('Notes', 'Findings');
    fireEvent.click(screen.getByRole('button', { name: 'Open full file' }));
    expect(screen.getByText('Leave without saving?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/patients/p-2');
  });

  it('T-EDGE-6 when the session ends while notes are typed, the user is logged out and sent to S1; typed text is not kept', async () => {
    api.saveDraft.mockRejectedValueOnce(new ApiError(401, 'Your session has ended. Please log in again.'));
    const session = show();
    await waitFor(() => screen.getByLabelText('Symptoms'));
    type('Notes', 'Unsaved notes');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/login'));
    expect(session.logout).toHaveBeenCalled();
    expect(takeFlash()).toBeUndefined();
  });

  it('T-EDGE-6 text saved with "Save draft" comes back when the Visit is opened again', async () => {
    await ready();
    type('Symptoms', 'Cough');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => screen.getByText('Draft saved.'));
    expect(api.saveDraft).toHaveBeenCalledWith('v-2', expect.objectContaining({ symptoms: 'Cough' }));
  });

  it('a Visit that was finished by someone else while the page was open shows the server message and keeps the text', async () => {
    api.saveDraft.mockRejectedValueOnce(new ApiError(409, 'This visit can no longer be changed.'));
    await ready();
    type('Symptoms', 'Cough');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByText('This visit can no longer be changed.')).toBeTruthy());
    expect(field('Symptoms').value).toBe('Cough');
  });

  it('"Try again" after a load failure reads the Visit again', async () => {
    api.getVisit.mockRejectedValueOnce(new ApiError(500, 'Something went wrong on our side. Please try again.'));
    show();
    await waitFor(() => screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => screen.getByLabelText('Symptoms'));
    expect(api.getVisit).toHaveBeenCalledTimes(2);
  });
});
