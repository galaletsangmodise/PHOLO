import { render, screen } from '@testing-library/react';
import QueuePage from '@/app/queue/page';
import SummaryPage from '@/app/summary/page';
import VisitPage from '@/app/visits/[id]/page';
import { PROFILES, WithSession, fakeSession } from '../sessionTestUtils';

// The router object must be the same on every render, as it is in Next.js.
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParams = { id: 'v-1' };
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => mockRouter,
  useParams: () => mockParams,
}));
const never = () => new Promise<never>(() => undefined);
jest.mock('@/components/queueApi', () => ({ getQueue: () => never(), callNext: () => never(), markLeft: () => never(), startConsultation: () => never() }));
jest.mock('@/components/summaryApi', () => ({ getSummary: () => never() }));
jest.mock('@/components/visitsApi', () => ({ getVisit: () => never(), saveDraft: () => never(), completeVisit: () => never() }));

const show = (role: keyof typeof PROFILES, page: React.ReactNode) =>
  render(<WithSession value={fakeSession({ status: 'in', profile: PROFILES[role] })}>{page}</WithSession>);

describe('T-NFR-1 speed: with a slow answer every screen shows a loading placeholder at once (never a blank page)', () => {
  it('S6 Queue', () => {
    show('clinical', <QueuePage />);
    expect(screen.getAllByTestId('placeholder-block').length).toBeGreaterThan(0);
  });
  it('S9 Visit', () => {
    show('clinical', <VisitPage />);
    expect(screen.getAllByTestId('placeholder-block').length).toBeGreaterThan(0);
  });
  it('S10 Daily summary', () => {
    show('manager', <SummaryPage />);
    expect(screen.getAllByTestId('placeholder-block').length).toBeGreaterThan(0);
  });
});
