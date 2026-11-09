import { fireEvent, render, screen } from '@testing-library/react';
import { ChoiceButton } from '@/components/ChoiceButton';

describe('Choice button', () => {
  it('T-C-7 is white with a teal border and no tick when not selected', () => {
    const { container } = render(<ChoiceButton selected={false}>Yes</ChoiceButton>);
    const button = screen.getByRole('button', { name: 'Yes' });
    expect(button.className).toContain('bg-surface');
    expect(button.className).toContain('border-primary');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-icon="check"]')).toBeNull();
  });

  it('T-C-7 has a teal fill, white text and a tick icon when selected', () => {
    const { container } = render(<ChoiceButton selected>Yes</ChoiceButton>);
    const button = screen.getByRole('button', { name: 'Yes' });
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('text-white');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-icon="check"]')).not.toBeNull();
  });

  it('T-C-7 is at least 44 px tall and calls onClick when tapped', () => {
    const onClick = jest.fn();
    render(
      <ChoiceButton selected={false} onClick={onClick}>
        No
      </ChoiceButton>,
    );
    const button = screen.getByRole('button', { name: 'No' });
    expect(button.className).toContain('min-h-touch');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
