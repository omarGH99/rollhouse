import { Category, GameMode, GameState, ScoreSheet } from '../types';
import { ALL_CATEGORIES, UPPER_CATEGORIES, grandTotal } from './scoring';

export interface ModeRules {
  label: string;
  /** One line for the game-type picker. */
  blurb: string;
  /** The boxes in play. */
  categories: Category[];
  /**
   * One scorecard column per entry, each worth that multiple of its total.
   * Every box in every column is filled once, so this also sets the length.
   */
  multipliers: number[];
}

/**
 * Everything that differs between game types, in one table. The rest of the
 * engine asks this rather than branching on the mode's name.
 */
export const MODES: Record<GameMode, ModeRules> = {
  quick: {
    label: 'Quick',
    blurb: 'Upper section only. Six rounds.',
    categories: UPPER_CATEGORIES,
    multipliers: [1],
  },
  classic: {
    label: 'Classic',
    blurb: 'The full card. Thirteen rounds.',
    categories: ALL_CATEGORIES,
    multipliers: [1],
  },
  marathon: {
    label: 'Marathon',
    blurb: 'Three columns, worth x1, x2 and x3.',
    categories: ALL_CATEGORIES,
    multipliers: [1, 2, 3],
  },
};

/** In the order the picker shows them: shortest first. */
export const GAME_MODES: GameMode[] = ['quick', 'classic', 'marathon'];

export const isGameMode = (v: unknown): v is GameMode =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(MODES, v);

/** Turns each player takes: every box in every column, once. */
export const roundsFor = (mode: GameMode): number =>
  MODES[mode].categories.length * MODES[mode].multipliers.length;

/** A player's score: each column's total times what that column is worth. */
export const playerTotal = (columns: ScoreSheet[], mode: GameMode): number =>
  columns.reduce(
    (total, sheet, column) => total + grandTotal(sheet) * MODES[mode].multipliers[column],
    0,
  );

/** Every seat's score, in seat order. */
export const totalsFor = (state: Pick<GameState, 'scores' | 'mode'>): number[] =>
  state.scores.map((columns) => playerTotal(columns, state.mode));
