export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface DieState {
  id: number;
  value: DieValue;
  held: boolean;
}

export type UpperCategory = 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes';

export type LowerCategory =
  | 'threeOfAKind'
  | 'fourOfAKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'rollhouse'
  | 'chance';

export type Category = UpperCategory | LowerCategory;

/** `null` means the category is still open. */
export type ScoreSheet = Record<Category, number | null> & {
  /**
   * Rollhouses rolled after the Rollhouse box was already scored for 50. Each
   * is worth a bonus on top of whatever box that turn went in.
   */
  extraRollhouses: number;
};

/** Seat index, `0 .. players.length - 1`. */
export type PlayerIndex = number;

/** One seat is a solo game, played for a high score. */
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;

export type PlayerKind = 'human' | 'ai';

/** How well a bot seat plays. Absent means `normal`. */
export type BotLevel = 'easy' | 'normal' | 'hard';

export interface Player {
  name: string;
  kind: PlayerKind;
  level?: BotLevel;
}

/**
 * Which game is being played. The rules each one implies — which boxes, how
 * many scorecard columns, how long — live in `logic/modes.ts`.
 */
export type GameMode = 'quick' | 'classic' | 'marathon';

export type Phase =
  /** Active player is rolling / choosing a category. */
  | 'turn'
  /** Score locked in — board is masked until the next player taps in. */
  | 'handoff'
  | 'gameover';

export interface LastScored {
  player: PlayerIndex;
  category: Category;
  /** Which of the player's scorecard columns it went in. */
  column: number;
  /** Points written in the box, before any column multiplier. */
  points: number;
  /** Extra-Rollhouse bonus earned by the same roll, or 0. */
  bonus: number;
}

export interface GameState {
  mode: GameMode;
  /** Seats, in turn order. Length is 1-4 and fixed for the game. */
  players: Player[];
  dice: DieState[];
  rollsLeft: number;
  /** False until the active player's first roll of the turn. */
  hasRolled: boolean;
  currentPlayer: PlayerIndex;
  /** From 1. Each round = one turn for every player. */
  round: number;
  /**
   * `scores[seat][column]`. Most games have a single column per seat; Marathon
   * has three, each worth a different multiple.
   */
  scores: ScoreSheet[][];
  phase: Phase;
  /** Who the handoff overlay is waiting on. */
  incomingPlayer: PlayerIndex;
  /** Bumped on every roll so dice can re-run their animation. */
  rollNonce: number;
  /** Most recently locked-in category, for the score-flash animation. */
  lastScored: LastScored | null;
}
