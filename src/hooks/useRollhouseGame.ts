import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

import {
  Category,
  DieValue,
  GameMode,
  GameState,
  LastScored,
  Phase,
  Player,
  PlayerIndex,
} from '../types';
import { hapticNotify as notify, hapticTap as tap, play } from '../feedback';
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
import { ScoreDecision, boardFor, planKeep, planScore } from '../logic/ai';
import {
  HighScores,
  emptyHighScores,
  entriesFor,
  insertScores,
} from '../logic/highScores';
import { MODES, totalsFor } from '../logic/modes';
import { previewScores } from '../logic/scoring';
import { Achievement, Stats, emptyStats, recordGame } from '../logic/stats';
import {
  clearGame,
  clearHighScores,
  clearStats,
  loadGame,
  loadHighScores,
  loadSeats,
  loadStats,
  saveGame,
  saveHighScores,
  saveSeats,
  saveStats,
} from '../storage';

/** Pacing for AI turns, so the player can watch what the bot is doing. */
const AI_THINK_MS = 700;
const AI_ROLL_MS = 1100;
const AI_HANDOFF_MS = 900;
const AI_HOLD_MS = 220;
/** How much of that pacing is left when bots are set to play fast. */
const FAST_PACE = 0.35;

/** What the hint button suggests for the dice as they lie. */
export interface Hint {
  /**
   * Ids of the dice to keep before throwing again; null when there is no throw
   * left to take. All five means "these are as good as they get: score them".
   */
  keep: number[] | null;
  /** Where the hand would best be scored as it stands. */
  box: ScoreDecision;
}

export interface RollhouseGame {
  state: GameState;
  /**
   * What the dice would score for the *current* player, one entry per scorecard
   * column, each listing only the boxes the rules allow.
   */
  previews: Partial<Record<Category, number>>[];
  totals: number[];
  canRoll: boolean;
  canUndo: boolean;
  /** Whose score undo would take back, or null when undo is unavailable. */
  undoPlayer: PlayerIndex | null;
  /** True while an AI seat is taking its turn; the board is read-only. */
  aiThinking: boolean;
  /** False until the saved game (if any) has been read from disk. */
  ready: boolean;
  /** A game has been dealt or restored and is not yet finished. */
  inProgress: boolean;
  stats: Stats;
  highScores: HighScores;
  /**
   * Best place any player took on the high-score table with the game that just
   * finished, from 0; null if nobody placed, or no game has just finished.
   */
  bestRank: number | null;
  /** A suggestion the player asked for, while the dice it was for still lie. */
  hint: Hint | null;
  requestHint: () => void;
  /** Achievements earned by the game that just finished. */
  pendingAchievements: Achievement[];
  acknowledgeAchievements: () => void;
  roll: () => void;
  toggleHold: (dieId: number) => void;
  score: (category: Category, column?: number) => void;
  beginTurn: () => void;
  undo: () => void;
  newGame: (players: Player[], mode: GameMode) => void;
  reset: () => void;
  /** Erase the record, achievements and every high-score table. */
  resetStats: () => void;
}

/**
 * `active` is whether the game is on screen. While it is not — the player is
 * at the menu — bots hold their turns rather than playing on unseen.
 */
export const useRollhouseGame = (active = true, fastBots = false): RollhouseGame => {
  const [session, dispatch] = useReducer(
    sessionReducer,
    undefined,
    () => createSession(),
  );
  const [ready, setReady] = useState(false);
  // The session starts out holding a placeholder game, which is not one to
  // offer "Continue" for.
  const [started, setStarted] = useState(false);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [highScores, setHighScores] = useState<HighScores>(emptyHighScores);
  const [bestRank, setBestRank] = useState<number | null>(null);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);

  const { state } = session;

  /* ---------------------------------------------------------------------- */
  /* Hydration                                                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [saved, savedStats, seats, savedScores] = await Promise.all([
        loadGame(),
        loadStats(),
        loadSeats(),
        loadHighScores(),
      ]);
      if (cancelled) return;
      setStats(savedStats);
      setHighScores(savedScores);
      if (saved) {
        setStarted(true);
        dispatch({ type: 'RESTORE', session: saved });
      } else if (seats) {
        // No game to resume: still seat the same people as last time.
        dispatch({ type: 'RESET', players: seats.players, mode: seats.mode });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after every change, once the initial read has finished — saving
  // before then would overwrite the save with the placeholder game. Nor is the
  // placeholder itself saved: nobody dealt it, so it is not a game to resume.
  useEffect(() => {
    if (!ready || !started) return;
    if (state.phase === 'gameover') {
      void clearGame();
    } else {
      void saveGame(session);
    }
  }, [ready, started, session, state.phase]);

  /* ---------------------------------------------------------------------- */
  /* End of game: fold into stats exactly once                               */
  /* ---------------------------------------------------------------------- */

  const recordedRef = useRef<GameState | null>(null);

  // Read from the effect below without making it re-run when stats change.
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const highScoresRef = useRef(highScores);
  highScoresRef.current = highScores;

  /** Seats that asked for a hint in the current game. */
  const hintedRef = useRef<number[]>([]);

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

    const placed = insertScores(
      highScoresRef.current,
      state.mode,
      entriesFor(state, hintedRef.current, Date.now()),
    );
    const ranks = placed.ranks.filter((rank) => rank >= 0);
    highScoresRef.current = placed.scores;
    setHighScores(placed.scores);
    setBestRank(ranks.length ? Math.min(...ranks) : null);
    void saveHighScores(placed.scores);
  }, [ready, state]);

  /* ---------------------------------------------------------------------- */
  /* Derived values                                                          */
  /* ---------------------------------------------------------------------- */

  const previews = useMemo(() => {
    const columns = state.scores[state.currentPlayer];
    const none: Partial<Record<Category, number>> = {};
    if (state.phase !== 'turn' || !state.hasRolled) return columns.map(() => none);
    const dice = diceValues(state.dice);
    return columns.map((sheet) =>
      previewScores(sheet, dice, MODES[state.mode].categories),
    );
  }, [
    state.phase,
    state.hasRolled,
    state.scores,
    state.currentPlayer,
    state.dice,
    state.mode,
  ]);

  const totals = useMemo(
    () => totalsFor({ scores: state.scores, mode: state.mode }),
    [state.scores, state.mode],
  );

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
    const live = liveRef.current;
    if (live.aiTurn) return;
    // Mirrors the reducer's own rule, so there is no click for a tap it ignores.
    if (live.state.phase !== 'turn' || !live.state.hasRolled || live.state.rollsLeft === 0) {
      return;
    }
    tap(Haptics.ImpactFeedbackStyle.Light);
    play('keep');
    dispatch({ type: 'TOGGLE_HOLD', dieId });
  }, []);

  const score = useCallback((category: Category, column = 0) => {
    const live = liveRef.current;
    if (!canScore(live.state, category, column) || live.aiTurn) return;
    // `previews` holds exactly what each legal box would pay, Joker included.
    const points = live.previews[column]?.[category] ?? 0;
    notify(
      points > 0
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    dispatch({ type: 'SCORE', category, column });
  }, []);

  const beginTurn = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'BEGIN_TURN' });
  }, []);

  const undo = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'UNDO' });
  }, []);

  /** Everything that belongs to one game rather than to the table. */
  const clearGameExtras = useCallback(() => {
    setPendingAchievements([]);
    setBestRank(null);
    setHintFor(null);
    hintedRef.current = [];
    recordedRef.current = null;
  }, []);

  const newGame = useCallback((players: Player[], mode: GameMode) => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    clearGameExtras();
    setStarted(true);
    void saveSeats(players, mode);
    dispatch({ type: 'RESET', players, mode });
  }, [clearGameExtras]);

  const reset = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    clearGameExtras();
    setStarted(true);
    dispatch({ type: 'RESET' });
  }, [clearGameExtras]);

  const resetStats = useCallback(() => {
    setStats(emptyStats());
    setHighScores(emptyHighScores());
    void clearStats();
    void clearHighScores();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Hints                                                                   */
  /* ---------------------------------------------------------------------- */

  // A hint is for one particular lie of the dice. It is remembered by the roll
  // and card it was asked on, so keeping a die does not dismiss it but the
  // next throw, or a score, does.
  const [hintFor, setHintFor] = useState<{ nonce: number; scores: GameState['scores'] } | null>(
    null,
  );

  const requestHint = useCallback(() => {
    const live = liveRef.current;
    if (live.aiTurn || live.state.phase !== 'turn' || !live.state.hasRolled) return;
    const seat = live.state.currentPlayer;
    if (!hintedRef.current.includes(seat)) hintedRef.current = [...hintedRef.current, seat];
    setHintFor({ nonce: live.state.rollNonce, scores: live.state.scores });
  }, []);

  const hintLive =
    hintFor !== null &&
    hintFor.nonce === state.rollNonce &&
    hintFor.scores === state.scores &&
    state.phase === 'turn' &&
    !aiTurn;
  const hintFaces = diceValues(state.dice).join('');

  const hint = useMemo<Hint | null>(() => {
    if (!hintLive) return null;
    const faces = Array.from(hintFaces, (face) => Number(face) as DieValue);
    const board = boardFor(state.scores[state.currentPlayer], state.mode);
    // The strongest bot's advice, whatever the table is playing against.
    const keep =
      state.rollsLeft > 0
        ? planKeep(faces, board, state.rollsLeft, 'hard').keep.map((i) => state.dice[i].id)
        : null;
    return { keep, box: planScore(faces, board, 'hard') };
    // `state.dice` is read for ids only, which never change; the faces are
    // what matter, and holding a die must not recompute the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintLive, hintFaces, state.scores, state.currentPlayer, state.mode, state.rollsLeft]);

  /* ---------------------------------------------------------------------- */
  /* Sound                                                                   */
  /* ---------------------------------------------------------------------- */

  // Sounds follow the state rather than the buttons, so a bot's throws and
  // scores are heard exactly as a person's are.
  const heard = useRef<{ nonce: number; last: LastScored | null; phase: Phase } | null>(null);

  useEffect(() => {
    if (!ready) return;
    const before = heard.current;
    heard.current = { nonce: state.rollNonce, last: state.lastScored, phase: state.phase };
    // Nothing on the first pass: that is a restored game appearing, not play.
    if (!before || !active) return;

    if (state.rollNonce > before.nonce) play('throw');

    if (state.phase === 'gameover' && before.phase !== 'gameover') {
      play('win');
    } else if (state.lastScored && state.lastScored !== before.last) {
      const { points, bonus } = state.lastScored;
      play(bonus > 0 ? 'bonus' : points > 0 ? 'score' : 'zero');
    }
  }, [ready, active, state.rollNonce, state.lastScored, state.phase]);

  const acknowledgeAchievements = useCallback(() => setPendingAchievements([]), []);

  /* ---------------------------------------------------------------------- */
  /* AI turn driver                                                          */
  /* ---------------------------------------------------------------------- */

  const pace = fastBots ? FAST_PACE : 1;

  /**
   * Bots start their own turns; people tap in. Keyed on the same predicate the
   * UI uses to decide whether to render a tap target, so the two cannot
   * disagree and strand the game mid-handoff.
   */
  useEffect(() => {
    if (!ready || !active || state.phase !== 'handoff') return;
    if (awaitsTurnStart(state)) return;
    const timer = setTimeout(() => dispatch({ type: 'BEGIN_TURN' }), AI_HANDOFF_MS * pace);
    return () => clearTimeout(timer);
  }, [ready, active, pace, state]);

  /**
   * The bot's hold plan for the dice as they lie. Holds are applied one die per
   * tick, and every tick is a state change, so without this the full search
   * would re-run for each die it touches. Keyed on the faces, not the dice
   * array, because toggling a hold replaces the array but changes no face.
   */
  const aiColumns = state.scores[state.currentPlayer];
  const aiLevel = state.players[state.currentPlayer].level ?? 'normal';
  const aiFaces = diceValues(state.dice).join('');
  const aiPlanning = aiTurn && state.hasRolled && state.rollsLeft > 0;
  const aiKeep = useMemo(() => {
    if (!aiPlanning) return null;
    const faces = Array.from(aiFaces, (face) => Number(face) as DieValue);
    const board = boardFor(aiColumns, state.mode);
    return new Set(planKeep(faces, board, state.rollsLeft, aiLevel).keep);
  }, [aiPlanning, aiFaces, aiColumns, state.mode, state.rollsLeft, aiLevel]);

  /**
   * One scheduled step per render while the bot is on turn. Each step either
   * rolls, adjusts holds, or scores — driving the same actions a human would,
   * so the AI is visible on the board rather than resolved instantly.
   */
  useEffect(() => {
    if (!ready || !active || !aiTurn) return;

    const dice = diceValues(state.dice);

    // Out of rolls, or holding everything: commit to a box.
    if (state.hasRolled && (state.rollsLeft === 0 || state.dice.every((d) => d.held))) {
      const timer = setTimeout(() => {
        const board = boardFor(state.scores[state.currentPlayer], state.mode);
        dispatch({ type: 'SCORE', ...planScore(dice, board, aiLevel) });
      }, AI_THINK_MS * pace);
      return () => clearTimeout(timer);
    }

    if (!state.hasRolled) {
      const timer = setTimeout(() => dispatch({ type: 'ROLL' }), AI_THINK_MS * pace);
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
      (mismatch >= 0 ? AI_HOLD_MS : AI_ROLL_MS) * pace,
    );
    return () => clearTimeout(timer);
  }, [ready, active, pace, aiTurn, aiKeep, aiLevel, state]);

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
    inProgress: started && state.phase !== 'gameover',
    stats,
    highScores,
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
    newGame,
    reset,
    resetStats,
  };
};

export { DICE_COUNT, MAX_ROLLS };
export type { GameSession };
