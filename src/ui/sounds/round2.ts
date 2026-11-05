// Sound round 2 (owner 2026-11-06): new variants for the sounds the owner wants regenerated (hit, pistol, rifle,
// shotgun, sniper). Direction from the owner: more cartoon, less "almost real"; shorter tails; the sniper quieter.
// So: tonal pops and snaps over raw noise, pitch drops for punch, little reverb. Picked in the next listening round.
import { biquad, buffer, finish, mix, noise, reverb, saturate, shape, tone, type Buf } from './dsp.ts';
import type { SoundId, SoundRecipe } from './types.ts';

/** Bandpassed noise burst (the "snap" or "puff" layer). */
function burst(sr: number, random: () => number, seconds: number, type: 'bandpass' | 'highpass' | 'lowpass', f: number, q: number, tau: number): Buf {
  return shape(biquad(noise(sr, seconds, random), sr, type, f, q), sr, 0.0005, tau);
}

/** Pitched punch: a tone gliding down fast (the cartoon "pop"). */
function pop(sr: number, seconds: number, wave: 'sine' | 'triangle' | 'square', f0: number, f1: number, glide: number, tau: number): Buf {
  return shape(tone(sr, seconds, wave, f0, f1, glide), sr, 0.0008, tau);
}

/** Short toy-gun shot: snap + puff + pitched pop, a touch of room. */
function toyShot(sr: number, random: () => number, p: {
  length: number; snap: [number, number, number]; puff: [number, number, number, number];
  pop: ['sine' | 'triangle' | 'square', number, number, number, number, number]; drive: number; room: [number, number, number]; peak: number;
}): Buf {
  const out = buffer(sr, p.length);
  mix(out, burst(sr, random, 0.03, 'highpass', p.snap[0], 0.9, p.snap[1]), sr, p.snap[2]);
  mix(out, burst(sr, random, p.length, 'bandpass', p.puff[0], p.puff[1], p.puff[2]), sr, p.puff[3]);
  const [wave, f0, f1, glide, tau, gain] = p.pop;
  mix(out, pop(sr, p.length, wave, f0, f1, glide, tau), sr, gain);
  saturate(out, p.drive);
  if (p.room[2] > 0) reverb(out, sr, p.room[0], p.room[1], p.room[2]);
  return finish(out, sr, p.peak);
}

/** Variants per sound, in listening order (v1, v2, v3). */
export const ROUND2: Partial<Record<SoundId, readonly SoundRecipe[]>> = {
  hit: [
    // v1 "tick": short pitched square click, dry.
    (sr, random) => {
      const out = buffer(sr, 0.1);
      mix(out, pop(sr, 0.1, 'square', 1900, 1500, 0.02, 0.012), sr, 0.35);
      mix(out, burst(sr, random, 0.02, 'highpass', 4000, 0.9, 0.003), sr, 0.5);
      biquad(out, sr, 'lowpass', 6000);
      return finish(out, sr, 0.6);
    },
    // v2 "thock": wood block, mallet on a toy.
    (sr, random) => {
      const out = buffer(sr, 0.13);
      mix(out, pop(sr, 0.13, 'sine', 980, 860, 0.02, 0.03), sr, 0.8);
      mix(out, pop(sr, 0.13, 'sine', 2550, 2400, 0.02, 0.012), sr, 0.25);
      mix(out, burst(sr, random, 0.03, 'bandpass', 2200, 2, 0.004), sr, 0.5);
      return finish(out, sr, 0.6);
    },
    // v3 "bloop": upward bubble pop with a click.
    (sr, random) => {
      const out = buffer(sr, 0.12);
      mix(out, pop(sr, 0.12, 'sine', 520, 1250, 0.035, 0.04), sr, 0.8);
      mix(out, burst(sr, random, 0.02, 'bandpass', 3000, 1.5, 0.003), sr, 0.4);
      return finish(out, sr, 0.6);
    },
  ],

  pistol: [
    // v1 "pop": round toy pop with a short low punch.
    (sr, random) => toyShot(sr, random, {
      length: 0.26, snap: [2500, 0.002, 0.7], puff: [1300, 1.1, 0.025, 0.8],
      pop: ['sine', 320, 85, 0.05, 0.04, 0.9], drive: 1.6, room: [0.6, 0.35, 0.08], peak: 0.88,
    }),
    // v2 "pew-pop": quick falling square chirp under the snap (playful, a bit arcade).
    (sr, random) => {
      const out = toyShot(sr, random, {
        length: 0.24, snap: [2800, 0.0018, 0.8], puff: [1600, 1, 0.018, 0.6],
        pop: ['sine', 260, 90, 0.04, 0.035, 0.7], drive: 1.5, room: [0.5, 0.3, 0.06], peak: 0.88,
      });
      mix(out, biquad(pop(sr, 0.24, 'square', 1500, 380, 0.06, 0.03), sr, 'lowpass', 3500), sr, 0.25);
      return finish(out, sr, 0.88);
    },
    // v3 "cap gun": sharp crack, paper puff and a tiny spring "ting".
    (sr, random) => {
      const out = toyShot(sr, random, {
        length: 0.3, snap: [3200, 0.0025, 1], puff: [900, 0.8, 0.035, 0.7],
        pop: ['triangle', 240, 110, 0.03, 0.025, 0.5], drive: 2.2, room: [0.7, 0.4, 0.1], peak: 0.88,
      });
      mix(out, pop(sr, 0.3, 'sine', 2350, 2300, 0.05, 0.05), sr, 0.08, 0.01);
      return finish(out, sr, 0.88);
    },
  ],

  rifle: [
    // v1 "tak": tight and short, so a burst stays clear.
    (sr, random) => toyShot(sr, random, {
      length: 0.16, snap: [2600, 0.0015, 0.8], puff: [1200, 1.2, 0.014, 0.8],
      pop: ['sine', 230, 85, 0.03, 0.022, 0.85], drive: 1.8, room: [0.5, 0.25, 0.05], peak: 0.86,
    }),
    // v2 "chunk": chunkier, more low end, a bit of grit.
    (sr, random) => toyShot(sr, random, {
      length: 0.2, snap: [2000, 0.002, 0.6], puff: [800, 0.9, 0.02, 0.9],
      pop: ['triangle', 170, 70, 0.04, 0.03, 0.9], drive: 2.6, room: [0.6, 0.3, 0.06], peak: 0.86,
    }),
    // v3 "pew-tak": tiny falling tone under the snap, the most cartoon of the three.
    (sr, random) => {
      const out = toyShot(sr, random, {
        length: 0.17, snap: [3000, 0.0015, 0.8], puff: [1500, 1.2, 0.012, 0.6],
        pop: ['sine', 210, 90, 0.03, 0.02, 0.7], drive: 1.6, room: [0.5, 0.25, 0.04], peak: 0.86,
      });
      mix(out, biquad(pop(sr, 0.17, 'square', 950, 420, 0.035, 0.022), sr, 'lowpass', 3000), sr, 0.22);
      return finish(out, sr, 0.86);
    },
  ],

  shotgun: [
    // v1 Claude's round-1 shotgun, made shorter and drier with a bigger boom.
    (sr, random) => toyShot(sr, random, {
      length: 0.5, snap: [1600, 0.003, 0.8], puff: [700, 0.7, 0.07, 1],
      pop: ['sine', 140, 42, 0.08, 0.08, 1], drive: 2.4, room: [1, 0.45, 0.12], peak: 0.9,
    }),
    // v2 "boom + ka-chunk": the shot, then a cartoon pump click-clack.
    (sr, random) => {
      const out = toyShot(sr, random, {
        length: 0.62, snap: [1700, 0.003, 0.8], puff: [750, 0.7, 0.06, 1],
        pop: ['sine', 130, 45, 0.07, 0.07, 1], drive: 2.3, room: [0.9, 0.4, 0.1], peak: 0.9,
      });
      for (const [at, f] of [[0.36, 1700], [0.46, 1200]] as const) {
        mix(out, burst(sr, random, 0.04, 'bandpass', f, 3, 0.006), sr, 0.35, at);
        mix(out, pop(sr, 0.04, 'triangle', f * 0.5, f * 0.45, 0.01, 0.01), sr, 0.15, at);
      }
      return finish(out, sr, 0.9);
    },
    // v3 "poof": big soft cartoon blast, almost no crack.
    (sr, random) => {
      const out = buffer(sr, 0.45);
      mix(out, shape(biquad(noise(sr, 0.45, random), sr, 'lowpass', (t) => 2600 * Math.pow(0.15, Math.min(1, t / 0.12)), 0.8), sr, 0.002, 0.06), sr, 1);
      mix(out, pop(sr, 0.45, 'sine', 110, 38, 0.1, 0.09), sr, 1);
      mix(out, burst(sr, random, 0.02, 'highpass', 1800, 0.9, 0.002), sr, 0.3);
      saturate(out, 2);
      return finish(out, sr, 0.9);
    },
  ],

  sniper: [
    // v1 Claude's round-1 sniper, shorter and quieter (0.7 s, small echo).
    (sr, random) => {
      const out = toyShot(sr, random, {
        length: 0.7, snap: [3000, 0.003, 0.9], puff: [900, 0.8, 0.06, 0.8],
        pop: ['sine', 110, 36, 0.2, 0.11, 1], drive: 1.8, room: [1.2, 0.5, 0.15], peak: 0.75,
      });
      mix(out, biquad(out.slice(0, Math.round(0.3 * sr)), sr, 'lowpass', 1200), sr, 0.15, 0.16);
      return finish(out, sr, 0.58);
    },
    // v2 "ka-POW + ping": crack and boom, then a small falling ricochet whistle.
    (sr, random) => {
      const out = toyShot(sr, random, {
        length: 0.75, snap: [3200, 0.0025, 1], puff: [1000, 0.8, 0.045, 0.7],
        pop: ['sine', 150, 45, 0.12, 0.08, 1], drive: 2, room: [1, 0.45, 0.1], peak: 0.75,
      });
      mix(out, shape(tone(sr, 0.4, 'sine', 2200, 1300, 0.35), sr, 0.02, 0.12), sr, 0.08, 0.12);
      return finish(out, sr, 0.58);
    },
    // v3 "thwip-boom": tonal cartoon shot, a fast low sweep under a dry crack.
    (sr, random) => {
      const out = buffer(sr, 0.6);
      mix(out, burst(sr, random, 0.03, 'highpass', 2800, 0.9, 0.002), sr, 0.8);
      mix(out, biquad(pop(sr, 0.6, 'square', 520, 70, 0.14, 0.09), sr, 'lowpass', 1800), sr, 0.45);
      mix(out, pop(sr, 0.6, 'sine', 120, 40, 0.15, 0.1), sr, 0.9);
      saturate(out, 1.6);
      reverb(out, sr, 0.9, 0.4, 0.08);
      return finish(out, sr, 0.58);
    },
  ],
};
