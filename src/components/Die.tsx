import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Accent, palette, radius, shadow } from '../theme';
import { DieValue } from '../types';

/** 3x3 pip grid — which cells are lit for each face. */
const PIP_LAYOUT: Record<DieValue, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const SCRAMBLE_MS = 420;
const SCRAMBLE_TICK_MS = 55;

/** How far a held die sits proud of the tray, in px. */
const HELD_LIFT = -6;

interface Props {
  value: DieValue;
  held: boolean;
  size: number;
  accent: Accent;
  /** Increments on every roll; drives the tumble + scramble animation. */
  rollNonce: number;
  disabled?: boolean;
  onPress: () => void;
  /** Stagger so the five dice don't land in lockstep. */
  index: number;
}

export const Die: React.FC<Props> = ({
  value,
  held,
  size,
  accent,
  rollNonce,
  disabled = false,
  onPress,
  index,
}) => {
  const [face, setFace] = useState<DieValue>(value);
  const scrambling = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Roll rotation, in degrees. Swings negative first, then over-rotates. */
  const tilt = useSharedValue(0);
  /** Vertical jitter during the throw. */
  const hop = useSharedValue(0);
  /** Scale pulse during the throw. */
  const pulse = useSharedValue(0);
  const heldProgress = useSharedValue(held ? 1 : 0);
  const press = useSharedValue(0);

  // Throw + face scramble on each roll. Held dice are excluded entirely: they
  // keep their raised, accent-ringed position while the others tumble.
  useEffect(() => {
    if (rollNonce === 0 || held) {
      setFace(value);
      return;
    }

    const delay = index * 45;
    const start = setTimeout(() => {
      // -12deg wind-up, over-swing to 15deg, then spring back to square.
      tilt.value = withSequence(
        withTiming(-12, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(15, { duration: 190, easing: Easing.inOut(Easing.quad) }),
        withSpring(0, { damping: 11, stiffness: 190 }),
      );
      hop.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 8, stiffness: 240 }),
      );
      pulse.value = withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 12, stiffness: 260 }),
      );

      scrambling.current = setInterval(() => {
        setFace(((Math.floor(Math.random() * 6) + 1) as DieValue));
      }, SCRAMBLE_TICK_MS);

      setTimeout(() => {
        if (scrambling.current) clearInterval(scrambling.current);
        scrambling.current = null;
        setFace(value);
      }, SCRAMBLE_MS);
    }, delay);

    return () => {
      clearTimeout(start);
      if (scrambling.current) clearInterval(scrambling.current);
      scrambling.current = null;
    };
    // `value` is intentionally read fresh per roll; rollNonce is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollNonce]);

  // Keep the displayed face honest if state changes outside a roll (e.g. reset).
  useEffect(() => {
    if (!scrambling.current) setFace(value);
  }, [value]);

  useEffect(() => {
    heldProgress.value = withSpring(held ? 1 : 0, { damping: 15, stiffness: 220 });
  }, [held, heldProgress]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 },
      { rotate: `${tilt.value}deg` },
      {
        // Held dice rest 6px proud of the tray; the throw jitter adds to that
        // only for dice that are actually being rerolled.
        translateY:
          heldProgress.value * HELD_LIFT + interpolate(hop.value, [0, 1], [0, -14]),
      },
      {
        scale:
          1 + pulse.value * 0.08 - press.value * 0.06 + heldProgress.value * 0.03,
      },
    ],
  }));

  const faceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      heldProgress.value,
      [0, 1],
      [palette.dieFace, palette.dieFaceHeld],
    ),
    borderColor: interpolateColor(
      heldProgress.value,
      [0, 1],
      [palette.dieEdge, accent.main],
    ),
    borderWidth: interpolate(heldProgress.value, [0, 1], [1, 2.5]),
  }));

  // Held dice are ringed in the player's metal — no scrim, since darkening a
  // bone-white die reads as "disabled" rather than "kept".
  const haloStyle = useAnimatedStyle(() => ({
    opacity: heldProgress.value * 0.5,
    transform: [{ scale: 0.96 + heldProgress.value * 0.04 }],
  }));

  const pipSize = Math.round(size * 0.155);
  const lit = PIP_LAYOUT[face];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Die showing ${face}${held ? ', held' : ''}`}
      accessibilityState={{ selected: held, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(1, { damping: 20, stiffness: 400 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 20, stiffness: 400 });
      }}
      hitSlop={6}
    >
      <Animated.View style={[{ width: size, height: size }, containerStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              borderRadius: radius.md + 6,
              borderColor: accent.main,
            },
            haloStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.face,
            { borderRadius: radius.md, opacity: disabled ? 0.8 : 1 },
            shadow(8),
            faceStyle,
          ]}
        >
          <View style={styles.grid}>
            {Array.from({ length: 9 }, (_, cell) => (
              <View key={cell} style={styles.cell}>
                {lit.includes(cell) ? (
                  <View
                    style={[
                      styles.pip,
                      {
                        width: pipSize,
                        height: pipSize,
                        borderRadius: pipSize / 2,
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  halo: {
    ...StyleSheet.absoluteFillObject,
    margin: -5,
    borderWidth: 1.5,
  },
  face: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: '11%',
  },
  cell: {
    width: '33.333%',
    height: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pip: {
    backgroundColor: palette.diePip,
  },
});
