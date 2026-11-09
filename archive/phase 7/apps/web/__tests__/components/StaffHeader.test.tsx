import { fireEvent, render, screen } from '@testing-library/react';
import { StaffHeader } from '@/components/StaffHeader';

describe('Staff Header', () => {
  it('T-C-1 shows Queue and Find patient for Reception and Clinical, with the active link underlined', () => {
    const { unmount } = render(
      <StaffHeader role="Reception" fullName="Busisiwe Naidoo" activeLink="queue" onLogout={() => {}} />,
    );
    const queue = screen.getByRole('link', { name: 'Queue' });
    const find = screen.getByRole('link', { name: 'Find patient' });
    expect(queue.getAttribute('href')).toBe('/queue');
    expect(find.getAttribute('href')).toBe('/patients');
    expect(screen.queryByRole('link', { name: 'Summary' })).toBeNull();

    expect(queue.getAttribute('aria-current')).toBe('page');
    expect(queue.className).toContain('border-b-focus');
    expect(queue.className).toContain('border-primary');
    expect(find.getAttribute('aria-current')).toBeNull();
    expect(queue.className).toContain('min-h-touch');
    unmount();

    render(<StaffHeader role="Clinical" fullName="Nomsa Khumalo" activeLink="patients" onLogout={() => {}} />);
    expect(screen.getByRole('link', { name: 'Queue' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Find patient' }).getAttribute('aria-current')).toBe('page');
  });

  it('T-C-1 shows only Summary for the Manager', () => {
    render(<StaffHeader role="Manager" fullName="Farouk Patel" activeLink="summary" onLogout={() => {}} />);
    expect(screen.getByRole('link', { name: 'Summary' }).getAttribute('href')).toBe('/summary');
    expect(screen.queryByRole('link', { name: 'Queue' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Find patient' })).toBeNull();
  });

  it('T-C-1 shows the logo, an initials circle, the name, the role and a Log out button', () => {
    const onLogout = jest.fn();
    render(<StaffHeader role="Clinical" fullName="Nomsa Khumalo" activeLink="queue" onLogout={onLogout} />);
    expect(screen.getByTestId('logo')).toBeTruthy();
    expect(screen.getByTestId('initials').textContent).toBe('NK');
    expect(screen.getByText('Nomsa Khumalo')).toBeTruthy();
    expect(screen.getByText('Clinical')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('Staff Header log out and links by role', () => {
  it('T-NAV-5 Reception and Clinical see "Queue" and "Find patient"; Manager sees "Summary"', () => {
    for (const role of ['Reception', 'Clinical'] as const) {
      const { unmount } = render(<StaffHeader role={role} fullName="A B" onLogout={() => {}} />);
      expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Queue', 'Find patient']);
      unmount();
    }
    render(<StaffHeader role="Manager" fullName="A B" onLogout={() => {}} />);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Summary']);
  });

  it('T-AUTH-9 "Log out" logs out at once, with no confirmation', () => {
    const onLogout = jest.fn();
    render(<StaffHeader role="Reception" fullName="Busisiwe Naidoo" onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('T-AUTH-9 on S9 with unsaved text, "Leave without saving?" shows first', () => {
    const onLogout = jest.fn();
    render(<StaffHeader role="Clinical" fullName="Nomsa Khumalo" unsavedChanges onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Leave without saving?' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onLogout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
