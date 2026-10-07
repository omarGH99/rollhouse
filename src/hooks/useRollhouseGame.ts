import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { Category, DieValue, GameState, Player, PlayerIndex } from '../types';
import {
  DICE_COUNT,
  GameSession,
  MAX_ROLLS,
  canRoll,
  canScore,
  canUndo,
  createSession,
  diceValues,
  awaitsTurnStart,
  isAiTurn,
  sessionReducer,
  undoSeat,
} from '../logic/gameReducer';
import { chooseCategory, chooseKeep } from '../logic/ai';
import { grandTotal, previewScores } from '../logic/scoring';
import { Achievement, Stats, emptyStats, recordGame } from '../logic/stats';
import {
  clearGame,
  clearStats,
  loadGame,
  loadSeats,
  loadStats,
  saveGame,
  saveSeats,
  saveStats,
} from '../storage';

/** Pacing for AI turns, so the player can watch what the bot is doing. */
const AI_THINK_MS = 700;
const AI_ROLL_MS = 1100;
const AI_HANDOFF_MS = 900;

export interface RollhouseGame {
  state: GameState;
  /** Preview points per open category for the *current* player. */
  previews: Partial<Record<Category, number>>;
  totals: number[];
  canRoll: boolean;
  canUndo: boolean;
  /** Whose score undo would take back, or null when undo is unavailable. */
  undoPlayer: PlayerIndex | null;
  /** True while an AI seat is taking its turn; the board is read-only. */
  aiThinking: boolean;
  /** False until the saved game (if any) has been read from disk. */
  ready: boolean;
  stats: Stats;
  /** Achievements earned by the game that just finished. */
  pendingAchievements: Achievement[];
  acknowledgeAchievements: () => void;
  roll: () => void;
  toggleHold: (dieId: number) => void;
  score: (category: Category) => void;
  beginTurn: () => void;
  undo: () => void;
  newGame: (players: Player[]) => void;
  reset: () => void;
  resetStats: () => void;
}

/** Haptics are best-effort: silently no-op on web / unsupported devices. */
const tap = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => {});
};

const notify = (type: Haptics.NotificationFeedbackType) => {
  Haptics.notificationAsync(type).catch(() => {});
};

export const useRollhouseGame = (): RollhouseGame => {
  const [session, dispatch] = useReducer(
    sessionReducer,
    undefined,
    () => createSession(),
  );
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);

  const { state } = session;

  /* ---------------------------------------------------------------------- */
  /* Hydration                                                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [saved, savedStats, seats] = await Promise.all([
        loadGame(),
        loadStats(),
        loadSeats(),
      ]);
      if (cancelled) return;
      setStats(savedStats);
      if (saved) {
        dispatch({ type: 'RESTORE', session: saved });
      } else if (seats) {
        // No game to resume: still seat the same people as last time.
        dispatch({ type: 'RESET', players: seats });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after every change, once the initial read has finished — saving
  // before then would overwrite the save with the placeholder game.
  useEffect(() => {
    if (!ready) return;
    if (state.phase === 'gameover') {
      void clearGame();
    } else {
      void saveGame(session);
    }
  }, [ready, session, state.phase]);

  /* ---------------------------------------------------------------------- */
  /* End of game: fold into stats exactly once                               */
  /* ---------------------------------------------------------------------- */

  const recordedRef = useRef<GameState | null>(null);

  // Read from the effect below without making it re-run when stats change.
  const statsRef = useRef(stats);
  statsRef.current = stats;

  useEffect(() => {
    if (!ready || state.phase !== 'gameover') return;
    // Guard against re-running on unrelated re-renders.
    if (recordedRef.current === state) return;
    recordedRef.current = state;

    const { stats: next, newlyUnlocked } = recordGame(statsRef.current, state);
    statsRef.current = next;
    setStats(next);
    if (newlyUnlocked.length) setPendingAchievements(newlyUnlocked);
    void saveStats(next);
  }, [ready, state]);

  /* ---------------------------------------------------------------------- */
  /* Derived values                                                          */
  /* ---------------------------------------------------------------------- */

  const previews = useMemo(
    () =>
      state.phase === 'turn' && state.hasRolled
        ? previewScores(state.scores[state.currentPlayer], diceValues(state.dice))
        : {},
    [state.phase, state.hasRolled, state.scores, state.currentPlayer, state.dice],
  );

  const totals = useMemo(() => state.scores.map(grandTotal), [state.scores]);

  const aiTurn = isAiTurn(state);

  /**
   * Latest state, readable from callbacks without becoming a dependency.
   *
   * The action callbacks are handed down to memoised components, so their
   * identity has to be stable — depending on `state` directly would give every
   * one of them a new identity on every dispatch, and defeat every `React.memo`
   * below this hook.
   */
  const liveRef = useRef({ state, aiTurn, previews });
  liveRef.current = { state, aiTurn, previews };

  /* ---------------------------------------------------------------------- */
  /* Actions                                                                 */
  /* ---------------------------------------------------------------------- */

  const roll = useCallback(() => {
    const live = liveRef.current;
    if (!canRoll(live.state) || live.aiTurn) return;
    tap(Haptics.ImpactFeedbackStyle.Heavy);
    dispatch({ type: 'ROLL' });
  }, []);

  const toggleHold = useCallback((dieId: number) => {
    if (liveRef.current.aiTurn) return;
    tap(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'TOGGLE_HOLD', dieId });
  }, []);

  const score = useCallback((category: Category) => {
    const live = liveRef.current;
    if (!canScore(live.state, category) || live.aiTurn) return;
    // `previews` holds exactly what each legal box would pay, Joker included.
    const points = live.previews[category] ?? 0;
    notify(
      points > 0
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    dispatch({ type: 'SCORE', category });
  }, []);

  const beginTurn = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'BEGIN_TURN' });
  }, []);

  const undo = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'UNDO' });
  }, []);

  const newGame = useCallback((players: Player[]) => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setPendingAchievements([]);
    recordedRef.current = null;
    void saveSeats(players);
    dispatch({ type: 'RESET', players });
  }, []);

  const reset = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setPendingAchievements([]);
    recordedRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  const resetStats = useCallback(() => {
    setStats(emptyStats());
    void clearStats();
  }, []);

  const acknowledgeAchievements = useCallback(() => setPendingAchievements([]), []);

  /* ---------------------------------------------------------------------- */
  /* AI turn driver                                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * Bots start their own turns; people tap in. Keyed on the same predicate the
   * UI uses to decide whether to render a tap target, so the two cannot
   * disagree and strand the game mid-handoff.
   */
  useEffect(() => {
    if (!ready || state.phase !== 'handoff') return;
    if (awaitsTurnStart(state)) return;
    const timer = setTimeout(() => dispatch({ type: 'BEGIN_TURN' }), AI_HANDOFF_MS);
    return () => clearTimeout(timer);
  }, [ready, state]);

  /**
   * The bot's hold plan for the dice as they lie. Holds are applied one die per
   * tick, and every tick is a state change, so without this the full search
   * would re-run for each die it touches. Keyed on the faces, not the dice
   * array, because toggling a hold replaces the array but changes no face.
   */
  const aiSheet = state.scores[state.currentPlayer];
  const aiFaces = diceValues(state.dice).join('');
  const aiPlanning = aiTurn && state.hasRolled && state.rollsLeft > 0;
  const aiKeep = useMemo(() => {
    if (!aiPlanning) return null;
    const faces = Array.from(aiFaces, (face) => Number(face) as DieValue);
    return new Set(chooseKeep(faces, aiSheet).keep);
  }, [aiPlanning, aiFaces, aiSheet]);

  /**
   * One scheduled step per render while the bot is on turn. Each step either
   * rolls, adjusts holds, or scores — driving the same actions a human would,
   * so the AI is visible on the board rather than resolved instantly.
   */
  useEffect(() => {
    if (!ready || !aiTurn) return;

    const sheet = state.scores[state.currentPlayer];
    const dice = diceValues(state.dice);

    // Out of rolls, or holding everything: commit to a box.
    if (state.hasRolled && (state.rollsLeft === 0 || state.dice.every((d) => d.held))) {
      const timer = setTimeout(() => {
        dispatch({ type: 'SCORE', category: chooseCategory(dice, sheet) });
      }, AI_THINK_MS);
      return () => clearTimeout(timer);
    }

    if (!state.hasRolled) {
      const timer = setTimeout(() => dispatch({ type: 'ROLL' }), AI_THINK_MS);
      return () => clearTimeout(timer);
    }

    // Mid-turn: set holds to match the bot's plan, one die per tick so the
    // change is legible, then roll once the plan is in place.
    if (!aiKeep) return;
    const mismatch = state.dice.findIndex((die, i) => die.held !== aiKeep.has(i));

    const timer = setTimeout(
      () => {
        if (mismatch >= 0) {
          dispatch({ type: 'TOGGLE_HOLD', dieId: state.dice[mismatch].id });
        } else {
          dispatch({ type: 'ROLL' });
        }
      },
      mismatch >= 0 ? 220 : AI_ROLL_MS,
    );
    return () => clearTimeout(timer);
  }, [ready, aiTurn, aiKeep, state]);

  return {
    state,
    previews,
    totals,
    canRoll: canRoll(state) && !aiTurn,
    // Undoing mid-bot-turn would fight the AI driver for control.
    canUndo: canUndo(session) && !aiTurn,
    undoPlayer: aiTurn ? null : undoSeat(session),
    aiThinking: aiTurn,
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
  };
};

export { DICE_COUNT, MAX_ROLLS };
export type { GameSession };
