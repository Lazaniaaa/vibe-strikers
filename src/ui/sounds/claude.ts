// Claude's code-made sound set (A/B round 2026-11-05, compared blind with codex.ts in the sound lab).
// Every sound is layered: a noise transient for the attack, a body (filtered noise or a gliding tone), a low
// thump for weight and a short tail. The numbers here are the sound design itself (like a sound file's content),
// not gameplay values, so they stay next to each recipe.
import { biquad, buffer, finish, mix, noise, reverb, saturate, shape, sweep, tone, type Buf } from './dsp.ts';
import type { SoundSet } from './types.ts';

/** Random value in [a, b) from the injected source. */
const range = (random: () => number, a: number, b: number) => a + (b - a) * random();

/** Short bright crack: high-passed noise burst. */
function crack(sr: number, random: () => number, seconds: number, cutoff: number, tau: number): Buf {
  return shape(biquad(noise(sr, seconds, random), sr, 'highpass', cutoff, 0.9), sr, 0.0005, tau);
}

/** Low punch: a sine falling in pitch. */
function thump(sr: number, seconds: number, f0: number, f1: number, glide: number, tau: number): Buf {
  return shape(tone(sr, seconds, 'sine', f0, f1, glide), sr, 0.001, tau);
}

/** Gun body: noise through a closing low-pass. */
function blast(sr: number, random: () => number, seconds: number, from: number, to: number, close: number, tau: number): Buf {
  return shape(biquad(noise(sr, seconds, random), sr, 'lowpass', sweep(from, to, close), 0.9), sr, 0.0008, tau);
}

function gunshot(sr: number, random: () => number, p: {
  length: number; crack: [number, number, number]; body: [number, number, number, number, number];
  thump: [number, number, number, number, number]; tail: [number, number, number]; drive: number;
  room: [number, number, number];
}): Buf {
  const out = buffer(sr, p.length);
  mix(out, crack(sr, random, 0.03, p.crack[0], p.crack[1]), sr, p.crack[2]);
  const [bFrom, bTo, bClose, bTau, bGain] = p.body;
  mix(out, blast(sr, random, p.length, bFrom, bTo, bClose, bTau), sr, bGain);
  const [tF0, tF1, tGlide, tTau, tGain] = p.thump;
  mix(out, thump(sr, p.length, tF0, tF1, tGlide, tTau), sr, tGain);
  const [lCut, lTau, lGain] = p.tail;
  mix(out, shape(biquad(noise(sr, p.length, random), sr, 'lowpass', lCut), sr, 0.01, lTau, 0.008), sr, lGain);
  saturate(out, p.drive);
  reverb(out, sr, p.room[0], p.room[1], p.room[2]);
  return out;
}

export const CLAUDE_SOUNDS: SoundSet = {
  uiHover: (sr, random) => {
    const out = buffer(sr, 0.07);
    mix(out, shape(biquad(noise(sr, 0.07, random), sr, 'bandpass', 4200, 2.5), sr, 0.0005, 0.006), sr, 0.7);
    mix(out, shape(tone(sr, 0.07, 'sine', 1900, 2300, 0.02), sr, 0.001, 0.014), sr, 0.5);
    return finish(out, sr, 0.35, 0.002);
  },

  knife: (sr, random) => {
    const out = buffer(sr, 0.3);
    // Whoosh: band-pass noise sweeping up then down, swelling in and out.
    const air = biquad(noise(sr, 0.3, random), sr, 'bandpass', (t) => (t < 0.09 ? 700 * Math.pow(5, t / 0.09) : 3500 * Math.pow(0.45, (t - 0.09) / 0.2)), 1.6);
    for (let i = 0; i < air.length; i++) { const t = i / sr; air[i] *= Math.sin(Math.min(1, t / 0.22) * Math.PI) ** 1.5; }
    mix(out, air, sr, 1);
    // Thin metallic edge: three inharmonic partials.
    for (const [f, g] of [[3150, 0.12], [4870, 0.08], [6230, 0.05]] as const) mix(out, shape(tone(sr, 0.2, 'sine', f), sr, 0.002, 0.05), sr, g, 0.08);
    return finish(out, sr, 0.8);
  },

  pistol: (sr, random) => finish(gunshot(sr, random, {
    length: 0.5, crack: [2200, 0.0025, 0.9], body: [5500, 1100, 0.05, 0.028, 0.85],
    thump: [170, 60, 0.06, 0.03, 0.75], tail: [1700, 0.11, 0.12], drive: 1.8, room: [1, 0.55, 0.18],
  }), sr, 0.9),

  rifle: (sr, random) => finish(gunshot(sr, random, {
    length: 0.4, crack: [2600, 0.0018, 1], body: [6500, 1600, 0.035, 0.016, 0.8],
    thump: [130, 55, 0.04, 0.02, 0.6], tail: [2000, 0.05, 0.07], drive: 2, room: [0.8, 0.4, 0.1],
  }), sr, 0.9),

  sniper: (sr, random) => {
    const out = gunshot(sr, random, {
      length: 1.4, crack: [3200, 0.004, 1], body: [4000, 500, 0.12, 0.08, 0.9],
      thump: [95, 32, 0.4, 0.17, 1.1], tail: [900, 0.42, 0.22], drive: 2.4, room: [1.6, 0.7, 0.3],
    });
    // Bright supersonic edge and a distant slap-back echo.
    mix(out, shape(biquad(noise(sr, 0.05, random), sr, 'bandpass', 2600, 3), sr, 0.0005, 0.01), sr, 0.5);
    const echo = biquad(out.slice(0, Math.round(0.5 * sr)), sr, 'lowpass', 1200);
    mix(out, echo, sr, 0.22, 0.19);
    return finish(out, sr, 0.92);
  },

  shotgun: (sr, random) => {
    const out = gunshot(sr, random, {
      length: 0.8, crack: [1600, 0.004, 0.9], body: [3200, 650, 0.09, 0.06, 1],
      thump: [115, 40, 0.09, 0.07, 0.95], tail: [1000, 0.25, 0.2], drive: 2.6, room: [1.2, 0.6, 0.22],
    });
    // Pellet spread: a second, darker burst a few ms later.
    mix(out, shape(biquad(noise(sr, 0.12, random), sr, 'bandpass', 1200, 0.8), sr, 0.001, 0.03), sr, 0.45, 0.006);
    return finish(out, sr, 0.92);
  },

  step: (sr, random) => {
    const out = buffer(sr, 0.2);
    const pitch = range(random, 0.88, 1.12);
    mix(out, thump(sr, 0.2, 95 * pitch, 55 * pitch, 0.05, range(random, 0.02, 0.03)), sr, 0.8);
    const grit = biquad(noise(sr, 0.2, random), sr, 'bandpass', range(random, 1400, 2300), 1.1);
    mix(out, shape(grit, sr, 0.001, range(random, 0.012, 0.022)), sr, 0.35, range(random, 0, 0.006));
    // Heel then toe: a smaller second contact.
    const toe = shape(biquad(noise(sr, 0.1, random), sr, 'bandpass', range(random, 900, 1500), 1.2), sr, 0.001, 0.012);
    mix(out, toe, sr, range(random, 0.25, 0.45), range(random, 0.03, 0.045));
    biquad(out, sr, 'lowpass', 3800);
    return finish(out, sr, 0.55);
  },

  hit: (sr, random) => {
    const out = buffer(sr, 0.15);
    mix(out, shape(biquad(noise(sr, 0.15, random), sr, 'bandpass', 3300, 4), sr, 0.0005, 0.006), sr, 0.9);
    mix(out, shape(tone(sr, 0.15, 'triangle', 1400, 1250, 0.04), sr, 0.001, 0.028), sr, 0.45);
    mix(out, thump(sr, 0.15, 230, 120, 0.03, 0.02), sr, 0.5);
    return finish(out, sr, 0.85);
  },

  headshot: (sr, random) => {
    const out = buffer(sr, 0.36);
    // Crunch, then a bright two-note "ding" (a fifth) with a small upward glide.
    mix(out, saturate(shape(biquad(noise(sr, 0.05, random), sr, 'bandpass', 2400, 1.5), sr, 0.0005, 0.01), 3), sr, 0.7);
    mix(out, shape(tone(sr, 0.36, 'sine', 1760, 1815, 0.05), sr, 0.002, 0.11), sr, 0.55, 0.004);
    mix(out, shape(tone(sr, 0.36, 'sine', 2637, 2720, 0.05), sr, 0.002, 0.09), sr, 0.35, 0.004);
    mix(out, shape(tone(sr, 0.2, 'sine', 4400), sr, 0.001, 0.04), sr, 0.15, 0.004);
    reverb(out, sr, 0.7, 0.45, 0.15);
    return finish(out, sr, 0.9);
  },

  loot: (sr, random) => {
    const out = buffer(sr, 0.45);
    // Rising major arpeggio (C6 E6 G6), each note with a soft octave and a sparkle.
    [1046.5, 1318.5, 1568].forEach((f, k) => {
      const at = k * 0.055;
      mix(out, shape(tone(sr, 0.3, 'sine', f), sr, 0.003, 0.09), sr, 0.5, at);
      mix(out, shape(tone(sr, 0.3, 'triangle', f * 2), sr, 0.003, 0.05), sr, 0.12, at);
      mix(out, shape(biquad(noise(sr, 0.04, random), sr, 'highpass', 6500), sr, 0.0005, 0.012), sr, 0.12, at);
    });
    reverb(out, sr, 0.9, 0.5, 0.2);
    return finish(out, sr, 0.75);
  },
};
