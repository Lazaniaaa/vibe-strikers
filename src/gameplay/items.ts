// Items on the ground (weapon drops, Cornucopia loot). Pure logic shared by the server and the offline simulation.
import { CORNUCOPIA, ITEMS, type LootKind } from '../config/items.ts';
import { MATCH } from '../config/rounds.ts';
import { WEAPON_STATS } from '../config/weapons.ts';
import type { WeaponId } from '../weapons/types.ts';
import type { Actor } from './actor.ts';
import { createSlot } from './weaponLogic.ts';

/** 'weapon' = a gun with its ammo (drop or loot); 'ammo' = pistol rounds; 'medkit'; 'boots' (Cornucopia). */
export type ItemKind = LootKind;

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
  if (it.kind === 'medkit') return `E: use MEDKIT (+${CORNUCOPIA.medkitHeal} HP)`;
  if (it.kind === 'boots') return 'E: put on ROCKET BOOTS (double jump)';
  if (it.kind === 'ammo') return `E: pick up PISTOL AMMO (+${it.reserve})`;
  return `E: pick up ${it.weapon.toUpperCase()} (${it.mag} / ${it.reserve})`;
}

/** An item as stored (server row or offline list). */
export interface ItemData extends ItemPos { kind: string; weapon: string; mag: number; reserve: number }

/** New loot item data with full ammo for weapons, a box of pistol rounds for ammo. */
export function lootAmmo(kind: string, weapon: string): { mag: number; reserve: number } {
  if (kind === 'weapon') { const s = WEAPON_STATS[weapon as WeaponId]; return { mag: s.magSize, reserve: s.reserve }; }
  if (kind === 'ammo') return { mag: 0, reserve: CORNUCOPIA.ammoAmount };
  return { mag: 0, reserve: 0 };
}

/**
 * E on an item. Returns false when it cannot be used now (full HP medkit, boots already on, healing already).
 * `drop` receives the weapon the actor had to give up (weapon swap), if any.
 */
export function useItem(a: Actor, it: ItemData, drop: (w: WeaponState) => void): boolean {
  switch (it.kind) {
    case 'weapon': {
      const had = a.hasPrimary;
      const old = swapPrimary(a, { weapon: it.weapon as WeaponId, mag: it.mag, reserve: it.reserve });
      a.hasPrimary = true;
      if (had) drop(old);
      return true;
    }
    case 'ammo': a.slots[1].reserve += it.reserve; return true;
    case 'medkit':
      if (a.hp >= MATCH.maxHealth || a.healLeft > 0) return false;
      a.healLeft = CORNUCOPIA.medkitTime; return true;
    case 'boots':
      if (a.boots) return false;
      a.boots = true; a.airJumpsLeft = CORNUCOPIA.bootsAirJumps; return true;
    default: return false;
  }
}

/** Medkit healing over time. Returns the HP gained this step. */
export function tickHeal(a: Actor, dt: number): number {
  if (a.healLeft <= 0 || !a.alive) { a.healLeft = 0; return 0; }
  const t = Math.min(dt, a.healLeft);
  a.healLeft -= t;
  const gain = Math.min(MATCH.maxHealth - a.hp, (CORNUCOPIA.medkitHeal / CORNUCOPIA.medkitTime) * t);
  a.hp += gain;
  return gain;
}

/** Cornucopia start: knife + pistol with one magazine, no primary, pistol drawn, no boots. */
export function cornucopiaLoadout(a: Actor): void {
  a.hasPrimary = false; a.boots = false; a.airJumpsLeft = 0; a.healLeft = 0;
  a.slots[1].mag = CORNUCOPIA.pistolMag; a.slots[1].reserve = CORNUCOPIA.pistolReserve;
  a.active = 1;
}

/** Cornucopia pedestals as solid boxes (same boxes for the client KCC, the server validation and the bot nav). */
export function pedestalBoxes(spots: readonly ItemPos[]): { x: number; y: number; z: number; w: number; h: number; d: number }[] {
  const s = ITEMS.pedestalSize, h = ITEMS.pedestalHeight;
  return spots.map((p) => ({ x: p.x, y: p.y + h / 2, z: p.z, w: s, h, d: s }));
}

/** Spawn points not blocked by a pedestal (some map spawns sit on loot spots); keeps all if every one is blocked. */
export function spawnsClearOf<T extends ItemPos>(spawns: readonly T[], boxes: readonly { x: number; y: number; z: number; w: number; h: number; d: number }[],
  margin = 0.5): T[] {
  const clear = spawns.filter((s) => boxes.every((b) => Math.abs(s.x - b.x) > b.w / 2 + margin || Math.abs(s.z - b.z) > b.d / 2 + margin));
  return clear.length ? clear : [...spawns];
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
