module.exports = function (api) {
  // Keyed on NODE_ENV so the test and app variants below get separate cache
  // entries rather than whichever ran first.
  api.cache.using(() => process.env.NODE_ENV);

  /**
   * The worklets plugin rewrites functions for the UI thread, and under Jest it
   * also mangles React Native's own component mocks — `Text` ends up without a
   * prototype, which breaks every render. Reanimated is mocked wholesale in
   * `jest.setup.js`, so no worklet ever runs in tests and the plugin has
   * nothing useful to do there.
   */
  const isTest = process.env.NODE_ENV === 'test';

  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 moved worklet transformation into react-native-worklets.
    // It still has to be listed last.
    plugins: isTest ? [] : ['react-native-worklets/plugin'],
  };
};
