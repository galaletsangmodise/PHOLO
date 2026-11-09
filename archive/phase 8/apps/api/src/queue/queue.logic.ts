import type { QueueCounts, QueueRow } from '@pholo/types';

const time = (value: string | null): number => (value ? Date.parse(value) : 0);
const isCalled = (row: QueueRow): boolean => row.status === 'Called' || row.status === 'In consultation';

/**
 * BR2: the Active list. Called and In consultation Visits first (earliest called first), then Waiting Visits with
 * urgent first, then by Check-in time. Completed and Left Visits are not in it.
 */
export function orderActive(rows: readonly QueueRow[]): QueueRow[] {
  return rows
    .filter((row) => row.status === 'Waiting' || isCalled(row))
    .sort((a, b) => {
      if (isCalled(a) !== isCalled(b)) return isCalled(a) ? -1 : 1;
      if (isCalled(a)) return time(a.called_at) - time(b.called_at);
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return time(a.checkin_at) - time(b.checkin_at);
    });
}

/** "Done today": Completed and Left Visits, the latest finish first. */
export function orderDone(rows: readonly QueueRow[]): QueueRow[] {
  const finished = (row: QueueRow) => time(row.completed_at) || time(row.left_at);
  return rows.filter((row) => row.status === 'Completed' || row.status === 'Left').sort((a, b) => finished(b) - finished(a));
}

/** The count chips of S6. "Waiting" counts Waiting and Called Visits; there is no Called chip. */
export function countQueue(rows: readonly QueueRow[]): QueueCounts {
  const count = (...statuses: string[]) => rows.filter((row) => statuses.includes(row.status)).length;
  return {
    waiting: count('Waiting', 'Called'),
    in_consultation: count('In consultation'),
    completed: count('Completed'),
    uncalled: count('Waiting'),
  };
}
