import {
  Category,
  DieState,
  DieValue,
  GameMode,
  GameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  Player,
  PlayerIndex,
} from '../types';
import { MODES, roundsFor } from './modes';
import {
  EXTRA_ROLLHOUSE_BONUS,
  createEmptyScoreSheet,
  earnsExtraRollhouse,
  isJoker,
  legalCategories,
  scoreFor,
} from './scoring';

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

export const defaultPlayers = (count = 2): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    name: `Player ${i + 1}`,
    kind: 'human' as const,
  }));

export const createInitialState = (
  players: Player[] = defaultPlayers(),
  mode: GameMode = 'classic',
): GameState => {
  const seats = players.slice(0, MAX_PLAYERS);
  if (seats.length < MIN_PLAYERS) {
    throw new Error(`A game needs at least ${MIN_PLAYERS} player`);
  }
  return {
    mode,
    players: seats,
    dice: freshDice(),
    rollsLeft: MAX_ROLLS,
    hasRolled: false,
    currentPlayer: 0,
    round: 1,
    scores: seats.map(() => MODES[mode].multipliers.map(() => createEmptyScoreSheet())),
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

export const createSession = (players?: Player[], mode?: GameMode): GameSession => ({
  state: createInitialState(players, mode),
  history: [],
});

export type GameAction =
  | { type: 'ROLL' }
  | { type: 'TOGGLE_HOLD'; dieId: number }
  /** `column` is which of the player's scorecard columns; 0 when there is one. */
  | { type: 'SCORE'; category: Category; column?: number }
  /** The incoming player tapped "start my turn" on the handoff overlay. */
  | { type: 'BEGIN_TURN' }
  /** Take back the most recent score a person made. */
  | { type: 'UNDO' }
  /** Swap in a session loaded from disk. Session-level only. */
  | { type: 'RESTORE'; session: GameSession }
  /** Deal a fresh game; anything omitted carries over from the current one. */
  | { type: 'RESET'; players?: Player[]; mode?: GameMode };

export const diceValues = (dice: DieState[]): DieValue[] => dice.map((d) => d.value);

export const canRoll = (state: GameState): boolean =>
  state.phase === 'turn' && state.rollsLeft > 0;

export const canScore = (state: GameState, category: Category, column = 0): boolean => {
  if (state.phase !== 'turn' || !state.hasRolled) return false;
  const sheet = state.scores[state.currentPlayer][column];
  if (!sheet) return false;
  return legalCategories(
    sheet,
    diceValues(state.dice),
    MODES[state.mode].categories,
  ).includes(category);
};

export const activePlayer = (state: GameState): Player =>
  state.players[state.currentPlayer];

/**
 * Index of the snapshot UNDO returns to: the newest one taken on a person's
 * turn. Bot turns are skipped — rewinding onto one would only hand the move
 * straight back to the bot, so undo always lands on a decision a person made.
 */
const undoIndex = (session: GameSession): number => {
  for (let i = session.history.length - 1; i >= 0; i -= 1) {
    if (activePlayer(session.history[i]).kind === 'human') return i;
  }
  return -1;
};

export const canUndo = (session: GameSession): boolean => undoIndex(session) >= 0;

/** Whose score UNDO would take back, or null when there is nothing to undo. */
export const undoSeat = (session: GameSession): PlayerIndex | null => {
  const index = undoIndex(session);
  return index < 0 ? null : session.history[index].currentPlayer;
};

export const isAiTurn = (state: GameState): boolean =>
  state.phase === 'turn' && activePlayer(state).kind === 'ai';

export const humanSeatCount = (state: GameState): number =>
  state.players.filter((p) => p.kind === 'human').length;

/**
 * Whether the game is waiting for a person to start their turn.
 *
 * The between-turns screen is a *turn boundary*, not a privacy screen —
 * The game has no hidden information, every score is public on a shared card,
 * and the screen even reports the move just played. What it actually buys is a
 * deliberate stop, so nobody rolls on someone else's turn and everyone gets a
 * beat to see what happened.
 *
 * So the rule is simply "is a person up next": bots start their own turns,
 * people tap in. It lives here, beside the reducer, because the UI and the
 * turn driver both need the answer and must never disagree — if the driver
 * waits for a tap while the UI renders nothing to tap, the game deadlocks.
 */
export const awaitsTurnStart = (state: GameState): boolean =>
  state.phase === 'handoff' &&
  state.players[state.incomingPlayer].kind === 'human';

/** The dice and counters a turn starts with. */
const freshTurn = () => ({
  dice: freshDice(),
  rollsLeft: MAX_ROLLS,
  hasRolled: false,
  phase: 'turn' as const,
});

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
      const column = action.column ?? 0;
      if (!canScore(state, action.category, column)) return state;

      const player = state.currentPlayer;
      const dice = diceValues(state.dice);
      const sheet = state.scores[player][column];
      const points = scoreFor(action.category, dice, isJoker(sheet, dice));
      const extra = earnsExtraRollhouse(sheet, dice);

      const scores = state.scores.map((columns, seat) =>
        seat !== player
          ? columns
          : columns.map((other, i) =>
              i !== column
                ? other
                : {
                    ...other,
                    [action.category]: points,
                    extraRollhouses: other.extraRollhouses + (extra ? 1 : 0),
                  },
            ),
      );

      const isLastPlayerOfRound = player === state.players.length - 1;
      const isFinalTurn = isLastPlayerOfRound && state.round === roundsFor(state.mode);
      const nextPlayer: PlayerIndex = (player + 1) % state.players.length;

      const scored: GameState = {
        ...state,
        scores,
        lastScored: {
          player,
          category: action.category,
          column,
          points,
          bonus: extra ? EXTRA_ROLLHOUSE_BONUS : 0,
        },
        phase: isFinalTurn ? 'gameover' : 'handoff',
        incomingPlayer: nextPlayer,
        // Round advances once the last seat has played.
        round: isLastPlayerOfRound && !isFinalTurn ? state.round + 1 : state.round,
      };

      // Playing alone there is nobody to hand over to, so the next turn simply
      // begins. `lastScored` is kept, so the box just filled still flashes.
      const solo = state.players.length === 1 && !isFinalTurn;
      return solo ? { ...scored, ...freshTurn() } : scored;
    }

    case 'BEGIN_TURN': {
      if (state.phase !== 'handoff') return state;
      return {
        ...state,
        ...freshTurn(),
        currentPlayer: state.incomingPlayer,
        lastScored: null,
      };
    }

    case 'RESET':
      return createInitialState(action.players ?? state.players, action.mode ?? state.mode);

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
    const index = undoIndex(session);
    if (index < 0) return session;
    // Any bot turns played since that snapshot are discarded along with it.
    return { state: session.history[index], history: session.history.slice(0, index) };
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
