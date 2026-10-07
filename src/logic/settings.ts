/** Player preferences. Every one is an on/off choice. */
export interface Settings {
  /** Sound effects. */
  sound: boolean;
  /** Vibration on throws, holds and scores. */
  haptics: boolean;
  /** Shaking the phone throws the dice. */
  shake: boolean;
  /** Bots play their turns quickly rather than at a watchable pace. */
  fastBots: boolean;
  /** Offer a hint button during your turn. */
  hints: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  shake: true,
  fastBots: false,
  // Off by default: a game marked as hinted is one the player chose to have.
  hints: false,
};

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

export const serializeSettings = (settings: Settings): string => JSON.stringify(settings);

/**
 * Missing or malformed settings fall back to the defaults, one field at a
 * time: a setting added in a later build takes its default, and one that was
 * saved as something other than a boolean is ignored rather than trusted.
 */
export const deserializeSettings = (raw: string | null): Settings => {
  const settings = { ...DEFAULT_SETTINGS };
  if (!raw) return settings;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof parsed !== 'object' || parsed === null) return settings;
    for (const key of KEYS) {
      if (typeof parsed[key] === 'boolean') settings[key] = parsed[key];
    }
  } catch {
    // Unreadable: the defaults stand.
  }
  return settings;
};
