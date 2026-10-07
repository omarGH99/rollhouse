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
  spacing,
} from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { SCORE_ROW_PADDING } from '../layout';
import { Category, ScoreSheet } from '../types';

/** Column width shrinks as columns are added, so four still fit on a phone. */
export const cellWidth = (columnCount: number): number =>
  columnCount >= 4 ? 40 : columnCount === 3 ? 48 : 58;

/**
 * One column of the scorecard as drawn. Usually that is one seat's sheet; in a
 * game with several columns per player it is one of a single seat's.
 */
export interface ColumnView {
  key: string;
  sheet: ScoreSheet;
  /** Identity colour for the figures in this column. */
  accent: Accent;
  /** Belongs to the player on turn, so it takes previews and status colour. */
  active: boolean;
  /** Index within that player's card — what scoring into it is addressed by. */
  column: number;
  /** Spoken name when a row offers more than one column, e.g. "times 2". */
  name: string;
}

export type ColumnPreviews = Partial<Record<Category, number>>[];

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
  /** Identity-stable between renders that do not change the card. */
  columns: ColumnView[];
  /** Tint for the row itself when it can be tapped. */
  accent: Accent;
  /**
   * What the live dice would score, indexed by `ColumnView.column`. Only the
   * active columns are looked up, and only boxes the rules allow appear.
   */
  previews: ColumnPreviews;
  /** Changes whenever the dice change, so the pulse restarts in sync. */
  previewNonce: number;
  /** The active player has rolled, so open/spent colouring is meaningful. */
  rolled: boolean;
  /** The board is accepting a score right now. */
  live: boolean;
  justScored: boolean;
  onSelect: (category: Category, column: number) => void;
}

const ScoreRowInner: React.FC<Props> = ({
  category,
  columns,
  accent,
  previews,
  previewNonce,
  rolled,
  live,
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

  const cells = columns.map((view) => {
    const value = view.sheet[category];
    const preview = view.active ? previews[view.column]?.[category] : undefined;
    return {
      view,
      value,
      // A prospective score: this box is open and these are the live dice.
      preview: value === null ? preview : undefined,
    };
  });

  /** Cells that would take a score if tapped now. */
  const targets = cells.filter((cell) => live && cell.preview !== undefined);
  const selectable = targets.length > 0;
  // With one place to score the whole row is the target, as large as it can
  // be. With several, each cell is its own.
  const only = targets.length === 1 ? targets[0] : null;
  const several = targets.length > 1;
  // A pressable row around pressable cells swallows their taps on the web, so
  // when the cells are the targets the row is a plain container.
  const Row: React.ElementType = several ? View : Pressable;

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: selectable ? `${accent.ink}0E` : 'transparent',
    transform: [{ scale: 1 - press.value * 0.012 + flash.value * 0.02 }],
  }));

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.8 }));

  const isRollhouse = category === 'rollhouse';
  const width = cellWidth(columns.length);
  const compact = columns.length >= 4;

  /** Still open in at least one of the active player's columns. */
  const available = cells.some((cell) => cell.view.active && cell.value === null);

  /**
   * The card reads as plain black ink until the dice are in play. Once the
   * active player has rolled it lights up: green where a box is still open to
   * them, red where it is already spent.
   */
  const status = (open: boolean) =>
    !rolled ? palette.cardInk : open ? palette.cardOpen : palette.cardClosed;
  const statusColor = status(available);

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
      <Row
        style={styles.row}
        {...(several
          ? {}
          : {
              accessibilityRole: 'button' as const,
              accessibilityLabel: `${CATEGORY_LABELS[category]}${
                only ? `, worth ${only.preview} points` : ''
              }`,
              accessibilityState: { disabled: !only },
              disabled: !only,
              onPress: () => only && onSelect(category, only.view.column),
              onPressIn: () => {
                press.value = withSpring(1, { damping: 20, stiffness: 400 });
              },
              onPressOut: () => {
                press.value = withSpring(0, { damping: 20, stiffness: 400 });
              },
            })}
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
            isRollhouse && styles.labelRollhouse,
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

        {cells.map(({ view, value, preview }) => {
          const showsPreview = preview !== undefined;
          const cellStatus = status(value === null);
          const tappable = several && showsPreview;

          const content =
            value !== null ? (
              <Text
                style={[
                  styles.cellText,
                  compact && styles.cellTextCompact,
                  // The active player's own spent boxes take the status
                  // colour; other columns keep their identity colour, since
                  // they are information rather than a choice being offered.
                  { color: view.active ? cellStatus : view.accent.ink },
                ]}
              >
                {value}
              </Text>
            ) : showsPreview ? (
              <PreviewScore points={preview} nonce={previewNonce} compact={compact} />
            ) : (
              <Text style={[styles.empty, view.active && { color: cellStatus }]}>–</Text>
            );

          const cellStyle = [
            styles.cell,
            { width },
            // An active cell is tinted to match its status, so the fill and
            // the figure inside it always agree.
            view.active && {
              backgroundColor: `${cellStatus}12`,
              borderColor: `${cellStatus}33`,
            },
            showsPreview && {
              backgroundColor: `${cellStatus}24`,
              borderColor: `${cellStatus}55`,
            },
            // Inactive columns recede so the live ones are unambiguous.
            !view.active && { opacity: INACTIVE_SEAT_OPACITY },
          ];

          return tappable ? (
            <Pressable
              key={view.key}
              accessibilityRole="button"
              accessibilityLabel={`${CATEGORY_LABELS[category]} ${view.name}, worth ${preview} points`}
              onPress={() => onSelect(category, view.column)}
              hitSlop={4}
              style={cellStyle}
            >
              {content}
            </Pressable>
          ) : (
            <View key={view.key} style={cellStyle}>
              {content}
            </View>
          );
        })}
      </Row>
    </Animated.View>
  );
};

/**
 * Thirteen of these are mounted at once and the AI driver dispatches roughly
 * five times a second while it plays, so re-rendering them all on every tick
 * was the app's hottest path.
 *
 * Every prop but one is a primitive or an identity-stable object. `previews`
 * is rebuilt whenever the dice change, so it is compared by what this row would
 * actually read from it: its own category, in the active columns.
 */
const sameRow = (prev: Props, next: Props): boolean => {
  if (
    prev.category !== next.category ||
    prev.columns !== next.columns ||
    prev.accent !== next.accent ||
    prev.previewNonce !== next.previewNonce ||
    prev.rolled !== next.rolled ||
    prev.live !== next.live ||
    prev.justScored !== next.justScored ||
    prev.onSelect !== next.onSelect
  ) {
    return false;
  }
  return next.columns.every(
    ({ active, column }) =>
      !active ||
      prev.previews[column]?.[next.category] === next.previews[column]?.[next.category],
  );
};

export const ScoreRow = React.memo(ScoreRowInner, sameRow);
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
    // Row height is a shared knob, paired with the scale floor. See layout.ts.
    paddingVertical: SCORE_ROW_PADDING,
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
  labelRollhouse: {
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
