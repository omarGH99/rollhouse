import { GameState, ScoreSheet } from '../types';
import { grandTotal, upperBonus } from './scoring';

export const STATS_VERSION = 1;

export interface Stats {
  version: number;
  gamesPlayed: number;
  /** Games in which a human seat finished top (ties count). */
  humanWins: number;
  aiWins: number;
  bestScore: number;
  /** Sum of every human final score, for the running average. */
  totalScore: number;
  scoredGames: number;
  yahtzees: number;
  upperBonuses: number;
  /** Achievement ids already earned. */
  unlocked: string[];
}

export const emptyStats = (): Stats => ({
  version: STATS_VERSION,
  gamesPlayed: 0,
  humanWins: 0,
  aiWins: 0,
  bestScore: 0,
  totalScore: 0,
  scoredGames: 0,
  yahtzees: 0,
  upperBonuses: 0,
  unlocked: [],
});

export const averageScore = (stats: Stats): number =>
  stats.scoredGames === 0 ? 0 : Math.round(stats.totalScore / stats.scoredGames);

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Evaluated against the stats *after* a game is recorded. */
  earned: (stats: Stats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-game',
    title: 'Table Stakes',
    description: 'Finish your first game',
    icon: 'flag-outline',
    earned: (s) => s.gamesPlayed >= 1,
  },
  {
    id: 'first-win',
    title: 'Winner',
    description: 'Win a game',
    icon: 'trophy-outline',
    earned: (s) => s.humanWins >= 1,
  },
  {
    id: 'yahtzee',
    title: 'Five Alike',
    description: 'Score a Qomar',
    icon: 'flame-outline',
    earned: (s) => s.yahtzees >= 1,
  },
  {
    id: 'bonus',
    title: 'Upstairs Money',
    description: 'Earn the upper-section bonus',
    icon: 'ribbon-outline',
    earned: (s) => s.upperBonuses >= 1,
  },
  {
    id: 'score-250',
    title: 'High Roller',
    description: 'Finish a game with 250 or more',
    icon: 'trending-up-outline',
    earned: (s) => s.bestScore >= 250,
  },
  {
    id: 'score-300',
    title: 'Sharp',
    description: 'Finish a game with 300 or more',
    icon: 'diamond-outline',
    earned: (s) => s.bestScore >= 300,
  },
  {
    id: 'veteran',
    title: 'Regular',
    description: 'Play 10 games',
    icon: 'albums-outline',
    earned: (s) => s.gamesPlayed >= 10,
  },
  {
    id: 'beat-ai',
    title: 'Out-Rolled the House',
    description: 'Beat an AI opponent',
    icon: 'hardware-chip-outline',
    earned: (s) => s.unlocked.includes('beat-ai'),
  },
];

/** Winning seats — plural, since a tie has more than one. */
export const winningSeats = (scores: ScoreSheet[]): number[] => {
  const totals = scores.map(grandTotal);
  const best = Math.max(...totals);
  return totals.reduce<number[]>(
    (seats, total, i) => (total === best ? [...seats, i] : seats),
    [],
  );
};

export interface RecordResult {
  stats: Stats;
  /** Achievements earned by this game, in display order. */
  newlyUnlocked: Achievement[];
}

/**
 * Fold a finished game into the running stats. Pure — the caller persists the
 * result. Safe to call only on a completed game.
 */
export const recordGame = (stats: Stats, state: GameState): RecordResult => {
  const totals = state.scores.map(grandTotal);
  const winners = winningSeats(state.scores);

  const humanSeats = state.players
    .map((p, i) => (p.kind === 'human' ? i : -1))
    .filter((i) => i >= 0);
  const aiSeats = state.players
    .map((p, i) => (p.kind === 'ai' ? i : -1))
    .filter((i) => i >= 0);

  const humanWon = winners.some((seat) => humanSeats.includes(seat));
  const aiWon = winners.some((seat) => aiSeats.includes(seat));

  // Player-facing figures track the best human seat; an all-AI game contributes
  // nothing to "your" score history.
  const humanTotals = humanSeats.map((seat) => totals[seat]);
  const bestHuman = humanTotals.length ? Math.max(...humanTotals) : null;

  const yahtzees = state.scores.reduce(
    (n, sheet, seat) =>
      humanSeats.includes(seat) && sheet.yahtzee === 50 ? n + 1 : n,
    0,
  );
  const bonuses = state.scores.reduce(
    (n, sheet, seat) =>
      humanSeats.includes(seat) && upperBonus(sheet) > 0 ? n + 1 : n,
    0,
  );

  const next: Stats = {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    humanWins: stats.humanWins + (humanWon ? 1 : 0),
    aiWins: stats.aiWins + (aiWon ? 1 : 0),
    bestScore: Math.max(stats.bestScore, bestHuman ?? 0),
    totalScore: stats.totalScore + (bestHuman ?? 0),
    scoredGames: stats.scoredGames + (bestHuman === null ? 0 : 1),
    yahtzees: stats.yahtzees + yahtzees,
    upperBonuses: stats.upperBonuses + bonuses,
  };

  // Seeded before evaluation so its own predicate can simply read the flag.
  if (humanWon && aiSeats.length > 0 && !next.unlocked.includes('beat-ai')) {
    next.unlocked = [...next.unlocked, 'beat-ai'];
  }

  const newlyUnlocked = ACHIEVEMENTS.filter(
    (a) => !stats.unlocked.includes(a.id) && a.earned(next),
  );

  next.unlocked = Array.from(
    new Set([...next.unlocked, ...newlyUnlocked.map((a) => a.id)]),
  );

  return { stats: next, newlyUnlocked };
};

export const serializeStats = (stats: Stats): string => JSON.stringify(stats);

/** Missing or malformed stats degrade to empty rather than throwing. */
export const deserializeStats = (raw: string | null): Stats => {
  if (!raw) return emptyStats();
  try {
    const parsed = JSON.parse(raw) as Partial<Stats>;
    if (parsed?.version !== STATS_VERSION) return emptyStats();
    return {
      ...emptyStats(),
      ...parsed,
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
    };
  } catch {
    return emptyStats();
  }
};
