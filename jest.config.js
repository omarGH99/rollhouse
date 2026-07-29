/**
 * Tests cover `src/logic` only — it is pure TypeScript with no React or React
 * Native imports, so it needs no native transform and runs in plain Node.
 * Component tests would need the `jest-expo` preset instead.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/logic'],
  testMatch: ['**/*.test.ts'],
};
