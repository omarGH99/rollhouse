import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '../components/ActionButton';
import { FeltBackdrop } from '../components/FeltBackdrop';
import { accents, fonts, palette, radius, shadow, spacing, textGlow } from '../theme';
import { DieValue } from '../types';

interface Props {
  /** One line describing the game that Continue would return to, if any. */
  resume: string | null;
  onContinue: () => void;
  onNewGame: () => void;
  onScores: () => void;
  onRules: () => void;
  onSettings?: () => void;
}

const accent = accents[0];

/** Which cells of a 3x3 grid are pips, per face. */
const PIPS: Record<DieValue, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** The hand on the cover: five alike, the roll the game is named for. */
const COVER: { turn: number; lift: number }[] = [
  { turn: -9, lift: 6 },
  { turn: 5, lift: -4 },
  { turn: -3, lift: 2 },
  { turn: 8, lift: -5 },
  { turn: -6, lift: 5 },
];

/** A small, still die. The playing dice animate; these are only decoration. */
const CoverDie: React.FC<{ face: DieValue; turn: number; lift: number }> = ({
  face,
  turn,
  lift,
}) => (
  <View
    style={[
      styles.die,
      shadow(6),
      { transform: [{ translateY: lift }, { rotate: `${turn}deg` }] },
    ]}
  >
    {Array.from({ length: 9 }, (_, cell) => (
      <View key={cell} style={styles.dieCell}>
        {PIPS[face].includes(cell) ? <View style={styles.diePip} /> : null}
      </View>
    ))}
  </View>
);

const LinkButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
  >
    <Ionicons name={icon} size={20} color={palette.brassBright} />
    <Text style={styles.linkText}>{label}</Text>
  </Pressable>
);

/** The front door: every session starts here. */
export const MenuScreen: React.FC<Props> = ({
  resume,
  onContinue,
  onNewGame,
  onScores,
  onRules,
  onSettings,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + spacing(6),
          paddingBottom: insets.bottom + spacing(8),
        },
      ]}
    >
      <FeltBackdrop accent={accent} />

      <View style={styles.cover}>
        <View style={styles.dice}>
          {COVER.map((die, i) => (
            <CoverDie key={i} face={6} {...die} />
          ))}
        </View>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.title, textGlow(palette.brass, 14)]}
        >
          ROLLHOUSE
        </Text>
        <View style={styles.ruleRow}>
          <View style={styles.rule} />
          <Text style={styles.tagline}>FIVE DICE · THREE THROWS</Text>
          <View style={styles.rule} />
        </View>
      </View>

      <View style={styles.actions}>
        {resume ? (
          <>
            <ActionButton
              label="CONTINUE"
              accent={accent}
              onPress={onContinue}
              size="lg"
              pulse
              style={styles.primary}
            />
            <Text style={styles.resume}>{resume}</Text>
          </>
        ) : null}

        <ActionButton
          label="NEW GAME"
          accent={accent}
          onPress={onNewGame}
          size={resume ? 'md' : 'lg'}
          pulse={!resume}
          style={styles.primary}
        />

        <View style={styles.links}>
          <LinkButton icon="trophy-outline" label="High scores" onPress={onScores} />
          <LinkButton icon="help-circle-outline" label="How to play" onPress={onRules} />
          {onSettings ? (
            <LinkButton icon="options-outline" label="Settings" onPress={onSettings} />
          ) : null}
        </View>
      </View>
    </View>
  );
};

const DIE = 46;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: spacing(7),
    justifyContent: 'space-between',
  },
  cover: {
    // Takes the space the buttons leave and sits in the middle of it.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dice: {
    flexDirection: 'row',
    gap: spacing(2.5),
    marginBottom: spacing(9),
  },
  die: {
    width: DIE,
    height: DIE,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 5,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: palette.dieEdge,
    backgroundColor: palette.dieFace,
  },
  dieCell: {
    width: '33.333%',
    height: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diePip: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.diePip,
  },
  title: {
    fontFamily: fonts.wordmark,
    fontSize: 40,
    letterSpacing: 4,
    color: palette.brassBright,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing(3),
    marginTop: spacing(3),
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: palette.railTrim,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 3,
    color: palette.textMuted,
  },
  actions: {
    alignItems: 'stretch',
  },
  primary: {
    alignSelf: 'stretch',
  },
  resume: {
    marginTop: spacing(2),
    marginBottom: spacing(5),
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 0.6,
    color: palette.textMuted,
  },
  links: {
    flexDirection: 'row',
    gap: spacing(2.5),
    marginTop: spacing(6),
  },
  link: {
    flex: 1,
    alignItems: 'center',
    gap: spacing(1.5),
    paddingVertical: spacing(3.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.panelStrong,
  },
  linkPressed: {
    opacity: 0.6,
  },
  linkText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: palette.textLight,
  },
});
