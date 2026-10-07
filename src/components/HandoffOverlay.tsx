import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ActionButton } from './ActionButton';
import { CATEGORY_LABELS } from '../logic/scoring';
import { accents, fonts, palette, radius, spacing, textGlow } from '../theme';
import { LastScored, Player, PlayerIndex } from '../types';

interface Props {
  visible: boolean;
  players: Player[];
  /** The player who must pick the device up. */
  incomingPlayer: PlayerIndex;
  /** Round that was just played. */
  completedRound: number;
  /** True once every seat has taken its turn in that round. */
  roundFullyComplete: boolean;
  lastScored: LastScored | null;
  /** More than one human seat, so the device physically changes hands. */
  passDevice: boolean;
  /** Whose score undo would take back; null hides the control. */
  undoPlayer: PlayerIndex | null;
  onBegin: () => void;
  onUndo: () => void;
}

/**
 * The boundary between turns.
 *
 * Not a privacy screen: the game has no hidden information — every score is
 * public on a shared card — and this very screen reports the move just played.
 * What it buys is a deliberate stop, so nobody rolls on someone else's turn,
 * and a beat to see what happened.
 *
 * Undo lives here because this is the one moment the player who just scored is
 * still the one holding the device. Against bots that same person is also the
 * one coming up next, so the label says "my"; otherwise it names the seat.
 */
export const HandoffOverlay: React.FC<Props> = ({
  visible,
  players,
  incomingPlayer,
  completedRound,
  roundFullyComplete,
  lastScored,
  passDevice,
  undoPlayer,
  onBegin,
  onUndo,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 260 : 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }],
  }));

  const accent = accents[incomingPlayer];
  const incoming = players[incomingPlayer];

  const undoLabel =
    undoPlayer === null
      ? null
      : undoPlayer === incomingPlayer
        ? 'Undo my last score'
        : `Undo ${players[undoPlayer].name}'s last score`;

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, backdropStyle]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <Animated.View style={[styles.card, cardStyle]}>
        <View style={[styles.iconRing, { borderColor: accent.soft }]}>
          <Ionicons name="swap-horizontal" size={30} color={accent.main} />
        </View>

        <Text style={styles.eyebrow}>
          {roundFullyComplete
            ? `ROUND ${completedRound} COMPLETE`
            : `ROUND ${completedRound} · TURN COMPLETE`}
        </Text>

        {lastScored ? (
          <View
            style={[styles.lastScore, { borderColor: accents[lastScored.player].soft }]}
          >
            <Text
              style={[styles.lastScoreLabel, { color: accents[lastScored.player].dim }]}
            >
              {players[lastScored.player].name} · {CATEGORY_LABELS[lastScored.category]}
            </Text>
            <Text
              style={[
                styles.lastScorePoints,
                {
                  color:
                    lastScored.points > 0
                      ? accents[lastScored.player].main
                      : palette.textFaint,
                },
                lastScored.points > 0 && textGlow(accents[lastScored.player].main, 6),
              ]}
            >
              +{lastScored.points}
            </Text>
            {lastScored.bonus > 0 ? (
              <Text style={[styles.lastScoreBonus, { color: palette.brassBright }]}>
                +{lastScored.bonus} BONUS
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.headline}>
          {passDevice ? 'Pass the device to' : 'Up next'}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.player, { color: accent.main, ...textGlow(accent.main, 12) }]}
        >
          {incoming.name.toUpperCase()}
        </Text>

        <Text style={styles.caution}>
          {passDevice
            ? 'Hand the device over before tapping in.'
            : 'Take a look at the board, then tap in when you are ready.'}
        </Text>

        <ActionButton
          label="START MY TURN"
          accent={accent}
          onPress={onBegin}
          size="lg"
          pulse
          style={styles.cta}
        />

        {undoLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={undoLabel}
            onPress={onUndo}
            hitSlop={10}
            style={styles.undo}
          >
            <Ionicons name="arrow-undo-outline" size={14} color={palette.textDim} />
            <Text style={styles.undoText}>{undoLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
  },
  scrim: {
    backgroundColor: 'rgba(5, 13, 9, 0.93)',
  },
  card: {
    alignItems: 'center',
    width: '100%',
  },
  iconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(5),
  },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    letterSpacing: 3,
    color: palette.textDim,
    fontWeight: '700',
  },
  lastScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    marginTop: spacing(4),
  },
  lastScoreLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  lastScorePoints: {
    fontFamily: fonts.numeric,
    fontSize: 16,
    fontWeight: '700',
  },
  lastScoreBonus: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headline: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.textDim,
    letterSpacing: 1,
    marginTop: spacing(7),
  },
  player: {
    fontFamily: fonts.display,
    fontSize: 40,
    fontWeight: '600',
    letterSpacing: 3,
    marginTop: spacing(1),
  },
  caution: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: palette.textFaint,
    letterSpacing: 0.6,
    marginTop: spacing(3),
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing(8),
    alignSelf: 'stretch',
  },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(5),
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
  },
  undoText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: palette.textDim,
    letterSpacing: 0.5,
  },
});
