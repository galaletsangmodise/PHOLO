/**
 * Design tokens (Section 7.1 of the plan, PRD Section 9).
 * This is the only place where colours, sizes and spacing are written down.
 * Everything else uses these through Tailwind (see tailwind.config.ts).
 */
export const tokens = {
  color: {
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
    badge: {
      called: { fill: '#FFF6E5', text: '#8A4B00' },
    },
  },
  font: {
    family: 'Atkinson Hyperlegible',
    fallback: 'system-ui, sans-serif',
    size: {
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
    },
  },
  space: { 1: 8, 2: 16, 3: 24, 4: 32, 6: 48 },
  margin: { staff: 24, tablet: 48 },
  radius: { card: 12, input: 8, button: 12, badge: 'pill' },
  shadow: { card: '0 1px 3px rgba(0,0,0,0.12)' },
  size: {
    button: { staff: 48, tablet: 72 },
    touchMin: 44,
    contentMax: { staff: 1200, tablet: 960 },
  },
  focus: { outline: { width: 3, gap: 2 } },
  hover: { darken: 10 },
  breakpoint: { phone: 640, tablet: 640, desktop: 1024 },
  frame: {
    tablet: { width: 1280, height: 800 },
    staff: { width: 1440, height: 900 },
  },
  toast: { durationMs: 3000 },
  icon: { set: 'Lucide', style: 'outline' },
} as const;

export type Tokens = typeof tokens;
