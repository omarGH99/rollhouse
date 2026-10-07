import {
  BotLevel,
  Category,
  DieValue,
  GameMode,
  GameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  Phase,
  Player,
  PlayerKind,
  ScoreSheet,
} from '../types';
import { GameSession } from './gameReducer';
import { MODES, isGameMode, roundsFor } from './modes';
import { ALL_CATEGORIES } from './scoring';

/**
 * Bump when the saved shape changes incompatibly. A save whose version does not
 * match is discarded rather than guessed at — losing one game in progress is a
 * far better failure than restoring a corrupt board.
 */
export const SAVE_VERSION = 3;

/** Versioned apart from games: who sat where outlives any change to the board. */
export const SEATS_VERSION = 1;

export interface SavedGame {
  version: number;
  savedAt: number;
  state: GameState;
}

/** Only the live game is persisted; the undo stack is deliberately dropped. */
export const serializeSession = (session: GameSession): string =>
  JSON.stringify({
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state: session.state,
  } satisfies SavedGame);

const isDieValue = (v: unknown): v is DieValue =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6;

const isPhase = (v: unknown): v is Phase =>
  v === 'turn' || v === 'handoff' || v === 'gameover';

const isPlayerKind = (v: unknown): v is PlayerKind => v === 'human' || v === 'ai';

const isScoreSheet = (v: unknown): v is ScoreSheet => {
  if (typeof v !== 'object' || v === null) return false;
  const sheet = v as Record<string, unknown>;
  const extra = sheet.extraRollhouses;
  if (typeof extra !== 'number' || !Number.isInteger(extra) || extra < 0) return false;
  return ALL_CATEGORIES.every((category: Category) => {
    const cell = sheet[category];
    return cell === null || (typeof cell === 'number' && Number.isFinite(cell));
  });
};

/**
 * Validates a parsed save. This is deliberately thorough: the payload comes
 * from disk, where it may have been written by an older build, truncated, or
 * hand-edited, and a malformed board would crash deep inside rendering.
 */
const isGameState = (v: unknown): v is GameState => {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;

  // Bound to a local so the `Array.isArray` narrowing survives into closures.
  const players = s.players;
  if (!Array.isArray(players)) return false;
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) return false;
  if (!players.every(isPlayer)) return false;

  if (!isGameMode(s.mode)) return false;
  const mode = s.mode;

  // One card per seat, each with exactly the columns this game type uses.
  const columnCount = MODES[mode].multipliers.length;
  if (!Array.isArray(s.scores) || s.scores.length !== players.length) return false;
  if (
    !s.scores.every(
      (columns: unknown) =>
        Array.isArray(columns) &&
        columns.length === columnCount &&
        columns.every(isScoreSheet),
    )
  ) {
    return false;
  }

  if (!Array.isArray(s.dice) || s.dice.length === 0) return false;
  if (
    !s.dice.every(
      (d: unknown) =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as { id?: unknown }).id === 'number' &&
        typeof (d as { held?: unknown }).held === 'boolean' &&
        isDieValue((d as { value?: unknown }).value),
    )
  ) {
    return false;
  }

  if (typeof s.rollsLeft !== 'number' || s.rollsLeft < 0) return false;
  if (typeof s.hasRolled !== 'boolean') return false;
  if (typeof s.rollNonce !== 'number') return false;
  if (!isPhase(s.phase)) return false;

  if (typeof s.round !== 'number' || s.round < 1 || s.round > roundsFor(mode)) {
    return false;
  }

  const seatInRange = (i: unknown) =>
    typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < players.length;
  if (!seatInRange(s.currentPlayer) || !seatInRange(s.incomingPlayer)) return false;

  if (s.lastScored !== null) {
    if (typeof s.lastScored !== 'object' || s.lastScored === null) return false;
    const last = s.lastScored as Record<string, unknown>;
    if (!seatInRange(last.player)) return false;
    if (!ALL_CATEGORIES.includes(last.category as Category)) return false;
    const column = last.column;
    if (typeof column !== 'number' || !Number.isInteger(column)) return false;
    if (column < 0 || column >= columnCount) return false;
    if (typeof last.points !== 'number') return false;
    if (typeof last.bonus !== 'number') return false;
  }

  return true;
};

/** What v1 saves called the five-alike box. Named here and nowhere else. */
const LEGACY_BOX = 'yahtzee';

/**
 * Bring a v1 state up to the current shape: the five-alike box was renamed,
 * and sheets gained a bonus count that v1 rules never awarded. Anything
 * unexpected is passed through untouched for `isGameState` to reject.
 */
const upgradeV1 = (raw: unknown): unknown => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const state = raw as Record<string, unknown>;

  const scores = Array.isArray(state.scores)
    ? state.scores.map((sheet: unknown) => {
        if (typeof sheet !== 'object' || sheet === null) return sheet;
        const { [LEGACY_BOX]: rollhouse, ...rest } = sheet as Record<string, unknown>;
        return { ...rest, rollhouse, extraRollhouses: 0 };
      })
    : state.scores;

  const last = state.lastScored;
  const lastScored =
    typeof last === 'object' && last !== null
      ? {
          ...last,
          category:
            (last as { category?: unknown }).category === LEGACY_BOX
              ? 'rollhouse'
              : (last as { category?: unknown }).category,
          bonus: 0,
        }
      : last;

  return { ...state, scores, lastScored };
};

/**
 * Bring a v2 state up to the current shape. v2 knew one game — what is now
 * Classic — with a single scorecard column per seat.
 */
const upgradeV2 = (raw: unknown): unknown => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const state = raw as Record<string, unknown>;
  const mode: GameMode = 'classic';

  const scores = Array.isArray(state.scores)
    ? state.scores.map((sheet: unknown) => [sheet])
    : state.scores;

  const last = state.lastScored;
  const lastScored =
    typeof last === 'object' && last !== null ? { ...last, column: 0 } : last;

  return { ...state, mode, scores, lastScored };
};

/** Upgrade steps, keyed by the version they upgrade *from*, applied in turn. */
const UPGRADES: Record<number, (state: unknown) => unknown> = {
  1: upgradeV1,
  2: upgradeV2,
};

/**
 * Parse a persisted game. Returns `null` for anything unusable — absent,
 * malformed, unknown version, or already finished (a completed game is not worth
 * restoring into).
 */
export const deserializeSession = (raw: string | null): GameSession | null => {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const save = parsed as Record<string, unknown>;
  const version = save.version;
  if (typeof version !== 'number' || !Number.isInteger(version)) return null;
  if (version < 1 || version > SAVE_VERSION) return null;

  let state = save.state;
  for (let v = version; v < SAVE_VERSION; v += 1) state = UPGRADES[v](state);
  if (!isGameState(state)) return null;
  if (state.phase === 'gameover') return null;

  // History is not persisted, so a restored game starts with nothing to undo.
  return { state, history: [] };
};

/** Longest seat name the setup screen accepts; longer ones crowd the banner. */
export const MAX_NAME_LENGTH = 12;

const isBotLevel = (v: unknown): v is BotLevel =>
  v === 'easy' || v === 'normal' || v === 'hard';

const isPlayer = (p: unknown): p is Player =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as { name?: unknown }).name === 'string' &&
  isPlayerKind((p as { kind?: unknown }).kind) &&
  ((p as { level?: unknown }).level === undefined ||
    isBotLevel((p as { level?: unknown }).level));

/**
 * The table of the last game started — who sat where, and what they played —
 * so the next one opens the same way.
 */
export const serializePlayers = (players: Player[], mode: GameMode = 'classic'): string =>
  JSON.stringify({ version: SEATS_VERSION, players, mode });

/** The game type saved alongside the seats; Classic when there is none. */
export const deserializeLastMode = (raw: string | null): GameMode => {
  try {
    const mode = (JSON.parse(raw ?? 'null') as { mode?: unknown } | null)?.mode;
    return isGameMode(mode) ? mode : 'classic';
  } catch {
    return 'classic';
  }
};

export const deserializePlayers = (raw: string | null): Player[] | null => {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const { version, players } = parsed as Record<string, unknown>;
  if (version !== SEATS_VERSION || !Array.isArray(players)) return null;
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) return null;
  if (!players.every(isPlayer)) return null;

  return players.map(({ name, kind, level }) =>
    level === undefined ? { name, kind } : { name, kind, level },
  );
};
