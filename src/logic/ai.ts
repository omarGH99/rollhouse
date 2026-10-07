import { BotLevel, Category, DieValue, GameMode, ScoreSheet } from '../types';
import { MODES } from './modes';
import {
  ALL_CATEGORIES,
  EXTRA_ROLLHOUSE_BONUS,
  ROLLHOUSE_POINTS,
  UPPER_BONUS_POINTS,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
  earnsExtraRollhouse,
  isJoker,
  legalCategories,
  scoreFor,
  tallyFaces,
  upperSubtotal,
} from './scoring';

/**
 * The bots.
 *
 * Every level shares one idea of what a finished hand is worth: its points in
 * the best box still open, adjusted for what filling that box costs or sets
 * up. They differ in how they get there.
 *
 *  - `normal` enumerates all 32 ways to keep the dice and takes the one with
 *    the best *exact* expected value over the reroll, treating that reroll as
 *    its last. Each roll re-plans from scratch.
 *  - `hard` does the same but, with two rerolls in hand, accounts for both,
 *    and it measures every box against par: what that box is worth, on
 *    average, to someone who plays the rest of the game well.
 *  - `easy` does not search at all: it keeps its most common number and takes
 *    whatever scores most right now, which is how most people start out.
 *
 * Nothing here is random, so a level's play is reproducible and testable.
 */

const HAND_SIZE = 5;

/** What a bot can see of its own scorecard. */
export interface BotBoard {
  /** One sheet per scorecard column. */
  columns: ScoreSheet[];
  /** The boxes in play in this game type. */
  categories: Category[];
  /** What each column is worth, parallel to `columns`. */
  multipliers: number[];
}

export const boardFor = (columns: ScoreSheet[], mode: GameMode): BotBoard => ({
  columns,
  categories: MODES[mode].categories,
  multipliers: MODES[mode].multipliers,
});

const singleSheet = (sheet: ScoreSheet): BotBoard => ({
  columns: [sheet],
  categories: ALL_CATEGORIES,
  multipliers: [1],
});

/** Face value each upper box counts, or undefined for the lower section. */
const UPPER_FACE: Partial<Record<Category, number>> = Object.fromEntries(
  UPPER_CATEGORIES.map((category, i) => [category, i + 1]),
);

/**
 * Could the upper bonus still be earned? Assumes the best case — five of a
 * kind in every box left open — so a `false` here means it is truly gone.
 */
const upperBonusReachable = (sheet: ScoreSheet): boolean => {
  let ceiling = 0;
  for (const category of UPPER_CATEGORIES) {
    const scored = sheet[category];
    ceiling += scored === null ? (UPPER_FACE[category] as number) * 5 : scored;
  }
  return ceiling >= UPPER_BONUS_THRESHOLD;
};

/** Value of a filled box beyond its face points, used to guide the search. */
const positionalBonus = (
  category: Category,
  points: number,
  sheet: ScoreSheet,
): number => {
  let bonus = 0;

  const face = UPPER_FACE[category];
  if (face !== undefined) {
    const subtotal = upperSubtotal(sheet);
    // Only steer toward the bonus while it is still both unearned and
    // attainable — otherwise missing "par" is not a cost at all.
    if (subtotal < UPPER_BONUS_THRESHOLD && upperBonusReachable(sheet)) {
      // Three of a face is the "par" that keeps the 63 bonus on track; credit
      // or debit the move by how far it moves us from that pace.
      const par = face * 3;
      const remaining = UPPER_BONUS_THRESHOLD - subtotal;
      const reachable = Math.min(remaining, UPPER_BONUS_POINTS);
      bonus += ((points - par) / par) * reachable * 0.35;
    }
  }

  // Burning a high-value box on a zero is much worse than its 0 points suggest.
  if (points === 0) {
    const cost: Partial<Record<Category, number>> = {
      rollhouse: 14,
      largeStraight: 9,
      smallStraight: 6,
      fullHouse: 5,
      fourOfAKind: 4,
      threeOfAKind: 2,
      chance: 8,
    };
    bonus -= cost[category] ?? 0;
  }

  return bonus;
};

/** A box a hand could go in, and what it would score there. */
interface Option {
  column: number;
  category: Category;
  points: number;
  /** Extra-Rollhouse bonus the same hand earns in this column, or 0. */
  extra: number;
  sheet: ScoreSheet;
  multiplier: number;
}

/** A board with each column's open boxes worked out once, up front. */
interface Prepared {
  board: BotBoard;
  open: Category[][];
}

const prepare = (board: BotBoard): Prepared => ({
  board,
  open: board.columns.map((sheet) =>
    board.categories.filter((category) => sheet[category] === null),
  ),
});

/** Every box the rules allow `dice` into, across all columns. */
const optionsFor = (dice: DieValue[], { board, open }: Prepared): Option[] => {
  const options: Option[] = [];
  board.columns.forEach((sheet, column) => {
    // A Joker narrows where the hand may go and changes what it is worth there.
    const joker = isJoker(sheet, dice);
    const legal = joker ? legalCategories(sheet, dice, board.categories) : open[column];
    const extra = earnsExtraRollhouse(sheet, dice) ? EXTRA_ROLLHOUSE_BONUS : 0;
    for (const category of legal) {
      options.push({
        column,
        category,
        points: scoreFor(category, dice, joker),
        extra,
        sheet,
        multiplier: board.multipliers[column],
      });
    }
  });
  return options;
};

/** What taking an option is worth to a bot that thinks about the whole card. */
const worth = (o: Option): number =>
  o.multiplier * (o.points + o.extra + positionalBonus(o.category, o.points, o.sheet));

/** What it is worth to one that only counts the points in front of it. */
const faceWorth = (o: Option): number => o.multiplier * (o.points + o.extra);

/**
 * What each box is worth on average to a player who plays the whole game
 * well: the points given up, in expectation, by closing it. Filling a box only
 * gains what it scores *beyond* this, which is what stops a strong player
 * spending Chance on a poor hand or taking a thin Three of a Kind early.
 */
const PAR: Record<Category, number> = {
  ones: 2.1,
  twos: 5.3,
  threes: 8.6,
  fours: 12.2,
  fives: 15.7,
  sixes: 19.2,
  threeOfAKind: 21.7,
  fourOfAKind: 13.1,
  fullHouse: 22.6,
  smallStraight: 29.5,
  largeStraight: 32.7,
  rollhouse: 16.9,
  chance: 22.0,
};

/** What an option is worth measured against par, with the upper bonus in view. */
const worthOverPar = (o: Option): number => {
  let value = o.points + o.extra - PAR[o.category];

  const face = UPPER_FACE[o.category];
  if (face !== undefined) {
    const subtotal = upperSubtotal(o.sheet);
    if (subtotal < UPPER_BONUS_THRESHOLD && upperBonusReachable(o.sheet)) {
      // Each point above or below three-of-a-face moves the 35 closer or
      // further; landing the bonus outright is worth all of it.
      const after = subtotal + o.points;
      value +=
        after >= UPPER_BONUS_THRESHOLD
          ? UPPER_BONUS_POINTS * 0.6
          : (o.points - face * 3) * 0.9;
    }
  }
  return o.multiplier * value;
};

type OptionValuer = (option: Option) => number;

const valuerFor = (level: BotLevel): OptionValuer =>
  level === 'hard' ? worthOverPar : level === 'easy' ? faceWorth : worth;

/** Best achievable value of a finished hand. */
const handValue = (dice: DieValue[], prepared: Prepared, valuer: OptionValuer): number => {
  let best = -Infinity;
  for (const option of optionsFor(dice, prepared)) {
    const value = valuer(option);
    if (value > best) best = value;
  }
  return best === -Infinity ? 0 : best;
};

/**
 * Canonical key for a set of dice. Dice are a multiset — 1-2-3-4-5 and
 * 5-4-3-2-1 score identically — so keying on face counts collapses the 7,776
 * ordered outcomes of a five-die reroll onto just 252 distinct hands. Sets of
 * different sizes never collide, since the counts sum to the size.
 */
const handKey = (dice: DieValue[]): number => {
  let key = 0;
  for (let i = 0; i < dice.length; i += 1) {
    // One 3-bit field per face, holding how many dice show it.
    key += 1 << ((dice[i] - 1) * 3);
  }
  return key;
};

type HandValuer = (hand: DieValue[]) => number;

/** Cache a valuer by hand. The hand array may be reused by the caller. */
const memoize = (valuer: HandValuer): HandValuer => {
  const cache = new Map<number, number>();
  return (hand) => {
    const key = handKey(hand);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = valuer(hand);
    cache.set(key, value);
    return value;
  };
};

/**
 * Exact expected value of `valuer` after rerolling up to a full hand from
 * `kept`. Enumerates every outcome rather than sampling, so it is
 * deterministic. `memo` is keyed on the kept dice and belongs to one valuer.
 */
const expectation = (
  kept: DieValue[],
  valuer: HandValuer,
  memo: Map<number, number>,
): number => {
  const key = handKey(kept);
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  const hand = kept.slice();
  let total = 0;
  let outcomes = 0;

  const recurse = (remaining: number) => {
    if (remaining === 0) {
      total += valuer(hand);
      outcomes += 1;
      return;
    }
    for (let face = 1; face <= 6; face += 1) {
      hand.push(face as DieValue);
      recurse(remaining - 1);
      hand.pop();
    }
  };

  recurse(HAND_SIZE - kept.length);
  const value = total / outcomes;
  memo.set(key, value);
  return value;
};

export interface KeepDecision {
  /** Indices into the dice array that should be held. */
  keep: number[];
  expected: number;
}

/** The best of the 32 ways to keep `dice`, judged by `valuer` after a reroll. */
const bestKeep = (
  dice: DieValue[],
  valuer: HandValuer,
  memo: Map<number, number>,
): KeepDecision => {
  let best: KeepDecision = { keep: [], expected: -Infinity };

  for (let mask = 0; mask < 1 << dice.length; mask += 1) {
    const keepIndices: number[] = [];
    const kept: DieValue[] = [];
    for (let i = 0; i < dice.length; i += 1) {
      if (mask & (1 << i)) {
        keepIndices.push(i);
        kept.push(dice[i]);
      }
    }
    const expected = expectation(kept, valuer, memo);
    if (expected > best.expected) best = { keep: keepIndices, expected };
  }

  return best;
};

/** Keep the most common number; ties go to the higher face. */
const easyKeep = (dice: DieValue[], prepared: Prepared): KeepDecision => {
  // Even a beginner does not break up a made hand.
  const made = optionsFor(dice, prepared).some((o) => o.points >= 25);
  if (made) return { keep: dice.map((_, i) => i), expected: 0 };

  const counts = tallyFaces(dice);
  let face = 1;
  for (let f = 2; f <= 6; f += 1) {
    if (counts[f] >= counts[face]) face = f;
  }
  const keep = dice.flatMap((value, i) => (value === face ? [i] : []));
  return { keep, expected: 0 };
};

/**
 * Which dice to hold before rerolling. Returns indices so the caller can map
 * them straight onto `DieState.id`. `rollsLeft` counts the rerolls still
 * available, including the one about to be taken.
 */
export const planKeep = (
  dice: DieValue[],
  board: BotBoard,
  rollsLeft = 1,
  level: BotLevel = 'normal',
): KeepDecision => {
  const prepared = prepare(board);
  if (level === 'easy') return easyKeep(dice, prepared);

  const final = memoize((hand) => handValue(hand, prepared, valuerFor(level)));
  if (level !== 'hard' || rollsLeft < 2) return bestKeep(dice, final, new Map());

  // With a reroll to spare, a hand is worth what its own best keep expects —
  // not what it would score if the turn ended on it. Both tables are small:
  // 252 hands, and 462 distinct sets of kept dice.
  const finalMemo = new Map<number, number>();
  const withRerollLeft = memoize(
    (hand) => bestKeep(hand.slice(), final, finalMemo).expected,
  );
  return bestKeep(dice, withRerollLeft, new Map());
};

export interface ScoreDecision {
  category: Category;
  column: number;
}

/**
 * Which box to take, given a final hand. Only ever returns a box the rules
 * allow for these dice, so never a filled one and never one a Joker forbids.
 */
export const planScore = (
  dice: DieValue[],
  board: BotBoard,
  level: BotLevel = 'normal',
): ScoreDecision => {
  const options = optionsFor(dice, prepare(board));
  if (options.length === 0) {
    throw new Error('planScore called on a full sheet');
  }

  let best = options[0];
  let bestValue = -Infinity;

  for (const option of options) {
    let value = valuerFor(level)(option);
    if (level === 'normal') {

      // With a genuine Rollhouse in hand, take it rather than bank the pips:
      // the box is also what unlocks the bonus for any that follow.
      if (option.category === 'rollhouse' && option.points === ROLLHOUSE_POINTS) {
        value += 25 * option.multiplier;
      }

      // Prefer to dump an unavoidable zero in the cheapest box available.
      if (option.points === 0 && options.length > 1) value -= 0.5;
    }

    if (value > bestValue) {
      bestValue = value;
      best = option;
    }
  }

  return { category: best.category, column: best.column };
};

/** `planKeep` for a single classic sheet, with one reroll in mind. */
export const chooseKeep = (dice: DieValue[], sheet: ScoreSheet): KeepDecision =>
  planKeep(dice, singleSheet(sheet));

/** `planScore` for a single classic sheet. */
export const chooseCategory = (dice: DieValue[], sheet: ScoreSheet): Category =>
  planScore(dice, singleSheet(sheet)).category;
