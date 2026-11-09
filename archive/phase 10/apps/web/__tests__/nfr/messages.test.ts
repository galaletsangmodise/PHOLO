import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');
const SOURCE_FOLDERS = ['apps/api/src', 'apps/web/app', 'apps/web/components', 'packages/types/src'];

const sourceText = (): string => {
  const read = (folder: string): string[] =>
    fs.readdirSync(path.join(repoRoot, folder), { withFileTypes: true }).flatMap((entry) => {
      const relative = path.join(folder, entry.name);
      if (entry.isDirectory()) return read(relative);
      return /\.tsx?$/.test(entry.name) && !/\.(spec|test)\./.test(entry.name) ? [fs.readFileSync(path.join(repoRoot, relative), 'utf8')] : [];
    });
  return SOURCE_FOLDERS.flatMap(read).join('\n');
};

describe('T-INT-19 the exact messages of PRD 6.2 and 12.2 are in the code', () => {
  const text = sourceText();
  it.each([
    'No internet. Check-in is paused. Please tell a staff member.',
    'No internet connection. Check your Wi-Fi and try again.',
    'No internet connection. The queue may be out of date.',
    'Something went wrong on our side. Please try again.',
    'Your session has ended. Please log in again.',
    'You are not allowed to open this page.',
    'Too many Check-ins at once. Please wait one minute and try again.',
    'You are already checked in.', // S5 shows the number on its own card (PRD S5, state "already checked in")
    'This ID number does not look right. Check it, or leave it empty if you do not have one.',
    'Mark this patient as left?',
    'Calling number',
    'Visit completed.',
    'Leave without saving?',
  ])('"%s"', (message) => {
    expect(text).toContain(message);
  });
});
