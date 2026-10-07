import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
import { Settings } from '../logic/settings';
import { accents, fonts, palette, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  settings: Settings;
  /** Whether this device can be shaken to throw; hides the option if not. */
  shakeSupported: boolean;
  onChange: (change: Partial<Settings>) => void;
  onClose: () => void;
}

const accent = accents[0];

interface Option {
  key: keyof Settings;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
}

const OPTIONS: Option[] = [
  {
    key: 'sound',
    icon: 'volume-medium-outline',
    label: 'Sound',
    detail: 'Dice, scores and the end-of-game fanfare',
  },
  {
    key: 'haptics',
    icon: 'phone-portrait-outline',
    label: 'Vibration',
    detail: 'A tap in the hand on throws and scores',
  },
  {
    key: 'shake',
    icon: 'move-outline',
    label: 'Shake to throw',
    detail: 'Shake the phone to roll the dice',
  },
  {
    key: 'fastBots',
    icon: 'flash-outline',
    label: 'Fast bots',
    detail: 'Bots take their turns without the pauses',
  },
  {
    key: 'hints',
    icon: 'bulb-outline',
    label: 'Hint button',
    detail: 'Suggests dice to keep and a box to score. Marks the game as hinted.',
  },
];

/** Full-screen preferences, reachable from the menu. */
export const SettingsScreen: React.FC<Props> = ({
  visible,
  settings,
  shakeSupported,
  onChange,
  onClose,
}) => {
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

  const options = OPTIONS.filter((option) => option.key !== 'shake' || shakeSupported);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <Animated.View style={[styles.content, style]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing(3) }]}>
          <Text style={styles.title}>Settings</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close settings"
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
          <FeltPanel style={styles.panel} intensity={20} elevation={0}>
            {options.map((option, i) => {
              const on = settings[option.key];
              return (
                // The whole row toggles, so the target is far bigger than the
                // switch drawn at the end of it.
                <Pressable
                  key={option.key}
                  accessibilityRole="switch"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.detail}
                  accessibilityState={{ checked: on }}
                  // The web build reads the ARIA prop, not the state object.
                  aria-checked={on}
                  onPress={() => onChange({ [option.key]: !on })}
                  style={[styles.row, i > 0 && styles.rowRuled]}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={on ? accent.main : palette.textFaint}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{option.label}</Text>
                    <Text style={styles.rowDetail}>{option.detail}</Text>
                  </View>
                  <View pointerEvents="none">
                    <Switch
                      value={on}
                      trackColor={{ false: palette.hairlineSoft, true: accent.dim }}
                      thumbColor={on ? accent.main : palette.textFaint}
                      // The web switch colours its "on" thumb separately, and
                      // defaults to a teal that belongs to no part of this table.
                      {...({ activeThumbColor: accent.main } as object)}
                      // Decorative here: the row carries the role and the tap.
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  </View>
                </Pressable>
              );
            })}
          </FeltPanel>
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
  panel: {
    paddingHorizontal: spacing(4),
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3.5),
    paddingVertical: spacing(3.5),
  },
  rowRuled: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: palette.hairlineSoft,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    fontWeight: '700',
    color: palette.textLight,
  },
  rowDetail: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: palette.textMuted,
  },
});
