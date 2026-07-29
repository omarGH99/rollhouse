import React, { useEffect } from 'react';
import { DimensionValue, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Accent, palette, radius } from '../theme';

/**
 * Steps used to fake a radial gradient without a gradient library. Many faint
 * rings rather than few strong ones — at low step counts the ring edges read as
 * visible banding instead of a soft falloff.
 */
const RING_STEPS = 18;

/** Thickness of the padded rail, in px. */
const RAIL_WIDTH = 10;

/** Soft circular haze: concentric discs whose overlap accumulates toward the centre. */
const RadialHaze: React.FC<{
  color: string;
  size: number;
  /** Alpha contributed by each ring; total opacity is roughly this × RING_STEPS. */
  step: number;
}> = ({ color, size, step }) => (
  <View style={[styles.haze, { width: size, height: size }]}>
    {Array.from({ length: RING_STEPS }, (_, i) => {
      const t = i / (RING_STEPS - 1);
      const ringSize = size * (1 - t * 0.78);
      return (
        <View
          key={i}
          style={[
            styles.ring,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              backgroundColor: color,
              opacity: step,
            },
          ]}
        />
      );
    })}
  </View>
);

/**
 * The table itself: green felt under a warm overhead light, with a slow drift so
 * the surface never looks perfectly static. Purely decorative — it never
 * intercepts touches. The active player's metal tints the light very faintly.
 */
export const FeltBackdrop: React.FC<{ accent: Accent }> = ({ accent }) => {
  const { width, height } = useWindowDimensions();
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [drift]);

  const lightStyle = useAnimatedStyle(() => ({
    opacity: 0.85 + drift.value * 0.15,
    transform: [{ scale: 1 + drift.value * 0.04 }],
  }));

  // The lamp hangs over the dice, not the centre of the screen.
  const lightSize = Math.max(width * 1.9, height * 0.95);
  const tintSize = width * 1.5;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* The padded oxblood rail: the table edge players lean on. */}
      <View style={[StyleSheet.absoluteFill, styles.rail]} />
      <View style={[StyleSheet.absoluteFill, styles.railSheen]} />

      {/* Baize inset within the rail, with a brass tack line at the join. */}
      <View style={styles.baize}>
        <View style={[StyleSheet.absoluteFill, styles.baizeFill]} />

        {/*
          Kept deliberately faint: these hazes stack multiplicatively over the
          felt, and much past this the green desaturates to a milky olive.
        */}
        <Animated.View
          style={[styles.lamp, { marginLeft: -lightSize / 2 }, lightStyle]}
        >
          <RadialHaze color="#F0DFAF" size={lightSize} step={0.0055} />
        </Animated.View>

        <View style={[styles.tint, { marginLeft: -tintSize / 2 }]}>
          <RadialHaze color={accent.main} size={tintSize} step={0.003} />
        </View>

        {/* Vignette: the lit table reads as a pool of light within the rail. */}
        <EdgeFade edge="top" height="22%" strength={0.35} />
        <EdgeFade edge="bottom" height="26%" strength={0.6} />
      </View>
    </View>
  );
};

const FADE_STEPS = 12;

/**
 * Vertical fade to the room colour. Built from stacked slices because a single
 * solid rect leaves a hard horizontal seam across the felt.
 */
const EdgeFade: React.FC<{
  edge: 'top' | 'bottom';
  height: DimensionValue;
  strength: number;
}> = ({ edge, height, strength }) => (
  <View
    style={[styles.fade, edge === 'top' ? { top: 0 } : { bottom: 0 }, { height }]}
  >
    {Array.from({ length: FADE_STEPS }, (_, i) => {
      // Densest at the screen edge, clear where it meets the lit table.
      const t = edge === 'top' ? 1 - i / (FADE_STEPS - 1) : i / (FADE_STEPS - 1);
      return (
        <View
          key={i}
          style={[
            styles.fadeSlice,
            { opacity: t * t * strength },
          ]}
        />
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  haze: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Absolute with no insets, so the parent's centering still positions it.
  ring: {
    position: 'absolute',
  },
  lamp: {
    position: 'absolute',
    top: '-22%',
    left: '50%',
  },
  tint: {
    position: 'absolute',
    top: '2%',
    left: '50%',
  },
  rail: {
    backgroundColor: palette.rail,
  },
  /** Light catching the top of the padded rail, dark pooling at the bottom. */
  railSheen: {
    borderTopWidth: RAIL_WIDTH,
    borderBottomWidth: RAIL_WIDTH,
    borderLeftWidth: RAIL_WIDTH,
    borderRightWidth: RAIL_WIDTH,
    borderTopColor: palette.railHighlight,
    borderLeftColor: palette.railHighlight,
    borderRightColor: palette.railDark,
    borderBottomColor: palette.railDark,
    opacity: 0.45,
  },
  baize: {
    ...StyleSheet.absoluteFillObject,
    margin: RAIL_WIDTH,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.railTrim,
    overflow: 'hidden',
  },
  baizeFill: {
    backgroundColor: palette.felt,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  fadeSlice: {
    flex: 1,
    // Fades toward the deep table shadow, not the rail colour.
    backgroundColor: '#04140C',
  },
});
