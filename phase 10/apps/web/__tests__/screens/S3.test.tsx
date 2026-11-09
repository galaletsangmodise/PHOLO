import { fireEvent, render, screen } from '@testing-library/react';
import { DetailsScreen } from '@/app/checkin/details/DetailsScreen';
import { WithCheckin, THANDI, fillDetails, typeInto } from '../checkinTestUtils';

const props = {
  facilityName: 'Ubuntu Community Clinic',
  dateText: '27 Oct 2026',
  today: '2026-10-27',
  onBack: jest.fn(),
  onNext: jest.fn(),
  onOpenPrivacy: jest.fn(),
};

const show = (extra: Partial<Parameters<typeof DetailsScreen>[0]> = {}, answers = {}, started = true) =>
  render(
    <WithCheckin answers={answers} started={started}>
      <DetailsScreen {...props} {...extra} />
    </WithCheckin>,
  );
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));

const FIRST = 'Please enter your first name.';
const SURNAME = 'Please enter your surname.';
const DOB = 'Please enter a real date of birth, for example 14 / 08 / 1997.';
const ID = 'This ID number does not look right. Check it, or leave it empty if you do not have one.';
const PHONE = 'Enter a South African cellphone number, for example 082 555 0147, or leave it empty.';
const CHOOSE = 'Please choose Yes or No.';

beforeEach(() => jest.clearAllMocks());

describe('S3 Your details', () => {
  it('T-S3-1, T-S3-10 shows the step, the heading, the five fields, the file question and the buttons', () => {
    show();
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeTruthy();
    expect((screen.getByLabelText('First name') as HTMLInputElement).placeholder).toBe('For example Thandi');
    expect((screen.getByLabelText('Surname') as HTMLInputElement).placeholder).toBe('For example Dlamini');
    expect((screen.getByLabelText('Day') as HTMLInputElement).placeholder).toBe('DD');
    expect((screen.getByLabelText('Month') as HTMLInputElement).placeholder).toBe('MM');
    expect((screen.getByLabelText('Year') as HTMLInputElement).placeholder).toBe('YYYY');
    expect(screen.getByText('Date of birth')).toBeTruthy();
    expect((screen.getByLabelText(/ID number/) as HTMLInputElement).placeholder).toBe('13 digits, if you have one');
    expect((screen.getByLabelText(/Cellphone number/) as HTMLInputElement).placeholder).toBe('For example 082 555 0147');
    expect(screen.getByText('Do you have a file at this clinic?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes, I have a file' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No, I do not have a file' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Privacy Notice' })).toBeTruthy();
  });

  it('T-US1-2 an empty Surname shows its message under the field, keeps the other answers and stays', () => {
    show({}, { ...THANDI, surname: '' });
    next();
    expect(screen.getByText(SURNAME)).toBeTruthy();
    expect(props.onNext).not.toHaveBeenCalled();
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Thandi');
    expect((screen.getByLabelText(/Cellphone number/) as HTMLInputElement).value).toBe('082 555 0147');
  });

  it.each([['', 'empty'], ['a'.repeat(41), 'over 40 characters'], ['Thandi1', 'digits'], ['Tha@ndi', 'symbols']])(
    'T-S3-2, T-S3-3 First name and Surname "%s" (%s) show their messages',
    (value) => {
      show({}, { ...THANDI, firstName: value, surname: value });
      next();
      expect(screen.getByText(FIRST)).toBeTruthy();
      expect(screen.getByText(SURNAME)).toBeTruthy();
    },
  );

  it('T-S3-2 accepts hyphens, apostrophes and spaces', () => {
    show({}, { ...THANDI, firstName: "Mary-Anne O'Neil" });
    next();
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['31', '02', '1997', 'not a real date'],
    ['01', '01', '2027', 'in the future'],
    ['31', '12', '1899', 'before 1 Jan 1900'],
    ['', '', '', 'empty'],
    ['ab', '08', '1997', 'letters'],
  ])('T-S3-4 date of birth %s/%s/%s (%s) shows the date message', (day, month, year) => {
    show({}, { ...THANDI, day, month, year, idNumber: '' });
    next();
    expect(screen.getByText(DOB)).toBeTruthy();
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('T-S3-5, T-EDGE-7 a wrong ID number shows the ID message and keeps the other answers; an empty one is accepted', () => {
    show({}, { ...THANDI, idNumber: '9708140234089' });
    next();
    expect(screen.getByText(ID)).toBeTruthy();
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Thandi');
    typeInto(/ID number/, '');
    next();
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it('T-S3-5 an ID number that does not match the date of birth is refused', () => {
    show({}, { ...THANDI, day: '15' });
    next();
    expect(screen.getByText(ID)).toBeTruthy();
  });

  it('T-S3-6 a wrong cellphone number shows its message; empty and 082 555 0147 are accepted', () => {
    show({}, { ...THANDI, cellphone: '08255501' });
    next();
    expect(screen.getByText(PHONE)).toBeTruthy();
    typeInto(/Cellphone number/, '');
    next();
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it('T-S3-7 no file choice shows "Please choose Yes or No."', () => {
    show({}, { ...THANDI, hasFile: null });
    next();
    expect(screen.getByText(CHOOSE)).toBeTruthy();
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('T-S3-8 "Next" with valid answers goes on; "Back" goes back', () => {
    show();
    fillDetails(THANDI);
    next();
    expect(props.onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('T-S3-9 the Door Assistant block shows only when assisted', () => {
    const { unmount } = show({}, { assisted: true });
    expect(screen.getByText('The Door Assistant will help you.')).toBeTruthy();
    unmount();
    show({}, { assisted: false });
    expect(screen.queryByText('The Door Assistant will help you.')).toBeNull();
  });

  it('T-S3-10 offline: the amber banner shows and "Next" is disabled', () => {
    show({ offline: true }, THANDI);
    const banner = screen.getByText('No internet. Check-in is paused. Please tell a staff member.').closest('[role="status"]') as HTMLElement;
    expect(banner.className).toContain('bg-warningBg');
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens the Privacy Notice', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Privacy Notice' }));
    expect(props.onOpenPrivacy).toHaveBeenCalledTimes(1);
  });
});
