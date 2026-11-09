import fs from 'node:fs';
import path from 'node:path';

const webRoot = path.resolve(__dirname, '..');
const HEX_COLOUR = /#[0-9a-fA-F]{3,8}\b/;

function listSourceFiles(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return /\.(ts|tsx|css|js|jsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('No hard-coded values (rule 7)', () => {
  it('T-SETUP-9 finds no hex colour in app/ or components/ outside styles/tokens.ts', () => {
    const files = [
      ...listSourceFiles(path.join(webRoot, 'app')),
      ...listSourceFiles(path.join(webRoot, 'components')),
    ];
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((file) => HEX_COLOUR.test(fs.readFileSync(file, 'utf8')));
    expect(offenders.map((file) => path.relative(webRoot, file))).toEqual([]);
  });
});
