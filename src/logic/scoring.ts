import {
  Category,
  DieValue,
  LowerCategory,
  ScoreSheet,
  UpperCategory,
} from '../types';

export const UPPER_CATEGORIES: UpperCategory[] = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
];

export const LOWER_CATEGORIES: LowerCategory[] = [
  'threeOfAKind',
  'fourOfAKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
];

export const ALL_CATEGORIES: Category[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

export const CATEGORY_LABELS: Record<Category, string> = {
  ones: 'Ones',
  twos: 'Twos',
  threes: 'Threes',
  fours: 'Fours',
  fives: 'Fives',
  sixes: 'Sixes',
  threeOfAKind: 'Three of a Kind',
  fourOfAKind: 'Four of a Kind',
  fullHouse: 'Full House',
  smallStraight: 'Small Straight',
  largeStraight: 'Large Straight',
  // The category key stays `yahtzee` so saved games keep loading; only the
  // player-facing name changes.
  yahtzee: 'QOMAR',
  chance: 'Chance',
};

/** Short hint shown under each label. */
export const CATEGORY_HINTS: Record<Category, string> = {
  ones: 'Sum of 1s',
  twos: 'Sum of 2s',
  threes: 'Sum of 3s',
  fours: 'Sum of 4s',
  fives: 'Sum of 5s',
  sixes: 'Sum of 6s',
  threeOfAKind: 'Sum of all dice',
  fourOfAKind: 'Sum of all dice',
  fullHouse: '25 pts',
  smallStraight: '30 pts',
  largeStraight: '40 pts',
  yahtzee: '50 pts',
  chance: 'Sum of all dice',
};

export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS_POINTS = 35;
export const TOTAL_ROUNDS = ALL_CATEGORIES.length; // 13

export const createEmptyScoreSheet = (): ScoreSheet =>
  ALL_CATEGORIES.reduce((sheet, category) => {
    sheet[category] = null;
    return sheet;
  }, {} as ScoreSheet);

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** counts[v] = how many dice show face `v` (index 0 unused). */
export const tallyFaces = (dice: DieValue[]): number[] => {
  const counts = new Array(7).fill(0);
  for (const die of dice) counts[die] += 1;
  return counts;
};

export const sumAll = (dice: DieValue[]): number => dice.reduce((a, b) => a + b, 0);

const sumOfFace = (dice: DieValue[], face: DieValue): number =>
  dice.filter((d) => d === face).length * face;

const hasRunOfLength = (dice: DieValue[], length: number): boolean => {
  const unique = Array.from(new Set(dice)).sort((a, b) => a - b);
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    run = unique[i] === unique[i - 1] + 1 ? run + 1 : 1;
    if (run >= length) return true;
  }
  return run >= length;
};

/* -------------------------------------------------------------------------- */
/* Category calculators                                                        */
/* -------------------------------------------------------------------------- */

export const calculateUpper = (dice: DieValue[], face: DieValue): number =>
  sumOfFace(dice, face);

export const calculateNOfAKind = (dice: DieValue[], n: number): number =>
  tallyFaces(dice).some((count) => count >= n) ? sumAll(dice) : 0;

export const calculateThreeOfAKind = (dice: DieValue[]): number =>
  calculateNOfAKind(dice, 3);

export const calculateFourOfAKind = (dice: DieValue[]): number =>
  calculateNOfAKind(dice, 4);

export const calculateFullHouse = (dice: DieValue[]): number => {
  const counts = tallyFaces(dice).filter((c) => c > 0);
  const isFullHouse =
    (counts.length === 2 && counts.includes(3) && counts.includes(2)) ||
    // Five of a kind also satisfies a full house under standard rules.
    counts.includes(5);
  return isFullHouse ? 25 : 0;
};

export const calculateSmallStraight = (dice: DieValue[]): number =>
  hasRunOfLength(dice, 4) ? 30 : 0;

export const calculateLargeStraight = (dice: DieValue[]): number =>
  hasRunOfLength(dice, 5) ? 40 : 0;

export const calculateYahtzee = (dice: DieValue[]): number =>
  tallyFaces(dice).some((count) => count === 5) ? 50 : 0;

export const calculateChance = (dice: DieValue[]): number => sumAll(dice);

const UPPER_FACE: Record<UpperCategory, DieValue> = {
  ones: 1,
  twos: 2,
  threes: 3,
  fours: 4,
  fives: 5,
  sixes: 6,
};

/** Points `dice` would earn in `category`. */
export const scoreFor = (category: Category, dice: DieValue[]): number => {
  switch (category) {
    case 'ones':
    case 'twos':
    case 'threes':
    case 'fours':
    case 'fives':
    case 'sixes':
      return calculateUpper(dice, UPPER_FACE[category]);
    case 'threeOfAKind':
      return calculateThreeOfAKind(dice);
    case 'fourOfAKind':
      return calculateFourOfAKind(dice);
    case 'fullHouse':
      return calculateFullHouse(dice);
    case 'smallStraight':
      return calculateSmallStraight(dice);
    case 'largeStraight':
      return calculateLargeStraight(dice);
    case 'yahtzee':
      return calculateYahtzee(dice);
    case 'chance':
      return calculateChance(dice);
  }
};

/** Preview score for every still-open category. */
export const previewScores = (
  sheet: ScoreSheet,
  dice: DieValue[],
): Partial<Record<Category, number>> => {
  const preview: Partial<Record<Category, number>> = {};
  for (const category of ALL_CATEGORIES) {
    if (sheet[category] === null) preview[category] = scoreFor(category, dice);
  }
  return preview;
};

/* -------------------------------------------------------------------------- */
/* Totals                                                                      */
/* -------------------------------------------------------------------------- */

const sumSection = (sheet: ScoreSheet, categories: Category[]): number =>
  categories.reduce((total, c) => total + (sheet[c] ?? 0), 0);

export const upperSubtotal = (sheet: ScoreSheet): number =>
  sumSection(sheet, UPPER_CATEGORIES);

export const upperBonus = (sheet: ScoreSheet): number =>
  upperSubtotal(sheet) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_POINTS : 0;

export const upperTotal = (sheet: ScoreSheet): number =>
  upperSubtotal(sheet) + upperBonus(sheet);

export const lowerTotal = (sheet: ScoreSheet): number =>
  sumSection(sheet, LOWER_CATEGORIES);

export const grandTotal = (sheet: ScoreSheet): number =>
  upperTotal(sheet) + lowerTotal(sheet);

export const isSheetComplete = (sheet: ScoreSheet): boolean =>
  ALL_CATEGORIES.every((c) => sheet[c] !== null);
