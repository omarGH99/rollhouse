import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

import { createShakeDetector } from '../logic/shake';

/**
 * Whether shaking is offered at all. Browsers expose a motion API even on
 * desktops with no sensor behind it, so the web build sticks to the button.
 */
export const SHAKE_SUPPORTED = Platform.OS !== 'web';

const SAMPLE_INTERVAL_MS = 80;

/**
 * Calls `onShake` when the device is shaken, while `enabled`. Best-effort: a
 * device with no accelerometer simply never fires, and the button still works.
 */
export const useShake = (onShake: () => void, enabled: boolean): void => {
  // Latest callback, so a new function identity does not resubscribe the sensor.
  const callback = useRef(onShake);
  callback.current = onShake;

  useEffect(() => {
    if (!enabled || !SHAKE_SUPPORTED) return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    const detect = createShakeDetector();

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return;
        Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
        subscription = Accelerometer.addListener((reading) => {
          if (detect(reading, Date.now())) callback.current();
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
};
