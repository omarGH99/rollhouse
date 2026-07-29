/**
 * Two projects, because the two halves of the codebase have different needs.
 *
 * `src/logic` is pure TypeScript with no React or React Native imports, so it
 * runs fastest and most simply under ts-jest in plain Node. Components need the
 * full `jest-expo` transform to handle React Native's untranspiled ESM, native
 * module mocks, and the asset pipeline.
 */
module.exports = {
  projects: [
    {
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/logic'],
      testMatch: ['**/*.test.ts'],
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      roots: ['<rootDir>/src/components', '<rootDir>/src/hooks'],
      testMatch: ['**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    },
  ],
};
