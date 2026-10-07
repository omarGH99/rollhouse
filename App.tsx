import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
  CinzelDecorative_700Bold,
  useFonts,
} from '@expo-google-fonts/cinzel-decorative';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiceTray } from './src/components/DiceTray';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { FeltBackdrop } from './src/components/FeltBackdrop';
import { FitToHeight } from './src/components/FitToHeight';
import { HandoffOverlay } from './src/components/HandoffOverlay';
import { ResultsScreen } from './src/components/ResultsScreen';
import { RulesScreen } from './src/components/RulesScreen';
import { Scorecard } from './src/components/Scorecard';
import { SetupScreen } from './src/components/SetupScreen';
import { StatsScreen } from './src/components/StatsScreen';
import { ThrowScreen } from './src/components/ThrowScreen';
import { TurnBanner } from './src/components/TurnBanner';
import { Wordmark } from './src/components/Wordmark';
import { awaitsTurnStart, humanSeatCount } from './src/logic/gameReducer';
import { useRollhouseGame } from './src/hooks/useRollhouseGame';
import { SHAKE_SUPPORTED, useShake } from './src/hooks/useShake';
import { palette, seatAccent, spacing } from './src/theme';
import { Player } from './src/types';

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

const Board: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    state,
    previews,
    canRoll,
    undoPlayer,
    aiThinking,
    ready,
    stats,
    pendingAchievements,
    acknowledgeAchievements,
    roll,
    toggleHold,
    score,
    beginTurn,
    undo,
    newGame,
    reset,
    resetStats,
  } = useRollhouseGame();

  const [rulesOpen, setRulesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [throwOpen, setThrowOpen] = useState(false);

  const accent = seatAccent(state.currentPlayer);
  const isOver = state.phase === 'gameover';

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
  const sheetOpen = rulesOpen || statsOpen || setupOpen;
  const showThrow = throwOpen && humanTurn && ready;

  useEffect(() => {
    // Closing here as well as opening matters: an undo lands mid-turn with the
    // dice already thrown, and should arrive at the table, not a stale page.
    setThrowOpen(humanTurn && !state.hasRolled);
    // Keyed on the turn, not on `hasRolled`: the first throw must not close it.
    // `scores` is what tells a new or restored game apart from the same seat
    // and round of the one before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, humanTurn, state.currentPlayer, state.round, state.scores]);

  // After the last throw there is nothing left to do here but look.
  useEffect(() => {
    if (!showThrow || !state.hasRolled || state.rollsLeft > 0) return;
    const timer = setTimeout(() => setThrowOpen(false), 1600);
    return () => clearTimeout(timer);
  }, [showThrow, state.hasRolled, state.rollsLeft]);

  useShake(roll, showThrow && canRoll && !sheetOpen);

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

  const startGame = (players: Player[]) => {
    setSetupOpen(false);
    acknowledgeAchievements();
    newGame(players);
  };

  // Until the saved game has been read back, show the bare table. Rendering the
  // board first would flash a default two-player game for a frame before the
  // restored one replaces it.
  if (!ready) {
    return (
      <View style={styles.root}>
        <FeltBackdrop accent={accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FeltBackdrop accent={accent} />

      <FitToHeight
        ref={scrollRef}
        // Nothing behind a curtain should be reachable, even by scroll.
        scrollEnabled={!showHandoff && !isOver && !sheetOpen && !showThrow}
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
          <HeaderButton
            icon="stats-chart-outline"
            label="Your record"
            onPress={() => setStatsOpen(true)}
          />
          <HeaderButton
            icon="help"
            label="How to play"
            onPress={() => setRulesOpen(true)}
          />
          <HeaderButton
            icon="refresh"
            label="New game"
            onPress={() => setSetupOpen(true)}
          />
        </View>

        <TurnBanner
          players={state.players}
          currentPlayer={state.currentPlayer}
          round={state.round}
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
          scores={state.scores}
          players={state.players}
          currentPlayer={state.currentPlayer}
          accent={accent}
          previews={previews}
          previewNonce={state.rollNonce}
          selectable={!boardLocked && state.hasRolled}
          lastScoredCategory={state.lastScored?.category ?? null}
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
        shakeSupported={SHAKE_SUPPORTED}
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
        passDevice={humanSeatCount(state) > 1}
        undoPlayer={undoPlayer}
        onBegin={beginTurn}
        onUndo={undo}
      />

      <ResultsScreen
        visible={isOver}
        players={state.players}
        scores={state.scores}
        achievements={pendingAchievements}
        onPlayAgain={() => {
          acknowledgeAchievements();
          reset();
        }}
        onNewSetup={() => setSetupOpen(true)}
      />

      <StatsScreen
        visible={statsOpen}
        stats={stats}
        onClose={() => setStatsOpen(false)}
        onReset={resetStats}
      />

      <RulesScreen visible={rulesOpen} onClose={() => setRulesOpen(false)} />

      <SetupScreen
        visible={setupOpen}
        initialPlayers={state.players}
        onCancel={() => setSetupOpen(false)}
        onStart={startGame}
      />

      <StatusBar style="light" />
    </View>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({ CinzelDecorative_700Bold });

  // Hold on the splash rather than flashing a fallback face in the title.
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <Board />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

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
