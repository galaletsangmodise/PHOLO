import { fireEvent, render, screen } from '@testing-library/react';
import { Checkbox } from '@/components/Checkbox';

describe('Checkbox', () => {
  it('T-C-9 shows a 32 px square box and a label, with no tick when unticked', () => {
    const { container } = render(<Checkbox label="I agree to the Privacy Notice" checked={false} onChange={() => {}} />);
    const box = screen.getByTestId('checkbox-box');
    expect(box.className).toContain('h-8');
    expect(box.className).toContain('w-8');
    expect(screen.getByLabelText('I agree to the Privacy Notice')).toBeTruthy();
    expect(container.querySelector('[data-icon="check"]')).toBeNull();
  });

  it('T-C-9 shows a tick icon when ticked', () => {
    const { container } = render(<Checkbox label="I agree" checked onChange={() => {}} />);
    expect(container.querySelector('[data-icon="check"]')).not.toBeNull();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('T-C-9 reports the new value when tapped', () => {
    const onChange = jest.fn();
    render(<Checkbox label="I agree" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('T-C-9 shows a red border and the message on error', () => {
    render(<Checkbox label="I agree" checked={false} onChange={() => {}} error="Please tick the box." />);
    expect(screen.getByTestId('checkbox-box').className).toContain('border-error');
    expect(screen.getByText('Please tick the box.')).toBeTruthy();
  });
});
