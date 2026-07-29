import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Die } from './Die';
import { ActionButton } from './ActionButton';
import { MAX_ROLLS } from '../logic/gameReducer';
import { Accent, fonts, palette, radius, spacing } from '../theme';
import { DieState } from '../types';

interface Props {
  dice: DieState[];
  accent: Accent;
  rollsLeft: number;
  hasRolled: boolean;
  rollNonce: number;
  canRoll: boolean;
  /** True while a bot holds the turn; the tray becomes read-only. */
  aiThinking: boolean;
  onRoll: () => void;
  onToggleHold: (dieId: number) => void;
}

const GAP = spacing(2.5);
const H_PADDING = spacing(5);

export const DiceTray: React.FC<Props> = ({
  dice,
  accent,
  rollsLeft,
  hasRolled,
  rollNonce,
  canRoll,
  aiThinking,
  onRoll,
  onToggleHold,
}) => {
  const { width } = useWindowDimensions();
  // Capped smaller than the tray allows, to keep the board on one screen.
  const dieSize = Math.min(
    56,
    Math.floor((width - H_PADDING * 2 - GAP * (dice.length - 1)) / dice.length),
  );

  // Holding only matters while a reroll remains — and never on a bot's turn.
  const holdDisabled = !hasRolled || rollsLeft === 0 || aiThinking;

  const rollLabel = aiThinking
    ? 'BOT IS PLAYING'
    : !hasRolled
      ? 'ROLL DICE'
      : rollsLeft > 0
        ? `ROLL AGAIN  ·  ${rollsLeft} LEFT`
        : 'NO ROLLS LEFT';

  const hint = aiThinking
    ? 'Watching the bot take its turn'
    : !hasRolled
      ? 'Tap roll to start your turn'
      : rollsLeft > 0
        ? 'Tap dice to hold them'
        : 'Choose a category below';

  return (
    <View style={styles.container}>
      <View style={[styles.row, { gap: GAP }]}>
        {dice.map((die, index) => (
          <Die
            key={die.id}
            index={index}
            value={die.value}
            held={die.held}
            size={dieSize}
            accent={accent}
            rollNonce={rollNonce}
            disabled={holdDisabled}
            onPress={() => onToggleHold(die.id)}
          />
        ))}
      </View>

      <Text style={styles.hint}>{hint}</Text>

      <ActionButton
        label={rollLabel}
        accent={accent}
        onPress={onRoll}
        disabled={!canRoll}
        pulse={!hasRolled}
        style={styles.rollButton}
      />

      {/*
        Rolls remaining, as a horizontal row of lit pips under the CTA. Stacked
        vertically beside the button they read as an overflow "kebab" menu.
      */}
      <View
        style={styles.pips}
        accessibilityRole="progressbar"
        accessibilityLabel={`${rollsLeft} of ${MAX_ROLLS} rolls remaining`}
      >
        {Array.from({ length: MAX_ROLLS }, (_, i) => {
          const lit = i < rollsLeft;
          return (
            <View
              key={i}
              style={[
                styles.rollPip,
                lit ? styles.rollPipLit : styles.rollPipSpent,
                lit && { backgroundColor: accent.main, borderColor: accent.main },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: H_PADDING,
    paddingTop: 0,
    // Clearance so the roll pips are not clipped by the scorecard below.
    paddingBottom: spacing(2.5),
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Room for held dice to sit proud without clipping.
    paddingTop: spacing(2),
  },
  hint: {
    marginTop: spacing(2),
    marginBottom: spacing(2),
    textAlign: 'center',
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  rollButton: {
    minWidth: 210,
  },
  pips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing(2),
    marginTop: spacing(2.5),
  },
  rollPip: {
    width: 22,
    height: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  rollPipLit: {
    // Colour is applied inline from the active seat's accent.
    borderColor: 'transparent',
  },
  rollPipSpent: {
    backgroundColor: 'transparent',
    borderColor: palette.hairlineSoft,
  },
});
