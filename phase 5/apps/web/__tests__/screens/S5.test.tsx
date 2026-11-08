import { act, fireEvent, render, screen } from '@testing-library/react';
import { DoneScreen } from '@/app/checkin/done/DoneScreen';
import type { CheckinResult } from '@/components/CheckinProvider';

const props = { facilityName: 'Ubuntu Community Clinic', dateText: '27 Oct 2026', onDone: jest.fn() };
const show = (result: CheckinResult) => render(<DoneScreen {...props} result={result} />);

const NORMAL: CheckinResult = { queueNumber: 14, alreadyCheckedIn: false, urgent: false, hasFile: false };
const URGENT_TEXT = 'Please tell the Door Assistant or a nurse now. Your number is marked urgent.';

beforeEach(() => jest.clearAllMocks());

describe('S5 You are checked in', () => {
  it('T-S5-1, T-S5-4 shows the green check, the heading, the number at 96 px, the seat text, Done and the timer text', () => {
    show(NORMAL);
    expect(screen.getByTestId('success-icon').className).toContain('text-success');
    expect(screen.getByRole('heading', { name: "You're checked in." })).toBeTruthy();
    expect(screen.getByText('Your number')).toBeTruthy();
    const number = screen.getByTestId('queue-number');
    expect(number.textContent).toBe('14');
    expect(number.className).toContain('text-tablet-queueNumber');
    expect(screen.getByText('Please take a seat. We will call your number.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.getByText('This screen closes in 15 seconds.')).toBeTruthy();
  });

  it('T-S5-2 file answer Yes shows the paper file message; No shows the digital file message', () => {
    const { unmount } = show({ ...NORMAL, hasFile: true });
    expect(screen.getByText('Please keep your paper file with you and give it to the nurse.')).toBeTruthy();
    expect(screen.queryByText(/digital file/)).toBeNull();
    unmount();
    show(NORMAL);
    expect(screen.getByText('We have made a digital file for you. You do not need a paper file.')).toBeTruthy();
    expect(screen.queryByText(/paper file with you/)).toBeNull();
  });

  it('T-US3-1, T-S5-3, T-S5-4 an urgent Visit shows the red card; a normal one does not', () => {
    const { unmount } = show({ ...NORMAL, queueNumber: 4, urgent: true });
    const card = screen.getByText(URGENT_TEXT).closest('[data-testid="card"]') as HTMLElement;
    expect(card.className).toContain('bg-errorBg');
    expect(screen.getByTestId('queue-number').textContent).toBe('4');
    unmount();
    show(NORMAL);
    expect(screen.queryByText(URGENT_TEXT)).toBeNull();
  });

  it('T-BR3-5, T-S5-4 already checked in: the heading, the existing number; no file message and no urgent card', () => {
    show({ queueNumber: 3, alreadyCheckedIn: true, urgent: true, hasFile: true });
    expect(screen.getByRole('heading', { name: 'You are already checked in.' })).toBeTruthy();
    expect(screen.getByTestId('queue-number').textContent).toBe('3');
    expect(screen.queryByText(/paper file/)).toBeNull();
    expect(screen.queryByText(/digital file/)).toBeNull();
    expect(screen.queryByText(URGENT_TEXT)).toBeNull();
  });

  it('T-BR10-4 shows the number only, never a name or a reason', () => {
    show({ ...NORMAL, queueNumber: 14 });
    const text = document.body.textContent ?? '';
    for (const word of ['Thandi', 'Dlamini', 'Test or screening', 'Feeling sick']) expect(text).not.toContain(word);
  });

  it('"Done" and 15 seconds both call onDone', () => {
    jest.useFakeTimers();
    try {
      const { unmount } = show(NORMAL);
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(props.onDone).toHaveBeenCalledTimes(1);
      unmount();
      props.onDone.mockClear();
      show(NORMAL);
      act(() => {
        jest.advanceTimersByTime(14_999);
      });
      expect(props.onDone).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(props.onDone).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
