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
  'rollhouse',
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
  rollhouse: 'Rollhouse',
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
  rollhouse: '50 pts',
  chance: 'Sum of all dice',
};

export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS_POINTS = 35;
export const ROLLHOUSE_POINTS = 50;
/** Paid for each further Rollhouse once the box holds its 50. */
export const EXTRA_ROLLHOUSE_BONUS = 100;
export const TOTAL_ROUNDS = ALL_CATEGORIES.length; // 13

export const createEmptyScoreSheet = (): ScoreSheet =>
  ALL_CATEGORIES.reduce(
    (sheet, category) => {
      sheet[category] = null;
      return sheet;
    },
    { extraRollhouses: 0 } as ScoreSheet,
  );

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

/** Three of one face and two of another. Five alike is not a full house. */
export const calculateFullHouse = (dice: DieValue[]): number => {
  const counts = tallyFaces(dice).filter((c) => c > 0);
  return counts.length === 2 && counts.includes(3) ? 25 : 0;
};

export const calculateSmallStraight = (dice: DieValue[]): number =>
  hasRunOfLength(dice, 4) ? 30 : 0;

export const calculateLargeStraight = (dice: DieValue[]): number =>
  hasRunOfLength(dice, 5) ? 40 : 0;

/** All five dice showing the same face. */
export const isFiveAlike = (dice: DieValue[]): boolean =>
  tallyFaces(dice).some((count) => count === 5);

export const calculateRollhouse = (dice: DieValue[]): number =>
  isFiveAlike(dice) ? ROLLHOUSE_POINTS : 0;

export const calculateChance = (dice: DieValue[]): number => sumAll(dice);

const UPPER_FACE: Record<UpperCategory, DieValue> = {
  ones: 1,
  twos: 2,
  threes: 3,
  fours: 4,
  fives: 5,
  sixes: 6,
};

const UPPER_BOX: Record<DieValue, UpperCategory> = {
  1: 'ones',
  2: 'twos',
  3: 'threes',
  4: 'fours',
  5: 'fives',
  6: 'sixes',
};

/**
 * A Rollhouse rolled when its box is already filled (with 50 or with a zero)
 * is a Joker: it may stand in for a full house or either straight, but where
 * it can be scored is restricted — see `legalCategories`.
 */
export const isJoker = (sheet: ScoreSheet, dice: DieValue[]): boolean =>
  sheet.rollhouse !== null && isFiveAlike(dice);

/** A further Rollhouse only pays its bonus if the box was scored, not zeroed. */
export const earnsExtraRollhouse = (sheet: ScoreSheet, dice: DieValue[]): boolean =>
  sheet.rollhouse === ROLLHOUSE_POINTS && isFiveAlike(dice);

/**
 * Boxes these dice may be scored in. Normally every open box. A Joker is
 * forced: the upper box matching its face if that is open; failing that any
 * open lower box; failing that an open upper box, where it scores nothing.
 */
export const legalCategories = (sheet: ScoreSheet, dice: DieValue[]): Category[] => {
  const open = ALL_CATEGORIES.filter((c) => sheet[c] === null);
  if (!isJoker(sheet, dice)) return open;

  const matching = UPPER_BOX[dice[0]];
  if (sheet[matching] === null) return [matching];

  const lower = open.filter((c) => !(c in UPPER_FACE));
  return lower.length > 0 ? lower : open;
};

/**
 * Points `dice` would earn in `category`. With `joker` set, the fixed-value
 * lower boxes pay in full even though five alike is none of those hands.
 */
export const scoreFor = (
  category: Category,
  dice: DieValue[],
  joker = false,
): number => {
  if (joker) {
    if (category === 'fullHouse') return 25;
    if (category === 'smallStraight') return 30;
    if (category === 'largeStraight') return 40;
  }
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
    case 'rollhouse':
      return calculateRollhouse(dice);
    case 'chance':
      return calculateChance(dice);
  }
};

/** Preview score for every box these dice may be scored in. */
export const previewScores = (
  sheet: ScoreSheet,
  dice: DieValue[],
): Partial<Record<Category, number>> => {
  const preview: Partial<Record<Category, number>> = {};
  const joker = isJoker(sheet, dice);
  for (const category of legalCategories(sheet, dice)) {
    preview[category] = scoreFor(category, dice, joker);
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

export const rollhouseBonus = (sheet: ScoreSheet): number =>
  sheet.extraRollhouses * EXTRA_ROLLHOUSE_BONUS;

export const grandTotal = (sheet: ScoreSheet): number =>
  upperTotal(sheet) + lowerTotal(sheet) + rollhouseBonus(sheet);

export const isSheetComplete = (sheet: ScoreSheet): boolean =>
  ALL_CATEGORIES.every((c) => sheet[c] !== null);
