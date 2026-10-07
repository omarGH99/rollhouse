/* eslint-env jest */

/**
 * Native modules the components pull in that have no meaningful behaviour in a
 * test renderer. Each is stubbed at the smallest surface the code actually
 * touches, so a stub going stale shows up as a failing test rather than a
 * silently wrong pass.
 */

/**
 * Reanimated, mocked by hand.
 *
 * Reanimated 4 delegates worklets to react-native-worklets, whose `.native`
 * entry points throw under Jest because there is no native runtime. Its own
 * `/mock` entry still imports that chain, and the resolver shim it ships
 * breaks React Native's component mocks. Mocking the surface this app actually
 * uses sidesteps all of it, and keeps animated styles resolving to their
 * settled values so layout assertions stay meaningful.
 */
jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');

  // Animation helpers collapse to their destination value.
  const toValue = (value) => value;
  const identityFirst = (first) => first;

  const easingFn = () => 0;
  const easingFactory = () => easingFn;
  const Easing = new Proxy(
    {},
    { get: () => Object.assign(easingFactory, { factory: easingFactory }) },
  );

  return {
    __esModule: true,
    default: {
      View,
      Text,
      createAnimatedComponent: (Component) => Component,
    },
    useSharedValue: (initial) => ({ value: initial }),
    // Styles are read once, at their initial values.
    useAnimatedStyle: (factory) => factory(),
    useAnimatedRef: () => ({ current: null }),
    useDerivedValue: (factory) => ({ value: factory() }),
    withTiming: toValue,
    withSpring: toValue,
    withDelay: (_delay, value) => value,
    withSequence: identityFirst,
    withRepeat: identityFirst,
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    interpolate: (value, input = [0, 1], output = [0, 1]) => {
      const lo = input[0];
      const hi = input[input.length - 1];
      const t = hi === lo ? 0 : (value - lo) / (hi - lo);
      return output[0] + t * (output[output.length - 1] - output[0]);
    },
    interpolateColor: (_value, _input, output) => output[0],
    Easing,
  };
});

// Icon sets reach into expo-font's loaded-font registry, which does not exist
// under the test renderer. The stub keeps the icon name queryable so tests can
// still assert which glyph a component chose.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Icon = ({ name, ...rest }) =>
    React.createElement(View, { testID: `icon-${name}`, ...rest });
  return { Ionicons: Icon, MaterialIcons: Icon, Feather: Icon };
});

// expo-blur renders a native view; a plain View is enough for assertions.
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

// Haptics are fire-and-forget and already best-effort in app code.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// No accelerometer under test; shaking is covered by the pure detector.
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(false)),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// In-memory AsyncStorage, so persistence paths run without a native module.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __resetStore: () => {
      store = {};
    },
    getItem: jest.fn((k) => Promise.resolve(k in store ? store[k] : null)),
    setItem: jest.fn((k, v) => {
      store[k] = v;
      return Promise.resolve();
    }),
    removeItem: jest.fn((k) => {
      delete store[k];
      return Promise.resolve();
    }),
  };
});

// Safe-area insets: zero, matching the web target the layout was tuned against.
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// Silence the noisy act() advice from animation timers; real failures still log.
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
