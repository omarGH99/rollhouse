import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_ICONS } from './categoryIcons';
import { FeltPanel } from './FeltPanel';
import { DICE_COUNT, MAX_ROLLS } from '../logic/gameReducer';
import {
  CATEGORY_LABELS,
  EXTRA_ROLLHOUSE_BONUS,
  LOWER_CATEGORIES,
  TOTAL_ROUNDS,
  UPPER_BONUS_POINTS,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
} from '../logic/scoring';
import { accents, fonts, palette, radius, spacing } from '../theme';
import { Category } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const accent = accents[0];

/** Plain-language scoring rule per category, shown in the reference table. */
const RULE_TEXT: Record<Category, string> = {
  ones: 'Total of every 1 you rolled',
  twos: 'Total of every 2 you rolled',
  threes: 'Total of every 3 you rolled',
  fours: 'Total of every 4 you rolled',
  fives: 'Total of every 5 you rolled',
  sixes: 'Total of every 6 you rolled',
  threeOfAKind: 'Three matching dice — score the sum of all five',
  fourOfAKind: 'Four matching dice — score the sum of all five',
  fullHouse: 'Three of one number and two of another',
  smallStraight: 'Four in a row, e.g. 2-3-4-5',
  largeStraight: 'All five in a row, e.g. 2-3-4-5-6',
  rollhouse: 'All five dice showing the same number',
  chance: 'Anything goes — score the sum of all five',
};

/** Fixed points for the categories that do not score by dice total. */
const FIXED_POINTS: Partial<Record<Category, number>> = {
  fullHouse: 25,
  smallStraight: 30,
  largeStraight: 40,
  rollhouse: 50,
};

/**
 * Right-hand column. Upper boxes get their per-die value, which is more useful
 * than repeating "sum" six times down the table.
 */
const PER_DIE: Partial<Record<Category, string>> = {
  ones: '1 each',
  twos: '2 each',
  threes: '3 each',
  fours: '4 each',
  fives: '5 each',
  sixes: '6 each',
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRule} />
    </View>
    {children}
  </View>
);

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <View style={styles.step}>
    <View style={styles.stepNumber}>
      <Text style={styles.stepNumberText}>{n}</Text>
    </View>
    <Text style={styles.stepText}>{children}</Text>
  </View>
);

const RuleRow: React.FC<{ category: Category }> = ({ category }) => {
  const fixed = FIXED_POINTS[category];
  const perDie = PER_DIE[category];
  return (
    <View style={styles.ruleRow}>
      <Ionicons
        name={CATEGORY_ICONS[category]}
        size={16}
        color={accent.dim}
        style={styles.ruleIcon}
      />
      <View style={styles.ruleTextBlock}>
        <Text style={styles.ruleLabel}>{CATEGORY_LABELS[category]}</Text>
        <Text style={styles.ruleHint}>{RULE_TEXT[category]}</Text>
      </View>
      <Text style={[styles.rulePoints, !fixed && styles.rulePointsSoft]}>
        {fixed ? `${fixed}` : (perDie ?? 'sum')}
      </Text>
    </View>
  );
};

/** Full-screen reference, reachable any time from the header. */
export const RulesScreen: React.FC<Props> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 240 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 20 }],
  }));

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <Animated.View style={[styles.content, style]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing(3) }]}>
          <Text style={styles.title}>How to Play</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close rules"
            onPress={onClose}
            hitSlop={12}
            style={styles.close}
          >
            <Ionicons name="close" size={20} color={palette.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing(10) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Two to four players, people or bots, share one device. Over{' '}
            {TOTAL_ROUNDS} rounds you each fill every box on the scorecard —
            highest total wins.
          </Text>

          <Section title="YOUR TURN">
            <Step n={1}>
              Your turn opens on the dice. Shake your phone or tap throw to roll
              all {DICE_COUNT}. You get {MAX_ROLLS} throws per turn.
            </Step>
            <Step n={2}>
              Tap any dice you want to keep — they sit out the next roll. Tap again
              to release them.
            </Step>
            <Step n={3}>
              When you are happy, or out of throws, go to the scorecard and choose
              a box to score in. Every box can be used only once, so a bad roll may mean taking a zero somewhere.
            </Step>
            <Step n={4}>
              Hand the device over. The next player taps in to start their turn.
            </Step>
          </Section>

          <Section title="UPPER SECTION">
            <FeltPanel style={styles.table} elevation={0}>
              {UPPER_CATEGORIES.map((c) => (
                <RuleRow key={c} category={c} />
              ))}
            </FeltPanel>
            <View style={[styles.callout, { borderColor: accent.soft }]}>
              <Ionicons name="ribbon-outline" size={18} color={accent.main} />
              <Text style={styles.calloutText}>
                Score {UPPER_BONUS_THRESHOLD} or more across the upper section and
                you earn a {UPPER_BONUS_POINTS}-point bonus. That is roughly three
                of each number.
              </Text>
            </View>
          </Section>

          <Section title="LOWER SECTION">
            <FeltPanel style={styles.table} elevation={0}>
              {LOWER_CATEGORIES.map((c) => (
                <RuleRow key={c} category={c} />
              ))}
            </FeltPanel>
            <Text style={styles.footnote}>
              “Sum” means add up all five dice, whatever they show. Fixed-point
              boxes score the same amount every time.
            </Text>
          </Section>

          <Section title="MORE THAN ONE ROLLHOUSE">
            <View style={[styles.callout, { borderColor: accent.soft }]}>
              <Ionicons name="flame-outline" size={18} color={accent.main} />
              <Text style={styles.calloutText}>
                Once your Rollhouse box holds its 50, every further Rollhouse
                earns a {EXTRA_ROLLHOUSE_BONUS}-point bonus. A box you filled
                with a zero earns no bonus.
              </Text>
            </View>
            <Text style={styles.body}>
              A Rollhouse rolled after the box is filled is a Joker, and must
              still be scored somewhere. It goes in the upper box for its number
              if that is open. If not, pick any open lower box: Full House and
              both Straights pay in full. If the lower section is full too, it
              takes a zero in an open upper box.
            </Text>
          </Section>

          <Section title="GOOD TO KNOW">
            <Text style={styles.body}>
              While you are choosing, each open box previews what your current dice
              would score there — a struck-through zero means that box would score
              nothing.
            </Text>
            <Text style={styles.body}>
              If you have no good option, taking a zero in a box you are unlikely to fill (often Ones) costs you
              the least.
            </Text>
          </Section>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    zIndex: 70,
  },
  scrim: {
    backgroundColor: 'rgba(5, 13, 9, 0.96)',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(3),
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: palette.text,
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
    backgroundColor: palette.panel,
  },
  scroll: {
    paddingHorizontal: spacing(5),
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: palette.textDim,
    marginBottom: spacing(2),
  },
  section: {
    marginTop: spacing(7),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginBottom: spacing(4),
  },
  sectionTitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: accent.main,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: palette.hairline,
  },
  step: {
    flexDirection: 'row',
    gap: spacing(3),
    marginBottom: spacing(4),
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: accent.soft,
    backgroundColor: accent.wash,
  },
  stepNumberText: {
    fontFamily: fonts.numeric,
    fontSize: 12,
    fontWeight: '700',
    color: accent.main,
  },
  stepText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 21,
    color: palette.textDim,
    paddingTop: 2,
  },
  table: {
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(3),
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(2.5),
  },
  ruleIcon: {
    width: 26,
  },
  ruleTextBlock: {
    flex: 1,
    paddingRight: spacing(2),
  },
  ruleLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  ruleHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: palette.textFaint,
    marginTop: 2,
    lineHeight: 15,
  },
  rulePoints: {
    fontFamily: fonts.numeric,
    fontSize: 14,
    fontWeight: '700',
    color: accent.main,
    minWidth: 46,
    textAlign: 'right',
  },
  rulePointsSoft: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(3),
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(4),
    marginTop: spacing(3),
    backgroundColor: accent.wash,
  },
  calloutText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: palette.textDim,
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 17,
    color: palette.textFaint,
    marginTop: spacing(3),
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 21,
    color: palette.textDim,
    marginBottom: spacing(3),
  },
});
