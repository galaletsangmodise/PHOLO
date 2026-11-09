import { fireEvent, render, screen } from '@testing-library/react';
import { Dropdown } from '@/components/Dropdown';

const OUTCOMES = ['Treated and sent home', 'Medication given', 'Referred to hospital'];

describe('Dropdown', () => {
  it('T-C-8 shows the label, a placeholder and the options, looking like the Text field', () => {
    render(
      <Dropdown label="Outcome" options={OUTCOMES} value="" onChange={() => {}} placeholder="Choose an outcome" />,
    );
    const select = screen.getByLabelText('Outcome') as HTMLSelectElement;
    expect(select.className).toContain('border-border');
    expect(select.className).toContain('rounded-input');
    expect(select.options.length).toBe(OUTCOMES.length + 1);
    expect(select.options[0].text).toBe('Choose an outcome');
    expect(select.options[1].text).toBe('Treated and sent home');
  });

  it('T-C-8 reports the chosen option', () => {
    const onChange = jest.fn();
    render(<Dropdown label="Outcome" options={OUTCOMES} value="" onChange={onChange} placeholder="Choose an outcome" />);
    fireEvent.change(screen.getByLabelText('Outcome'), { target: { value: 'Medication given' } });
    expect(onChange).toHaveBeenCalledWith('Medication given');
  });

  it('T-C-8 shows a red border, an error icon and the message on error', () => {
    const { container } = render(
      <Dropdown
        label="Outcome"
        options={OUTCOMES}
        value=""
        onChange={() => {}}
        placeholder="Choose an outcome"
        error="Please choose an outcome."
      />,
    );
    expect(screen.getByLabelText('Outcome').className).toContain('border-error');
    expect(screen.getByText('Please choose an outcome.')).toBeTruthy();
    expect(container.querySelector('[data-icon="alert-circle"]')).not.toBeNull();
  });

  it('T-C-8 shows a down arrow', () => {
    const { container } = render(
      <Dropdown label="Outcome" options={OUTCOMES} value="" onChange={() => {}} placeholder="Choose an outcome" />,
    );
    expect(container.querySelector('[data-icon="chevron-down"]')).not.toBeNull();
  });
});
