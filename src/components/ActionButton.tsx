import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Accent, fonts, palette, radius, shadow, textGlow } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  label: string;
  accent: Accent;
  onPress: () => void;
  disabled?: boolean;
  /** Slow breathing glow — used for the primary CTA on results / handoff. */
  pulse?: boolean;
  size?: 'md' | 'lg';
  style?: ViewStyle;
}

export const ActionButton: React.FC<Props> = ({
  label,
  accent,
  onPress,
  disabled = false,
  pulse = false,
  size = 'md',
  style,
}) => {
  const pressed = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (!pulse || disabled) {
      breathe.value = withTiming(0, { duration: 220 });
      return;
    }
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse, disabled, breathe]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 + breathe.value * 0.012 }],
    // Pressing seats the button into the felt; the pulse lifts it slightly.
    shadowOpacity: disabled ? 0 : 0.45 - pressed.value * 0.3 + breathe.value * 0.2,
    borderColor: disabled ? palette.hairlineSoft : accent.main,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => {
        pressed.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 18, stiffness: 320 });
      }}
      onPress={onPress}
      style={[
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        {
          backgroundColor: disabled ? 'rgba(244,237,221,0.03)' : accent.soft,
          ...shadow(size === 'lg' ? 10 : 6),
        },
        animatedStyle,
        style,
      ]}
    >
      <Text
        // Two lines rather than an ellipsis: a clipped CTA is worse than a tall one.
        numberOfLines={2}
        style={[
          styles.label,
          size === 'lg' ? styles.labelLg : styles.labelMd,
          disabled
            ? { color: palette.textFaint }
            : { color: accent.main, ...textGlow(accent.main, 6) },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  md: { paddingVertical: 14, paddingHorizontal: 26 },
  lg: { paddingVertical: 20, paddingHorizontal: 30 },
  label: {
    fontFamily: fonts.display,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelMd: { fontSize: 15, letterSpacing: 1.6 },
  labelLg: { fontSize: 17, letterSpacing: 2 },
});
