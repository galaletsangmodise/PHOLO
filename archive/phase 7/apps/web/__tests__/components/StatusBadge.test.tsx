import { render, screen } from '@testing-library/react';
import { StatusBadge, type BadgeStatus } from '@/components/StatusBadge';

const EXPECTED: Array<[BadgeStatus, string[]]> = [
  ['Waiting', ['bg-tint', 'text-text']],
  ['Called', ['bg-badge-called-fill', 'text-badge-called-text']],
  ['In consultation', ['bg-primary', 'text-white']],
  ['Completed', ['bg-successBg', 'text-success']],
  ['Left', ['bg-greyBadgeBg', 'text-greyBadgeText']],
  ['Urgent', ['bg-error', 'text-white']],
  ['No paper file', ['bg-greyBadgeBg', 'text-greyBadgeText']],
  ['Paper file - not yet digitised', ['bg-greyBadgeBg', 'text-greyBadgeText']],
  ['Paper file - digitised', ['bg-greyBadgeBg', 'text-greyBadgeText']],
];

describe('Status badge', () => {
  it.each(EXPECTED)('T-C-11 shows "%s" as a word with its own colours', (status, classes) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(status);
    for (const cssClass of classes) {
      expect(badge.className).toContain(cssClass);
    }
  });

  it('T-C-11 is a fully rounded pill', () => {
    render(<StatusBadge status="Waiting" />);
    expect(screen.getByText('Waiting').className).toContain('rounded-badge');
  });
});
