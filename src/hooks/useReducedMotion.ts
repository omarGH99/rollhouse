import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the OS "reduce motion" setting is on.
 *
 * Used to switch off *decorative* animation only — the breathing call to
 * action, the pulsing score preview, the drifting table light. Motion that
 * carries meaning stays: the dice still tumble, because that throw is the
 * feedback confirming a roll happened, and removing it would leave the player
 * unsure whether their tap registered.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {
        // Unsupported platform: assume motion is fine.
      });

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => setReduced(value),
    );

    return () => {
      active = false;
      sub?.remove();
    };
  }, []);

  return reduced;
};
