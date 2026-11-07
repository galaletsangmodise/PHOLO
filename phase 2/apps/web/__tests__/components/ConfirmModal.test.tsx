import { fireEvent, render, screen } from '@testing-library/react';
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
