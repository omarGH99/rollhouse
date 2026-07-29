import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { Category, GameState, Player } from '../types';
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
} from '../logic/gameReducer';
import { chooseCategory, chooseKeep } from '../logic/ai';
import { grandTotal, previewScores, scoreFor } from '../logic/scoring';
import { Achievement, Stats, emptyStats, recordGame } from '../logic/stats';
import {
  clearGame,
  clearStats,
  loadGame,
  loadStats,
  saveGame,
  saveStats,
} from '../storage';

/** Pacing for AI turns, so the player can watch what the bot is doing. */
const AI_THINK_MS = 700;
const AI_ROLL_MS = 1100;
const AI_HANDOFF_MS = 900;

export interface YahtzeeGame {
  state: GameState;
  /** Preview points per open category for the *current* player. */
  previews: Partial<Record<Category, number>>;
  totals: number[];
  canRoll: boolean;
  canUndo: boolean;
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

export const useYahtzeeGame = (): YahtzeeGame => {
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
      const [saved, savedStats] = await Promise.all([loadGame(), loadStats()]);
      if (cancelled) return;
      setStats(savedStats);
      if (saved) dispatch({ type: 'RESTORE', session: saved });
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

  useEffect(() => {
    if (!ready || state.phase !== 'gameover') return;
    // Guard against re-running on unrelated re-renders.
    if (recordedRef.current === state) return;
    recordedRef.current = state;

    setStats((current) => {
      const { stats: next, newlyUnlocked } = recordGame(current, state);
      if (newlyUnlocked.length) setPendingAchievements(newlyUnlocked);
      void saveStats(next);
      return next;
    });
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
  const liveRef = useRef({ state, aiTurn });
  liveRef.current = { state, aiTurn };

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
    const points = scoreFor(category, diceValues(live.state.dice));
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
    const keep = new Set(chooseKeep(dice, sheet).keep);
    const mismatch = state.dice.findIndex((die, i) => die.held !== keep.has(i));

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
  }, [ready, aiTurn, state]);

  return {
    state,
    previews,
    totals,
    canRoll: canRoll(state) && !aiTurn,
    // Undoing mid-bot-turn would fight the AI driver for control.
    canUndo: canUndo(session) && !aiTurn,
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
