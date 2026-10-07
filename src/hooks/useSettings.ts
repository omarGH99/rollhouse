import { useCallback, useEffect, useRef, useState } from 'react';

import { configureFeedback } from '../feedback';
import { DEFAULT_SETTINGS, Settings } from '../logic/settings';
import { loadSettings, saveSettings } from '../storage';

export interface SettingsControl {
  settings: Settings;
  update: (change: Partial<Settings>) => void;
}

/** The player's preferences: read once, saved on every change. */
export const useSettings = (): SettingsControl => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // The latest value, so `update` can build on it without being re-created.
  const current = useRef(settings);

  const apply = useCallback((next: Settings) => {
    current.current = next;
    // Pushed straight to sound and vibration, not left to an effect, so that
    // muting takes hold before the very next sound rather than after it.
    configureFeedback(next);
    setSettings(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((saved) => {
      if (!cancelled) apply(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const update = useCallback(
    (change: Partial<Settings>) => {
      const next = { ...current.current, ...change };
      apply(next);
      void saveSettings(next);
    },
    [apply],
  );

  return { settings, update };
};
