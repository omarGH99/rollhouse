import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiceTray } from '../components/DiceTray';
import { FeltBackdrop } from '../components/FeltBackdrop';
import { FitToHeight } from '../components/FitToHeight';
import { HandoffOverlay } from '../components/HandoffOverlay';
import { ResultsScreen } from './ResultsScreen';
import { Scorecard } from '../components/Scorecard';
import { ThrowScreen } from './ThrowScreen';
import { TurnBanner } from '../components/TurnBanner';
import { Wordmark } from '../components/Wordmark';
import { RollhouseGame } from '../hooks/useRollhouseGame';
import { SHAKE_SUPPORTED, useShake } from '../hooks/useShake';
import { awaitsTurnStart, humanSeatCount } from '../logic/gameReducer';
import { MODES, roundsFor } from '../logic/modes';
import { Settings } from '../logic/settings';
import { palette, seatAccent, spacing } from '../theme';

interface Props {
  game: RollhouseGame;
  settings: Settings;
  /** Something is open over the game, so it should not react to a shake. */
  paused: boolean;
  onOpenMenu: () => void;
  onOpenRules: () => void;
}

const HeaderButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    hitSlop={8}
    style={styles.iconButton}
  >
    <Ionicons name={icon} size={16} color={palette.textDim} />
  </Pressable>
);

/** A game in play: the table, and the pages that open over it during a turn. */
export const GameScreen: React.FC<Props> = ({
  game,
  settings,
  paused,
  onOpenMenu,
  onOpenRules,
}) => {
  const insets = useSafeAreaInsets();
  const {
    state,
    previews,
    totals,
    canRoll,
    undoPlayer,
    aiThinking,
    bestRank,
    hint,
    requestHint,
    pendingAchievements,
    acknowledgeAchievements,
    roll,
    toggleHold,
    score,
    beginTurn,
    undo,
    reset,
  } = game;

  const [throwOpen, setThrowOpen] = useState(false);

  const accent = seatAccent(state.currentPlayer);
  const isOver = state.phase === 'gameover';
  const { multipliers } = MODES[state.mode];

  // Shared with the turn driver, so the two can never disagree about whether
  // there is something for a person to tap.
  const showHandoff = awaitsTurnStart(state);

  // A bot's handoff resolves itself, but the board must still be inert.
  const boardLocked = state.phase === 'handoff' || isOver || aiThinking;

  /**
   * A person's turn is played across two pages: the dice, then the table. It
   * opens on the dice; bots are simply watched from the table.
   */
  const humanTurn = state.phase === 'turn' && !aiThinking;
  const showThrow = throwOpen && humanTurn;

  useEffect(() => {
    // Closing here as well as opening matters: an undo lands mid-turn with the
    // dice already thrown, and should arrive at the table, not a stale page.
    //
    // A turn that follows straight on from a score — which is every turn when
    // playing alone — stays at the table instead, so the box just filled is
    // seen before the dice take over the screen again.
    setThrowOpen(humanTurn && !state.hasRolled && state.lastScored === null);
    // Keyed on the turn, not on `hasRolled`: the first throw must not close it.
    // `scores` is what tells a new or restored game apart from the same seat
    // and round of the one before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [humanTurn, state.currentPlayer, state.round, state.scores]);

  // After the last throw there is nothing left to do here but look.
  useEffect(() => {
    if (!showThrow || !state.hasRolled || state.rollsLeft > 0) return;
    const timer = setTimeout(() => setThrowOpen(false), 1600);
    return () => clearTimeout(timer);
  }, [showThrow, state.hasRolled, state.rollsLeft]);

  useShake(roll, showThrow && canRoll && !paused && settings.shake);

  // A hint that says "throw again" is about the dice, so it is shown on the
  // dice page. Keyed on the hint alone: leaving that page afterwards must not
  // drag the player straight back to it.
  useEffect(() => {
    if (hint?.keep && hint.keep.length < state.dice.length) setThrowOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint]);

  const canHint = settings.hints && humanTurn && state.hasRolled;
  // On the table a hint points at a box, but only once the advice is to score.
  const suggested =
    hint && (hint.keep === null || hint.keep.length === state.dice.length)
      ? hint.box
      : null;

  /** Rolling from the table goes via the dice page, so the throw is seen there. */
  const throwFromTable = () => {
    setThrowOpen(true);
    roll();
  };

  // The outgoing player may have scrolled deep into the scorecard; the incoming
  // player should start at the dice, not wherever the last one left off.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [state.currentPlayer]);

  /**
   * The round the *just-finished* turn belonged to. The last seat finishing
   * already advanced `round`, so step back one in that case.
   */
  const completedRound = useMemo(
    () => (state.incomingPlayer === 0 ? state.round - 1 : state.round),
    [state.incomingPlayer, state.round],
  );

  // Between turns the handoff page offers undo. At the table it is offered
  // before the first throw only: once the dice are out, the turn has moved on.
  const tableUndo = undoPlayer !== null && humanTurn && !state.hasRolled;

  return (
    <View style={styles.root}>
      <FeltBackdrop accent={accent} />

      <FitToHeight
        ref={scrollRef}
        // Nothing behind a curtain should be reachable, even by scroll.
        scrollEnabled={!showHandoff && !isOver && !paused && !showThrow}
        contentStyle={[
          styles.scroll,
          {
            // Keep the board inside the baize: the rail should frame it on
            // every edge rather than being overlapped by content.
            paddingTop: insets.top + spacing(3),
            paddingBottom: insets.bottom + spacing(4),
          },
        ]}
      >
        <View style={styles.topBar}>
          <Wordmark compact={state.players.length >= 3} />
          {tableUndo ? (
            <HeaderButton icon="arrow-undo-outline" label="Undo last score" onPress={undo} />
          ) : null}
          {canHint ? (
            <HeaderButton icon="bulb-outline" label="Hint" onPress={requestHint} />
          ) : null}
          <HeaderButton icon="help" label="How to play" onPress={onOpenRules} />
          <HeaderButton icon="menu" label="Menu" onPress={onOpenMenu} />
        </View>

        <TurnBanner
          players={state.players}
          currentPlayer={state.currentPlayer}
          round={state.round}
          rounds={roundsFor(state.mode)}
          accent={accent}
          aiThinking={aiThinking}
        />

        <DiceTray
          dice={state.dice}
          accent={accent}
          rollsLeft={state.rollsLeft}
          hasRolled={state.hasRolled}
          rollNonce={state.rollNonce}
          canRoll={canRoll}
          aiThinking={aiThinking}
          onRoll={throwFromTable}
          onToggleHold={toggleHold}
        />

        <Scorecard
          mode={state.mode}
          scores={state.scores}
          players={state.players}
          currentPlayer={state.currentPlayer}
          accent={accent}
          previews={previews}
          previewNonce={state.rollNonce}
          selectable={!boardLocked && state.hasRolled}
          lastScored={state.lastScored}
          suggested={suggested}
          onSelect={score}
        />
      </FitToHeight>

      <ThrowScreen
        visible={showThrow}
        playerName={state.players[state.currentPlayer].name}
        accent={accent}
        dice={state.dice}
        rollsLeft={state.rollsLeft}
        hasRolled={state.hasRolled}
        rollNonce={state.rollNonce}
        canRoll={canRoll}
        previews={previews}
        multipliers={multipliers}
        shakeSupported={SHAKE_SUPPORTED && settings.shake}
        hint={hint}
        onHint={settings.hints ? requestHint : undefined}
        onRoll={roll}
        onToggleHold={toggleHold}
        onDone={() => setThrowOpen(false)}
      />

      <HandoffOverlay
        visible={showHandoff}
        players={state.players}
        incomingPlayer={state.incomingPlayer}
        completedRound={completedRound}
        roundFullyComplete={state.incomingPlayer === 0}
        lastScored={state.lastScored}
        multiplier={state.lastScored ? multipliers[state.lastScored.column] : 1}
        passDevice={humanSeatCount(state) > 1}
        undoPlayer={undoPlayer}
        onBegin={beginTurn}
        onUndo={undo}
      />

      <ResultsScreen
        visible={isOver}
        mode={state.mode}
        players={state.players}
        scores={state.scores}
        totals={totals}
        bestRank={bestRank}
        achievements={pendingAchievements}
        onPlayAgain={() => {
          acknowledgeAchievements();
          reset();
        }}
        onMenu={onOpenMenu}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  scroll: {
    paddingHorizontal: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(0.5),
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
    backgroundColor: palette.panel,
  },
});
