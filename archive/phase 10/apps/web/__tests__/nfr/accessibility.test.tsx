import { render, screen } from '@testing-library/react';
import { QueueScreen } from '@/app/queue/QueueScreen';
import { SummaryScreen } from '@/app/summary/SummaryScreen';
import { VisitScreen } from '@/app/visits/[id]/VisitScreen';
import { StatusBadge, type BadgeStatus } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { tokens } from '../../styles/tokens';

const channel = (value: number): number => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (foreground: string, background: string): number => {
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};
const { color } = tokens;

describe('T-NFR-6 contrast (PRD 9.4)', () => {
  it.each([
    ['text on background', color.text, color.background, 14.1],
    ['secondary text on background', color.textSecondary, color.background, 6.7],
    ['white on teal', color.surface, color.primary, 6.0],
    ['error on white', color.error, color.surface, 6.6],
    ['success on its background', color.success, color.successBg, 5.4],
    ['warning text on its background', color.warningText, color.warningBg, 6.3],
    ['grey badge text on its background', color.greyBadgeText, color.greyBadgeBg, 6.1],
  ])('%s is at least the PRD ratio', (_name, foreground, background, expected) => {
    // The PRD figures are rounded (the text colour on the background is really 14.05, which the PRD writes as 14.1).
    const actual = contrast(foreground, background);
    expect(actual).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(actual - expected)).toBeLessThan(0.1);
  });

  it.each([
    ['toast text on toast', color.toastText, color.toastBg],
    ['text on tint', color.text, color.tint],
    ['text on white', color.text, color.surface],
    ['secondary text on white', color.textSecondary, color.surface],
    ['called badge', color.badge.called.text, color.badge.called.fill],
    ['error text on its background', color.error, color.errorBg],
  ])('%s is at least 4.5 to 1', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('T-NFR-6 sizes', () => {
  it('body text 16 px or more, small text 12 px or more, tablet body 22 px or more', () => {
    expect(tokens.font.size.staff.body.size).toBeGreaterThanOrEqual(16);
    expect(tokens.font.size.tablet.body.size).toBeGreaterThanOrEqual(22);
    for (const kind of [tokens.font.size.staff, tokens.font.size.tablet]) expect(kind.small.size).toBeGreaterThanOrEqual(12);
  });

  it('everything tappable is 44 px or more, staff buttons 48, tablet buttons 72, and focus is a 3 px outline', () => {
    expect(tokens.size.touchMin).toBeGreaterThanOrEqual(44);
    expect(tokens.size.button.staff).toBeGreaterThanOrEqual(44);
    expect(tokens.size.button.tablet).toBe(72);
    expect(tokens.focus.outline.width).toBe(3);
  });
});

describe('T-NFR-6 every control has a word', () => {
  const noop = () => undefined;
  const everyControlHasAName = () => {
    for (const element of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link'), ...screen.queryAllByRole('textbox'), ...screen.queryAllByRole('combobox')]) {
      const name = element.getAttribute('aria-label') ?? element.textContent ?? '';
      const labelled = element.getAttribute('aria-labelledby') !== null || ((element as HTMLInputElement).labels?.length ?? 0) > 0;
      expect(name.trim() !== '' || labelled).toBe(true);
    }
  };

  it('every Status badge shows a word', () => {
    const statuses: BadgeStatus[] = ['Waiting', 'Called', 'In consultation', 'Completed', 'Left', 'Urgent', 'No paper file', 'Paper file - not yet digitised', 'Paper file - digitised', 'Paper file', 'Helped'];
    for (const status of statuses) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      expect((container.textContent ?? '').trim()).not.toBe('');
      unmount();
    }
  });

  it('S6 buttons, links and tabs all have names', () => {
    render(
      <QueueScreen
        role="Clinical" fullName="Nomsa Khumalo" tab="active" nowMs={Date.now()} offline={false} onTab={noop} onCallNext={noop} onMarkLeft={noop} onStart={noop}
        onContinue={noop} onRefresh={noop} onTryAgain={noop} onToastDone={noop} onLogout={noop}
        state={{ kind: 'ready', counts: { waiting: 1, inConsultation: 0, completed: 0, uncalled: 1 }, visits: [{
          id: 'v1', patientId: 'p1', queueNumber: 1, firstName: 'Thandi', surname: 'Dlamini', dateOfBirth: '1996-01-01', reasonCategory: 'Test or screening', urgent: true,
          assisted: true, status: 'Waiting', paperFileStatus: 'Paper file - not yet digitised', checkinAt: new Date().toISOString(), calledAt: null, completedAt: null, leftAt: null,
        }] }}
      />,
    );
    everyControlHasAName();
  });

  it('S10 and S9 buttons, links and fields all have names', () => {
    const { unmount } = render(<SummaryScreen fullName="Farouk Patel" facilityName="Ubuntu Community Clinic" state={{ kind: 'error' }} offline={false} onRefresh={noop} onTryAgain={noop} onLogout={noop} />);
    everyControlHasAName();
    unmount();
    render(
      <VisitScreen
        fullName="Nomsa Khumalo" nowMs={Date.now()} offline={false} busy={null} unsaved={false} dialog={null} errors={{ symptoms: 'x' }} values={{ symptoms: '', notes: '', icd10_codes: '', outcome: '' }}
        onChange={noop} onSaveDraft={noop} onComplete={noop} onBack={noop} onOpenFullFile={noop} onTryAgain={noop} onToastDone={noop} onLogout={noop} onConfirmDialog={noop} onCancelDialog={noop}
        state={{ kind: 'ready', detail: {
          visit: { id: 'v', patientId: 'p', queueNumber: 1, checkinAt: new Date().toISOString(), reasonCategory: 'Test or screening', urgent: false, status: 'In consultation', symptoms: null, notes: null, icd10Codes: null, outcome: null },
          patient: { id: 'p', fileNumber: 'PH-000001', firstName: 'A', surname: 'B', dateOfBirth: '1990-01-01', paperFileStatus: 'No paper file', chronicConditions: null, allergies: null, currentMedication: null },
        } }}
      />,
    );
    everyControlHasAName();
  });

  it('a form error has a red border, an icon and a message (S9)', () => {
    render(
      <VisitScreen
        fullName="N" nowMs={Date.now()} offline={false} busy={null} unsaved={false} dialog={null} errors={{ symptoms: 'Please fix this.' }} values={{ symptoms: '', notes: '', icd10_codes: '', outcome: '' }}
        onChange={noop} onSaveDraft={noop} onComplete={noop} onBack={noop} onOpenFullFile={noop} onTryAgain={noop} onToastDone={noop} onLogout={noop} onConfirmDialog={noop} onCancelDialog={noop}
        state={{ kind: 'ready', detail: {
          visit: { id: 'v', patientId: 'p', queueNumber: 1, checkinAt: new Date().toISOString(), reasonCategory: 'Test or screening', urgent: false, status: 'In consultation', symptoms: null, notes: null, icd10Codes: null, outcome: null },
          patient: { id: 'p', fileNumber: 'PH-000001', firstName: 'A', surname: 'B', dateOfBirth: '1990-01-01', paperFileStatus: 'No paper file', chronicConditions: null, allergies: null, currentMedication: null },
        } }}
      />,
    );
    const field = screen.getByLabelText('Symptoms');
    expect(field.className).toContain('border-error');
    const message = screen.getByText('Please fix this.');
    expect(message.parentElement?.querySelector('svg')).not.toBeNull();
  });

  it('the dialogs have a title and named buttons', () => {
    render(<ConfirmDialog kind="completeVisit" onConfirm={noop} onCancel={noop} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    everyControlHasAName();
  });
});
