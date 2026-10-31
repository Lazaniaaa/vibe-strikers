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
  crosshairColor: '#ffffff',
  /** Crosshair line length, px. */
  crosshairSize: 8,
  /** Owner 2026-10-31: right mouse button toggles ADS by default. */
  adsMode: 'toggle' as AdsMode,
};

export const SETTINGS_LIMITS = {
  sensitivity: { min: 0.0005, max: 0.006, step: 0.0001 },
  fov: { min: 70, max: 110, step: 1 },
  volume: { min: 0, max: 1, step: 0.05 },
  crosshairSize: { min: 4, max: 20, step: 1 },
} as const;

/** ADS blend speed (full aim in 1 / blendSpeed seconds). */
export const ADS = { blendSpeed: 5.5 } as const;
