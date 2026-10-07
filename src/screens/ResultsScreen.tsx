import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ActionButton } from '../components/ActionButton';
import { FeltPanel } from '../components/FeltPanel';
import { MODES } from '../logic/modes';
import { grandTotal, lowerTotal, upperBonus, upperSubtotal } from '../logic/scoring';
import { Achievement, winningSeats } from '../logic/stats';
import { accents, fonts, palette, radius, spacing, textGlow } from '../theme';
import { GameMode, Player, ScoreSheet } from '../types';

interface Props {
  visible: boolean;
  mode: GameMode;
  players: Player[];
  /** `scores[seat][column]`. */
  scores: ScoreSheet[][];
  /** Final score per seat, column multipliers applied. */
  totals: number[];
  /** Best place taken on the high-score table, from 0; null if none. */
  bestRank: number | null;
  /** Earned by this game — shown once, then acknowledged. */
  achievements: Achievement[];
  onPlayAgain: () => void;
  onMenu: () => void;
}

const StatLine: React.FC<{ label: string; values: number[] }> = ({
  label,
  values,
}) => (
  <View style={styles.statLine}>
    <Text style={styles.statLabel}>{label}</Text>
    <View style={styles.statValues}>
      {values.map((value, seat) => (
        <Text key={seat} style={[styles.statValue, { color: accents[seat].main }]}>
          {value}
        </Text>
      ))}
    </View>
  </View>
);

export const ResultsScreen: React.FC<Props> = ({
  visible,
  mode,
  players,
  scores,
  totals,
  bestRank,
  achievements,
  onPlayAgain,
  onMenu,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      visible ? 120 : 0,
      withTiming(visible ? 1 : 0, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [visible, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 28 }],
  }));

  if (!visible) return null;

  const winners = winningSeats(totals);
  const solo = players.length === 1;
  const isTie = winners.length > 1;
  const { multipliers } = MODES[mode];
  const hasLower = MODES[mode].categories.includes('chance');
  const winner = winners[0];
  const accent = accents[winner];

  const runnerUp = totals
    .filter((_, seat) => seat !== winner)
    .reduce((best, total) => Math.max(best, total), 0);
  const margin = totals[winner] - runnerUp;

  const headline = solo
    ? `${totals[0]} POINTS`
    : isTie
      ? 'DEAD HEAT'
      : `${players[winner].name.toUpperCase()} WINS`;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <Animated.View style={[styles.content, style]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Ionicons
            name={isTie ? 'git-compare-outline' : 'trophy'}
            size={38}
            color={accent.main}
            style={styles.trophy}
          />

          <Text style={styles.eyebrow}>FINAL RESULTS</Text>
          <Text
            style={[styles.winner, { color: accent.main, ...textGlow(accent.main, 12) }]}
          >
            {headline}
          </Text>
          <Text style={styles.margin}>
            {solo
              ? `${MODES[mode].label} game, played alone`
              : isTie
                ? `${winners.length} players finished level on ${totals[winner]}`
                : `by ${margin} point${margin === 1 ? '' : 's'}`}
          </Text>

          {bestRank !== null ? (
            <View style={[styles.placed, { borderColor: palette.brass }]}>
              <Ionicons name="ribbon-outline" size={15} color={palette.brassBright} />
              <Text style={styles.placedText}>
                {bestRank === 0
                  ? `NEW ${MODES[mode].label.toUpperCase()} HIGH SCORE`
                  : `NUMBER ${bestRank + 1} ON THE ${MODES[mode].label.toUpperCase()} BOARD`}
              </Text>
            </View>
          ) : null}

          <View style={styles.totalsRow}>
            {players.map((player, seat) => (
              <FeltPanel
                key={seat}
                style={styles.totalCard}
                tint={accents[seat].wash}
                borderColor={
                  winners.includes(seat) ? accents[seat].main : palette.hairline
                }
                intensity={22}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.totalLabel, { color: accents[seat].dim }]}
                >
                  {player.name.toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.totalValue,
                    players.length >= 3 && styles.totalValueCompact,
                    { color: accents[seat].main },
                    // Only the winner's total glows, so the rest stay calm.
                    winners.includes(seat) ? textGlow(accents[seat].main, 12) : null,
                  ]}
                >
                  {totals[seat]}
                </Text>
              </FeltPanel>
            ))}
          </View>

          {achievements.length ? (
            <FeltPanel style={styles.achievements} intensity={22}>
              <Text style={styles.achievementsTitle}>UNLOCKED</Text>
              {achievements.map((a) => (
                <View key={a.id} style={styles.achievement}>
                  <Ionicons
                    name={a.icon as never}
                    size={18}
                    color={palette.brassBright}
                  />
                  <View style={styles.achievementText}>
                    <Text style={styles.achievementName}>{a.title}</Text>
                    <Text style={styles.achievementDesc}>{a.description}</Text>
                  </View>
                </View>
              ))}
            </FeltPanel>
          ) : null}

          <FeltPanel style={styles.breakdown} intensity={20}>
            {multipliers.length > 1 ? (
              // A card of several columns is summed up column by column.
              multipliers.map((multiplier, column) => (
                <StatLine
                  key={column}
                  label={`Column ×${multiplier}`}
                  values={scores.map((card) => grandTotal(card[column]) * multiplier)}
                />
              ))
            ) : (
              <>
                <StatLine
                  label="Upper subtotal"
                  values={scores.map((card) => upperSubtotal(card[0]))}
                />
                <StatLine
                  label="Upper bonus"
                  values={scores.map((card) => upperBonus(card[0]))}
                />
                {hasLower ? (
                  <StatLine
                    label="Lower total"
                    values={scores.map((card) => lowerTotal(card[0]))}
                  />
                ) : null}
              </>
            )}
          </FeltPanel>

          <ActionButton
            label="PLAY AGAIN"
            accent={accent}
            onPress={onPlayAgain}
            size="lg"
            pulse
            style={styles.cta}
          />
          <ActionButton
            label="MENU"
            accent={accent}
            onPress={onMenu}
            style={styles.secondaryCta}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    zIndex: 60,
  },
  placed: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing(2),
    marginTop: spacing(4),
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  placedText: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: palette.brassBright,
  },
  scrim: {
    backgroundColor: 'rgba(5, 13, 9, 0.95)',
  },
  content: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(12),
  },
  trophy: {
    marginBottom: spacing(4),
  },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    letterSpacing: 3.5,
    color: palette.textDim,
    fontWeight: '700',
  },
  winner: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: spacing(2),
    textAlign: 'center',
  },
  margin: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: palette.textFaint,
    letterSpacing: 0.8,
    marginTop: spacing(1),
    textAlign: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing(3),
    marginTop: spacing(7),
    alignSelf: 'stretch',
  },
  totalCard: {
    flexGrow: 1,
    flexBasis: '40%',
    alignItems: 'center',
    paddingVertical: spacing(4),
    paddingHorizontal: spacing(2),
    borderRadius: radius.lg,
  },
  totalLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },
  totalValue: {
    fontFamily: fonts.numeric,
    fontSize: 38,
    fontWeight: '800',
    marginTop: spacing(1),
  },
  totalValueCompact: {
    fontSize: 30,
  },
  achievements: {
    alignSelf: 'stretch',
    marginTop: spacing(4),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
  },
  achievementsTitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '700',
    color: palette.brassBright,
    marginBottom: spacing(2),
  },
  achievement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
  },
  achievementText: {
    flex: 1,
  },
  achievementName: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  achievementDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: palette.textFaint,
    marginTop: 1,
  },
  breakdown: {
    alignSelf: 'stretch',
    marginTop: spacing(4),
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(2),
  },
  statLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.textDim,
  },
  statValues: {
    flexDirection: 'row',
  },
  statValue: {
    width: 46,
    textAlign: 'center',
    fontFamily: fonts.numeric,
    fontSize: 14,
    fontWeight: '700',
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing(8),
  },
  secondaryCta: {
    alignSelf: 'stretch',
    marginTop: spacing(3),
  },
});
