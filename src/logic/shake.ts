/**
 * Shake detection, kept free of the sensor itself so it can be tested with
 * plain numbers. Readings are in g: a phone at rest reports a magnitude of
 * about 1, whichever way up it is.
 */

export interface Acceleration {
  x: number;
  y: number;
  z: number;
}

/** Comfortably above walking or setting the phone down; a real shake clears 2g. */
export const SHAKE_THRESHOLD_G = 1.8;

/** One shake produces a burst of high readings; this makes it count once. */
export const SHAKE_COOLDOWN_MS = 900;

/**
 * Returns a function to feed each reading into. It answers true on the reading
 * that starts a shake, then stays quiet until the cooldown has passed.
 */
export const createShakeDetector = (
  threshold = SHAKE_THRESHOLD_G,
  cooldownMs = SHAKE_COOLDOWN_MS,
) => {
  let lastShake = -Infinity;
  return ({ x, y, z }: Acceleration, now: number): boolean => {
    if (Math.hypot(x, y, z) < threshold) return false;
    if (now - lastShake < cooldownMs) return false;
    lastShake = now;
    return true;
  };
};
