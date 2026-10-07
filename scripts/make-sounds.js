/**
 * Synthesises the game's sound effects into assets/sounds/.
 *
 * The effects are generated rather than sourced so there is nothing to
 * license, and so they can be retuned by editing numbers here. Output is
 * deterministic: the noise comes from a seeded generator, so re-running this
 * produces byte-identical files and no spurious diffs.
 *
 *   node scripts/make-sounds.js
 */

const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

/** Small seeded generator; Math.random would make every run a new file. */
const seeded = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buffer = (seconds) => new Float32Array(Math.round(seconds * RATE));

/** A struck, bell-like note: a sine and a quieter octave, fading out. */
const note = (out, at, freq, seconds, gain = 0.5) => {
  const start = Math.round(at * RATE);
  const length = Math.round(seconds * RATE);
  for (let i = 0; i < length && start + i < out.length; i += 1) {
    const t = i / RATE;
    const attack = Math.min(1, i / (0.004 * RATE));
    const envelope = attack * Math.exp((-5 * t) / seconds);
    out[start + i] +=
      gain *
      envelope *
      (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t));
  }
};

/** A hard knock: a burst of filtered noise that dies almost at once. */
const clack = (out, at, random, gain = 0.6, seconds = 0.03) => {
  const start = Math.round(at * RATE);
  const length = Math.round(seconds * RATE);
  let previous = 0;
  for (let i = 0; i < length && start + i < out.length; i += 1) {
    const envelope = Math.exp((-7 * i) / length);
    // A one-pole low-pass takes the hiss off, leaving something more wooden.
    previous = previous * 0.55 + (random() * 2 - 1) * 0.45;
    out[start + i] += gain * envelope * previous * 2;
  }
};

const sounds = {
  /** Dice rattling out of a cup: knocks that thin out and soften. */
  throw: () => {
    const out = buffer(0.55);
    const random = seeded(11);
    let at = 0;
    for (let i = 0; i < 11; i += 1) {
      clack(out, at, random, 0.7 * (1 - i / 14), 0.028);
      at += 0.018 + random() * 0.03 + i * 0.006;
    }
    return out;
  },

  /** Setting a die aside: one small knock with a pitch to it. */
  keep: () => {
    const out = buffer(0.09);
    clack(out, 0, seeded(5), 0.45, 0.02);
    note(out, 0, 1400, 0.07, 0.22);
    return out;
  },

  /** Points in a box: two rising notes. */
  score: () => {
    const out = buffer(0.36);
    note(out, 0, 659.25, 0.2, 0.42);
    note(out, 0.09, 987.77, 0.26, 0.42);
    return out;
  },

  /** A zero: a falling, muted pair. */
  zero: () => {
    const out = buffer(0.34);
    note(out, 0, 220, 0.2, 0.42);
    note(out, 0.11, 164.81, 0.22, 0.42);
    return out;
  },

  /** A bonus: a quick run up a chord. */
  bonus: () => {
    const out = buffer(0.62);
    [659.25, 830.61, 987.77, 1318.51].forEach((freq, i) =>
      note(out, i * 0.085, freq, 0.34, 0.36),
    );
    return out;
  },

  /** Game over: a short fanfare that lands and rings. */
  win: () => {
    const out = buffer(1.15);
    [523.25, 659.25, 783.99].forEach((freq, i) => note(out, i * 0.12, freq, 0.3, 0.34));
    [523.25, 783.99, 1046.5].forEach((freq) => note(out, 0.4, freq, 0.75, 0.28));
    return out;
  },
};

/** 16-bit mono PCM in a WAV container. */
const toWav = (samples) => {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clipped * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(sounds)) {
  const file = path.join(OUT, `${name}.wav`);
  const wav = toWav(make());
  fs.writeFileSync(file, wav);
  console.log(`${path.relative(process.cwd(), file)}  ${(wav.length / 1024).toFixed(1)} kB`);
}
