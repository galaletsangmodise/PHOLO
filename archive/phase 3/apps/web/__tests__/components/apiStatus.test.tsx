import { act, render, screen } from '@testing-library/react';
import { apiRequest } from '@/components/api';
import { OfflineBanner } from '@/components/OfflineBanner';
import { setApiReachable } from '@/components/apiStatus';

// jsdom has no fetch: tests put in a fake one that answers like the real one.
const fetchMock = jest.fn();
const answer = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
});
afterEach(() => {
  setApiReachable(true);
});

describe('Offline from failed API calls (plan Section 18, #10)', () => {
  it('shows the banner when an API call cannot reach the server and removes it when the next call works', async () => {
    render(<OfflineBanner message="No internet connection. Check your Wi-Fi and try again." />);
    expect(screen.queryByText(/No internet/)).toBeNull();

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => {
      await expect(apiRequest('/auth/me')).rejects.toThrow();
    });
    expect(screen.getByText(/No internet/)).toBeTruthy();

    fetchMock.mockResolvedValueOnce(answer(200, { ok: true }));
    await act(async () => {
      await apiRequest('/auth/me');
    });
    expect(screen.queryByText(/No internet/)).toBeNull();
  });

  it('an API error answer (such as 401) does not count as offline', async () => {
    render(<OfflineBanner message="No internet connection. Check your Wi-Fi and try again." />);
    fetchMock.mockResolvedValueOnce(answer(401, { message: 'x' }));
    await act(async () => {
      await expect(apiRequest('/auth/me')).rejects.toThrow();
    });
    expect(screen.queryByText(/No internet/)).toBeNull();
  });
});
