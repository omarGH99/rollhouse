import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { TOTAL_ROUNDS } from '../logic/scoring';
import { Accent, fonts, palette, spacing, textGlow } from '../theme';
import { Player, PlayerIndex } from '../types';

interface Props {
  players: Player[];
  currentPlayer: PlayerIndex;
  round: number;
  accent: Accent;
  /** True while the active seat is a bot taking its turn. */
  aiThinking: boolean;
}

export const TurnBanner: React.FC<Props> = ({
  players,
  currentPlayer,
  round,
  accent,
  aiThinking,
}) => {
  const enter = useSharedValue(1);

  // Re-announce the active player whenever the turn changes.
  useEffect(() => {
    enter.value = 0;
    enter.value = withSequence(
      withTiming(1.06, { duration: 260, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 180 }),
    );
  }, [currentPlayer, enter]);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: enter.value }],
    opacity: Math.min(1, enter.value),
  }));

  const active = players[currentPlayer];
  const compact = players.length >= 3;

  return (
    <View style={styles.container}>
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.title,
          compact && styles.titleCompact,
          { color: accent.main, ...textGlow(accent.main, 6) },
          titleStyle,
        ]}
      >
        {active.name.toUpperCase()}
      </Animated.Text>

      <View style={styles.subtitleRow}>
        {active.kind === 'ai' ? (
          <Ionicons name="hardware-chip-outline" size={11} color={palette.textMuted} />
        ) : null}
        <Text style={styles.subtitle}>
          {active.kind === 'ai' ? (aiThinking ? 'THINKING' : 'WAITING') : 'YOUR TURN'}
        </Text>
        <Text style={[styles.subtitle, { color: accent.dim }]}>
          {`· ROUND ${round}/${TOTAL_ROUNDS}`}
        </Text>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: spacing(0.5),
    paddingBottom: spacing(1.5),
    paddingHorizontal: spacing(4),
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    // Serif faces read as elegant at normal weight; synthesised bold muddies them.
    fontWeight: '600',
    letterSpacing: 5,
  },
  titleCompact: {
    fontSize: 24,
    letterSpacing: 2,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginTop: spacing(0.5),
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    letterSpacing: 3,
    color: palette.textMuted,
  },
});
