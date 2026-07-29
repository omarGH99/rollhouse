import AsyncStorage from '@react-native-async-storage/async-storage';

import { GameSession } from './logic/gameReducer';
import { deserializeSession, serializeSession } from './logic/persistence';
import {
  Stats,
  deserializeStats,
  emptyStats,
  serializeStats,
} from './logic/stats';

/**
 * The only module that touches the device. Everything it stores and loads is
 * shaped by the pure helpers in `logic/`, so all parsing and validation is
 * covered by tests that never need a native module.
 *
 * Every call swallows its errors: storage being unavailable should cost you a
 * saved game, never a crash.
 */

const GAME_KEY = 'yahtzee:game:v1';
const STATS_KEY = 'yahtzee:stats:v1';

export const saveGame = async (session: GameSession): Promise<void> => {
  try {
    await AsyncStorage.setItem(GAME_KEY, serializeSession(session));
  } catch {
    // Non-fatal: the game continues, it just will not resume.
  }
};

export const loadGame = async (): Promise<GameSession | null> => {
  try {
    return deserializeSession(await AsyncStorage.getItem(GAME_KEY));
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
    return deserializeStats(await AsyncStorage.getItem(STATS_KEY));
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
