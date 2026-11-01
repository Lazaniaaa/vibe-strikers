// Procedural sound effects (ZzFX style, no audio files). All numbers for sounds live here.

export type Wave = 'sine' | 'square' | 'saw' | 'triangle' | 'noise';

export interface SoundDef {
  wave: Wave;
  /** Start / end frequency (Hz), linear slide. */
  freq: number;
  freqEnd: number;
  /** Envelope (seconds). */
  attack: number;
  sustain: number;
  release: number;
  /** 0..1 white noise mixed into the oscillator. */
  noise: number;
  /** One-pole low-pass cutoff (Hz); 0 = off. */
  lowpass: number;
  volume: number;
  /** Random playback-rate variation (+-). */
  pitchJitter: number;
}

const d = { attack: 0.002, noise: 0, lowpass: 0, volume: 0.5, pitchJitter: 0.04 };

export const SOUNDS = {
  shot_rifle: { ...d, wave: 'square', freq: 220, freqEnd: 60, sustain: 0.03, release: 0.12, noise: 0.75, lowpass: 3800, volume: 0.55 },
  shot_pistol: { ...d, wave: 'square', freq: 320, freqEnd: 90, sustain: 0.02, release: 0.1, noise: 0.6, lowpass: 4500, volume: 0.5 },
  shot_sniper: { ...d, wave: 'saw', freq: 140, freqEnd: 30, sustain: 0.06, release: 0.45, noise: 0.8, lowpass: 2600, volume: 0.75, pitchJitter: 0.02 },
  shot_shotgun: { ...d, wave: 'square', freq: 120, freqEnd: 35, sustain: 0.05, release: 0.3, noise: 0.9, lowpass: 2200, volume: 0.7 },
  shot_knife: { ...d, wave: 'noise', freq: 800, freqEnd: 300, attack: 0.02, sustain: 0.04, release: 0.08, noise: 1, lowpass: 5000, volume: 0.3, pitchJitter: 0.1 },
  hit: { ...d, wave: 'triangle', freq: 1500, freqEnd: 1300, sustain: 0.02, release: 0.05, volume: 0.35, pitchJitter: 0.02 },
  headshot: { ...d, wave: 'sine', freq: 2100, freqEnd: 2600, sustain: 0.05, release: 0.15, volume: 0.45, pitchJitter: 0 },
  kill: { ...d, wave: 'triangle', freq: 900, freqEnd: 1800, sustain: 0.06, release: 0.12, volume: 0.35, pitchJitter: 0 },
  hurt: { ...d, wave: 'saw', freq: 180, freqEnd: 90, sustain: 0.04, release: 0.12, noise: 0.3, lowpass: 1200, volume: 0.4 },
  reload: { ...d, wave: 'square', freq: 1200, freqEnd: 700, sustain: 0.01, release: 0.03, noise: 0.5, lowpass: 3000, volume: 0.3, pitchJitter: 0.08 },
  step: { ...d, wave: 'noise', freq: 120, freqEnd: 60, sustain: 0.015, release: 0.06, noise: 1, lowpass: 700, volume: 0.25, pitchJitter: 0.15 },
  ui: { ...d, wave: 'sine', freq: 660, freqEnd: 880, sustain: 0.02, release: 0.05, volume: 0.25, pitchJitter: 0 },
  ping: { ...d, wave: 'sine', freq: 1046, freqEnd: 1568, sustain: 0.05, release: 0.18, volume: 0.35, pitchJitter: 0 },
} as const satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;

export const AUDIO = {
  /** Metres between footsteps while running. */
  stride: 2.2,
  /** Footsteps only above this fraction of run speed (Shift walk is silent, GAME.md 3). */
  stepMinMoveFraction: 0.55,
  /** Remote sounds: full volume until this distance, then 1/d falloff; silent beyond maxDistance. */
  refDistance: 4,
  maxDistance: 70,
  /** Second reload click, seconds before the reload ends. */
  reloadSecondClick: 0.35,
} as const;

/** Generative music (GAME.md 12): synth notes on a step sequencer, no audio files. */
export const MUSIC = {
  /** Beats per minute per mood; one sequencer step = an 8th note. */
  tempo: { menu: 68, calm: 76, round: 100, tension: 126 },
  /** Last seconds of a round that switch to the tense mood. */
  tensionTime: 15,
  /** Music gain = music volume x master volume x this (kept subtle under the effects). */
  mix: 0.6,
  /** Scheduler look-ahead (s) and timer interval (ms). */
  lookAhead: 0.15,
  tickMs: 50,
  /** Root note (MIDI) of the A-minor chord loop and the progression (semitones from the root, one chord per bar). */
  root: 45,
  chords: [0, 8, 3, 10],
  /** Instruments (synth defs without pitch; freq is set per note). */
  pad: { wave: 'triangle', attack: 0.25, sustain: 0.9, release: 1.4, noise: 0, lowpass: 1200, volume: 0.22, pitchJitter: 0 },
  bass: { wave: 'sine', attack: 0.01, sustain: 0.12, release: 0.25, noise: 0, lowpass: 600, volume: 0.45, pitchJitter: 0 },
  arp: { wave: 'triangle', attack: 0.005, sustain: 0.05, release: 0.18, noise: 0, lowpass: 2400, volume: 0.16, pitchJitter: 0 },
  hat: { wave: 'noise', attack: 0.001, sustain: 0.005, release: 0.04, noise: 1, lowpass: 9000, volume: 0.07, pitchJitter: 0 },
  sting: { wave: 'triangle', attack: 0.005, sustain: 0.12, release: 0.5, noise: 0, lowpass: 3000, volume: 0.3, pitchJitter: 0 },
  /** Win / lose stings (semitones from root + 24), 8th notes. */
  win: [0, 4, 7, 12],
  lose: [7, 3, 0, -5],
} as const;
