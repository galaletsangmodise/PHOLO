import type { Config } from 'tailwindcss';
import { tokens } from './styles/tokens';

const px = (value: number): string => `${value}px`;

type FontSizeEntry = [string, { fontWeight: string; lineHeight: string }];

const fontSizes: Record<string, FontSizeEntry> = {};
for (const kind of ['staff', 'tablet'] as const) {
  for (const [name, { size, weight }] of Object.entries(tokens.font.size[kind])) {
    fontSizes[`${kind}-${name}`] = [px(size), { fontWeight: String(weight), lineHeight: '1.3' }];
  }
}

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    screens: {
      tablet: px(tokens.breakpoint.tablet),
      desktop: px(tokens.breakpoint.desktop + 1),
    },
    extend: {
      colors: { ...tokens.color },
      fontFamily: {
        sans: ['var(--font-atkinson)', tokens.font.family, ...tokens.font.fallback.split(', ')],
      },
      fontSize: fontSizes,
      spacing: Object.fromEntries(Object.entries(tokens.space).map(([step, value]) => [`s${step}`, px(value)])),
      borderRadius: {
        card: px(tokens.radius.card),
        input: px(tokens.radius.input),
        button: px(tokens.radius.button),
        badge: '9999px',
      },
      boxShadow: { card: tokens.shadow.card },
      height: {
        'button-staff': px(tokens.size.button.staff),
        'button-tablet': px(tokens.size.button.tablet),
      },
      minHeight: {
        touch: px(tokens.size.touchMin),
        'button-tablet': px(tokens.size.button.tablet),
      },
      minWidth: { touch: px(tokens.size.touchMin) },
      maxWidth: {
        'content-staff': px(tokens.size.contentMax.staff),
        'content-tablet': px(tokens.size.contentMax.tablet),
      },
      borderWidth: { focus: px(tokens.focus.outline.width) },
      outlineWidth: { focus: px(tokens.focus.outline.width) },
      outlineOffset: { focus: px(tokens.focus.outline.gap) },
    },
  },
  plugins: [],
};

export default config;
