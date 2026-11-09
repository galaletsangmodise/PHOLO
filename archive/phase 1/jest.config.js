/** Root Jest config: each test level is its own project (see Section 12.2 of the plan). */
module.exports = {
  testTimeout: 30000,
  projects: [
    '<rootDir>/packages/types/jest.config.js',
    '<rootDir>/apps/api/jest.config.js',
    '<rootDir>/apps/api/jest.int.config.js',
    '<rootDir>/apps/web/jest.unit.config.js',
    '<rootDir>/apps/web/jest.component.config.js',
    '<rootDir>/supabase/tests/jest.config.js',
  ],
};
