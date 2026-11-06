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
  streak: { ...d, wave: 'triangle', freq: 660, freqEnd: 1320, sustain: 0.08, release: 0.14, volume: 0.3, pitchJitter: 0 },
  // Fallbacks only: these two always use their code-made recipe (PICKED_SOUNDS).
  hover: { ...d, wave: 'sine', freq: 1800, freqEnd: 2100, sustain: 0.005, release: 0.02, volume: 0.15, pitchJitter: 0 },
  loot: { ...d, wave: 'sine', freq: 1046, freqEnd: 1568, sustain: 0.04, release: 0.15, volume: 0.35, pitchJitter: 0 },
} as const satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;

/**
 * Code-made sounds picked by the owner in the A/B rounds (2026-11-06; recipes mapped in src/ui/sounds/picks.ts).
 * They replace the synth defs above. `gain` = playback volume, set so each sound sits near the old synth level
 * (peaks stay below full scale; the raw recipes differ a lot, e.g. Codex's hover is about 25 dB quieter),
 * `jitter` = random playback-rate variation (+-).
 */
export const PICKED_SOUNDS = {
  shot_knife: { gain: 0.55, jitter: 0.06 },
  shot_pistol: { gain: 0.82, jitter: 0.04 },
  shot_rifle: { gain: 0.7, jitter: 0.04 },
  shot_shotgun: { gain: 0.42, jitter: 0.03 },
  shot_sniper: { gain: 0.75, jitter: 0.02 },
  hit: { gain: 0.9, jitter: 0.03 },
  headshot: { gain: 1.05, jitter: 0 },
  step: { gain: 0.12, jitter: 0.05 },
  hover: { gain: 2.8, jitter: 0.02 },
  loot: { gain: 1.5, jitter: 0 },
} as const satisfies Partial<Record<SoundName, { gain: number; jitter: number }>>;

/** Footsteps: this many renders of the step recipe (different random), one picked at random per step. */
export const STEP_VARIANTS = 4;

export const AUDIO = {
  /** Metres between footsteps while running. */
  stride: 2.2,
  /** Footsteps only above this fraction of run speed (Shift walk is silent, GAME.md 3). */
  stepMinMoveFraction: 0.55,
  /** Remote sounds: full volume until this distance, then 1/d falloff; silent beyond maxDistance. */
  refDistance: 4,
  maxDistance: 70,
  /** Sounds with a short range: full volume until `ref` metres, then a linear fade to silence at `max` (owner: 5-10 m). */
  hearing: { step: { ref: 3, max: 10 } },
  /** Second reload click, seconds before the reload ends. */
  reloadSecondClick: 0.35,
} as const;
