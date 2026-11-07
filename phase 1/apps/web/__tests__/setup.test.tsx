import { render, screen } from '@testing-library/react';
import { Button } from '@/components/Button';

describe('Component runner', () => {
  it('T-SETUP-2 renders the Primary button and finds it by its label', () => {
    render(<Button variant="primary">Log in</Button>);
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
  });
});
