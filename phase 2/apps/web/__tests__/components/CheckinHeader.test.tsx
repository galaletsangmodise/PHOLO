import { act, fireEvent, render, screen } from '@testing-library/react';
import { CheckinHeader } from '@/components/CheckinHeader';

describe('Check-in Header', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('T-C-2 shows the logo, the facility name and the date and time, with no menu', () => {
    render(<CheckinHeader facilityName="Ubuntu Community Clinic" dateTimeText="Tue 27 Oct 2026 · 07:05" />);
    expect(screen.getByTestId('logo')).toBeTruthy();
    expect(screen.getByText('Ubuntu Community Clinic')).toBeTruthy();
    expect(screen.getByText('Tue 27 Oct 2026 · 07:05')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText(/Step \d of 2/)).toBeNull();
  });

  it('T-C-2 shows "Step 1 of 2" or "Step 2 of 2" when a step is given', () => {
    const { rerender } = render(<CheckinHeader facilityName="Clinic" dateTimeText="now" step={1} />);
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    rerender(<CheckinHeader facilityName="Clinic" dateTimeText="now" step={2} />);
    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
  });

  it('T-C-2 calls the long-press handler only after the logo is held for 3 seconds', () => {
    jest.useFakeTimers();
    const onLongPress = jest.fn();
    render(<CheckinHeader facilityName="Clinic" dateTimeText="now" onLogoLongPress={onLongPress} />);
    const target = screen.getByTestId('logo-hold-target');

    fireEvent.pointerDown(target);
    act(() => {
      jest.advanceTimersByTime(2999);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('T-C-2 does nothing when the logo is released before 3 seconds', () => {
    jest.useFakeTimers();
    const onLongPress = jest.fn();
    render(<CheckinHeader facilityName="Clinic" dateTimeText="now" onLogoLongPress={onLongPress} />);
    const target = screen.getByTestId('logo-hold-target');

    fireEvent.pointerDown(target);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    fireEvent.pointerUp(target);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
