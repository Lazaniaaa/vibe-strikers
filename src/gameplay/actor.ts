// Simulation state of one player (local, bot, or later remote). Plain data, no three.js.
import { CAPSULE } from '../config/movement.ts';
import { MATCH } from '../config/rounds.ts';
import { LOADOUT, loadoutFor, WEAPON_STATS } from '../config/weapons.ts';
import type { WeaponId } from '../weapons/types.ts';
import { createSlot, type WeaponSlot } from './weaponLogic.ts';
import type { HitTarget } from './hitscan.ts';
import type { TeamId } from './round.ts';

/** What a client (or bot) wants this step. The simulation decides what actually happens. */
export interface PlayerIntent {
  /** -1..1 along view yaw. */
  forward: number;
  /** -1..1, positive = right. */
  right: number;
  /** Absolute look angles, radians. */
  yaw: number;
  pitch: number;
  jump: boolean;
  crouch: boolean;
  walk: boolean;
  fire: boolean;
  reload: boolean;
  /** Aiming down sights (ADS): sniper accuracy. */
  aim: boolean;
  /** Pick up / use the nearest item (one per key press). */
  use: boolean;
  /** Weapon slot to switch to, -1 = keep. */
  slot: number;
}

export function createIntent(): PlayerIntent {
  return { forward: 0, right: 0, yaw: 0, pitch: 0, jump: false, crouch: false, walk: false, fire: false, reload: false, aim: false, use: false, slot: -1 };
}

export interface Actor extends HitTarget {
  team: TeamId;
  name: string;
  isBot: boolean;
  /** Index into the `characters` list (visual only). */
  characterIndex: number;
  pitch: number;
  vx: number; vy: number; vz: number;
  grounded: boolean;
  /** Current (smoothed) eye height above the feet. */
  eyeHeight: number;
  hp: number;
  alive: boolean;
  slots: WeaponSlot[];
  active: number;
  /** Seconds left of the draw animation. */
  equipLeft: number;
  /** Seconds left of the fire kick animation. */
  fireAnimLeft: number;
  /** Semi-auto trigger latch and jump latch. */
  fireLatch: boolean;
  jumpLatch: boolean;
  kills: number;
  deaths: number;
  /** Horizontal speed / run speed, 0..1 (animation and spread). */
  moveFraction: number;
  /** Movement direction relative to facing (+X right, +Z back), for poseCharacter. */
  moveLocalX: number;
  moveLocalZ: number;
  /** Seconds since this actor last took damage. */
  sinceDamage: number;
  /** id of the actor that hit this one last, -1 = none. */
  lastAttacker: number;
  /** Cornucopia: false until a primary is picked up (slot 0 cannot be drawn). */
  hasPrimary: boolean;
  /** Cornucopia: rocket boots (extra jumps in the air) and air jumps left until landing. */
  boots: boolean;
  airJumpsLeft: number;
  /** Seconds since the last boost (glow box). */
  sinceBoost: number;
  /** Medkit healing: seconds left. */
  healLeft: number;
  intent: PlayerIntent;
}

/** Replace slot 0 (primary) if it is a different weapon. Returns true when it changed. */
export function setPrimary(a: Actor, primary: WeaponId): boolean {
  const want = loadoutFor(primary)[0];
  if (a.slots[0].stats.id === want) return false;
  a.slots[0] = createSlot(WEAPON_STATS[want]);
  return true;
}

export function createActor(id: number, team: TeamId, name: string, isBot: boolean, characterIndex: number,
  primary: WeaponId = LOADOUT.defaultPrimary): Actor {
  return {
    id, team, name, isBot, characterIndex, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, crouching: false,
    vx: 0, vy: 0, vz: 0, grounded: false, eyeHeight: CAPSULE.eyeHeight, hp: MATCH.maxHealth, alive: true,
    slots: loadoutFor(primary).map((w) => createSlot(WEAPON_STATS[w])), active: 0, equipLeft: 0, fireAnimLeft: 0,
    fireLatch: false, jumpLatch: false, kills: 0, deaths: 0, moveFraction: 0, moveLocalX: 0, moveLocalZ: -1,
    sinceDamage: 99, lastAttacker: -1, hasPrimary: true, boots: false, airJumpsLeft: 0, sinceBoost: 99, healLeft: 0, intent: createIntent(),
  };
}

/** Animation fields (moveFraction, moveLocalX/Z) from a horizontal velocity, e.g. for remote players. */
export function setMotionFromVelocity(a: Actor, vx: number, vz: number, runSpeed: number): void {
  const hs = Math.hypot(vx, vz);
  a.vx = vx; a.vz = vz;
  a.moveFraction = Math.min(1, hs / runSpeed);
  if (hs > 0.05) {
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    a.moveLocalX = (vx * -fz + vz * fx) / hs;
    a.moveLocalZ = -(vx * fx + vz * fz) / hs;
  } else { a.moveLocalX = 0; a.moveLocalZ = -1; }
}
