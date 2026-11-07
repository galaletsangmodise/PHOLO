import { tokens } from '@/styles/tokens';

describe('Design tokens (Section 7.1)', () => {
  it('T-SETUP-6 holds every value of Section 7.1 exactly as written', () => {
    expect(tokens.color).toMatchObject({
      primary: '#0F6E6E',
      accent: '#9A4A00',
      background: '#F7FAFA',
      surface: '#FFFFFF',
      tint: '#E3F1F1',
      text: '#1A2B2B',
      textSecondary: '#4A5C5C',
      error: '#B42318',
      success: '#067647',
      warning: '#9A4A00',
      errorBg: '#FEF3F2',
      successBg: '#ECFDF3',
      warningBg: '#FFF6E5',
      warningText: '#8A4B00',
      greyBadgeBg: '#EDEFEF',
      greyBadgeText: '#4A5C5C',
      border: '#6B7B7B',
      borderLight: '#E3F1F1',
      disabledBg: '#EDEFEF',
      disabledText: '#6B7B7B',
      toastBg: '#1A2B2B',
      toastText: '#FFFFFF',
      backdrop: 'rgba(26, 43, 43, 0.6)',
      skeleton: '#EDEFEF',
    });
    expect(tokens.color.badge.called).toEqual({ fill: '#FFF6E5', text: '#8A4B00' });

    expect(tokens.font.family).toBe('Atkinson Hyperlegible');
    expect(tokens.font.fallback).toBe('system-ui, sans-serif');
    expect(tokens.font.size).toEqual({
      staff: {
        title: { size: 28, weight: 700 },
        heading: { size: 20, weight: 700 },
        body: { size: 16, weight: 400 },
        small: { size: 14, weight: 400 },
      },
      tablet: {
        title: { size: 40, weight: 700 },
        heading: { size: 28, weight: 700 },
        body: { size: 22, weight: 400 },
        small: { size: 16, weight: 400 },
        button: { size: 24, weight: 700 },
        queueNumber: { size: 96, weight: 700 },
      },
    });

    expect(tokens.space).toEqual({ 1: 8, 2: 16, 3: 24, 4: 32, 6: 48 });
    expect(tokens.margin).toEqual({ staff: 24, tablet: 48 });
    expect(tokens.radius).toEqual({ card: 12, input: 8, button: 12, badge: 'pill' });
    expect(tokens.shadow.card).toBe('0 1px 3px rgba(0,0,0,0.12)');
    expect(tokens.size.button).toEqual({ staff: 48, tablet: 72 });
    expect(tokens.size.touchMin).toBe(44);
    expect(tokens.size.contentMax).toEqual({ staff: 1200, tablet: 960 });
    expect(tokens.focus.outline).toEqual({ width: 3, gap: 2 });
    expect(tokens.hover.darken).toBe(10);
    expect(tokens.breakpoint).toEqual({ phone: 640, tablet: 640, desktop: 1024 });
    expect(tokens.frame).toEqual({
      tablet: { width: 1280, height: 800 },
      staff: { width: 1440, height: 900 },
    });
    expect(tokens.toast.durationMs).toBe(3000);
    expect(tokens.icon).toEqual({ set: 'Lucide', style: 'outline' });
  });
});
