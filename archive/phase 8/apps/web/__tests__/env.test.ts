import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

const REQUIRED_NAMES = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_API_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'API_PORT',
  'WEB_ORIGIN',
];

const SKIPPED_FOLDERS = new Set(['node_modules', '.next', 'dist', 'coverage', '.git', '.supabase']);
const SKIPPED_FILES = new Set(['.env', 'package-lock.json']);

const SECRET_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // a JWT, like a Supabase key
  /sb_secret_[A-Za-z0-9_-]+/,
  /sbp_[a-f0-9]{20,}/,
];

function listFiles(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return SKIPPED_FOLDERS.has(entry.name) ? [] : listFiles(path.join(folder, entry.name));
    }
    return SKIPPED_FILES.has(entry.name) ? [] : [path.join(folder, entry.name)];
  });
}

describe('Environment and secrets (Section 6)', () => {
  it('T-SETUP-7 ignores .env, lists all 8 names with placeholders, and holds no key', () => {
    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8').split(/\r?\n/);
    expect(gitignore).toContain('.env');

    const example = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
    const entries = Object.fromEntries(
      example
        .split(/\r?\n/)
        .filter((line) => line.includes('='))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
    expect(Object.keys(entries).sort()).toEqual([...REQUIRED_NAMES].sort());
    for (const value of Object.values(entries)) {
      expect(value.length).toBeGreaterThan(0);
      for (const pattern of SECRET_PATTERNS) {
        expect(pattern.test(value)).toBe(false);
      }
    }

    const filesWithKeys = listFiles(repoRoot).filter((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return SECRET_PATTERNS.some((pattern) => pattern.test(text));
    });
    expect(filesWithKeys).toEqual([]);
  });
});
