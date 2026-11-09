import type { QueueRow } from '@pholo/types';
import { countQueue, orderActive, orderDone } from './queue.logic';

let counter = 0;
function row(fields: Partial<QueueRow>): QueueRow {
  counter += 1;
  return {
    id: `v-${counter}`,
    patient_id: `p-${counter}`,
    queue_number: counter,
    first_name: 'Test',
    surname: 'Patient',
    date_of_birth: '1990-01-01',
    reason_category: 'Test or screening',
    urgent: false,
    assisted: false,
    status: 'Waiting',
    paper_file_status: 'No paper file',
    checkin_at: '2026-10-27T07:00:00Z',
    called_at: null,
    completed_at: null,
    left_at: null,
    ...fields,
  };
}

describe('BR2 order of the Active list', () => {
  it('T-BR2-4 Called and In consultation first (earliest called first), then Waiting with urgent first, then by Check-in time', () => {
    const rows = [
      row({ id: 'waiting-normal-late', checkin_at: '2026-10-27T07:10:00Z' }),
      row({ id: 'called-late', status: 'Called', checkin_at: '2026-10-27T06:00:00Z', called_at: '2026-10-27T08:05:00Z' }),
      row({ id: 'waiting-urgent-late', urgent: true, checkin_at: '2026-10-27T07:45:00Z' }),
      row({ id: 'done', status: 'Completed', completed_at: '2026-10-27T08:30:00Z' }),
      row({ id: 'in-consultation', status: 'In consultation', checkin_at: '2026-10-27T06:30:00Z', called_at: '2026-10-27T08:00:00Z' }),
      row({ id: 'waiting-normal-early', checkin_at: '2026-10-27T07:00:00Z' }),
      row({ id: 'left', status: 'Left', left_at: '2026-10-27T08:00:00Z' }),
      row({ id: 'waiting-urgent-early', urgent: true, checkin_at: '2026-10-27T07:30:00Z' }),
    ];
    expect(orderActive(rows).map((r) => r.id)).toEqual([
      'in-consultation',
      'called-late',
      'waiting-urgent-early',
      'waiting-urgent-late',
      'waiting-normal-early',
      'waiting-normal-late',
    ]);
  });

  it('keeps Completed and Left Visits out of the Active list', () => {
    expect(orderActive([row({ status: 'Completed' }), row({ status: 'Left' })])).toEqual([]);
  });

  it('does not change the list it was given', () => {
    const rows = [row({ checkin_at: '2026-10-27T07:10:00Z' }), row({ checkin_at: '2026-10-27T07:00:00Z' })];
    const before = rows.map((r) => r.id);
    orderActive(rows);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe('Done today list', () => {
  it('shows only Completed and Left Visits, the latest finish first (completed_at or left_at)', () => {
    const rows = [
      row({ id: 'waiting' }),
      row({ id: 'completed-early', status: 'Completed', completed_at: '2026-10-27T08:00:00Z' }),
      row({ id: 'left-late', status: 'Left', left_at: '2026-10-27T09:00:00Z' }),
      row({ id: 'completed-mid', status: 'Completed', completed_at: '2026-10-27T08:30:00Z' }),
    ];
    expect(orderDone(rows).map((r) => r.id)).toEqual(['left-late', 'completed-mid', 'completed-early']);
  });
});

describe('Count chips', () => {
  it('T-S6-4 Waiting counts Waiting and Called Visits; In consultation and Completed have their own; Left is not counted', () => {
    const rows = [
      row({ status: 'Waiting' }),
      row({ status: 'Called' }),
      row({ status: 'In consultation' }),
      row({ status: 'Completed' }),
      row({ status: 'Left' }),
    ];
    expect(countQueue(rows)).toEqual({ waiting: 2, in_consultation: 1, completed: 1, uncalled: 1 });
  });

  it('is all zero for an empty Queue', () => {
    expect(countQueue([])).toEqual({ waiting: 0, in_consultation: 0, completed: 0, uncalled: 0 });
  });
});
