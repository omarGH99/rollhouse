import AsyncStorage from '@react-native-async-storage/async-storage';

import { GameSession } from './logic/gameReducer';
import {
  deserializeLastMode,
  deserializePlayers,
  deserializeSession,
  serializePlayers,
  serializeSession,
} from './logic/persistence';
import {
  HighScores,
  deserializeHighScores,
  emptyHighScores,
  serializeHighScores,
} from './logic/highScores';
import {
  Settings,
  deserializeSettings,
  serializeSettings,
} from './logic/settings';
import {
  Stats,
  deserializeStats,
  emptyStats,
  serializeStats,
} from './logic/stats';
import { GameMode, Player } from './types';

/**
 * The only module that touches the device. Everything it stores and loads is
 * shaped by the pure helpers in `logic/`, so all parsing and validation is
 * covered by tests that never need a native module.
 *
 * Every call swallows its errors: storage being unavailable should cost you a
 * saved game, never a crash.
 */

const GAME_KEY = 'rollhouse:game';
const STATS_KEY = 'rollhouse:stats';
const SEATS_KEY = 'rollhouse:seats';
const SCORES_KEY = 'rollhouse:scores';
const SETTINGS_KEY = 'rollhouse:settings';

/** Where builds before the rename kept the same two payloads. */
const LEGACY_PREFIX = 'yahtzee';
const LEGACY_GAME_KEY = `${LEGACY_PREFIX}:game:v1`;
const LEGACY_STATS_KEY = `${LEGACY_PREFIX}:stats:v1`;

/**
 * Read `key`, falling back once to the key an older build used. A legacy value
 * is copied across before the old key is dropped, so it cannot be lost between
 * the two — stats in particular are not rewritten until a game finishes.
 */
const readMigrating = async (key: string, legacyKey: string): Promise<string | null> => {
  const current = await AsyncStorage.getItem(key);
  if (current !== null) return current;

  const legacy = await AsyncStorage.getItem(legacyKey);
  if (legacy === null) return null;
  await AsyncStorage.setItem(key, legacy);
  await AsyncStorage.removeItem(legacyKey);
  return legacy;
};

export const saveGame = async (session: GameSession): Promise<void> => {
  try {
    await AsyncStorage.setItem(GAME_KEY, serializeSession(session));
  } catch {
    // Non-fatal: the game continues, it just will not resume.
  }
};

export const loadGame = async (): Promise<GameSession | null> => {
  try {
    return deserializeSession(await readMigrating(GAME_KEY, LEGACY_GAME_KEY));
  } catch {
    return null;
  }
};

export const clearGame = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(GAME_KEY);
  } catch {
    // Ignored.
  }
};

export const saveStats = async (stats: Stats): Promise<void> => {
  try {
    await AsyncStorage.setItem(STATS_KEY, serializeStats(stats));
  } catch {
    // Ignored.
  }
};

export const loadStats = async (): Promise<Stats> => {
  try {
    return deserializeStats(await readMigrating(STATS_KEY, LEGACY_STATS_KEY));
  } catch {
    return emptyStats();
  }
};

export const clearStats = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STATS_KEY);
  } catch {
    // Ignored.
  }
};

export const saveSeats = async (players: Player[], mode: GameMode): Promise<void> => {
  try {
    await AsyncStorage.setItem(SEATS_KEY, serializePlayers(players, mode));
  } catch {
    // Ignored.
  }
};

/** The last table dealt: its seats, and the game type they played. */
export const loadSeats = async (): Promise<{ players: Player[]; mode: GameMode } | null> => {
  try {
    const raw = await AsyncStorage.getItem(SEATS_KEY);
    const players = deserializePlayers(raw);
    return players ? { players, mode: deserializeLastMode(raw) } : null;
  } catch {
    return null;
  }
};

export const saveHighScores = async (scores: HighScores): Promise<void> => {
  try {
    await AsyncStorage.setItem(SCORES_KEY, serializeHighScores(scores));
  } catch {
    // Ignored.
  }
};

export const loadHighScores = async (): Promise<HighScores> => {
  try {
    return deserializeHighScores(await AsyncStorage.getItem(SCORES_KEY));
  } catch {
    return emptyHighScores();
  }
};

export const clearHighScores = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SCORES_KEY);
  } catch {
    // Ignored.
  }
};

export const saveSettings = async (settings: Settings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, serializeSettings(settings));
  } catch {
    // Ignored.
  }
};

export const loadSettings = async (): Promise<Settings> => {
  try {
    return deserializeSettings(await AsyncStorage.getItem(SETTINGS_KEY));
  } catch {
    return deserializeSettings(null);
  }
};
