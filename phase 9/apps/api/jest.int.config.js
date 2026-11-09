module.exports = {
  displayName: 'api-int',
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@pholo/types$': '<rootDir>/../../packages/types/src' },
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
};
