import React, { useEffect, useState } from 'react';
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

import { FeltPanel } from './FeltPanel';
import { ACHIEVEMENTS, Stats, averageScore } from '../logic/stats';
import { accents, fonts, palette, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  stats: Stats;
  onClose: () => void;
  onReset: () => void;
}

const accent = accents[0];

const Tile: React.FC<{ label: string; value: string | number; wide?: boolean }> = ({
  label,
  value,
  wide = false,
}) => (
  <FeltPanel
    style={[styles.tile, wide ? styles.tileWide : null] as never}
    intensity={20}
    elevation={0}
  >
    <Text style={styles.tileValue}>{value}</Text>
    <Text style={styles.tileLabel}>{label}</Text>
  </FeltPanel>
);

export const StatsScreen: React.FC<Props> = ({
  visible,
  stats,
  onClose,
  onReset,
}) => {
  const insets = useSafeAreaInsets();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 240 : 180,
      easing: Easing.out(Easing.cubic),
    });
    if (!visible) setConfirmingReset(false);
  }, [visible, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 20 }],
  }));

  if (!visible) return null;

  const winRate =
    stats.gamesPlayed === 0
      ? '—'
      : `${Math.round((stats.humanWins / stats.gamesPlayed) * 100)}%`;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <Animated.View style={[styles.content, style]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing(3) }]}>
          <Text style={styles.title}>Your Record</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close stats"
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
          {stats.gamesPlayed === 0 ? (
            <Text style={styles.empty}>
              No games finished yet. Play one through and your record will appear
              here.
            </Text>
          ) : null}

          <View style={styles.tiles}>
            <Tile label="GAMES" value={stats.gamesPlayed} />
            <Tile label="WINS" value={stats.humanWins} />
            <Tile label="WIN RATE" value={winRate} />
            <Tile label="BEST" value={stats.bestScore} />
            <Tile label="AVERAGE" value={averageScore(stats)} />
            <Tile label="ROLLHOUSES" value={stats.rollhouses} />
          </View>

          <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
          <FeltPanel style={styles.achievements} intensity={20} elevation={0}>
            {ACHIEVEMENTS.map((a) => {
              const earned = stats.unlocked.includes(a.id);
              return (
                <View key={a.id} style={styles.achievement}>
                  <View
                    style={[
                      styles.achievementIcon,
                      earned && {
                        borderColor: accent.main,
                        backgroundColor: accent.wash,
                      },
                    ]}
                  >
                    <Ionicons
                      name={(earned ? a.icon : 'lock-closed-outline') as never}
                      size={16}
                      color={earned ? accent.main : palette.textFaint}
                    />
                  </View>
                  <View style={styles.achievementText}>
                    <Text
                      style={[
                        styles.achievementName,
                        !earned && styles.achievementLocked,
                      ]}
                    >
                      {a.title}
                    </Text>
                    <Text style={styles.achievementDesc}>{a.description}</Text>
                  </View>
                  {earned ? (
                    <Ionicons name="checkmark" size={16} color={accent.main} />
                  ) : null}
                </View>
              );
            })}
          </FeltPanel>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              confirmingReset ? 'Confirm clearing your record' : 'Clear your record'
            }
            onPress={() => {
              if (confirmingReset) {
                onReset();
                setConfirmingReset(false);
              } else {
                setConfirmingReset(true);
              }
            }}
            style={[styles.reset, confirmingReset && styles.resetArmed]}
          >
            <Ionicons
              name={confirmingReset ? 'warning-outline' : 'trash-outline'}
              size={14}
              color={confirmingReset ? palette.danger : palette.textFaint}
            />
            <Text
              style={[
                styles.resetText,
                confirmingReset && { color: palette.danger },
              ]}
            >
              {confirmingReset ? 'Tap again to erase everything' : 'Clear my record'}
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    zIndex: 75,
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
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: palette.textFaint,
    marginBottom: spacing(4),
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2.5),
  },
  tile: {
    flexGrow: 1,
    flexBasis: '28%',
    alignItems: 'center',
    paddingVertical: spacing(4),
    borderRadius: radius.md,
  },
  tileWide: {
    flexBasis: '100%',
  },
  tileValue: {
    fontFamily: fonts.numeric,
    fontSize: 24,
    fontWeight: '800',
    color: palette.brassBright,
  },
  tileLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
    color: palette.textFaint,
    marginTop: spacing(1),
  },
  sectionTitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: accent.main,
    marginTop: spacing(8),
    marginBottom: spacing(3),
  },
  achievements: {
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(3),
    borderRadius: radius.md,
  },
  achievement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2.5),
  },
  achievementIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.hairlineSoft,
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
  achievementLocked: {
    color: palette.textDim,
  },
  achievementDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: palette.textFaint,
    marginTop: 1,
  },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    marginTop: spacing(7),
    paddingVertical: spacing(3),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.hairlineSoft,
  },
  resetArmed: {
    borderColor: palette.danger,
  },
  resetText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: palette.textFaint,
    letterSpacing: 0.5,
  },
});
