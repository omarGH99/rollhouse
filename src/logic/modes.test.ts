import { GAME_MODES, MODES, isGameMode, playerTotal, roundsFor, totalsFor } from './modes';
import { createEmptyScoreSheet } from './scoring';

describe('game types', () => {
  it('lists them shortest first', () => {
    expect(GAME_MODES).toEqual(['quick', 'classic', 'marathon']);
    expect(GAME_MODES.map(roundsFor)).toEqual([6, 13, 39]);
  });

  it('gives Quick the upper section only', () => {
    expect(MODES.quick.categories).toEqual([
      'ones',
      'twos',
      'threes',
      'fours',
      'fives',
      'sixes',
    ]);
  });

  it('gives Marathon three columns worth one, two and three', () => {
    expect(MODES.marathon.multipliers).toEqual([1, 2, 3]);
    expect(MODES.classic.multipliers).toEqual([1]);
  });

  it('recognises only real game types', () => {
    expect(isGameMode('classic')).toBe(true);
    expect(isGameMode('endless')).toBe(false);
    // Not fooled by names every object has.
    expect(isGameMode('toString')).toBe(false);
    expect(isGameMode(undefined)).toBe(false);
  });
});

describe('totals', () => {
  const sheet = (chance: number) => ({ ...createEmptyScoreSheet(), chance });

  it('is just the sheet total with one column', () => {
    expect(playerTotal([sheet(21)], 'classic')).toBe(21);
  });

  it('counts each Marathon column at its worth', () => {
    expect(playerTotal([sheet(10), sheet(10), sheet(10)], 'marathon')).toBe(60);
  });

  it('multiplies bonuses along with the column they were earned in', () => {
    const third = { ...createEmptyScoreSheet(), rollhouse: 50, extraRollhouses: 1 };
    expect(playerTotal([sheet(0), sheet(0), third], 'marathon')).toBe(450);
  });

  it('reports every seat in order', () => {
    expect(totalsFor({ mode: 'classic', scores: [[sheet(5)], [sheet(9)]] })).toEqual([5, 9]);
  });
});
