import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { Accent, palette, radius } from '../theme';

/** Thickness of the padded rail, in px. */
const RAIL_WIDTH = 10;

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

/**
 * The table: green baize under a warm overhead light, inside a padded oxblood
 * rail. Purely decorative — it never intercepts touches.
 *
 * The gradients are real SVG rather than stacked Views. The previous version
 * faked each one with concentric discs and sliced strips, which cost around
 * eighty nodes and still banded visibly at the edges; this is three rects with
 * a true falloff. The active player's metal tints the light very faintly.
 */
const FeltBackdropInner: React.FC<{ accent: Accent }> = ({ accent }) => {
  const { width, height } = useWindowDimensions();
  const drift = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [drift, reduceMotion]);

  // The lamp breathes rather than travels, so the felt never looks static.
  const lampStyle = useAnimatedStyle(() => ({
    opacity: 0.85 + drift.value * 0.15,
  }));

  const w = Math.max(width, 1);
  const h = Math.max(height, 1);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Padded oxblood rail, lit from above and shadowed below. */}
      <View style={[StyleSheet.absoluteFill, styles.rail]} />
      <View style={[StyleSheet.absoluteFill, styles.railSheen]} />

      {/* Baize inset within the rail, with a brass tack line at the join. */}
      <View style={styles.baize}>
        <View style={[StyleSheet.absoluteFill, styles.baizeFill]} />

        <AnimatedSvg
          style={[StyleSheet.absoluteFill, lampStyle]}
          width={w}
          height={h}
          pointerEvents="none"
        >
          <Defs>
            {/* Overhead lamp, hung above the dice rather than screen centre. */}
            <RadialGradient id="lamp" cx="50%" cy="26%" rx="78%" ry="58%">
              <Stop offset="0%" stopColor="#F0DFAF" stopOpacity={0.2} />
              <Stop offset="55%" stopColor="#F0DFAF" stopOpacity={0.06} />
              <Stop offset="100%" stopColor="#F0DFAF" stopOpacity={0} />
            </RadialGradient>

            {/* A whisper of the active seat's metal in the light. */}
            <RadialGradient id="tint" cx="50%" cy="30%" rx="62%" ry="46%">
              <Stop offset="0%" stopColor={accent.main} stopOpacity={0.11} />
              <Stop offset="100%" stopColor={accent.main} stopOpacity={0} />
            </RadialGradient>

            {/* Vignette, so the lit table reads as a pool of light. */}
            <LinearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#04140C" stopOpacity={0.42} />
              <Stop offset="28%" stopColor="#04140C" stopOpacity={0} />
              <Stop offset="70%" stopColor="#04140C" stopOpacity={0} />
              <Stop offset="100%" stopColor="#04140C" stopOpacity={0.62} />
            </LinearGradient>
          </Defs>

          <Rect x={0} y={0} width={w} height={h} fill="url(#lamp)" />
          <Rect x={0} y={0} width={w} height={h} fill="url(#tint)" />
          <Rect x={0} y={0} width={w} height={h} fill="url(#vignette)" />
        </AnimatedSvg>
      </View>
    </View>
  );
};

/**
 * Depends on nothing but the seat accent, which is an identity-stable object,
 * so this only re-renders when the turn passes to a different player.
 */
export const FeltBackdrop = React.memo(FeltBackdropInner);
FeltBackdrop.displayName = 'FeltBackdrop';

const styles = StyleSheet.create({
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
});
