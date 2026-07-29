import { chooseCategory, chooseKeep, isYahtzee } from './ai';
import {
  ALL_CATEGORIES,
  createEmptyScoreSheet,
  grandTotal,
  isSheetComplete,
  scoreFor,
} from './scoring';
import { DieValue, ScoreSheet } from '../types';

const d = (...values: number[]) => values as DieValue[];


/** Every box filled except the listed ones. */
const onlyOpen = (...open: string[]): ScoreSheet => {
  const sheet = createEmptyScoreSheet();
  ALL_CATEGORIES.forEach((c) => {
    if (!open.includes(c)) sheet[c] = 0;
  });
  return sheet;
};

describe('chooseCategory', () => {
  it('never returns a filled box', () => {
    const sheet = onlyOpen('ones', 'chance');
    const pick = chooseCategory(d(3, 3, 3, 3, 3), sheet);
    expect(['ones', 'chance']).toContain(pick);
  });

  it('throws rather than guess on a full sheet', () => {
    const full = createEmptyScoreSheet();
    ALL_CATEGORIES.forEach((c) => {
      full[c] = 0;
    });
    expect(() => chooseCategory(d(1, 2, 3, 4, 5), full)).toThrow(/full sheet/);
  });

  it('takes a real Yahtzee when the box is open', () => {
    expect(chooseCategory(d(4, 4, 4, 4, 4), createEmptyScoreSheet())).toBe('yahtzee');
  });

  it('takes a large straight over the equivalent chance points', () => {
    expect(chooseCategory(d(1, 2, 3, 4, 5), createEmptyScoreSheet())).toBe(
      'largeStraight',
    );
  });

  it('takes the full house rather than scattering the pips', () => {
    const sheet = onlyOpen('fullHouse', 'ones', 'twos');
    expect(chooseCategory(d(5, 5, 5, 2, 2), sheet)).toBe('fullHouse');
  });

  it('dumps a forced zero in a cheap box, not on Yahtzee', () => {
    // Nothing here scores anywhere except a small upper total.
    const sheet = onlyOpen('yahtzee', 'ones', 'largeStraight');
    const pick = chooseCategory(d(2, 3, 3, 4, 6), sheet);
    expect(pick).toBe('ones');
  });

  it('prefers sixes over ones for the same dice count, chasing the bonus', () => {
    const sheet = onlyOpen('ones', 'sixes');
    // Three sixes (18) is worth far more than two ones (2).
    expect(chooseCategory(d(6, 6, 6, 1, 1), sheet)).toBe('sixes');
  });

  it('always returns something scoreable for any legal hand', () => {
    for (let i = 0; i < 300; i += 1) {
      const dice = Array.from(
        { length: 5 },
        () => (Math.floor(Math.random() * 6) + 1) as DieValue,
      );
      const sheet = createEmptyScoreSheet();
      // Fill a random subset, leaving at least one open.
      ALL_CATEGORIES.slice(0, Math.floor(Math.random() * 12)).forEach((c) => {
        sheet[c] = 0;
      });
      const pick = chooseCategory(dice, sheet);
      expect(sheet[pick]).toBeNull();
    }
  });
});

describe('chooseKeep', () => {
  it('keeps all five of a Yahtzee', () => {
    const { keep } = chooseKeep(d(5, 5, 5, 5, 5), createEmptyScoreSheet());
    expect(keep).toHaveLength(5);
  });

  it('keeps a completed large straight intact', () => {
    const sheet = onlyOpen('largeStraight');
    const { keep } = chooseKeep(d(1, 2, 3, 4, 5), sheet);
    expect(keep.sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps the four to a straight and rerolls the odd die', () => {
    const sheet = onlyOpen('largeStraight', 'smallStraight');
    const { keep } = chooseKeep(d(2, 3, 4, 5, 5), sheet);
    // Indices 0-3 are the run; the duplicate 5 at index 4 should go.
    expect(keep).toContain(0);
    expect(keep).toContain(1);
    expect(keep).toContain(2);
    expect(keep).toContain(3);
    expect(keep).not.toContain(4);
  });

  it('keeps the trips when chasing four of a kind', () => {
    const sheet = onlyOpen('fourOfAKind');
    const { keep } = chooseKeep(d(6, 6, 6, 2, 1), sheet);
    expect(keep.sort()).toEqual([0, 1, 2]);
  });

  it('keeps only the matching face when chasing an upper box', () => {
    const sheet = onlyOpen('sixes');
    const { keep } = chooseKeep(d(6, 6, 1, 2, 3), sheet);
    expect(keep.sort()).toEqual([0, 1]);
  });

  it('returns indices that are always in range and unique', () => {
    for (let i = 0; i < 100; i += 1) {
      const dice = Array.from(
        { length: 5 },
        () => (Math.floor(Math.random() * 6) + 1) as DieValue,
      );
      const { keep } = chooseKeep(dice, createEmptyScoreSheet());
      expect(new Set(keep).size).toBe(keep.length);
      keep.forEach((i2) => {
        expect(i2).toBeGreaterThanOrEqual(0);
        expect(i2).toBeLessThan(5);
      });
    }
  });
});

describe('isYahtzee', () => {
  it('detects five alike only', () => {
    expect(isYahtzee(d(3, 3, 3, 3, 3))).toBe(true);
    expect(isYahtzee(d(3, 3, 3, 3, 2))).toBe(false);
  });
});

/**
 * End-to-end strength check. A greedy bot averages roughly 160; a competent
 * heuristic bot should clear 200. This asserts a floor well under the observed
 * mean so it fails on a real regression, not on variance.
 */
describe('self-play strength', () => {
  const roll = (): DieValue => (Math.floor(Math.random() * 6) + 1) as DieValue;

  const playGame = (): number => {
    const sheet = createEmptyScoreSheet();
    for (let turn = 0; turn < 13; turn += 1) {
      let dice = Array.from({ length: 5 }, roll);
      for (let rollsLeft = 2; rollsLeft > 0; rollsLeft -= 1) {
        const { keep } = chooseKeep(dice, sheet);
        if (keep.length === 5) break;
        const kept = keep.map((i) => dice[i]);
        dice = [...kept, ...Array.from({ length: 5 - kept.length }, roll)];
      }
      const category = chooseCategory(dice, sheet);
      sheet[category] = scoreFor(category, dice);
    }
    return grandTotal(sheet);
  };

  it('completes every sheet it plays', () => {
    const sheet = createEmptyScoreSheet();
    for (let turn = 0; turn < 13; turn += 1) {
      const dice = Array.from({ length: 5 }, roll);
      const category = chooseCategory(dice, sheet);
      sheet[category] = scoreFor(category, dice);
    }
    expect(isSheetComplete(sheet)).toBe(true);
  });

  it('averages a competitive score over 60 games', () => {
    const scores = Array.from({ length: 60 }, playGame);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Logged so a regression shows the actual number, not just a failure.
    // eslint-disable-next-line no-console
    console.log(
      `AI mean ${mean.toFixed(1)} | min ${Math.min(...scores)} | max ${Math.max(...scores)}`,
    );

    expect(mean).toBeGreaterThan(180);
    expect(Math.min(...scores)).toBeGreaterThan(60);
  }, 60000);
});
