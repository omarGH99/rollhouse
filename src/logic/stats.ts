import { GameState, ScoreSheet } from '../types';
import { ROLLHOUSE_POINTS, grandTotal, upperBonus } from './scoring';

export const STATS_VERSION = 2;

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
  rollhouses: number;
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
  rollhouses: 0,
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
    id: 'rollhouse',
    title: 'Perfect Hand',
    description: 'Score a Rollhouse',
    icon: 'flame-outline',
    earned: (s) => s.rollhouses >= 1,
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

  const rollhouses = state.scores.reduce(
    (n, sheet, seat) =>
      humanSeats.includes(seat)
        ? n + (sheet.rollhouse === ROLLHOUSE_POINTS ? 1 : 0) + sheet.extraRollhouses
        : n,
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
    rollhouses: stats.rollhouses + rollhouses,
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

type RawStats = Record<string, unknown>;

const LEGACY_ACHIEVEMENT = 'yahtzee';
const LEGACY_COUNTER = `${LEGACY_ACHIEVEMENT}s`;

/**
 * Upgrade steps, keyed by the version they upgrade *from*. Bumping
 * `STATS_VERSION` means adding the step here: unlike a game in progress, a
 * lifetime record is not something to throw away over a schema change.
 */
const MIGRATIONS: Record<number, (stats: RawStats) => RawStats> = {
  // v1 predates the game's own name for five alike, in a counter and in an
  // achievement id. The old spellings appear here and nowhere else.
  1: ({ [LEGACY_COUNTER]: rollhouses, ...rest }) => ({
    ...rest,
    rollhouses,
    unlocked: Array.isArray(rest.unlocked)
      ? rest.unlocked.map((id) => (id === LEGACY_ACHIEVEMENT ? 'rollhouse' : id))
      : rest.unlocked,
  }),
};

const COUNTERS = [
  'gamesPlayed',
  'humanWins',
  'aiWins',
  'bestScore',
  'totalScore',
  'scoredGames',
  'rollhouses',
  'upperBonuses',
] as const;

/**
 * Missing or malformed stats degrade to empty rather than throwing. Stats from
 * an older build are migrated forward; only a version this build has never
 * heard of (written by a newer one) is discarded.
 */
export const deserializeStats = (raw: string | null): Stats => {
  if (!raw) return emptyStats();
  try {
    let parsed = JSON.parse(raw) as RawStats | null;
    if (typeof parsed !== 'object' || parsed === null) return emptyStats();

    let version = parsed.version;
    if (typeof version !== 'number' || !Number.isInteger(version)) return emptyStats();
    if (version < 1 || version > STATS_VERSION) return emptyStats();
    for (; version < STATS_VERSION; version += 1) {
      parsed = MIGRATIONS[version]?.(parsed) ?? parsed;
    }

    const stats = emptyStats();
    for (const key of COUNTERS) {
      const value = parsed[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        stats[key] = value;
      }
    }
    if (Array.isArray(parsed.unlocked)) {
      stats.unlocked = parsed.unlocked.filter(
        (id): id is string => typeof id === 'string',
      );
    }
    return stats;
  } catch {
    return emptyStats();
  }
};
