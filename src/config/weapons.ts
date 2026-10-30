// Weapon gameplay numbers (GAME.md section 4). Visuals live in src/weapons/.
import type { WeaponId } from '../weapons';

export interface RecoilKick { pitchDeg: number; yawDeg: number }

export interface WeaponStats {
  id: WeaponId;
  /** Damage per bullet / pellet. */
  damage: number;
  pellets: number;
  /** Seconds between shots. */
  fireInterval: number;
  automatic: boolean;
  /** 0 = melee (no magazine). */
  magSize: number;
  /** Spare rounds at round start. */
  reserve: number;
  /** Full reload time, seconds (shotgun: per shell). */
  reloadTime: number;
  reloadPerShell: boolean;
  /** Base spread cone half-angle, degrees. */
  spreadDeg: number;
  /** Extra spread per shot while firing, degrees. */
  bloomPerShotDeg: number;
  maxBloomDeg: number;
  /** Extra spread at full run speed, degrees. */
  moveSpreadDeg: number;
  /** Extra spread while airborne, degrees. */
  airSpreadDeg: number;
  /** Bloom and recoil pattern fully reset after this long without firing, seconds. */
  recoverTime: number;
  range: number;
  /** Damage falloff (shotgun): full damage until falloffStart, then linear to falloffMinScale at range. */
  falloffStart: number;
  falloffMinScale: number;
  /** Camera kick per shot, in order; the last entry repeats. Random yaw jitter is added. */
  recoilPattern: readonly RecoilKick[];
  recoilYawJitterDeg: number;
  /** Visual-only view punch, degrees, recovers quickly. */
  viewPunchDeg: number;
  /** Seconds to draw the weapon after switching. */
  equipTime: number;
  /** Visual fire animation length (viewmodel / third person), seconds. */
  fireAnimTime: number;
  /** Move speed multiplier while holding this weapon. */
  moveSpeedScale: number;
}

const base = {
  pellets: 1, reserve: 0, reloadPerShell: false, bloomPerShotDeg: 0, maxBloomDeg: 0,
  moveSpreadDeg: 2.5, airSpreadDeg: 4, recoverTime: 0.3, range: 200, falloffStart: 1000,
  falloffMinScale: 1, recoilPattern: [{ pitchDeg: 0, yawDeg: 0 }], recoilYawJitterDeg: 0,
  viewPunchDeg: 0, equipTime: 0.45, fireAnimTime: 0.12, moveSpeedScale: 1,
} as const;

export const WEAPON_STATS: Readonly<Record<WeaponId, WeaponStats>> = {
  knife: { ...base, id: 'knife', damage: 40, fireInterval: 0.6, automatic: false, magSize: 0, reloadTime: 0,
    spreadDeg: 0, moveSpreadDeg: 0, airSpreadDeg: 0, range: 1.6, fireAnimTime: 0.3, equipTime: 0.3 },
  pistol: { ...base, id: 'pistol', damage: 30, fireInterval: 60 / 400, automatic: false, magSize: 12, reserve: 36,
    reloadTime: 1.6, spreadDeg: 0.4, bloomPerShotDeg: 0.6, maxBloomDeg: 2.5,
    recoilPattern: [{ pitchDeg: 1.2, yawDeg: 0 }], recoilYawJitterDeg: 0.3, viewPunchDeg: 1.5 },
  rifle: { ...base, id: 'rifle', damage: 27, fireInterval: 60 / 600, automatic: true, magSize: 30, reserve: 90,
    reloadTime: 2.2, spreadDeg: 0.5, bloomPerShotDeg: 0.25, maxBloomDeg: 3, moveSpreadDeg: 4,
    recoilPattern: [
      { pitchDeg: 0.6, yawDeg: 0 }, { pitchDeg: 0.8, yawDeg: 0.05 }, { pitchDeg: 0.9, yawDeg: 0.1 },
      { pitchDeg: 0.9, yawDeg: -0.1 }, { pitchDeg: 0.8, yawDeg: -0.25 }, { pitchDeg: 0.7, yawDeg: -0.3 },
      { pitchDeg: 0.5, yawDeg: 0.3 }, { pitchDeg: 0.4, yawDeg: 0.4 }, { pitchDeg: 0.3, yawDeg: -0.35 },
      { pitchDeg: 0.25, yawDeg: 0 },
    ],
    recoilYawJitterDeg: 0.2, viewPunchDeg: 0.8, fireAnimTime: 0.08 },
  sniper: { ...base, id: 'sniper', damage: 100, fireInterval: 1.4, automatic: false, magSize: 5, reserve: 15,
    reloadTime: 3.0, spreadDeg: 8, moveSpreadDeg: 6, recoilPattern: [{ pitchDeg: 3, yawDeg: 0 }], viewPunchDeg: 3,
    moveSpeedScale: 0.9 },
  shotgun: { ...base, id: 'shotgun', damage: 12, pellets: 8, fireInterval: 0.9, automatic: false, magSize: 6, reserve: 24,
    reloadTime: 0.5, reloadPerShell: true, spreadDeg: 6, moveSpreadDeg: 1, range: 40, falloffStart: 8, falloffMinScale: 0.3,
    recoilPattern: [{ pitchDeg: 2.5, yawDeg: 0 }], viewPunchDeg: 2.5 },
};

/** Weapons enabled per milestone. M1: pistol + rifle (knife/sniper/shotgun come in M3). */
export const M1_LOADOUT: readonly WeaponId[] = ['rifle', 'pistol'];
