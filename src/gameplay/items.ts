// Items on the ground (weapon drops, Cornucopia loot). Pure logic shared by the server and the offline simulation.
import { ITEMS } from '../config/items.ts';
import { WEAPON_STATS } from '../config/weapons.ts';
import type { WeaponId } from '../weapons/types.ts';
import type { Actor } from './actor.ts';
import { createSlot } from './weaponLogic.ts';

/** 'weapon' = a gun with its ammo (drop or loot). */
export type ItemKind = 'weapon';

export interface ItemPos { x: number; y: number; z: number }

/** A weapon with the ammo it carries. */
export interface WeaponState { weapon: WeaponId; mag: number; reserve: number }

/** Index of the nearest item within pick-up range of the feet at (x, y, z), or -1. `slack` widens the range (server). */
export function nearestItem(items: readonly ItemPos[], x: number, y: number, z: number, slack = 0): number {
  let best = -1, bestD: number = ITEMS.pickupRadius + slack;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (Math.abs(it.y - y) > ITEMS.pickupMaxDy + slack) continue;
    const d = Math.hypot(it.x - x, it.z - z);
    if (d <= bestD) { best = i; bestD = d; }
  }
  return best;
}

/** The nearest item in pick-up range from any collection (Map values, arrays), or null. */
export function nearestOf<T extends ItemPos>(items: Iterable<T>, x: number, y: number, z: number): T | null {
  let best: T | null = null, bestD: number = ITEMS.pickupRadius;
  for (const it of items) {
    if (Math.abs(it.y - y) > ITEMS.pickupMaxDy) continue;
    const d = Math.hypot(it.x - x, it.z - z);
    if (d <= bestD) { best = it; bestD = d; }
  }
  return best;
}

/** HUD hint for an item. */
export function itemHint(it: { kind: string; weapon: string; mag: number; reserve: number }): string {
  return `E: pick up ${it.weapon.toUpperCase()} (${it.mag} / ${it.reserve})`;
}

/** True when the item is within pick-up range of the feet (server check, with slack). */
export function inPickupRange(it: ItemPos, x: number, y: number, z: number, slack = 0): boolean {
  return Math.abs(it.y - y) <= ITEMS.pickupMaxDy + slack && Math.hypot(it.x - x, it.z - z) <= ITEMS.pickupRadius + slack;
}

/** The primary (slot 0) with its current ammo. */
export function primaryState(a: Actor): WeaponState {
  const s = a.slots[0];
  return { weapon: s.stats.id, mag: s.mag, reserve: s.reserve };
}

/**
 * Put a picked-up weapon into the primary slot and draw it. Returns the weapon it replaced (to drop).
 */
export function swapPrimary(a: Actor, w: WeaponState): WeaponState {
  const old = primaryState(a);
  a.slots[a.active].reloadLeft = 0;
  const slot = createSlot(WEAPON_STATS[w.weapon]);
  slot.mag = Math.min(w.mag, slot.stats.magSize); slot.reserve = w.reserve;
  a.slots[0] = slot;
  a.active = 0;
  a.equipLeft = slot.stats.equipTime;
  a.fireLatch = false;
  return old;
}
