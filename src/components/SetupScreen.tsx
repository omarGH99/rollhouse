import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from './ActionButton';
import { FeltPanel } from './FeltPanel';
import { MAX_NAME_LENGTH } from '../logic/persistence';
import { accents, fonts, palette, radius, spacing } from '../theme';
import { MAX_PLAYERS, MIN_PLAYERS, Player, PlayerKind } from '../types';

interface Props {
  visible: boolean;
  /** Seats to pre-fill, so reopening keeps the previous choices. */
  initialPlayers: Player[];
  /** Null when there is no game to return to (first launch). */
  onCancel: (() => void) | null;
  onStart: (players: Player[]) => void;
}

const COUNTS = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, i) => MIN_PLAYERS + i,
);

const defaultName = (seat: number, kind: PlayerKind) =>
  kind === 'ai' ? `Bot ${seat + 1}` : `Player ${seat + 1}`;

/** Grow or shrink the seat list, keeping existing choices where possible. */
const resize = (players: Player[], count: number): Player[] =>
  Array.from({ length: count }, (_, seat) => {
    const existing = players[seat];
    return existing ?? { name: defaultName(seat, 'human'), kind: 'human' };
  });

export const SetupScreen: React.FC<Props> = ({
  visible,
  initialPlayers,
  onCancel,
  onStart,
}) => {
  const insets = useSafeAreaInsets();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const progress = useSharedValue(0);

  // Re-seed whenever the sheet opens, so it reflects the current game.
  useEffect(() => {
    if (visible) setPlayers(initialPlayers);
  }, [visible, initialPlayers]);

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

  const setKind = (seat: number, kind: PlayerKind) => {
    setPlayers((current) =>
      current.map((player, i) => {
        if (i !== seat) return player;
        // Only rename when the name was still the default for the old kind,
        // so a custom name survives toggling human/AI.
        const wasDefault = player.name === defaultName(i, player.kind);
        return {
          kind,
          name: wasDefault ? defaultName(i, kind) : player.name,
        };
      }),
    );
  };

  const setName = (seat: number, name: string) => {
    setPlayers((current) =>
      current.map((player, i) => (i === seat ? { ...player, name } : player)),
    );
  };

  /** Names as they will be played: trimmed, and never blank. */
  const seated = (): Player[] =>
    players.map((player, seat) => ({
      kind: player.kind,
      name: player.name.trim() || defaultName(seat, player.kind),
    }));

  const humanCount = players.filter((p) => p.kind === 'human').length;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <Animated.View style={[styles.content, style]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing(3) }]}>
          <Text style={styles.title}>New Game</Text>
          {onCancel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              hitSlop={12}
              style={styles.close}
            >
              <Ionicons name="close" size={20} color={palette.text} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          // Without this the first tap on DEAL only dismisses the keyboard.
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing(8) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>PLAYERS</Text>
          <View style={styles.countRow}>
            {COUNTS.map((count) => {
              const selected = players.length === count;
              return (
                <Pressable
                  key={count}
                  accessibilityRole="button"
                  accessibilityLabel={`${count} players`}
                  accessibilityState={{ selected }}
                  onPress={() => setPlayers((cur) => resize(cur, count))}
                  style={[
                    styles.countChip,
                    selected && {
                      borderColor: palette.brass,
                      backgroundColor: accents[0].wash,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      { color: selected ? palette.brassBright : palette.textDim },
                    ]}
                  >
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, styles.seatsTitle]}>SEATS</Text>
          {players.map((player, seat) => (
            <FeltPanel
              key={seat}
              style={styles.seat}
              tint={accents[seat].wash}
              borderColor={accents[seat].soft}
              intensity={20}
              elevation={0}
            >
              <View style={[styles.seatDot, { backgroundColor: accents[seat].main }]} />
              {/*
                Wrapped because on web a bare input is not a positioned element,
                so the panel's absolutely-filled blur and tint paint over it.
              */}
              <View style={styles.seatNameWrap}>
                <TextInput
                  accessibilityLabel={`Seat ${seat + 1} name`}
                  value={player.name}
                  onChangeText={(name) => setName(seat, name)}
                  placeholder={defaultName(seat, player.kind)}
                  placeholderTextColor={palette.textFaint}
                  selectionColor={accents[seat].main}
                  maxLength={MAX_NAME_LENGTH}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  selectTextOnFocus
                  style={styles.seatName}
                />
              </View>
              <View style={styles.kindToggle}>
                {(['human', 'ai'] as PlayerKind[]).map((kind) => {
                  const active = player.kind === kind;
                  return (
                    <Pressable
                      key={kind}
                      accessibilityRole="button"
                      accessibilityLabel={`Seat ${seat + 1} ${kind === 'ai' ? 'computer' : 'human'}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => setKind(seat, kind)}
                      style={[
                        styles.kindButton,
                        active && {
                          backgroundColor: accents[seat].soft,
                          borderColor: accents[seat].main,
                        },
                      ]}
                    >
                      <Ionicons
                        name={kind === 'ai' ? 'hardware-chip-outline' : 'person-outline'}
                        size={15}
                        color={active ? accents[seat].main : palette.textFaint}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </FeltPanel>
          ))}

          <Text style={styles.note}>
            {humanCount === 0
              ? 'All seats are bots — they will play the game out on their own.'
              : humanCount === 1
                ? 'After the bots have played, you tap in to start your turn.'
                : 'Each turn ends with a pause, so the device can change hands.'}
          </Text>

          <ActionButton
            label="DEAL"
            accent={accents[0]}
            onPress={() => onStart(seated())}
            size="lg"
            pulse
            style={styles.cta}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    zIndex: 80,
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
  sectionTitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: palette.brassBright,
    marginBottom: spacing(3),
  },
  seatsTitle: {
    marginTop: spacing(7),
  },
  countRow: {
    flexDirection: 'row',
    gap: spacing(3),
  },
  countChip: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.hairline,
    backgroundColor: palette.panel,
  },
  countText: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '600',
  },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    marginBottom: spacing(2),
    borderRadius: radius.md,
  },
  seatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  seatNameWrap: {
    flex: 1,
  },
  seatName: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    // Android pads text inputs by default, which would make the row taller.
    paddingVertical: 0,
  },
  kindToggle: {
    flexDirection: 'row',
    gap: spacing(2),
  },
  kindButton: {
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.hairlineSoft,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 17,
    color: palette.textFaint,
    marginTop: spacing(4),
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing(7),
    alignSelf: 'stretch',
  },
});
