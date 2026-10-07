import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from './ActionButton';
import { Die } from './Die';
import { FeltBackdrop } from './FeltBackdrop';
import { MAX_ROLLS } from '../logic/gameReducer';
import { CATEGORY_LABELS } from '../logic/scoring';
import { Accent, fonts, palette, radius, spacing, textGlow } from '../theme';
import { Category, DieState } from '../types';

interface Props {
  visible: boolean;
  playerName: string;
  accent: Accent;
  dice: DieState[];
  rollsLeft: number;
  hasRolled: boolean;
  rollNonce: number;
  canRoll: boolean;
  /** What the dice as they lie would score, per box they may go in. */
  previews: Partial<Record<Category, number>>;
  /** The device can be shaken to throw, so the copy should say so. */
  shakeSupported: boolean;
  onRoll: () => void;
  onToggleHold: (dieId: number) => void;
  /** Leave for the scorecard. */
  onDone: () => void;
}

/** Where a die came to rest: a nudge off its slot and a turn. */
interface Lie {
  dx: number;
  dy: number;
  turn: number;
}

const SQUARE: Lie = { dx: 0, dy: 0, turn: 0 };
const BEST_SHOWN = 3;

const scatter = (): Lie => ({
  dx: (Math.random() - 0.5) * 18,
  dy: (Math.random() - 0.5) * 22,
  turn: (Math.random() - 0.5) * 30,
});

/**
 * The throwing page: nothing but the dice, large, on the felt.
 *
 * Rolling used to share a screen with thirteen score rows, which left the dice
 * small and the throw itself an afterthought. Here the turn opens on the dice,
 * a shake (or the button) throws them, and the scorecard is one tap away once
 * the player has seen enough.
 */
export const ThrowScreen: React.FC<Props> = ({
  visible,
  playerName,
  accent,
  dice,
  rollsLeft,
  hasRolled,
  rollNonce,
  canRoll,
  previews,
  shakeSupported,
  onRoll,
  onToggleHold,
  onDone,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Each throw scatters the dice that were thrown and leaves kept ones exactly
  // where they lay. Held in a ref and advanced during render, keyed on the
  // roll, so the new lie is in place on the same frame the dice start to tumble.
  const lies = useRef<{ nonce: number; byDie: Record<number, Lie> }>({
    nonce: -1,
    byDie: {},
  });
  if (lies.current.nonce !== rollNonce) {
    const byDie: Record<number, Lie> = {};
    for (const die of dice) {
      const kept = die.held && lies.current.byDie[die.id];
      byDie[die.id] = !hasRolled ? SQUARE : kept || scatter();
    }
    lies.current = { nonce: rollNonce, byDie };
  }

  if (!visible) return null;

  const gap = spacing(6);
  const dieSize = Math.min(92, Math.floor((width - spacing(16) - gap * 2) / 3));
  const thrown = MAX_ROLLS - rollsLeft;

  const best = (Object.entries(previews) as [Category, number][])
    .filter(([, points]) => points > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, BEST_SHOWN);

  const throwLabel = !hasRolled
    ? 'THROW DICE'
    : rollsLeft > 0
      ? `THROW AGAIN  ·  ${rollsLeft} LEFT`
      : 'NO THROWS LEFT';

  const hint = !hasRolled
    ? shakeSupported
      ? 'Shake your phone, or tap throw'
      : 'Tap throw to roll the dice'
    : rollsLeft > 0
      ? shakeSupported
        ? 'Tap dice to keep them, then shake again'
        : 'Tap dice to keep them, then throw the rest'
      : 'That was your last throw';

  const renderDie = (die: DieState, index: number) => {
    const lie = lies.current.byDie[die.id] ?? SQUARE;
    return (
      <View
        key={die.id}
        style={{
          transform: [
            { translateX: lie.dx },
            { translateY: lie.dy },
            { rotate: `${lie.turn}deg` },
          ],
        }}
      >
        <Die
          index={index}
          value={die.value}
          held={die.held}
          size={dieSize}
          accent={accent}
          rollNonce={rollNonce}
          disabled={!hasRolled || rollsLeft === 0}
          onPress={() => onToggleHold(die.id)}
        />
      </View>
    );
  };

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        {
          paddingTop: insets.top + spacing(6),
          paddingBottom: insets.bottom + spacing(6),
        },
      ]}
    >
      <FeltBackdrop accent={accent} />

      <View style={styles.header}>
        <Text
          numberOfLines={1}
          style={[styles.player, { color: accent.main }, textGlow(accent.main, 10)]}
        >
          {playerName.toUpperCase()}
        </Text>
        <Text style={styles.count}>
          {hasRolled ? `THROW ${thrown} OF ${MAX_ROLLS}` : 'YOUR THROW'}
        </Text>
        <View
          style={styles.pips}
          accessibilityRole="progressbar"
          accessibilityLabel={`${rollsLeft} of ${MAX_ROLLS} throws remaining`}
        >
          {Array.from({ length: MAX_ROLLS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                i < rollsLeft
                  ? { backgroundColor: accent.main, borderColor: accent.main }
                  : styles.pipSpent,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Dice not yet thrown sit dimmed and square, as if still in the cup. */}
      <View style={[styles.table, !hasRolled && styles.tableWaiting]}>
        <View style={[styles.diceRow, { gap }]}>{dice.slice(0, 3).map(renderDie)}</View>
        <View style={[styles.diceRow, { gap }]}>
          {dice.slice(3).map((die, i) => renderDie(die, i + 3))}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.best}>
          {best.map(([category, points]) => (
            <View key={category} style={[styles.chip, { borderColor: accent.soft }]}>
              <Text style={styles.chipLabel}>{CATEGORY_LABELS[category]}</Text>
              <Text style={[styles.chipPoints, { color: accent.main }]}>{points}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.hint}>{hint}</Text>

        <ActionButton
          label={throwLabel}
          accent={accent}
          onPress={onRoll}
          disabled={!canRoll}
          pulse={!hasRolled}
          size="lg"
          style={styles.throw}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasRolled ? 'Score this hand' : 'View scorecard'}
          onPress={onDone}
          hitSlop={8}
          style={[styles.done, hasRolled && { borderColor: accent.dim }]}
        >
          <Text style={[styles.doneText, hasRolled && { color: palette.textLight }]}>
            {hasRolled ? 'SCORE THIS HAND' : 'VIEW SCORECARD'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={15}
            color={hasRolled ? palette.textLight : palette.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    zIndex: 40,
    backgroundColor: palette.bg,
    paddingHorizontal: spacing(6),
  },
  header: {
    alignItems: 'center',
  },
  player: {
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: 3,
  },
  count: {
    marginTop: spacing(1),
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: palette.textMuted,
  },
  pips: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  pip: {
    width: 28,
    height: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pipSpent: {
    backgroundColor: 'transparent',
    borderColor: palette.hairlineSoft,
  },
  table: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(9),
  },
  tableWaiting: {
    opacity: 0.35,
  },
  diceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  best: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing(2),
    // Reserved even when empty, so the buttons do not jump after a throw.
    minHeight: 30,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: palette.panelStrong,
  },
  chipLabel: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: palette.textMuted,
  },
  chipPoints: {
    fontFamily: fonts.numeric,
    fontSize: 13,
    fontWeight: '800',
  },
  hint: {
    marginTop: spacing(4),
    marginBottom: spacing(3),
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 11.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.textMuted,
  },
  throw: {
    alignSelf: 'stretch',
  },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    alignSelf: 'stretch',
    marginTop: spacing(3),
    paddingVertical: spacing(3.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.hairlineSoft,
  },
  doneText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: palette.textMuted,
  },
});
