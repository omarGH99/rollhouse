import {
  HIGH_SCORE_LIMIT,
  ScoreEntry,
  deserializeHighScores,
  emptyHighScores,
  entriesFor,
  insertScores,
  serializeHighScores,
} from './highScores';
import { createInitialState } from './gameReducer';
import { GameState } from '../types';

const entry = (score: number, name = 'Omar', extra: Partial<ScoreEntry> = {}): ScoreEntry => ({
  name,
  score,
  date: 1000,
  opponents: 1,
  hinted: false,
  ...extra,
});

describe('entries from a finished game', () => {
  const game = (): GameState => {
    const state = createInitialState(
      [
        { name: 'Omar', kind: 'human' },
        { name: 'Bot 2', kind: 'ai' },
        { name: 'Sara', kind: 'human' },
      ],
      'classic',
    );
    state.scores[0][0].chance = 21;
    state.scores[1][0].chance = 30;
    state.scores[2][0].chance = 17;
    return state;
  };

  it('puts forward the people at the table, not the bots', () => {
    const entries = entriesFor(game(), [], 5000);
    expect(entries.map((e) => [e.name, e.score])).toEqual([
      ['Omar', 21],
      ['Sara', 17],
    ]);
    expect(entries.every((e) => e.date === 5000 && e.opponents === 2)).toBe(true);
  });

  it('marks only the seats that used a hint', () => {
    const entries = entriesFor(game(), [2], 5000);
    expect(entries.map((e) => e.hinted)).toEqual([false, true]);
  });

  it('records a solo game with no opponents', () => {
    const solo = createInitialState([{ name: 'Omar', kind: 'human' }], 'quick');
    expect(entriesFor(solo, [], 1)[0].opponents).toBe(0);
  });

  it('counts a Marathon score with its column multipliers', () => {
    const state = createInitialState([{ name: 'Omar', kind: 'human' }], 'marathon');
    state.scores[0][2].chance = 20;
    expect(entriesFor(state, [], 1)[0].score).toBe(60);
  });
});

describe('inserting', () => {
  it('keeps the table best first', () => {
    let scores = emptyHighScores();
    for (const score of [200, 260, 180, 240]) {
      scores = insertScores(scores, 'classic', [entry(score)]).scores;
    }
    expect(scores.classic.map((e) => e.score)).toEqual([260, 240, 200, 180]);
  });

  it('reports where each entry landed', () => {
    const start = insertScores(emptyHighScores(), 'classic', [entry(200), entry(100)]).scores;
    const { ranks } = insertScores(start, 'classic', [entry(250), entry(150)]);
    expect(ranks).toEqual([0, 2]);
  });

  it('puts a new score below an equal one already there', () => {
    const start = insertScores(emptyHighScores(), 'classic', [entry(200, 'First')]).scores;
    const { scores, ranks } = insertScores(start, 'classic', [entry(200, 'Second')]);
    expect(scores.classic.map((e) => e.name)).toEqual(['First', 'Second']);
    expect(ranks).toEqual([1]);
  });

  it(`keeps only the best ${HIGH_SCORE_LIMIT}, and says when a score missed`, () => {
    const full = Array.from({ length: HIGH_SCORE_LIMIT }, (_, i) => entry(300 - i));
    const start = insertScores(emptyHighScores(), 'classic', full).scores;
    const { scores, ranks } = insertScores(start, 'classic', [entry(50), entry(400)]);
    expect(scores.classic).toHaveLength(HIGH_SCORE_LIMIT);
    expect(scores.classic[0].score).toBe(400);
    expect(ranks).toEqual([-1, 0]);
  });

  it('keeps each game type in its own table', () => {
    const { scores } = insertScores(emptyHighScores(), 'quick', [entry(70)]);
    expect(scores.quick).toHaveLength(1);
    expect(scores.classic).toHaveLength(0);
    expect(scores.marathon).toHaveLength(0);
  });

  it('does not alter the table it was given', () => {
    const start = emptyHighScores();
    insertScores(start, 'classic', [entry(200)]);
    expect(start.classic).toHaveLength(0);
  });
});

describe('persistence', () => {
  it('round-trips', () => {
    const { scores } = insertScores(emptyHighScores(), 'marathon', [
      entry(1500, 'Omar', { hinted: true, opponents: 0 }),
    ]);
    expect(deserializeHighScores(serializeHighScores(scores))).toEqual(scores);
  });

  it('degrades to empty rather than throwing', () => {
    expect(deserializeHighScores(null)).toEqual(emptyHighScores());
    expect(deserializeHighScores('{ broken')).toEqual(emptyHighScores());
    expect(deserializeHighScores('null')).toEqual(emptyHighScores());
    expect(deserializeHighScores(JSON.stringify({ version: 99, scores: {} }))).toEqual(
      emptyHighScores(),
    );
  });

  it('drops a bad entry without losing the good ones', () => {
    const raw = JSON.stringify({
      version: 1,
      scores: { classic: [entry(200), { name: 'Bad', score: 'lots' }, entry(150)] },
    });
    expect(deserializeHighScores(raw).classic.map((e) => e.score)).toEqual([200, 150]);
  });

  it('re-sorts and trims a table that was saved out of shape', () => {
    const many = Array.from({ length: 14 }, (_, i) => entry(i * 10));
    const raw = JSON.stringify({ version: 1, scores: { classic: many } });
    const table = deserializeHighScores(raw).classic;
    expect(table).toHaveLength(HIGH_SCORE_LIMIT);
    expect(table[0].score).toBe(130);
    expect(table[HIGH_SCORE_LIMIT - 1].score).toBe(40);
  });
});
