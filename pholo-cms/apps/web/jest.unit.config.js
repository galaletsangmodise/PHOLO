const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: __dirname });

module.exports = createJestConfig({
  displayName: 'web-unit',
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/tokens.test.ts',
    '<rootDir>/__tests__/env.test.ts',
    '<rootDir>/__tests__/no-hardcoded-values.test.ts',
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
});
