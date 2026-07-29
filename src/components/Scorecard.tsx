import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScoreRow, cellWidth } from './ScoreRow';
import {
  LOWER_CATEGORIES,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
  grandTotal,
  lowerTotal,
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
import { Category, Player, PlayerIndex, ScoreSheet } from '../types';

interface Props {
  scores: ScoreSheet[];
  players: Player[];
  currentPlayer: PlayerIndex;
  accent: Accent;
  previews: Partial<Record<Category, number>>;
  previewNonce: number;
  /** Board is live and the active player has rolled. */
  selectable: boolean;
  lastScoredCategory: Category | null;
  onSelect: (category: Category) => void;
}

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
  values: number[];
  currentPlayer: PlayerIndex;
  emphasis?: boolean;
  note?: string;
}> = ({ label, values, currentPlayer, emphasis = false, note }) => {
  const width = cellWidth(values.length);
  const compact = values.length >= 4;

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
      {values.map((value, player) => (
        <View
          key={player}
          style={[
            styles.summaryCell,
            { width },
            player !== currentPlayer && { opacity: INACTIVE_SEAT_OPACITY },
          ]}
        >
          <Text
            style={[
              styles.summaryValue,
              emphasis &&
                (compact ? styles.summaryValueStrongCompact : styles.summaryValueStrong),
              { color: value > 0 ? seatAccent(player).ink : palette.cardInkMuted },
              
            ]}
          >
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
};

export const Scorecard: React.FC<Props> = ({
  scores,
  players,
  currentPlayer,
  accent,
  previews,
  previewNonce,
  selectable,
  lastScoredCategory,
  onSelect,
}) => {
  const width = cellWidth(players.length);

  const renderRows = (categories: Category[]) =>
    categories.map((category) => (
      <ScoreRow
        key={category}
        category={category}
        values={scores.map((sheet) => sheet[category])}
        currentPlayer={currentPlayer}
        accent={accent}
        preview={previews[category]}
        previewNonce={previewNonce}
        available={scores[currentPlayer][category] === null}
        rolled={selectable}
        selectable={selectable && scores[currentPlayer][category] === null}
        justScored={lastScoredCategory === category}
        onSelect={onSelect}
      />
    ));

  return (
    // Printed card stock rather than another felt panel: opaque ivory, no blur.
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>SCORECARD</Text>
        {players.map((player, seat) => {
          const isActive = seat === currentPlayer;
          const accentOf = seatAccent(seat);
          return (
            <View
              key={seat}
              style={[
                styles.headerCell,
                { width },
                // The live seat's header cell is filled and ruled in its metal.
                isActive && {
                  backgroundColor: `${accentOf.ink}1F`,
                  borderColor: accentOf.ink,
                },
                !isActive && styles.headerCellInactive,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.headerPlayer,
                  { color: accentOf.ink },
                ]}
              >
                {/* "B" for bot keeps the AI seats readable at a glance. */}
                {player.kind === 'ai' ? `B${seat + 1}` : `P${seat + 1}`}
              </Text>
            </View>
          );
        })}
      </View>

      <SectionHeader title="UPPER" accent={accent} />
      {renderRows(UPPER_CATEGORIES)}
      <SummaryRow
        label="Subtotal"
        values={scores.map(upperSubtotal)}
        currentPlayer={currentPlayer}
      />
      <SummaryRow
        label="Bonus"
        values={scores.map(upperBonus)}
        currentPlayer={currentPlayer}
        note={`+35 at ${UPPER_BONUS_THRESHOLD}`}
      />

      <SectionHeader title="LOWER" accent={accent} />
      {renderRows(LOWER_CATEGORIES)}
      <SummaryRow
        label="Lower total"
        values={scores.map(lowerTotal)}
        currentPlayer={currentPlayer}
      />

      <View style={styles.totalDivider} />
      <SummaryRow
        label="TOTAL"
        values={scores.map(grandTotal)}
        currentPlayer={currentPlayer}
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
