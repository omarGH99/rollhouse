import {
  ACHIEVEMENTS,
  Stats,
  averageScore,
  deserializeStats,
  emptyStats,
  recordGame,
  serializeStats,
  winningSeats,
} from './stats';
import { ALL_CATEGORIES, UPPER_CATEGORIES, createEmptyScoreSheet } from './scoring';
import { GameState, Player, ScoreSheet } from '../types';

/** A completed sheet whose grand total is exactly `target` (via chance/rollhouse). */
const sheetScoring = (overrides: Partial<ScoreSheet> = {}): ScoreSheet => {
  const sheet = createEmptyScoreSheet();
  ALL_CATEGORIES.forEach((c) => {
    sheet[c] = 0;
  });
  return { ...sheet, ...overrides };
};

const finishedGame = (
  players: Player[],
  sheets: ScoreSheet[],
): GameState => ({
  players,
  dice: [],
  rollsLeft: 0,
  hasRolled: true,
  currentPlayer: 0,
  round: 13,
  scores: sheets,
  phase: 'gameover',
  incomingPlayer: 0,
  rollNonce: 0,
  lastScored: null,
});

const human: Player = { name: 'You', kind: 'human' };
const bot: Player = { name: 'Bot', kind: 'ai' };

describe('winningSeats', () => {
  it('returns the single top seat', () => {
    const seats = winningSeats([
      sheetScoring({ chance: 10 }),
      sheetScoring({ chance: 30 }),
    ]);
    expect(seats).toEqual([1]);
  });

  it('returns every seat on a tie', () => {
    const seats = winningSeats([
      sheetScoring({ chance: 20 }),
      sheetScoring({ chance: 20 }),
    ]);
    expect(seats).toEqual([0, 1]);
  });
});

describe('recordGame', () => {
  it('counts a human win', () => {
    const game = finishedGame(
      [human, bot],
      [sheetScoring({ chance: 30 }), sheetScoring({ chance: 10 })],
    );
    const { stats } = recordGame(emptyStats(), game);
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.humanWins).toBe(1);
    expect(stats.aiWins).toBe(0);
    expect(stats.bestScore).toBe(30);
  });

  it('counts an AI win', () => {
    const game = finishedGame(
      [human, bot],
      [sheetScoring({ chance: 10 }), sheetScoring({ chance: 30 })],
    );
    const { stats } = recordGame(emptyStats(), game);
    expect(stats.humanWins).toBe(0);
    expect(stats.aiWins).toBe(1);
  });

  it('credits both sides on a tie', () => {
    const game = finishedGame(
      [human, bot],
      [sheetScoring({ chance: 20 }), sheetScoring({ chance: 20 })],
    );
    const { stats } = recordGame(emptyStats(), game);
    expect(stats.humanWins).toBe(1);
    expect(stats.aiWins).toBe(1);
  });

  it('tracks the best human score across games, not the latest', () => {
    let stats = emptyStats();
    stats = recordGame(
      stats,
      finishedGame([human, human], [sheetScoring({ chance: 40 }), sheetScoring()]),
    ).stats;
    stats = recordGame(
      stats,
      finishedGame([human, human], [sheetScoring({ chance: 12 }), sheetScoring()]),
    ).stats;
    expect(stats.bestScore).toBe(40);
    expect(stats.gamesPlayed).toBe(2);
  });

  it('averages only over games with a human seat', () => {
    let stats = emptyStats();
    stats = recordGame(
      stats,
      finishedGame([human, bot], [sheetScoring({ chance: 30 }), sheetScoring()]),
    ).stats;
    stats = recordGame(
      stats,
      finishedGame([human, bot], [sheetScoring({ chance: 10 }), sheetScoring()]),
    ).stats;
    expect(averageScore(stats)).toBe(20);
  });

  it('ignores AI-only games in the personal score history', () => {
    const game = finishedGame(
      [bot, bot],
      [sheetScoring({ chance: 30 }), sheetScoring({ chance: 20 })],
    );
    const { stats } = recordGame(emptyStats(), game);
    expect(stats.scoredGames).toBe(0);
    expect(stats.bestScore).toBe(0);
    expect(averageScore(stats)).toBe(0);
    expect(stats.aiWins).toBe(1);
  });

  it('counts human Rollhouses only', () => {
    const game = finishedGame(
      [human, bot],
      [sheetScoring({ rollhouse: 50 }), sheetScoring({ rollhouse: 50 })],
    );
    const { stats } = recordGame(emptyStats(), game);
    expect(stats.rollhouses).toBe(1);
  });

  it('counts extra Rollhouses too', () => {
    const game = finishedGame(
      [human, bot],
      [sheetScoring({ rollhouse: 50, extraRollhouses: 2 }), sheetScoring()],
    );
    expect(recordGame(emptyStats(), game).stats.rollhouses).toBe(3);
  });

  it('counts the upper bonus when it is earned', () => {
    const bonusSheet = sheetScoring();
    UPPER_CATEGORIES.forEach((c, i) => {
      bonusSheet[c] = (i + 1) * 3;
    });
    const { stats } = recordGame(
      emptyStats(),
      finishedGame([human, bot], [bonusSheet, sheetScoring()]),
    );
    expect(stats.upperBonuses).toBe(1);
  });
});

describe('achievements', () => {
  it('unlocks first game and first win together on a debut victory', () => {
    const { newlyUnlocked } = recordGame(
      emptyStats(),
      finishedGame([human, human], [sheetScoring({ chance: 20 }), sheetScoring()]),
    );
    const ids = newlyUnlocked.map((a) => a.id);
    expect(ids).toContain('first-game');
    expect(ids).toContain('first-win');
  });

  it('does not re-award an achievement already held', () => {
    const game = finishedGame(
      [human, human],
      [sheetScoring({ chance: 20 }), sheetScoring()],
    );
    const first = recordGame(emptyStats(), game);
    const second = recordGame(first.stats, game);
    expect(second.newlyUnlocked.map((a) => a.id)).not.toContain('first-game');
  });

  it('unlocks beating an AI only when an AI seat was present', () => {
    const vsHuman = recordGame(
      emptyStats(),
      finishedGame([human, human], [sheetScoring({ chance: 20 }), sheetScoring()]),
    );
    expect(vsHuman.stats.unlocked).not.toContain('beat-ai');

    const vsBot = recordGame(
      emptyStats(),
      finishedGame([human, bot], [sheetScoring({ chance: 20 }), sheetScoring()]),
    );
    expect(vsBot.stats.unlocked).toContain('beat-ai');
  });

  it('unlocks the score milestones at their thresholds', () => {
    const play = (score: number) =>
      recordGame(
        emptyStats(),
        finishedGame([human, human], [sheetScoring({ chance: score }), sheetScoring()]),
      );
    expect(play(249).stats.unlocked).not.toContain('score-250');
    expect(play(250).stats.unlocked).toContain('score-250');
    expect(play(300).stats.unlocked).toContain('score-300');
  });

  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('serialization', () => {
  it('round trips', () => {
    const { stats } = recordGame(
      emptyStats(),
      finishedGame([human, bot], [sheetScoring({ chance: 30 }), sheetScoring()]),
    );
    expect(deserializeStats(serializeStats(stats))).toEqual(stats);
  });

  it('degrades to empty rather than throwing', () => {
    expect(deserializeStats(null)).toEqual(emptyStats());
    expect(deserializeStats('{ broken')).toEqual(emptyStats());
  });

  it('discards stats written by a newer build', () => {
    const stale = JSON.stringify({ ...emptyStats(), version: 99, gamesPlayed: 5 });
    expect(deserializeStats(stale).gamesPlayed).toBe(0);
  });

  it('repairs a missing unlocked array', () => {
    const partial = JSON.stringify({ version: 2, gamesPlayed: 3 } as Partial<Stats>);
    const stats = deserializeStats(partial);
    expect(stats.unlocked).toEqual([]);
    expect(stats.gamesPlayed).toBe(3);
  });

  it('drops malformed counters without losing the good ones', () => {
    const raw = JSON.stringify({ version: 2, gamesPlayed: 4, bestScore: 'lots', humanWins: -2 });
    const stats = deserializeStats(raw);
    expect(stats.gamesPlayed).toBe(4);
    expect(stats.bestScore).toBe(0);
    expect(stats.humanWins).toBe(0);
  });

  it('carries a v1 record forward under the new names', () => {
    const legacy = 'yahtzee';
    const raw = JSON.stringify({
      version: 1,
      gamesPlayed: 9,
      bestScore: 281,
      [`${legacy}s`]: 4,
      unlocked: ['first-game', legacy],
    });
    const stats = deserializeStats(raw);
    expect(stats.version).toBe(2);
    expect(stats.gamesPlayed).toBe(9);
    expect(stats.bestScore).toBe(281);
    expect(stats.rollhouses).toBe(4);
    expect(stats.unlocked).toEqual(['first-game', 'rollhouse']);
  });

  it('rejects a payload that is not a stats object', () => {
    expect(deserializeStats('null')).toEqual(emptyStats());
    expect(deserializeStats('{"gamesPlayed":2}')).toEqual(emptyStats());
  });
});
