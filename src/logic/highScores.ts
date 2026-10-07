import { GameMode, GameState } from '../types';
import { GAME_MODES, totalsFor } from './modes';

export const HIGH_SCORES_VERSION = 1;

/** How many scores each game type's table keeps. */
export const HIGH_SCORE_LIMIT = 10;

export interface ScoreEntry {
  name: string;
  score: number;
  /** When the game finished, in ms since the epoch. */
  date: number;
  /** How many other seats were at the table; 0 for a solo game. */
  opponents: number;
  /** The player asked for a hint at some point in the game. */
  hinted: boolean;
}

/** One table per game type, best first. */
export type HighScores = Record<GameMode, ScoreEntry[]>;

export const emptyHighScores = (): HighScores => ({ quick: [], classic: [], marathon: [] });

/**
 * The entries a finished game puts forward: one per human seat. Bots do not
 * get on the board. `hinted` lists the seats that used a hint.
 */
export const entriesFor = (
  state: GameState,
  hinted: readonly number[],
  now: number,
): ScoreEntry[] => {
  const totals = totalsFor(state);
  return state.players.flatMap((player, seat) =>
    player.kind === 'human'
      ? [
          {
            name: player.name,
            score: totals[seat],
            date: now,
            opponents: state.players.length - 1,
            hinted: hinted.includes(seat),
          },
        ]
      : [],
  );
};

export interface InsertResult {
  scores: HighScores;
  /**
   * Where each entry landed, parallel to the entries given: its position in
   * the table from 0, or -1 if it did not make the cut.
   */
  ranks: number[];
}

/**
 * Add entries to a game type's table. Pure — the caller persists the result.
 * A new score goes *below* an equal one already there: the first to reach a
 * score keeps the place.
 */
export const insertScores = (
  scores: HighScores,
  mode: GameMode,
  entries: ScoreEntry[],
): InsertResult => {
  const table = [...scores[mode]];
  for (const entry of entries) {
    const at = table.findIndex((existing) => existing.score < entry.score);
    table.splice(at < 0 ? table.length : at, 0, entry);
  }
  const kept = table.slice(0, HIGH_SCORE_LIMIT);
  return {
    scores: { ...scores, [mode]: kept },
    ranks: entries.map((entry) => kept.indexOf(entry)),
  };
};

export const serializeHighScores = (scores: HighScores): string =>
  JSON.stringify({ version: HIGH_SCORES_VERSION, scores });

const isEntry = (v: unknown): v is ScoreEntry => {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.name === 'string' &&
    typeof e.score === 'number' &&
    Number.isFinite(e.score) &&
    typeof e.date === 'number' &&
    Number.isFinite(e.date) &&
    typeof e.opponents === 'number' &&
    typeof e.hinted === 'boolean'
  );
};

/**
 * Missing or malformed tables degrade to empty rather than throwing. A single
 * bad entry is dropped on its own, and each table is re-sorted and trimmed, so
 * a hand-edited file cannot leave the list out of order or over-long.
 */
export const deserializeHighScores = (raw: string | null): HighScores => {
  const scores = emptyHighScores();
  if (!raw) return scores;
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; scores?: unknown } | null;
    if (typeof parsed !== 'object' || parsed === null) return scores;
    if (parsed.version !== HIGH_SCORES_VERSION) return scores;
    const saved = parsed.scores as Record<string, unknown> | null;
    if (typeof saved !== 'object' || saved === null) return scores;

    for (const mode of GAME_MODES) {
      const table = saved[mode];
      if (!Array.isArray(table)) continue;
      scores[mode] = table
        .filter(isEntry)
        .map(({ name, score, date, opponents, hinted }) => ({
          name,
          score,
          date,
          opponents,
          hinted,
        }))
        // Stable, so equal scores keep the order they were saved in.
        .sort((a, b) => b.score - a.score)
        .slice(0, HIGH_SCORE_LIMIT);
    }
  } catch {
    // Unreadable: start with empty tables.
  }
  return scores;
};
