import { BotBoard, boardFor, chooseCategory, chooseKeep, planKeep, planScore } from './ai';
import { playerTotal } from './modes';
import {
  ALL_CATEGORIES,
  createEmptyScoreSheet,
  earnsExtraRollhouse,
  grandTotal,
  isJoker,
  isSheetComplete,
  scoreFor,
} from './scoring';
import { BotLevel, DieValue, GameMode, ScoreSheet } from '../types';

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

  it('takes a real Rollhouse when the box is open', () => {
    expect(chooseCategory(d(4, 4, 4, 4, 4), createEmptyScoreSheet())).toBe('rollhouse');
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

  it('dumps a forced zero in a cheap box, not on Rollhouse', () => {
    // Nothing here scores anywhere except a small upper total.
    const sheet = onlyOpen('rollhouse', 'ones', 'largeStraight');
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
  it('keeps all five of a Rollhouse', () => {
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

describe('Joker', () => {
  it('obeys the forced upper box even when a lower box pays more', () => {
    const sheet = createEmptyScoreSheet();
    sheet.rollhouse = 50;
    expect(chooseCategory(d(1, 1, 1, 1, 1), sheet)).toBe('ones');
  });

  it('cashes a Joker in as a large straight once its upper box is gone', () => {
    const sheet = createEmptyScoreSheet();
    sheet.rollhouse = 50;
    sheet.ones = 3;
    expect(chooseCategory(d(1, 1, 1, 1, 1), sheet)).toBe('largeStraight');
  });

  it('keeps all five when another Rollhouse is worth the bonus', () => {
    const sheet = createEmptyScoreSheet();
    sheet.rollhouse = 50;
    expect(chooseKeep(d(2, 2, 2, 2, 2), sheet).keep).toHaveLength(5);
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

describe('levels', () => {
  const classic = (sheet: ScoreSheet): BotBoard => boardFor([sheet], 'classic');

  it('easy keeps its most common number, the higher on a tie', () => {
    const { keep } = planKeep(d(2, 2, 5, 5, 1), classic(createEmptyScoreSheet()), 2, 'easy');
    expect(keep).toEqual([2, 3]);
  });

  it('easy does not break up a hand that is already made', () => {
    const { keep } = planKeep(d(1, 2, 3, 4, 5), classic(createEmptyScoreSheet()), 2, 'easy');
    expect(keep).toHaveLength(5);
  });

  it('easy takes the most points on offer; hard weighs what the box is worth', () => {
    // 1-1-2-3-4 is 11 in Chance and 2 in Ones. Chance averages about 22 when
    // saved for a better hand, so spending it here costs more than it gains.
    const dice = d(1, 1, 2, 3, 4);
    const sheet = onlyOpen('ones', 'chance');
    expect(planScore(dice, classic(sheet), 'easy').category).toBe('chance');
    expect(planScore(dice, classic(sheet), 'hard').category).toBe('ones');
  });

  it('every level stays within the rules of a Joker', () => {
    const sheet = createEmptyScoreSheet();
    sheet.rollhouse = 50;
    for (const level of ['easy', 'normal', 'hard'] as BotLevel[]) {
      expect(planScore(d(3, 3, 3, 3, 3), classic(sheet), level).category).toBe('threes');
    }
  });

  it('hard expects more of a hand with two rerolls in hand than with one', () => {
    // A second reroll can only add options, never remove them.
    const board = classic(createEmptyScoreSheet());
    for (const dice of [d(1, 3, 3, 5, 6), d(2, 3, 4, 6, 6), d(1, 1, 2, 5, 6)]) {
      expect(planKeep(dice, board, 2, 'hard').expected).toBeGreaterThanOrEqual(
        planKeep(dice, board, 1, 'hard').expected - 1e-9,
      );
    }
  });
});

describe('game types', () => {
  it('never picks a lower box in a Quick game', () => {
    const board = boardFor([createEmptyScoreSheet()], 'quick');
    // A large straight, with nowhere to score it as one.
    expect(planScore(d(2, 3, 4, 5, 6), board).category).toMatch(
      /^(ones|twos|threes|fours|fives|sixes)$/,
    );
  });

  it('puts a strong hand in the Marathon column worth most', () => {
    const board = boardFor([0, 1, 2].map(createEmptyScoreSheet), 'marathon');
    expect(planScore(d(6, 6, 6, 6, 6), board)).toEqual({ category: 'rollhouse', column: 2 });
  });

  it('dumps a forced zero in the Marathon column worth least', () => {
    const full = () => onlyOpen('largeStraight');
    const board = boardFor([full(), full(), full()], 'marathon');
    expect(planScore(d(1, 1, 2, 2, 6), board)).toEqual({ category: 'largeStraight', column: 0 });
  });
});

/**
 * Whole games under the real rules, on a seeded die, so the result is the same
 * on every run: the bots themselves have no randomness in them.
 */
describe('strength by level', () => {
  const seeded = (seed: number) => {
    let a = seed >>> 0;
    return (): DieValue => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((((t ^ (t >>> 14)) >>> 0) % 6) + 1) as DieValue;
    };
  };

  const playGame = (level: BotLevel, mode: GameMode, roll: () => DieValue): number => {
    const columns = boardFor([createEmptyScoreSheet()], mode).multipliers.map(
      createEmptyScoreSheet,
    );
    const board = boardFor(columns, mode);
    const turns = board.categories.length * board.multipliers.length;

    for (let turn = 0; turn < turns; turn += 1) {
      let dice = Array.from({ length: 5 }, roll);
      for (let rollsLeft = 2; rollsLeft > 0; rollsLeft -= 1) {
        const { keep } = planKeep(dice, board, rollsLeft, level);
        if (keep.length === 5) break;
        const kept = keep.map((i) => dice[i]);
        dice = [...kept, ...Array.from({ length: 5 - kept.length }, roll)];
      }
      const { category, column } = planScore(dice, board, level);
      const sheet = columns[column];
      const points = scoreFor(category, dice, isJoker(sheet, dice));
      if (earnsExtraRollhouse(sheet, dice)) sheet.extraRollhouses += 1;
      sheet[category] = points;
    }
    return playerTotal(columns, mode);
  };

  const mean = (level: BotLevel, mode: GameMode, games: number): number => {
    const roll = seeded(20261007);
    let total = 0;
    for (let i = 0; i < games; i += 1) total += playGame(level, mode, roll);
    return total / games;
  };

  it('ranks easy below normal below hard', () => {
    const easy = mean('easy', 'classic', 150);
    const normal = mean('normal', 'classic', 150);
    const hard = mean('hard', 'classic', 150);

    // eslint-disable-next-line no-console
    console.log(
      `Classic means over 150 games | easy ${easy.toFixed(1)} | normal ${normal.toFixed(1)} | hard ${hard.toFixed(1)}`,
    );

    // Seeded, so these are fixed numbers rather than samples; the margins
    // asserted are well inside the gaps actually measured.
    expect(normal - easy).toBeGreaterThan(15);
    expect(hard - normal).toBeGreaterThan(5);
  }, 120000);

  it('plays Quick and Marathon to a sensible score', () => {
    const quick = mean('normal', 'quick', 60);
    const marathon = mean('normal', 'marathon', 20);

    // eslint-disable-next-line no-console
    console.log(`Quick mean ${quick.toFixed(1)} | Marathon mean ${marathon.toFixed(1)}`);

    // Par for the upper section is 63; six times a classic game is the ceiling
    // a Marathon total is measured against.
    expect(quick).toBeGreaterThan(45);
    expect(marathon).toBeGreaterThan(900);
  }, 120000);
});
