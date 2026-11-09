import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ConfirmModal } from '@/components/ConfirmModal';

const baseProps = {
  title: 'Mark this patient as left?',
  text: 'This cannot be undone.',
  confirmLabel: 'Yes, mark as left',
  cancelLabel: 'Cancel',
  confirmVariant: 'danger' as const,
  onConfirm: () => {},
  onCancel: () => {},
};

describe('Confirmation pop-up', () => {
  it('T-C-13 shows the title, the text, a cancel button on the left and a confirm button on the right', () => {
    render(<ConfirmModal {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Mark this patient as left?' })).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Cancel', 'Yes, mark as left']);
    expect(buttons[1].className).toContain('bg-error');
  });

  it('T-C-13 calls onConfirm and onCancel from their buttons', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<ConfirmModal {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, mark as left' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('T-C-13 uses a Primary confirm button when asked to', () => {
    render(<ConfirmModal {...baseProps} confirmVariant="primary" confirmLabel="Yes, complete visit" />);
    expect(screen.getByRole('button', { name: 'Yes, complete visit' }).className).toContain('bg-primary');
  });

  it('T-C-13 Loading: the confirm button reads "Please wait..." and is disabled', () => {
    render(<ConfirmModal {...baseProps} loading />);
    const confirm = screen.getByRole('button', { name: 'Please wait...' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('T-C-13 Error: shows the server problem message', () => {
    render(<ConfirmModal {...baseProps} error />);
    expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy();
  });

  it('T-C-13 Offline: shows the offline banner and disables the confirm button', () => {
    render(<ConfirmModal {...baseProps} offline />);
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Yes, mark as left' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('T-C-13 Offline: keeps the confirm button working when offline confirming is allowed', () => {
    render(<ConfirmModal {...baseProps} offline allowOfflineConfirm />);
    expect((screen.getByRole('button', { name: 'Yes, mark as left' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('M4 versions (Phase 3)', () => {
  const buttons = () => screen.getAllByRole('button').map((button) => button.textContent);

  it('T-M4-1 Mark as left', () => {
    render(<ConfirmDialog kind="markLeft" queueNumber={3} patientName="Thandi Dlamini" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Mark this patient as left?' })).toBeTruthy();
    expect(screen.getByText('Number 3: Thandi Dlamini will move to Done today. This cannot be undone.')).toBeTruthy();
    expect(buttons()).toEqual(['Cancel', 'Yes, mark as left']);
    expect(screen.getByRole('button', { name: 'Yes, mark as left' }).className).toContain('bg-error');
  });

  it('T-M4-2 Complete visit', () => {
    render(<ConfirmDialog kind="completeVisit" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Complete this visit?' })).toBeTruthy();
    expect(screen.getByText('You cannot change it afterwards.')).toBeTruthy();
    expect(buttons()).toEqual(['Cancel', 'Yes, complete visit']);
    expect(screen.getByRole('button', { name: 'Yes, complete visit' }).className).toContain('bg-primary');
  });

  it('T-M4-3 Leave S9 with unsaved text', () => {
    render(<ConfirmDialog kind="leaveUnsaved" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Leave without saving?' })).toBeTruthy();
    expect(screen.getByText('Your changes will be lost. Tap \u201CSave draft\u201D first to keep them.')).toBeTruthy();
    expect(buttons()).toEqual(['Stay here', 'Leave without saving']);
    expect(screen.getByRole('button', { name: 'Leave without saving' }).className).toContain('bg-error');
  });

  it('T-M4-4 Log out of the Check-in Tablet', () => {
    render(<ConfirmDialog kind="logoutTablet" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Log out of this tablet?' })).toBeTruthy();
    expect(screen.getByText('Staff only. The tablet will stop checking patients in.')).toBeTruthy();
    expect(buttons()).toEqual(['Cancel', 'Yes, log out']);
    expect(screen.getByRole('button', { name: 'Yes, log out' }).className).toContain('bg-error');
  });

  it.each(['markLeft', 'completeVisit', 'leaveUnsaved', 'logoutTablet'] as const)('T-M4-5 %s: Loading, Error and Offline', (kind) => {
    const props = { kind, queueNumber: 3, patientName: 'Thandi Dlamini', onConfirm: () => {}, onCancel: () => {} };
    const { unmount } = render(<ConfirmDialog {...props} loading />);
    const confirm = screen.getByRole('button', { name: 'Please wait...' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    unmount();

    const error = render(<ConfirmDialog {...props} error />);
    expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy();
    error.unmount();

    render(<ConfirmDialog {...props} offline />);
    expect(screen.getByText('No internet connection. Check your Wi-Fi and try again.')).toBeTruthy();
    const label = { markLeft: 'Yes, mark as left', completeVisit: 'Yes, complete visit', leaveUnsaved: 'Leave without saving', logoutTablet: 'Yes, log out' }[kind];
    const offlineConfirm = screen.getByRole('button', { name: label }) as HTMLButtonElement;
    expect(offlineConfirm.disabled).toBe(kind !== 'logoutTablet');
  });

  it('T-NAV-7 closing the modal (Cancel) calls onCancel so the screen that opened it shows again', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog kind="markLeft" queueNumber={1} patientName="A B" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
