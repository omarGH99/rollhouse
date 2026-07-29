/**
 * Expo's config already bundles the React, React Hooks and React Native
 * plugins. The additions here are the rules that would have caught real
 * mistakes in this codebase rather than style preferences.
 */
module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['node_modules/', 'assets/', '.expo/', 'dist/', 'coverage/'],
  rules: {
    // Hand-written dependency arrays are where the subtle bugs live; the one
    // deliberate exception in Die.tsx carries an inline disable and a reason.
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    // Unused code should not accumulate silently. Leading-underscore args are
    // the escape hatch for intentionally ignored parameters.
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // The console is the only error sink until a crash reporter exists, so
    // warn and error stay allowed and plain logging does not.
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      env: { jest: true },
      rules: { 'no-console': 'off' },
    },
  ],
};
