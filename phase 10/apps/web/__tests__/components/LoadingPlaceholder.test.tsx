import { render, screen } from '@testing-library/react';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';

describe('Loading placeholder', () => {
  it('T-C-15 shows grey pulsing blocks the shape of the real content', () => {
    render(<LoadingPlaceholder rows={5} />);
    const blocks = screen.getAllByTestId('placeholder-block');
    expect(blocks.length).toBe(5);
    for (const block of blocks) {
      expect(block.className).toContain('bg-skeleton');
      expect(block.className).toContain('animate-pulse');
    }
  });

  it('T-C-15 shows 3 blocks by default', () => {
    render(<LoadingPlaceholder />);
    expect(screen.getAllByTestId('placeholder-block').length).toBe(3);
  });

  it('T-C-15 is marked as busy and has no spinner on its own', () => {
    const { container } = render(<LoadingPlaceholder />);
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
