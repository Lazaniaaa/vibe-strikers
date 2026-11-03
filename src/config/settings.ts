// Player settings: defaults and limits (GAME.md 10). Saved in the browser by src/ui/settings.ts.
import { MOUSE } from './input.ts';

export type AdsMode = 'toggle' | 'hold';

export const SETTINGS_DEFAULTS = {
  /** Radians per pixel. */
  sensitivity: MOUSE.sensitivity,
  /** Horizontal-ish world FOV in degrees (GAME.md 10: default 90, 70-110). */
  fov: 90,
  /** 0..1 */
  volume: 0.7,
  /** Music volume 0..1 (GAME.md 12: subtle, default low). */
  musicVolume: 0.25,
  crosshairColor: '#ffffff',
  /** Crosshair line length, px. */
  crosshairSize: 8,
  /** Owner 2026-10-31: right mouse button toggles ADS by default. */
  adsMode: 'toggle' as AdsMode,
  /** GAME.md 5: second-person view (V) is a toggle by default. */
  secondPersonMode: 'toggle' as AdsMode,
  /** Camera shake when the local player is hit (2026-11-01 audit). */
  screenShake: 'on' as OnOff,
  /** Opt-in until the target laptop sustains 60 FPS with AO. */
  ambientOcclusion: 'off' as OnOff,
};

export type OnOff = 'on' | 'off';

export const SETTINGS_LIMITS = {
  sensitivity: { min: 0.0005, max: 0.006, step: 0.0001 },
  fov: { min: 70, max: 110, step: 1 },
  volume: { min: 0, max: 1, step: 0.05 },
  musicVolume: { min: 0, max: 1, step: 0.05 },
  crosshairSize: { min: 4, max: 20, step: 1 },
} as const;

/** ADS blend speed (full aim in 1 / blendSpeed seconds). */
export const ADS = { blendSpeed: 5.5 } as const;

/** Second-person view (GAME.md 5): camera in front of the player looking back at the own character. */
export const SECOND_PERSON = {
  distance: 2.5,
  /** Kept this far in front of a wall the ray hits. */
  wallMargin: 0.25,
  minDistance: 0.6,
} as const;
