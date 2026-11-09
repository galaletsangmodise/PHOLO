import { fireEvent, render, screen } from '@testing-library/react';
import { VisitScreen } from '@/app/checkin/visit/VisitScreen';
import { WithCheckin, THANDI, PALESA } from '../checkinTestUtils';

const props = {
  facilityName: 'Ubuntu Community Clinic',
  dateText: '27 Oct 2026',
  today: '2026-10-27',
  onBack: jest.fn(),
  onSubmit: jest.fn(),
  onOpenPrivacy: jest.fn(),
};

const show = (extra: Partial<Parameters<typeof VisitScreen>[0]> = {}, answers = {}) =>
  render(
    <WithCheckin answers={{ ...THANDI, ...answers }}>
      <VisitScreen {...props} {...extra} />
    </WithCheckin>,
  );
const submit = (name = 'Check in') => fireEvent.click(screen.getByRole('button', { name }));
const choose = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

const REASONS = [
  'Feeling sick or injured',
  'Collecting medication',
  'Baby or child care',
  'Pregnancy or family planning',
  'Test or screening',
  'Something else',
];
const NO_REASON = 'Please choose why you are here today.';
const CHOOSE = 'Please choose Yes or No.';
const TICK = 'Please tick the box to agree to the Privacy Notice to check in.';
const SERVER = 'Something went wrong on our side. Please try again.';
const LIMIT = 'Too many Check-ins at once. Please wait one minute and try again.';

beforeEach(() => jest.clearAllMocks());

describe('S4 Why are you here today?', () => {
  it('T-S4-1 shows the step, the six reasons, the urgent question, the checkbox and the buttons', () => {
    show();
    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why are you here today?' })).toBeTruthy();
    for (const reason of REASONS) expect(screen.getByRole('button', { name: reason })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Do you have any of these right now?' })).toBeTruthy();
    expect(screen.getByText('Trouble breathing, chest pain, heavy bleeding, fainting, a seizure, or a very sick baby.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
    expect(screen.getByLabelText('I agree to the Privacy Notice')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read the Privacy Notice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check in' })).toBeTruthy();
  });

  it('T-S4-2 no reason shows its message and only one reason can be selected', () => {
    show();
    choose('No');
    fireEvent.click(screen.getByLabelText('I agree to the Privacy Notice'));
    submit();
    expect(screen.getByText(NO_REASON)).toBeTruthy();
    expect(props.onSubmit).not.toHaveBeenCalled();

    choose('Test or screening');
    choose('Something else');
    expect(screen.getByRole('button', { name: 'Something else' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Test or screening' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('T-US3-2, T-S4-3 neither Yes nor No shows "Please choose Yes or No." and nothing is saved', () => {
    show();
    choose('Test or screening');
    fireEvent.click(screen.getByLabelText('I agree to the Privacy Notice'));
    submit();
    expect(screen.getByText(CHOOSE)).toBeTruthy();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('T-S4-4 the three field errors show together, each under its own field', () => {
    show();
    submit();
    const reasonError = screen.getByText(NO_REASON);
    const urgentError = screen.getByText(CHOOSE);
    const consentError = screen.getByText(TICK);
    const reasonSection = screen.getByTestId('reason-section');
    const urgentSection = screen.getByTestId('urgent-section');
    const consentSection = screen.getByTestId('consent-section');
    expect(reasonSection.contains(reasonError)).toBe(true);
    expect(urgentSection.contains(urgentError)).toBe(true);
    expect(consentSection.contains(consentError)).toBe(true);
    expect(reasonSection.contains(urgentError)).toBe(false);
  });

  it('T-BR17-3 the box starts unticked; with no tick the message shows; an adult sees no under-18 text', () => {
    show();
    expect((screen.getByLabelText('I agree to the Privacy Notice') as HTMLInputElement).checked).toBe(false);
    choose('Test or screening');
    choose('No');
    submit();
    expect(screen.getByText(TICK)).toBeTruthy();
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText('The patient is under 18, so a parent or guardian must tick this box.')).toBeNull();
  });

  it('T-BR17-3 for a date of birth under 18 the parent or guardian text shows', () => {
    show({}, PALESA);
    expect(screen.getByText('The patient is under 18, so a parent or guardian must tick this box.')).toBeTruthy();
  });

  it('T-BR17-3 turns 18 today: no under-18 text; the day before: text shows', () => {
    const { unmount } = show({}, { day: '27', month: '10', year: '2008' });
    expect(screen.queryByText(/under 18/)).toBeNull();
    unmount();
    show({}, { day: '28', month: '10', year: '2008' });
    expect(screen.getByText(/under 18/)).toBeTruthy();
  });

  it('submits when everything is answered', () => {
    show();
    choose('Test or screening');
    choose('No');
    fireEvent.click(screen.getByLabelText('I agree to the Privacy Notice'));
    submit();
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('T-S4-5 loading: the button reads "Checking you in..." and is disabled', () => {
    show({ loading: true });
    const button = screen.getByRole('button', { name: 'Checking you in...' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('T-S4-6 a server problem shows its message and the button reads "Try again"', () => {
    show({ error: SERVER });
    expect(screen.getByText(SERVER)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('T-BR14-5 the Too many Check-ins message shows and the user stays on S4', () => {
    show({ error: LIMIT });
    expect(screen.getByText(LIMIT)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why are you here today?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check in' })).toBeTruthy();
  });

  it('T-S4-7 offline: the banner shows and "Check in" is disabled', () => {
    show({ offline: true });
    expect(screen.getByText('No internet. Check-in is paused. Please tell a staff member.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Check in' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('T-S4-8 "Back" goes back and the answers stay', () => {
    show();
    choose('Test or screening');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Test or screening' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('T-S4-9 "Read the Privacy Notice" opens M1', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Read the Privacy Notice' }));
    expect(props.onOpenPrivacy).toHaveBeenCalledTimes(1);
  });
});
