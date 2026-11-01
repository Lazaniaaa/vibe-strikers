// Settings store (localStorage). The panel UI is in settingsPanel.ts.
import { SETTINGS_DEFAULTS, SETTINGS_LIMITS, type AdsMode } from '../config/settings.ts';

export interface Settings {
  sensitivity: number;
  fov: number;
  volume: number;
  crosshairColor: string;
  crosshairSize: number;
  adsMode: AdsMode;
  musicVolume: number;
  secondPersonMode: AdsMode;
}

const KEY = 'voxel-settings';
const clamp = (v: unknown, lim: { min: number; max: number }, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(lim.max, Math.max(lim.min, v)) : d;

function load(): Settings {
  let raw: Partial<Settings> = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>; } catch { /* blocked or bad JSON */ }
  const d = SETTINGS_DEFAULTS;
  return {
    sensitivity: clamp(raw.sensitivity, SETTINGS_LIMITS.sensitivity, d.sensitivity),
    fov: clamp(raw.fov, SETTINGS_LIMITS.fov, d.fov),
    volume: clamp(raw.volume, SETTINGS_LIMITS.volume, d.volume),
    musicVolume: clamp(raw.musicVolume, SETTINGS_LIMITS.musicVolume, d.musicVolume),
    crosshairColor: typeof raw.crosshairColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.crosshairColor) ? raw.crosshairColor : d.crosshairColor,
    crosshairSize: clamp(raw.crosshairSize, SETTINGS_LIMITS.crosshairSize, d.crosshairSize),
    adsMode: raw.adsMode === 'hold' ? 'hold' : 'toggle',
    secondPersonMode: raw.secondPersonMode === 'hold' ? 'hold' : 'toggle',
  };
}

/** The live settings object (mutated in place by the panel). */
export const settings: Settings = load();

const listeners: (() => void)[] = [];
export function onSettingsChange(fn: () => void): void { listeners.push(fn); }

export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
  for (const fn of listeners) fn();
}
