import {
  Category,
  DieValue,
  GameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  Phase,
  PlayerKind,
  ScoreSheet,
} from '../types';
import { GameSession } from './gameReducer';
import { ALL_CATEGORIES, TOTAL_ROUNDS } from './scoring';

/**
 * Bump when the saved shape changes incompatibly. A save whose version does not
 * match is discarded rather than guessed at — losing one game in progress is a
 * far better failure than restoring a corrupt board.
 */
export const SAVE_VERSION = 1;

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
  if (
    !players.every(
      (p: unknown) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as { name?: unknown }).name === 'string' &&
        isPlayerKind((p as { kind?: unknown }).kind),
    )
  ) {
    return false;
  }

  if (!Array.isArray(s.scores) || s.scores.length !== players.length) return false;
  if (!s.scores.every(isScoreSheet)) return false;

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

  if (typeof s.round !== 'number' || s.round < 1 || s.round > TOTAL_ROUNDS) {
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
    if (typeof last.points !== 'number') return false;
  }

  return true;
};

/**
 * Parse a persisted game. Returns `null` for anything unusable — absent,
 * malformed, wrong version, or already finished (a completed game is not worth
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
  if (save.version !== SAVE_VERSION) return null;
  if (!isGameState(save.state)) return null;
  if (save.state.phase === 'gameover') return null;

  // History is not persisted, so a restored game starts with nothing to undo.
  return { state: save.state, history: [] };
};
