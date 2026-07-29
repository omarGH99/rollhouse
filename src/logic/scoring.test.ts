import {
  ALL_CATEGORIES,
  LOWER_CATEGORIES,
  TOTAL_ROUNDS,
  UPPER_BONUS_POINTS,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
  createEmptyScoreSheet,
  grandTotal,
  isSheetComplete,
  lowerTotal,
  previewScores,
  scoreFor,
  tallyFaces,
  upperBonus,
  upperSubtotal,
  upperTotal,
} from './scoring';
import { Category, DieValue, ScoreSheet } from '../types';

/** Terser than casting a literal array at every call site. */
const d = (...values: number[]) => values as DieValue[];

/** A sheet with the given upper values filled and everything else open. */
const upperSheet = (values: number[]): ScoreSheet => {
  const sheet = createEmptyScoreSheet();
  UPPER_CATEGORIES.forEach((category, i) => {
    sheet[category] = values[i];
  });
  return sheet;
};

describe('structure', () => {
  it('has 13 categories, matching the round count', () => {
    expect(ALL_CATEGORIES).toHaveLength(13);
    expect(TOTAL_ROUNDS).toBe(13);
    expect(UPPER_CATEGORIES).toHaveLength(6);
    expect(LOWER_CATEGORIES).toHaveLength(7);
  });

  it('starts every category open rather than zeroed', () => {
    const sheet = createEmptyScoreSheet();
    // `null` (open) and `0` (scored a zero) are different states.
    expect(ALL_CATEGORIES.every((c) => sheet[c] === null)).toBe(true);
    expect(isSheetComplete(sheet)).toBe(false);
  });

  it('returns an independent sheet each call', () => {
    const a = createEmptyScoreSheet();
    const b = createEmptyScoreSheet();
    a.ones = 3;
    expect(b.ones).toBeNull();
  });
});

describe('tallyFaces', () => {
  it('counts each face, leaving index 0 unused', () => {
    expect(tallyFaces(d(1, 1, 3, 6, 6))).toEqual([0, 2, 0, 1, 0, 0, 2]);
  });
});

describe('upper section', () => {
  it.each([
    ['ones', d(1, 1, 3, 1, 5), 3],
    ['twos', d(2, 2, 2, 4, 5), 6],
    ['threes', d(1, 2, 4, 5, 6), 0],
    ['fours', d(4, 4, 4, 4, 4), 20],
    ['fives', d(5, 1, 5, 2, 3), 10],
    ['sixes', d(6, 6, 6, 6, 6), 30],
  ] as [Category, DieValue[], number][])(
    '%s scores only its own face',
    (category, dice, expected) => {
      expect(scoreFor(category, dice)).toBe(expected);
    },
  );
});

describe('n of a kind', () => {
  it('scores the sum of all five dice when the requirement is met', () => {
    expect(scoreFor('threeOfAKind', d(4, 4, 4, 2, 1))).toBe(15);
    expect(scoreFor('fourOfAKind', d(4, 4, 4, 4, 1))).toBe(17);
  });

  it('scores zero when it is not', () => {
    expect(scoreFor('threeOfAKind', d(4, 4, 3, 2, 1))).toBe(0);
    expect(scoreFor('fourOfAKind', d(4, 4, 4, 2, 1))).toBe(0);
  });

  it('treats five of a kind as satisfying both', () => {
    expect(scoreFor('threeOfAKind', d(2, 2, 2, 2, 2))).toBe(10);
    expect(scoreFor('fourOfAKind', d(2, 2, 2, 2, 2))).toBe(10);
  });
});

describe('full house', () => {
  it('scores 25 for three-plus-two', () => {
    expect(scoreFor('fullHouse', d(3, 3, 5, 5, 5))).toBe(25);
  });

  it('accepts five of a kind', () => {
    expect(scoreFor('fullHouse', d(2, 2, 2, 2, 2))).toBe(25);
  });

  it('rejects four-plus-one and two-pair', () => {
    expect(scoreFor('fullHouse', d(2, 2, 2, 2, 3))).toBe(0);
    expect(scoreFor('fullHouse', d(2, 2, 3, 3, 4))).toBe(0);
  });
});

describe('straights', () => {
  it.each([
    [d(1, 2, 3, 4, 4), 30],
    [d(2, 3, 4, 5, 5), 30],
    [d(6, 5, 4, 3, 3), 30],
    // A run of five contains a run of four.
    [d(2, 3, 4, 5, 6), 30],
  ])('small straight scores 30 for %j', (dice, expected) => {
    expect(scoreFor('smallStraight', dice)).toBe(expected);
  });

  it.each([
    [d(1, 2, 3, 5, 6)],
    [d(1, 1, 2, 3, 6)],
    [d(2, 2, 3, 3, 4)],
  ])('small straight scores 0 for %j', (dice) => {
    expect(scoreFor('smallStraight', dice)).toBe(0);
  });

  it('large straight scores 40 only for a full run of five', () => {
    expect(scoreFor('largeStraight', d(1, 2, 3, 4, 5))).toBe(40);
    expect(scoreFor('largeStraight', d(2, 3, 4, 5, 6))).toBe(40);
    expect(scoreFor('largeStraight', d(1, 2, 3, 4, 6))).toBe(0);
    expect(scoreFor('largeStraight', d(1, 2, 3, 4, 4))).toBe(0);
  });

  it('is order independent', () => {
    expect(scoreFor('largeStraight', d(5, 3, 1, 4, 2))).toBe(40);
  });
});

describe('yahtzee and chance', () => {
  it('scores 50 for five alike, 0 otherwise', () => {
    expect(scoreFor('yahtzee', d(5, 5, 5, 5, 5))).toBe(50);
    expect(scoreFor('yahtzee', d(5, 5, 5, 5, 4))).toBe(0);
  });

  it('chance always takes the total', () => {
    expect(scoreFor('chance', d(1, 2, 3, 4, 5))).toBe(15);
    expect(scoreFor('chance', d(6, 6, 6, 6, 6))).toBe(30);
  });
});

describe('upper bonus', () => {
  it(`awards ${UPPER_BONUS_POINTS} at exactly ${UPPER_BONUS_THRESHOLD}`, () => {
    expect(upperSubtotal(upperSheet([3, 6, 9, 12, 15, 18]))).toBe(63);
    expect(upperBonus(upperSheet([3, 6, 9, 12, 15, 18]))).toBe(UPPER_BONUS_POINTS);
  });

  it('withholds it one point below the threshold', () => {
    expect(upperSubtotal(upperSheet([3, 6, 9, 12, 15, 17]))).toBe(62);
    expect(upperBonus(upperSheet([3, 6, 9, 12, 15, 17]))).toBe(0);
  });

  it('folds into the upper total', () => {
    expect(upperTotal(upperSheet([3, 6, 9, 12, 15, 18]))).toBe(63 + UPPER_BONUS_POINTS);
  });
});

describe('totals', () => {
  it('treats open categories as zero without crashing', () => {
    const sheet = createEmptyScoreSheet();
    expect(grandTotal(sheet)).toBe(0);
  });

  it('sums upper, bonus and lower', () => {
    const sheet = upperSheet([3, 6, 9, 12, 15, 18]);
    sheet.yahtzee = 50;
    sheet.chance = 20;
    expect(lowerTotal(sheet)).toBe(70);
    expect(grandTotal(sheet)).toBe(63 + UPPER_BONUS_POINTS + 70);
  });

  it('reports completeness only when every box is filled', () => {
    const sheet = createEmptyScoreSheet();
    ALL_CATEGORIES.forEach((c) => {
      sheet[c] = 0;
    });
    expect(isSheetComplete(sheet)).toBe(true);
  });
});

describe('previewScores', () => {
  it('offers every open category and no filled one', () => {
    const sheet = createEmptyScoreSheet();
    sheet.chance = 20;
    const preview = previewScores(sheet, d(1, 2, 3, 4, 5));
    expect(preview.chance).toBeUndefined();
    expect(Object.keys(preview)).toHaveLength(12);
    expect(preview.largeStraight).toBe(40);
  });

  it('includes zero-scoring options, which are legal moves', () => {
    const preview = previewScores(createEmptyScoreSheet(), d(1, 1, 1, 1, 1));
    // Scoring a zero is often the correct play, so it must be offered.
    expect(preview.sixes).toBe(0);
    expect(preview.largeStraight).toBe(0);
  });
});
