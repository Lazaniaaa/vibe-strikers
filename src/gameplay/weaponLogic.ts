// Weapon state machine: cooldown, magazine, reload, bloom, recoil pattern. Pure; server reuses it.
import type { RecoilKick, WeaponStats } from '../config/weapons.ts';

export interface WeaponSlot {
  stats: WeaponStats;
  mag: number;
  reserve: number;
  /** Seconds until the next shot is allowed (can go negative to carry time between frames). */
  cooldown: number;
  /** Seconds of reload left; 0 = not reloading. */
  reloadLeft: number;
  /** Current extra spread from sustained fire, degrees. */
  bloomDeg: number;
  /** Shots in the current spray (indexes the recoil pattern). */
  sprayIndex: number;
  /** Seconds since the last shot. */
  sinceShot: number;
}

export function createSlot(stats: WeaponStats): WeaponSlot {
  return { stats, mag: stats.magSize, reserve: stats.reserve, cooldown: 0, reloadLeft: 0, bloomDeg: 0, sprayIndex: 0, sinceShot: 99 };
}

export function resetSlot(slot: WeaponSlot): void {
  slot.mag = slot.stats.magSize; slot.reserve = slot.stats.reserve; slot.cooldown = 0; slot.reloadLeft = 0;
  slot.bloomDeg = 0; slot.sprayIndex = 0; slot.sinceShot = 99;
}

export function isReloading(slot: WeaponSlot): boolean { return slot.reloadLeft > 0; }

/** Reload progress 0..1, or null when not reloading. */
export function reloadProgress(slot: WeaponSlot): number | null {
  if (slot.reloadLeft <= 0) return null;
  return 1 - slot.reloadLeft / slot.stats.reloadTime;
}

export function startReload(slot: WeaponSlot): boolean {
  const s = slot.stats;
  if (s.magSize === 0 || slot.reloadLeft > 0 || slot.mag >= s.magSize || slot.reserve <= 0) return false;
  slot.reloadLeft = s.reloadTime;
  return true;
}

export function cancelReload(slot: WeaponSlot): void { slot.reloadLeft = 0; }

/** Advance timers. Call every simulation step for the active slot. */
export function tickSlot(slot: WeaponSlot, dt: number): void {
  const s = slot.stats;
  if (slot.cooldown > 0) slot.cooldown -= dt;
  else if (slot.cooldown < 0) slot.cooldown = 0;
  slot.sinceShot += dt;
  if (slot.sinceShot >= s.recoverTime) { slot.bloomDeg = 0; slot.sprayIndex = 0; }
  else slot.bloomDeg = Math.max(0, slot.bloomDeg - (s.maxBloomDeg / s.recoverTime) * dt);
  if (slot.reloadLeft > 0) {
    slot.reloadLeft -= dt;
    if (slot.reloadLeft <= 0) {
      if (s.reloadPerShell) {
        slot.mag += 1; slot.reserve -= 1;
        slot.reloadLeft = slot.mag < s.magSize && slot.reserve > 0 ? s.reloadTime : 0;
      } else {
        const take = Math.min(s.magSize - slot.mag, slot.reserve);
        slot.mag += take; slot.reserve -= take; slot.reloadLeft = 0;
      }
    }
  }
}

/** True when a shot may be fired this step. Per-shell reload is interrupted by firing (shotgun). */
export function canFire(slot: WeaponSlot): boolean {
  if (slot.cooldown > 0) return false;
  if (slot.stats.magSize === 0) return true;
  if (slot.mag <= 0) return false;
  return slot.reloadLeft <= 0 || slot.stats.reloadPerShell;
}

/** Spend one shot. Returns the recoil kick for this shot (pattern entry, not jittered). */
export function consumeShot(slot: WeaponSlot): RecoilKick {
  const s = slot.stats;
  if (s.magSize > 0) slot.mag -= 1;
  if (s.reloadPerShell) slot.reloadLeft = 0;
  // Keep the remainder so fire rate is exact at low frame rates.
  slot.cooldown += s.fireInterval;
  const kick = s.recoilPattern[Math.min(slot.sprayIndex, s.recoilPattern.length - 1)];
  slot.sprayIndex += 1;
  slot.bloomDeg = Math.min(s.maxBloomDeg, slot.bloomDeg + s.bloomPerShotDeg);
  slot.sinceShot = 0;
  return kick;
}

/**
 * Current spread half-angle, degrees. `moveFraction` = horizontal speed / run speed (0..1).
 * `scoped` = fully aimed (ADS); weapons with adsSpreadDeg (sniper) are accurate only then.
 */
export function spreadDeg(slot: WeaponSlot, moveFraction: number, airborne: boolean, scoped = false): number {
  const s = slot.stats;
  const base = scoped && s.adsSpreadDeg !== undefined ? s.adsSpreadDeg : s.spreadDeg;
  return base + slot.bloomDeg + s.moveSpreadDeg * Math.min(1, Math.max(0, moveFraction)) + (airborne ? s.airSpreadDeg : 0);
}

/** Damage for one bullet at a distance (falloff only where configured, e.g. shotgun). */
export function damageAt(stats: WeaponStats, distance: number): number {
  if (distance <= stats.falloffStart) return stats.damage;
  const span = Math.max(1e-6, stats.range - stats.falloffStart);
  const f = Math.min(1, (distance - stats.falloffStart) / span);
  return stats.damage * (1 - f * (1 - stats.falloffMinScale));
}

/** Bolt / pump animation progress 0..1 after a shot (null when idle or not a cycling weapon). */
export function cycleProgress(slot: WeaponSlot): number | null {
  if (!slot.stats.cycles || slot.cooldown <= 0) return null;
  return Math.min(1, Math.max(0, 1 - slot.cooldown / slot.stats.fireInterval));
}
