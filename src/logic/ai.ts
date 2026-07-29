import { Category, DieValue, ScoreSheet } from '../types';
import {
  ALL_CATEGORIES,
  UPPER_BONUS_POINTS,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
  scoreFor,
  tallyFaces,
  upperSubtotal,
} from './scoring';

/**
 * A one-ply expectimax bot.
 *
 * For the keep decision it enumerates all 32 subsets of the five dice and, for
 * each, computes the *exact* expected value over every possible reroll outcome.
 * That sounds costly but the work is bounded: summing 6^k over all C(5,k)
 * subsets is 7^5 = 16,807 evaluations, which is trivial.
 *
 * It deliberately does not search two plies deep (16,807² is far too much).
 * Instead each roll re-plans from scratch, which recovers most of the value of
 * deeper search at a fraction of the cost.
 */

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
      yahtzee: 14,
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

/**
 * Best achievable value of `dice` across the still-open boxes. `open` is passed
 * in rather than derived because this runs ~17k times per decision, and
 * rescanning the sheet each call dominated the cost.
 */
const bestValue = (
  dice: DieValue[],
  sheet: ScoreSheet,
  open: Category[],
): number => {
  let best = -Infinity;
  for (let i = 0; i < open.length; i += 1) {
    const category = open[i];
    const points = scoreFor(category, dice);
    const value = points + positionalBonus(category, points, sheet);
    if (value > best) best = value;
  }
  return best === -Infinity ? 0 : best;
};

const openCategories = (sheet: ScoreSheet): Category[] =>
  ALL_CATEGORIES.filter((c) => sheet[c] === null);

/**
 * Canonical key for a hand. Dice are a multiset — 1-2-3-4-5 and 5-4-3-2-1 score
 * identically — so keying on face counts collapses the 7,776 ordered outcomes
 * of a five-die reroll onto just 252 distinct hands.
 */
const handKey = (dice: DieValue[]): number => {
  let key = 0;
  for (let i = 0; i < dice.length; i += 1) {
    // Six base-6 digits, one per face count (each count fits in 3 bits).
    key += 1 << ((dice[i] - 1) * 3);
  }
  return key;
};

/**
 * Exact expected `bestValue` after rerolling the dice not in `keep`.
 * Enumerates all 6^n outcomes rather than sampling, so it is deterministic.
 */
const expectedValue = (
  keep: DieValue[],
  rerollCount: number,
  sheet: ScoreSheet,
  open: Category[],
  cache: Map<number, number>,
): number => {
  const evaluate = (hand: DieValue[]): number => {
    const key = handKey(hand);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = bestValue(hand, sheet, open);
    cache.set(key, value);
    return value;
  };

  if (rerollCount === 0) return evaluate(keep);

  const hand = keep.slice();
  let total = 0;
  let outcomes = 0;

  const recurse = (depth: number) => {
    if (depth === 0) {
      total += evaluate(hand);
      outcomes += 1;
      return;
    }
    for (let face = 1; face <= 6; face += 1) {
      hand.push(face as DieValue);
      recurse(depth - 1);
      hand.pop();
    }
  };

  recurse(rerollCount);
  return total / outcomes;
};

export interface KeepDecision {
  /** Indices into the dice array that should be held. */
  keep: number[];
  expected: number;
}

/**
 * Which dice to hold before rerolling. Returns indices so the caller can map
 * them straight onto `DieState.id`.
 */
export const chooseKeep = (
  dice: DieValue[],
  sheet: ScoreSheet,
): KeepDecision => {
  let best: KeepDecision = { keep: [], expected: -Infinity };
  const open = openCategories(sheet);
  // Shared across all 32 subsets: they evaluate many of the same hands.
  const cache = new Map<number, number>();

  for (let mask = 0; mask < 1 << dice.length; mask += 1) {
    const keepIndices: number[] = [];
    const kept: DieValue[] = [];
    for (let i = 0; i < dice.length; i += 1) {
      if (mask & (1 << i)) {
        keepIndices.push(i);
        kept.push(dice[i]);
      }
    }
    const expected = expectedValue(
      kept,
      dice.length - kept.length,
      sheet,
      open,
      cache,
    );
    if (expected > best.expected) {
      best = { keep: keepIndices, expected };
    }
  }

  return best;
};

/** Which box to take, given a final hand. Never returns a filled category. */
export const chooseCategory = (dice: DieValue[], sheet: ScoreSheet): Category => {
  const open = openCategories(sheet);
  if (open.length === 0) {
    throw new Error('chooseCategory called on a full sheet');
  }

  let best = open[0];
  let bestValue = -Infinity;

  for (const category of open) {
    const points = scoreFor(category, dice);
    let value = points + positionalBonus(category, points, sheet);

    // With a genuine Yahtzee in hand, take it rather than bank the pips.
    if (category === 'yahtzee' && points === 50) value += 25;

    // Prefer to dump an unavoidable zero in the cheapest box available.
    if (points === 0 && open.length > 1) value -= 0.5;

    if (value > bestValue) {
      bestValue = value;
      best = category;
    }
  }

  return best;
};

/** True when the hand is five alike — used for commentary and stats. */
export const isYahtzee = (dice: DieValue[]): boolean =>
  tallyFaces(dice).some((count) => count === 5);
