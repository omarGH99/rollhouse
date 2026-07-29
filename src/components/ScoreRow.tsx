import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CATEGORY_ICONS } from './categoryIcons';
import { CATEGORY_HINTS, CATEGORY_LABELS } from '../logic/scoring';
import {
  Accent,
  INACTIVE_SEAT_OPACITY,
  fonts,
  palette,
  radius,
  seatAccent,
  spacing,
} from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Category, PlayerIndex, ScoreSheet } from '../types';

/** Column width shrinks as seats are added, so four still fit on a phone. */
export const cellWidth = (playerCount: number): number =>
  playerCount >= 4 ? 40 : playerCount === 3 ? 48 : 58;

/** Faint, slowly pulsing "you could score this" number. */
const PreviewScore: React.FC<{
  points: number;
  nonce: number;
  compact: boolean;
}> = ({ points, nonce, compact }) => {
  const pulse = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    pulse.value = 0;
    // Decorative only — the number is legible without it.
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [nonce, pulse, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.45,
    transform: [{ scale: 0.97 + pulse.value * 0.05 }],
  }));

  return (
    <Animated.Text
      style={[
        styles.cellText,
        compact && styles.cellTextCompact,
        // A prospective score is by definition still available: green.
        { color: palette.cardOpen },
        points === 0 && styles.zeroPreview,
        style,
      ]}
    >
      {points}
    </Animated.Text>
  );
};

interface Props {
  category: Category;
  /**
   * Every seat's sheet. Passed whole rather than as a pre-sliced values array
   * because `scores` keeps its identity while only the dice change — a fresh
   * array per render would break the memo below on every roll and hold.
   */
  scores: ScoreSheet[];
  currentPlayer: PlayerIndex;
  accent: Accent;
  /** Points the current player would score right now, if the row is open. */
  preview?: number;
  /** Changes whenever the dice change, so the pulse restarts in sync. */
  previewNonce: number;
  /** The box is still open to the active player, whether or not they can tap it yet. */
  available: boolean;
  /** The active player has rolled, so open/spent colouring is meaningful. */
  rolled: boolean;
  selectable: boolean;
  justScored: boolean;
  onSelect: (category: Category) => void;
}

const ScoreRowInner: React.FC<Props> = ({
  category,
  scores,
  currentPlayer,
  accent,
  preview,
  previewNonce,
  available,
  rolled,
  selectable,
  justScored,
  onSelect,
}) => {
  const flash = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    if (!justScored) return;
    flash.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 620, easing: Easing.in(Easing.quad) }),
    );
  }, [justScored, flash]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: selectable ? `${accent.ink}0E` : 'transparent',
    transform: [{ scale: 1 - press.value * 0.012 + flash.value * 0.02 }],
  }));

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.8 }));

  const values = scores.map((sheet) => sheet[category]);
  const isYahtzee = category === 'yahtzee';
  const width = cellWidth(values.length);
  const compact = values.length >= 4;

  /**
   * The card reads as plain black ink until the dice are in play. Once the
   * active player has rolled it lights up: green where a box is still open to
   * them, red where it is already spent.
   */
  const statusColor = !rolled
    ? palette.cardInk
    : available
      ? palette.cardOpen
      : palette.cardClosed;

  return (
    <Animated.View style={[styles.rowWrap, rowStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `${accent.ink}40`, borderRadius: radius.sm },
          flashStyle,
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${CATEGORY_LABELS[category]}${
          preview !== undefined ? `, worth ${preview} points` : ''
        }`}
        accessibilityState={{ disabled: !selectable }}
        disabled={!selectable}
        onPress={() => onSelect(category)}
        onPressIn={() => {
          press.value = withSpring(1, { damping: 20, stiffness: 400 });
        }}
        onPressOut={() => {
          press.value = withSpring(0, { damping: 20, stiffness: 400 });
        }}
        style={styles.row}
      >
        <Ionicons
          name={CATEGORY_ICONS[category]}
          size={17}
          color={statusColor}
          style={styles.icon}
        />

        {/*
          Label and hint share one line via nested Text. Stacked they cost a
          second line in every one of the 13 rows, which is what pushed the
          board past a single screen.
        */}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            isYahtzee && styles.labelYahtzee,
            // Struck through when spent. Roughly 1 in 12 men cannot separate
            // the green/red pair, so availability must not rest on colour.
            !available && styles.labelSpent,
            { color: statusColor },
          ]}
        >
          {CATEGORY_LABELS[category]}
          <Text style={[styles.hint, { color: statusColor }]}>
            {`   ${CATEGORY_HINTS[category]}`}
          </Text>
        </Text>

        {values.map((value, player) => {
          const accentOf = seatAccent(player);
          const isActive = player === currentPlayer;
          // A prospective score: this box is open and these are the live dice.
          const showsPreview = value === null && isActive && preview !== undefined;

          return (
            <View
              key={player}
              style={[
                styles.cell,
                { width },
                // The active seat's cell is tinted to match its status, so the
                // fill and the figure inside it always agree.
                isActive && {
                  backgroundColor: `${statusColor}12`,
                  borderColor: `${statusColor}33`,
                },
                showsPreview && {
                  backgroundColor: `${statusColor}24`,
                  borderColor: `${statusColor}55`,
                },
                // Inactive seats recede so the live column is unambiguous.
                !isActive && { opacity: INACTIVE_SEAT_OPACITY },
              ]}
            >
              {value !== null ? (
                <Text
                  style={[
                    styles.cellText,
                    compact && styles.cellTextCompact,
                    // The active player's own spent boxes take the status
                    // colour; other seats keep their identity colour, since
                    // they are information rather than a choice being offered.
                    { color: isActive ? statusColor : accentOf.ink },
                  ]}
                >
                  {value}
                </Text>
              ) : showsPreview ? (
                <PreviewScore
                  points={preview!}
                  nonce={previewNonce}
                  compact={compact}
                />
              ) : (
                <Text style={[styles.empty, isActive && { color: statusColor }]}>
                  –
                </Text>
              )}
            </View>
          );
        })}
      </Pressable>
    </Animated.View>
  );
};

/**
 * Thirteen of these are mounted at once and the AI driver dispatches roughly
 * five times a second while it plays, so re-rendering them all on every tick
 * was the app's hottest path. Every prop is either a primitive or an
 * identity-stable object, so the default shallow comparison is enough.
 */
export const ScoreRow = React.memo(ScoreRowInner);
ScoreRow.displayName = 'ScoreRow';

const styles = StyleSheet.create({
  rowWrap: {
    // Square rather than rounded: rows are ruled like a printed ledger, and a
    // radius reads oddly against a full-width divider.
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: palette.cardRule,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Sized for the finger, not the pixel budget: this is the app's primary
    // control, repeated thirteen times.
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(2),
  },
  icon: {
    width: 22,
  },
  label: {
    flex: 1,
    paddingRight: spacing(1.5),
    fontFamily: fonts.body,
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelSpent: {
    textDecorationLine: 'line-through',
  },
  labelYahtzee: {
    letterSpacing: 2,
    fontFamily: fonts.display,
    fontWeight: '700',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.72,
    marginTop: 0.5,
    letterSpacing: 0.4,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(0.75),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellText: {
    fontFamily: fonts.numeric,
    fontSize: 19,
    fontWeight: '800',
  },
  cellTextCompact: {
    fontSize: 16,
  },
  zeroPreview: {
    textDecorationLine: 'line-through',
  },
  empty: {
    fontFamily: fonts.numeric,
    fontSize: 16,
    fontWeight: '700',
    color: palette.cardInkMuted,
    opacity: 0.6,
  },
});
