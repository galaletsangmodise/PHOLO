import { act, render, screen } from '@testing-library/react';
import { Toast } from '@/components/Toast';

describe('Toast', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('T-C-12 shows a short message in a dark bar', () => {
    render(<Toast message="Details saved." onDismiss={() => {}} />);
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Details saved.');
    expect(toast.className).toContain('bg-toastBg');
    expect(toast.className).toContain('text-toastText');
  });

  it('T-C-12 disappears after 3 seconds', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(<Toast message="Details saved." onDismiss={onDismiss} />);

    act(() => {
      jest.advanceTimersByTime(2999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('T-C-12 does not call onDismiss after it has been removed', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    const { unmount } = render(<Toast message="Marked as left." onDismiss={onDismiss} />);
    unmount();
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
