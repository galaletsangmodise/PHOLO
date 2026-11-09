import fs from 'node:fs';
import path from 'node:path';
import { formatSastDate, formatSastTime, normaliseCellphone } from '@pholo/types';
import config from '../../tailwind.config';
import { tokens } from '../../styles/tokens';

const webRoot = path.resolve(__dirname, '../..');
const sourceFiles = (folder: string): string[] =>
  fs.readdirSync(path.join(webRoot, folder), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(folder, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.tsx?$/.test(entry.name) ? [relative] : [];
  });

describe('T-NFR-4 responsive layout', () => {
  const screens = Object.keys((config.theme?.screens ?? {}) as Record<string, string>);

  it('the breakpoints are the PRD ones: phone and tablet below 640 px, staff screens from 1024 px', () => {
    expect(screens.sort()).toEqual(['desktop', 'tablet']);
    expect(tokens.breakpoint.tablet).toBe(640);
    expect(tokens.breakpoint.desktop).toBe(1024);
  });

  it('every responsive prefix used in the code exists in the Tailwind config (an unknown one such as "md:" produces no CSS at all)', () => {
    const unknown: string[] = [];
    for (const file of [...sourceFiles('app'), ...sourceFiles('components')]) {
      const text = fs.readFileSync(path.join(webRoot, file), 'utf8');
      for (const match of text.matchAll(/(?<![\w-])(sm|md|lg|xl|2xl|min-\[[^\]]+\]|max-\[[^\]]+\]|max-(?:sm|md|lg|xl)):[a-z[!-]/g)) {
        unknown.push(`${file}: ${match[1]}:`);
      }
    }
    expect(unknown).toEqual([]);
  });
});

describe('T-NFR-5 formats', () => {
  it('dates look like "27 Oct 2026" and times are 24-hour SAST', () => {
    expect(formatSastDate('2026-10-27T07:12:00Z')).toBe('27 Oct 2026');
    expect(formatSastTime('2026-10-27T05:12:00Z')).toBe('07:12');
    expect(formatSastTime('2026-10-27T21:59:00Z')).toBe('23:59');
    expect(formatSastDate('2026-10-27T22:30:00Z')).toBe('28 Oct 2026');
  });

  it('phone numbers are written in +27 format', () => {
    expect(normaliseCellphone('082 555 0147')).toBe('+27825550147');
    expect(normaliseCellphone('+27 82 555 0147')).toBe('+27825550147');
    expect(normaliseCellphone('27825550147')).toBe('+27825550147');
  });
});
