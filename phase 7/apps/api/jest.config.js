module.exports = {
  displayName: 'api-unit',
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@pholo/types$': '<rootDir>/../../packages/types/src' },
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};
