import { SHAKE_COOLDOWN_MS, createShakeDetector } from './shake';

const still = { x: 0, y: 0, z: 1 };
const jolt = { x: 1.6, y: 1.2, z: 1 };

describe('shake detection', () => {
  it('ignores a phone at rest, whichever way up', () => {
    const detect = createShakeDetector();
    expect(detect(still, 0)).toBe(false);
    expect(detect({ x: -1, y: 0, z: 0 }, 100)).toBe(false);
  });

  it('fires on a hard jolt', () => {
    expect(createShakeDetector()(jolt, 0)).toBe(true);
  });

  it('counts one shake once, however many readings it spans', () => {
    const detect = createShakeDetector();
    expect(detect(jolt, 0)).toBe(true);
    expect(detect(jolt, 80)).toBe(false);
    expect(detect(jolt, SHAKE_COOLDOWN_MS - 1)).toBe(false);
  });

  it('fires again once the cooldown has passed', () => {
    const detect = createShakeDetector();
    detect(jolt, 0);
    expect(detect(jolt, SHAKE_COOLDOWN_MS)).toBe(true);
  });

  it('honours a custom threshold', () => {
    expect(createShakeDetector(3)(jolt, 0)).toBe(false);
  });
});
