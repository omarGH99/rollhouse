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

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export type PlayerKind = 'human' | 'ai';

export interface Player {
  name: string;
  kind: PlayerKind;
}

export type Phase =
  /** Active player is rolling / choosing a category. */
  | 'turn'
  /** Score locked in — board is masked until the next player taps in. */
  | 'handoff'
  | 'gameover';

export interface LastScored {
  player: PlayerIndex;
  category: Category;
  /** Points written in the box. */
  points: number;
  /** Extra-Rollhouse bonus earned by the same roll, or 0. */
  bonus: number;
}

export interface GameState {
  /** Seats, in turn order. Length is 2-4 and fixed for the game. */
  players: Player[];
  dice: DieState[];
  rollsLeft: number;
  /** False until the active player's first roll of the turn. */
  hasRolled: boolean;
  currentPlayer: PlayerIndex;
  /** 1-13. Each round = one turn for every player. */
  round: number;
  /** One sheet per seat, parallel to `players`. */
  scores: ScoreSheet[];
  phase: Phase;
  /** Who the handoff overlay is waiting on. */
  incomingPlayer: PlayerIndex;
  /** Bumped on every roll so dice can re-run their animation. */
  rollNonce: number;
  /** Most recently locked-in category, for the score-flash animation. */
  lastScored: LastScored | null;
}
