import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ColumnPreviews, ColumnView, ScoreRow, cellWidth } from './ScoreRow';
import { MODES, playerTotal } from '../logic/modes';
import {
  EXTRA_ROLLHOUSE_BONUS,
  LOWER_CATEGORIES,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
  grandTotal,
  lowerTotal,
  rollhouseBonus,
  upperBonus,
  upperSubtotal,
} from '../logic/scoring';
import {
  Accent,
  INACTIVE_SEAT_OPACITY,
  fonts,
  palette,
  radius,
  seatAccent,
  shadow,
  spacing,
} from '../theme';
import {
  Category,
  GameMode,
  LastScored,
  Player,
  PlayerIndex,
  ScoreSheet,
} from '../types';

interface Props {
  mode: GameMode;
  /** `scores[seat][column]`. */
  scores: ScoreSheet[][];
  players: Player[];
  currentPlayer: PlayerIndex;
  accent: Accent;
  /** The active player's previews, one per column of their card. */
  previews: ColumnPreviews;
  previewNonce: number;
  /** Board is live and the active player has rolled. */
  selectable: boolean;
  lastScored: LastScored | null;
  onSelect: (category: Category, column: number) => void;
}

/** "P1" / "B2": short enough for a column header at any seat count. */
const seatTag = (player: Player, seat: number): string =>
  player.kind === 'ai' ? `B${seat + 1}` : `P${seat + 1}`;

const SectionHeader: React.FC<{ title: string; accent: Accent }> = ({
  title,
  accent,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, { color: accent.ink }]}>{title}</Text>
    <View style={styles.sectionRule} />
  </View>
);

const SummaryRow: React.FC<{
  label: string;
  columns: ColumnView[];
  value: (sheet: ScoreSheet, view: ColumnView) => number;
  emphasis?: boolean;
  note?: string;
}> = ({ label, columns, value, emphasis = false, note }) => {
  const width = cellWidth(columns.length);
  const compact = columns.length >= 4;

  return (
    <View style={[styles.summaryRow, emphasis && styles.summaryRowStrong]}>
      <View style={styles.summaryLabelBlock}>
        <Text
          numberOfLines={1}
          style={[styles.summaryLabel, emphasis && styles.summaryLabelStrong]}
        >
          {label}
        </Text>
        {note ? <Text style={styles.summaryNote}>{note}</Text> : null}
      </View>
      {columns.map((view) => {
        const figure = value(view.sheet, view);
        return (
          <View
            key={view.key}
            style={[
              styles.summaryCell,
              { width },
              !view.active && { opacity: INACTIVE_SEAT_OPACITY },
            ]}
          >
            <Text
              style={[
                styles.summaryValue,
                emphasis &&
                  (compact ? styles.summaryValueStrongCompact : styles.summaryValueStrong),
                { color: figure > 0 ? view.accent.ink : palette.cardInkMuted },
              ]}
            >
              {figure}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export const Scorecard: React.FC<Props> = ({
  mode,
  scores,
  players,
  currentPlayer,
  accent,
  previews,
  previewNonce,
  selectable,
  lastScored,
  onSelect,
}) => {
  const { categories, multipliers } = MODES[mode];
  /** Several columns per player: the card shows one seat's at a time. */
  const stacked = multipliers.length > 1;

  // Whose card is on show when only one fits. Follows the turn, and a look at
  // somebody else's lasts only until the turn moves on.
  const [peek, setPeek] = useState<PlayerIndex | null>(null);
  useEffect(() => setPeek(null), [currentPlayer]);
  const shown = peek !== null && peek < players.length ? peek : currentPlayer;

  // Rebuilt only when the card itself changes, so rows keep their memo while
  // the dice are being rolled and held.
  const columns = useMemo<ColumnView[]>(() => {
    if (stacked) {
      return scores[shown].map((sheet, column) => ({
        key: `c${column}`,
        sheet,
        accent: seatAccent(shown),
        active: shown === currentPlayer,
        column,
        name: `times ${multipliers[column]}`,
      }));
    }
    return scores.map((card, seat) => ({
      key: `s${seat}`,
      sheet: card[0],
      accent: seatAccent(seat),
      active: seat === currentPlayer,
      column: 0,
      name: players[seat].name,
    }));
  }, [stacked, scores, shown, currentPlayer, multipliers, players]);

  const width = cellWidth(columns.length);

  const upper = UPPER_CATEGORIES.filter((c) => categories.includes(c));
  const lower = LOWER_CATEGORIES.filter((c) => categories.includes(c));

  const renderRows = (rows: Category[]) =>
    rows.map((category) => (
      <ScoreRow
        key={category}
        category={category}
        columns={columns}
        accent={accent}
        previews={previews}
        previewNonce={previewNonce}
        rolled={selectable}
        live={selectable}
        justScored={
          lastScored?.category === category &&
          // On a one-seat-at-a-time card, only flash if that seat is on show.
          (!stacked || lastScored.player === shown)
        }
        onSelect={onSelect}
      />
    ));

  return (
    // Printed card stock rather than another felt panel: opaque ivory, no blur.
    <View style={styles.panel}>
      {stacked && players.length > 1 ? (
        // The card only has room for one player's columns, so everyone's
        // running score lives here, and a tap swaps whose card is shown.
        <View style={styles.seats}>
          {players.map((player, seat) => {
            const tint = seatAccent(seat);
            const isShown = seat === shown;
            const total = playerTotal(scores[seat], mode);
            return (
              <Pressable
                key={seat}
                accessibilityRole="button"
                accessibilityLabel={`${player.name}'s card, ${total} points`}
                accessibilityState={{ selected: isShown }}
                onPress={() => setPeek(seat === currentPlayer ? null : seat)}
                style={[
                  styles.seat,
                  isShown && { backgroundColor: `${tint.ink}1F`, borderColor: tint.ink },
                ]}
              >
                <Text style={[styles.seatTag, { color: tint.ink }]}>
                  {seatTag(player, seat)}
                </Text>
                <Text style={[styles.seatTotal, { color: tint.ink }]}>{total}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.headerLabel}>
          {stacked && shown !== currentPlayer
            ? `${players[shown].name.toUpperCase()}'S CARD`
            : 'SCORECARD'}
        </Text>
        {columns.map((view, i) => (
          <View
            key={view.key}
            style={[
              styles.headerCell,
              { width },
              // A live column's header cell is filled and ruled in its metal.
              view.active && {
                backgroundColor: `${view.accent.ink}1F`,
                borderColor: view.accent.ink,
              },
              !view.active && styles.headerCellInactive,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.headerPlayer, { color: view.accent.ink }]}
            >
              {/* "B" for bot keeps the AI seats readable at a glance. */}
              {stacked ? `×${multipliers[i]}` : seatTag(players[i], i)}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="UPPER" accent={accent} />
      {renderRows(upper)}
      <SummaryRow label="Subtotal" columns={columns} value={upperSubtotal} />
      <SummaryRow
        label="Bonus"
        columns={columns}
        value={upperBonus}
        note={`+35 at ${UPPER_BONUS_THRESHOLD}`}
      />

      {lower.length > 0 ? (
        <>
          <SectionHeader title="LOWER" accent={accent} />
          {renderRows(lower)}
          <SummaryRow label="Lower total" columns={columns} value={lowerTotal} />
        </>
      ) : null}
      {/* Rare enough that the row only appears once somebody has earned one. */}
      {columns.some((view) => view.sheet.extraRollhouses > 0) ? (
        <SummaryRow
          label="Rollhouse bonus"
          columns={columns}
          value={rollhouseBonus}
          note={`+${EXTRA_ROLLHOUSE_BONUS} each`}
        />
      ) : null}

      <View style={styles.totalDivider} />
      <SummaryRow
        label="TOTAL"
        columns={columns}
        // Each column counts for its multiple; adding these gives the score,
        // which the seat strip shows — or this note, when there is no strip.
        value={(sheet, view) => grandTotal(sheet) * multipliers[view.column]}
        note={
          stacked && players.length === 1
            ? `${playerTotal(scores[shown], mode)} in all`
            : undefined
        }
        emphasis
      />
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing(4),
    // Clear of the bottom rail, so the red edge stays visible under the card.
    marginBottom: spacing(3),
    paddingHorizontal: spacing(1.5),
    paddingBottom: spacing(0.5),
    paddingTop: spacing(0.5),
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    ...shadow(10),
  },
  seats: {
    flexDirection: 'row',
    gap: spacing(1.5),
    paddingHorizontal: spacing(1),
    paddingTop: spacing(1.5),
  },
  seat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing(1.5),
    paddingVertical: spacing(1.25),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.cardHairline,
  },
  seatTag: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  seatTotal: {
    fontFamily: fonts.numeric,
    fontSize: 16,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
  },
  headerLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 3,
    color: palette.cardInkMuted,
    fontWeight: '800',
  },
  headerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(0.75),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  headerCellInactive: {
    opacity: INACTIVE_SEAT_OPACITY,
  },
  headerPlayer: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(2),
    marginTop: spacing(0.5),
    marginBottom: 0,
  },
  sectionTitle: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 3,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: palette.cardHairline,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(2),
    backgroundColor: palette.cardRow,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: palette.cardRule,
  },
  summaryRowStrong: {
    backgroundColor: 'rgba(22, 36, 28, 0.09)',
    paddingVertical: spacing(1),
  },
  summaryLabelBlock: {
    flex: 1,
    paddingLeft: spacing(5.5),
    paddingRight: spacing(1.5),
  },
  summaryLabel: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.cardInkMuted,
  },
  summaryLabelStrong: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 3,
    fontWeight: '800',
    color: palette.cardInk,
  },
  summaryNote: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: palette.cardInkMuted,
    opacity: 0.75,
    marginTop: 0.5,
    letterSpacing: 0.5,
  },
  summaryCell: {
    alignItems: 'center',
  },
  summaryValue: {
    fontFamily: fonts.numeric,
    fontSize: 17,
    fontWeight: '800',
  },
  summaryValueStrong: {
    fontSize: 22,
  },
  summaryValueStrongCompact: {
    fontSize: 19,
  },
  totalDivider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: palette.cardHairline,
    marginVertical: spacing(1),
    marginHorizontal: spacing(2),
  },
});
