export type BadgeStatus =
  | 'Waiting'
  | 'Called'
  | 'In consultation'
  | 'Completed'
  | 'Left'
  | 'Urgent'
  | 'No paper file'
  | 'Paper file - not yet digitised'
  | 'Paper file - digitised'
  /** The short badges on S6 rows (PRD 8.2). */
  | 'Paper file'
  | 'Helped';

const GREY = 'bg-greyBadgeBg text-greyBadgeText';

const COLOURS: Record<BadgeStatus, string> = {
  Waiting: 'bg-tint text-text',
  Called: 'bg-badge-called-fill text-badge-called-text',
  'In consultation': 'bg-primary text-white',
  Completed: 'bg-successBg text-success',
  Left: GREY,
  Urgent: 'bg-error text-white',
  'No paper file': GREY,
  'Paper file - not yet digitised': GREY,
  'Paper file - digitised': GREY,
  'Paper file': GREY,
  Helped: 'bg-tint text-text',
};

/** Always a word, never colour alone (PRD 9.4). */
export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-badge px-s2 py-0.5 text-staff-small font-bold ${COLOURS[status]}`}
    >
      {status}
    </span>
  );
}
