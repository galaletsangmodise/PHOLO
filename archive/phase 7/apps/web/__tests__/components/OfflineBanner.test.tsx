import { act, render, screen } from '@testing-library/react';
import { OfflineBanner } from '@/components/OfflineBanner';

const MESSAGE = 'No internet connection. Check your Wi-Fi and try again.';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

describe('Offline banner', () => {
  afterEach(() => {
    setOnline(true);
  });

  it('T-C-16 shows nothing while there is internet', () => {
    render(<OfflineBanner message={MESSAGE} />);
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('T-C-16 shows a full-width amber bar with an icon and the text when there is no internet', () => {
    setOnline(false);
    const { container } = render(<OfflineBanner message={MESSAGE} />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain(MESSAGE);
    expect(banner.className).toContain('w-full');
    expect(banner.className).toContain('bg-warningBg');
    expect(banner.className).toContain('text-warningText');
    expect(container.querySelector('[data-icon="wifi-off"]')).not.toBeNull();
  });

  it('T-C-16 can be red, as on the Check-in start screen', () => {
    setOnline(false);
    render(<OfflineBanner message="No internet. Check-in is paused. Please tell a staff member." tone="red" />);
    const banner = screen.getByRole('status');
    expect(banner.className).toContain('bg-errorBg');
    expect(banner.className).toContain('text-error');
  });

  it('T-C-16 appears when the internet goes and disappears by itself when it is back', () => {
    render(<OfflineBanner message={MESSAGE} />);
    expect(screen.queryByText(MESSAGE)).toBeNull();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(MESSAGE)).toBeTruthy();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('T-C-16 can be switched on by a screen, whatever the browser says', () => {
    render(<OfflineBanner message={MESSAGE} offline />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();
  });
});
