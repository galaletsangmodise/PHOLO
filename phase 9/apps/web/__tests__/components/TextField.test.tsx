import { fireEvent, render, screen } from '@testing-library/react';
import { TextField } from '@/components/TextField';

describe('Text field', () => {
  it('T-C-6 shows the label above the field, with a grey border and a teal focus outline', () => {
    render(<TextField label="Email" value="" onChange={() => {}} placeholder="name@clinic.co.za" />);
    const input = screen.getByLabelText('Email') as HTMLInputElement;
    expect(input.placeholder).toBe('name@clinic.co.za');
    expect(input.className).toContain('border-border');
    expect(input.className).toContain('focus:outline-primary');
    expect(input.className).toContain('rounded-input');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('T-C-6 reports what is typed', () => {
    const onChange = jest.fn();
    render(<TextField label="Email" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co.za' } });
    expect(onChange).toHaveBeenCalledWith('a@b.co.za');
  });

  it('T-C-6 shows a red border, an error icon and the message under the field on error', () => {
    const { container } = render(
      <TextField label="Email" value="x" onChange={() => {}} error="Enter your password." />,
    );
    const input = screen.getByLabelText('Email');
    expect(input.className).toContain('border-error');
    expect(input.className).not.toContain('border-border ');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(container.querySelector('[data-icon="alert-circle"]')).not.toBeNull();
  });

  it('T-C-6 keeps the typed text when an error shows', () => {
    render(<TextField label="Email" value="typed text" onChange={() => {}} error="Oops" />);
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('typed text');
  });

  it('T-C-6 has a long text variant', () => {
    render(<TextField label="Symptoms" type="textarea" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Symptoms').tagName).toBe('TEXTAREA');
  });

  it('T-C-6 has a password variant with a Show / Hide toggle', () => {
    render(<TextField label="Password" type="password" value="secret" onChange={() => {}} />);
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(input.type).toBe('password');
  });
});
