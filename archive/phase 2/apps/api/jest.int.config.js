module.exports = {
  displayName: 'api-int',
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
};
