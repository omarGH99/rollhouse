import {
  Category,
  DieState,
  DieValue,
  GameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  Player,
  PlayerIndex,
} from '../types';
import { TOTAL_ROUNDS, createEmptyScoreSheet, scoreFor } from './scoring';

export const DICE_COUNT = 5;
export const MAX_ROLLS = 3;

/** How many completed turns can be taken back. */
export const HISTORY_LIMIT = 12;

const randomFace = (): DieValue => ((Math.floor(Math.random() * 6) + 1) as DieValue);

const freshDice = (): DieState[] =>
  Array.from({ length: DICE_COUNT }, (_, id) => ({
    id,
    value: randomFace(),
    held: false,
  }));

export const defaultPlayers = (count = MIN_PLAYERS): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    name: `Player ${i + 1}`,
    kind: 'human' as const,
  }));

export const createInitialState = (
  players: Player[] = defaultPlayers(),
): GameState => {
  const seats = players.slice(0, MAX_PLAYERS);
  if (seats.length < MIN_PLAYERS) {
    throw new Error(`A game needs at least ${MIN_PLAYERS} players`);
  }
  return {
    players: seats,
    dice: freshDice(),
    rollsLeft: MAX_ROLLS,
    hasRolled: false,
    currentPlayer: 0,
    round: 1,
    scores: seats.map(() => createEmptyScoreSheet()),
    phase: 'turn',
    incomingPlayer: 0,
    rollNonce: 0,
    lastScored: null,
  };
};

/**
 * Undo stack. Kept beside `GameState` rather than inside it so the game state
 * stays a plain snapshot — which is what makes it trivially serializable and
 * what lets each history entry simply *be* a previous state.
 */
export interface GameSession {
  state: GameState;
  /** Snapshots taken immediately before each SCORE, newest last. */
  history: GameState[];
}

export const createSession = (players?: Player[]): GameSession => ({
  state: createInitialState(players),
  history: [],
});

export type GameAction =
  | { type: 'ROLL' }
  | { type: 'TOGGLE_HOLD'; dieId: number }
  | { type: 'SCORE'; category: Category }
  /** The incoming player tapped "start my turn" on the handoff overlay. */
  | { type: 'BEGIN_TURN' }
  /** Take back the most recent scoring action. */
  | { type: 'UNDO' }
  /** Swap in a session loaded from disk. Session-level only. */
  | { type: 'RESTORE'; session: GameSession }
  | { type: 'RESET'; players?: Player[] };

export const diceValues = (dice: DieState[]): DieValue[] => dice.map((d) => d.value);

export const canRoll = (state: GameState): boolean =>
  state.phase === 'turn' && state.rollsLeft > 0;

export const canScore = (state: GameState, category: Category): boolean =>
  state.phase === 'turn' &&
  state.hasRolled &&
  state.scores[state.currentPlayer][category] === null;

export const canUndo = (session: GameSession): boolean =>
  session.history.length > 0;

export const activePlayer = (state: GameState): Player =>
  state.players[state.currentPlayer];

export const isAiTurn = (state: GameState): boolean =>
  state.phase === 'turn' && activePlayer(state).kind === 'ai';

/** Pure state transition. Illegal actions return the same object reference. */
export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'ROLL': {
      if (!canRoll(state)) return state;
      return {
        ...state,
        dice: state.dice.map((die) =>
          die.held ? die : { ...die, value: randomFace() },
        ),
        rollsLeft: state.rollsLeft - 1,
        hasRolled: true,
        rollNonce: state.rollNonce + 1,
        lastScored: null,
      };
    }

    case 'TOGGLE_HOLD': {
      // Holding is meaningless before the first roll or after the last one.
      if (state.phase !== 'turn' || !state.hasRolled || state.rollsLeft === 0) {
        return state;
      }
      return {
        ...state,
        dice: state.dice.map((die) =>
          die.id === action.dieId ? { ...die, held: !die.held } : die,
        ),
      };
    }

    case 'SCORE': {
      if (!canScore(state, action.category)) return state;

      const player = state.currentPlayer;
      const points = scoreFor(action.category, diceValues(state.dice));

      const scores = state.scores.map((sheet, i) =>
        i === player ? { ...sheet, [action.category]: points } : sheet,
      );

      const isLastPlayerOfRound = player === state.players.length - 1;
      const isFinalTurn = isLastPlayerOfRound && state.round === TOTAL_ROUNDS;
      const nextPlayer: PlayerIndex = (player + 1) % state.players.length;

      return {
        ...state,
        scores,
        lastScored: { player, category: action.category, points },
        phase: isFinalTurn ? 'gameover' : 'handoff',
        incomingPlayer: nextPlayer,
        // Round advances once the last seat has played.
        round: isLastPlayerOfRound && !isFinalTurn ? state.round + 1 : state.round,
      };
    }

    case 'BEGIN_TURN': {
      if (state.phase !== 'handoff') return state;
      return {
        ...state,
        currentPlayer: state.incomingPlayer,
        dice: freshDice(),
        rollsLeft: MAX_ROLLS,
        hasRolled: false,
        phase: 'turn',
        lastScored: null,
      };
    }

    case 'RESET':
      return createInitialState(action.players ?? state.players);

    default:
      return state;
  }
};

/**
 * Session-level reducer: threads the undo stack around `gameReducer`. SCORE
 * pushes a snapshot, UNDO pops one, and anything that starts a fresh game
 * clears the stack.
 */
export const sessionReducer = (
  session: GameSession,
  action: GameAction,
): GameSession => {
  if (action.type === 'RESTORE') return action.session;

  if (action.type === 'UNDO') {
    if (!canUndo(session)) return session;
    const history = session.history.slice(0, -1);
    return { state: session.history[session.history.length - 1], history };
  }

  const state = gameReducer(session.state, action);
  if (state === session.state) return session;

  if (action.type === 'RESET') return { state, history: [] };

  if (action.type === 'SCORE') {
    // Snapshot the pre-score state so UNDO restores the dice as they were.
    const history = [...session.history, session.state].slice(-HISTORY_LIMIT);
    return { state, history };
  }

  return { state, history: session.history };
};
