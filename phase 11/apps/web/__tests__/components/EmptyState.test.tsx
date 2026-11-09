import { fireEvent, render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/EmptyState';

describe('Empty-state block', () => {
  it('T-C-14 shows an icon and a centred message, with no button when there is nothing to do', () => {
    const { container } = render(<EmptyState icon="check" message="No patients in the queue right now." />);
    expect(screen.getByText('No patients in the queue right now.')).toBeTruthy();
    expect(container.querySelector('[data-icon="check"]')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect((container.firstChild as HTMLElement).className).toContain('text-center');
  });

  it('T-C-14 shows a supporting line when given one', () => {
    render(<EmptyState icon="check" message="No patients in the queue right now." hint="New check-ins appear here by themselves." />);
    expect(screen.getByText('New check-ins appear here by themselves.')).toBeTruthy();
  });

  it('T-C-14 shows a button when there is something to do', () => {
    const onAction = jest.fn();
    render(<EmptyState icon="check" message="No patients." actionLabel="Refresh" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
