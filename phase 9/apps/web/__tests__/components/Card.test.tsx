import { render, screen } from '@testing-library/react';
import { Card } from '@/components/Card';

describe('Card', () => {
  it('T-C-10 has a white background, a light border, a soft shadow and a 12 px radius', () => {
    render(<Card>Some content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-surface');
    expect(card.className).toContain('border-borderLight');
    expect(card.className).toContain('shadow-card');
    expect(card.className).toContain('rounded-card');
    expect(card.textContent).toBe('Some content');
  });

  it('T-C-10 is not clickable unless it holds a button or link', () => {
    render(<Card>Some content</Card>);
    const card = screen.getByTestId('card');
    expect(card.getAttribute('role')).toBeNull();
    expect(card.getAttribute('tabindex')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
