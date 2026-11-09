import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '@/components/Button';

describe('Primary button', () => {
  it('T-C-3 has a teal fill, white text and a 48 px height on staff screens', () => {
    render(<Button variant="primary">Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('text-white');
    expect(button.className).toContain('h-button-staff');
    expect(button.className).toContain('rounded-button');
  });

  it('T-C-3 is 72 px tall on the Check-in Tablet', () => {
    render(
      <Button variant="primary" size="tablet">
        Check in
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Check in' });
    expect(button.className).toContain('h-button-tablet');
    expect(button.className).not.toContain('h-button-staff');
  });

  it('T-C-3 darkens 10% on hover and press', () => {
    render(<Button variant="primary">Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('hover:brightness-90');
    expect(button.className).toContain('active:brightness-90');
  });

  it('T-C-3 is grey with grey text and does nothing when disabled', () => {
    const onClick = jest.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toContain('bg-disabledBg');
    expect(button.className).toContain('text-disabledText');
    expect(button.className).not.toContain('bg-primary');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('T-C-3 shows the loading label and is disabled while loading', () => {
    render(
      <Button variant="primary" loading loadingLabel="Saving...">
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('T-C-3 calls onClick when tapped', () => {
    const onClick = jest.fn();
    render(
      <Button variant="primary" onClick={onClick}>
        Save
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Secondary button', () => {
  it('T-C-4 has a white fill with a teal border and teal text, and fills with the light tint on hover', () => {
    render(<Button variant="secondary">Cancel</Button>);
    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button.className).toContain('bg-surface');
    expect(button.className).toContain('border-primary');
    expect(button.className).toContain('text-primary');
    expect(button.className).toContain('hover:bg-tint');
  });

  it('T-C-4 is grey when disabled', () => {
    render(
      <Button variant="secondary" disabled>
        Cancel
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toContain('bg-disabledBg');
    expect(button.className).toContain('text-disabledText');
    expect(button.className).not.toContain('hover:bg-tint');
  });
});

describe('Danger button', () => {
  it('T-C-5 has a red fill and white text', () => {
    render(<Button variant="danger">Yes, mark as left</Button>);
    const button = screen.getByRole('button', { name: 'Yes, mark as left' });
    expect(button.className).toContain('bg-error');
    expect(button.className).toContain('text-white');
  });
});
