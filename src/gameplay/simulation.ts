// Offline match simulation (M1): actors, movement, weapons, hits, bots and rounds.
// The structure mirrors the M2 server: intents in, state + events out.
import { HITBOXES } from '../config/hitboxes.ts';
import { CAPSULE } from '../config/movement.ts';
import { MATCH, ROUND_PRESETS, type RoundPreset } from '../config/rounds.ts';
import { M1_LOADOUT, WEAPON_STATS } from '../config/weapons.ts';
import type { HitPart } from '../config/hitboxes.ts';
import { createIntent, type Actor, type PlayerIntent } from './actor.ts';
import { createBrain, resetBrain, updateBot, type BotBrain, type BotWorld } from './botBrain.ts';
import { createShotResult, traceShot, type AabbBox } from './hitscan.ts';
import { clamp, DEG, directionFromAngles, spreadDirection, vec3, type Vec3 } from './math.ts';
import type { NavGrid } from './navGrid.ts';
import type { RapierMotor } from './rapierMotor.ts';
import { createRoundState, restartMatch, tickRound, type RoundEvent, type RoundState, type TeamId } from './round.ts';
import { canFire, cancelReload, consumeShot, createSlot, damageAt, resetSlot, spreadDeg, startReload, tickSlot } from './weaponLogic.ts';

export interface SpawnSpot { x: number; y: number; z: number; yaw: number }

export interface SimulationOptions {
  blockers: readonly AabbBox[];
  spawnsA: readonly SpawnSpot[];
  spawnsB: readonly SpawnSpot[];
  goals: readonly Vec3[];
  nav: NavGrid;
  motor: RapierMotor;
  killY: number;
  localName: string;
  botNames: readonly string[];
  /** Number of characters available (visual index range). */
  characterCount: number;
  random?: () => number;
  /** Override the freeze time (tests). */
  freezeTime?: number;
}

/** One bullet, for tracers, hit markers and sounds. */
export interface ShotEvent {
  shooterId: number;
  ox: number; oy: number; oz: number;
  /** End point (hit point or max range). */
  ex: number; ey: number; ez: number;
  hitKind: 'none' | 'world' | 'player';
  victimId: number;
  part: HitPart;
  damage: number;
  killed: boolean;
}

export interface KillEvent { killerId: number; victimId: number; headshot: boolean; weapon: string }

const MAX_SHOT_EVENTS = 128;
export const LOCAL_ID = 0;

export class Simulation {
  readonly actors: Actor[] = [];
  readonly round: RoundState;
  readonly preset: RoundPreset;
  readonly shots: ShotEvent[] = [];
  shotCount = 0;
  readonly kills: KillEvent[] = [];
  lastRoundEvent: RoundEvent = 'none';
  time = 0;
  private brains = new Map<number, BotBrain>();
  private opts: SimulationOptions;
  private botWorld: BotWorld;
  private random: () => number;
  private readonly origin = vec3();
  private readonly aimDir = vec3();
  private readonly shotDir = vec3();
  private readonly result = createShotResult();
  private shooter: Actor | null = null;
  private readonly skipTarget = (i: number): boolean => {
    const t = this.actors[i], s = this.shooter!;
    return t === s || !t.alive || (!MATCH.friendlyFire && t.team === s.team);
  };

  constructor(opts: SimulationOptions) {
    this.opts = opts;
    this.random = opts.random ?? Math.random;
    const base = ROUND_PRESETS[MATCH.preset];
    this.preset = opts.freezeTime === undefined ? base : { ...base, freezeTime: opts.freezeTime };
    this.round = createRoundState(this.preset);
    let id = 0;
    for (const team of ['A', 'B'] as const) {
      for (let i = 0; i < MATCH.teamSize; i++) {
        const isLocal = id === LOCAL_ID;
        const actor = this.createActor(id, team, isLocal ? opts.localName : opts.botNames[(id - 1) % opts.botNames.length], !isLocal,
          id % opts.characterCount);
        this.actors.push(actor);
        opts.motor.add(actor);
        if (!isLocal) this.brains.set(id, createBrain());
        id++;
      }
    }
    for (let i = 0; i < MAX_SHOT_EVENTS; i++) {
      this.shots.push({ shooterId: 0, ox: 0, oy: 0, oz: 0, ex: 0, ey: 0, ez: 0, hitKind: 'none', victimId: -1, part: 'body', damage: 0, killed: false });
    }
    this.botWorld = { actors: this.actors, blockers: opts.blockers, nav: opts.nav, goals: opts.goals, random: this.random };
    this.respawnAll();
  }

  private createActor(id: number, team: TeamId, name: string, isBot: boolean, characterIndex: number): Actor {
    return {
      id, team, name, isBot, characterIndex, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, crouching: false,
      vx: 0, vy: 0, vz: 0, grounded: false, eyeHeight: CAPSULE.eyeHeight, hp: MATCH.maxHealth, alive: true,
      slots: M1_LOADOUT.map((w) => createSlot(WEAPON_STATS[w])), active: 0, equipLeft: 0, fireAnimLeft: 0,
      fireLatch: false, jumpLatch: false, kills: 0, deaths: 0, moveFraction: 0, moveLocalX: 0, moveLocalZ: -1,
      sinceDamage: 99, lastAttacker: -1, intent: createIntent(),
    };
  }

  get local(): Actor { return this.actors[LOCAL_ID]; }

  private respawnAll(): void {
    let a = 0, b = 0;
    for (const actor of this.actors) {
      const list = actor.team === 'A' ? this.opts.spawnsA : this.opts.spawnsB;
      const spot = list[(actor.team === 'A' ? a++ : b++) % list.length];
      this.opts.motor.teleport(actor, spot.x, spot.y, spot.z);
      actor.yaw = spot.yaw; actor.pitch = 0; actor.intent.yaw = spot.yaw; actor.intent.pitch = 0;
      actor.hp = MATCH.maxHealth; actor.alive = true; actor.active = 0; actor.equipLeft = 0; actor.fireAnimLeft = 0;
      actor.sinceDamage = 99; actor.lastAttacker = -1;
      for (const s of actor.slots) resetSlot(s);
      const brain = this.brains.get(actor.id);
      if (brain) resetBrain(brain);
    }
  }

  /** Move an actor (debug tools and tests). */
  teleport(actorId: number, x: number, y: number, z: number, yaw: number): void {
    const a = this.actors[actorId];
    this.opts.motor.teleport(a, x, y, z);
    a.yaw = yaw; a.intent.yaw = yaw;
  }

  restart(): void {
    restartMatch(this.round, this.preset);
    for (const a of this.actors) { a.kills = 0; a.deaths = 0; }
    this.kills.length = 0;
    this.respawnAll();
  }

  /** Advance the match. `localIntent` is copied into the local actor. */
  update(dt: number, localIntent: PlayerIntent): void {
    this.time += dt;
    this.shotCount = 0;
    const local = this.local;
    Object.assign(local.intent, localIntent);

    let aliveA = 0, aliveB = 0, hpA = 0, hpB = 0;
    for (const a of this.actors) if (a.alive) { if (a.team === 'A') { aliveA++; hpA += a.hp; } else { aliveB++; hpB += a.hp; } }
    this.lastRoundEvent = tickRound(this.round, this.preset, dt, { aliveA, aliveB, hpA, hpB });
    if (this.lastRoundEvent === 'roundStart') this.respawnAll();

    const phase = this.round.phase;
    const frozen = phase === 'freeze';
    const combat = phase === 'live';
    for (const a of this.actors) {
      a.sinceDamage += dt;
      if (!a.alive) continue;
      if (a.isBot) {
        if (combat || phase === 'roundEnd') updateBot(a, this.brains.get(a.id)!, this.botWorld, dt);
        else { a.intent.forward = 0; a.intent.right = 0; a.intent.fire = false; a.intent.yaw = a.yaw; a.intent.pitch = a.pitch; }
      }
      const intent = a.intent;
      a.yaw = intent.yaw;
      a.pitch = clamp(intent.pitch, -89 * DEG, 89 * DEG);
      const slot = a.slots[a.active];
      this.opts.motor.step(a, intent, dt, frozen || phase === 'matchEnd', slot.stats.moveSpeedScale);
      if (a.y < this.opts.killY) this.kill(a, null, false);
      if (!a.alive) continue;
      this.updateWeapon(a, dt, combat);
    }
  }

  private updateWeapon(a: Actor, dt: number, combat: boolean): void {
    const intent = a.intent;
    if (intent.slot >= 0 && intent.slot < a.slots.length && intent.slot !== a.active) {
      cancelReload(a.slots[a.active]);
      a.active = intent.slot;
      a.equipLeft = a.slots[a.active].stats.equipTime;
      a.fireLatch = false;
    }
    const slot = a.slots[a.active];
    if (a.equipLeft > 0) a.equipLeft = Math.max(0, a.equipLeft - dt);
    if (a.fireAnimLeft > 0) a.fireAnimLeft = Math.max(0, a.fireAnimLeft - dt);
    tickSlot(slot, dt);
    if (intent.reload) startReload(slot);
    if (!intent.fire) a.fireLatch = false;
    if (!combat || !intent.fire || a.equipLeft > 0) return;
    if (slot.stats.magSize > 0 && slot.mag === 0) { startReload(slot); return; }
    // Several shots per step at low frame rates; semi-auto fires once per press.
    while (canFire(slot) && (slot.stats.automatic || !a.fireLatch)) {
      this.fire(a);
      a.fireLatch = true;
      if (!a.alive) break;
    }
  }

  private fire(a: Actor): void {
    const slot = a.slots[a.active], s = slot.stats;
    const spread = spreadDeg(slot, a.moveFraction, !a.grounded) * DEG;
    const kick = consumeShot(slot);
    a.fireAnimLeft = s.fireAnimTime;
    this.origin.x = a.x; this.origin.y = a.y + a.eyeHeight; this.origin.z = a.z;
    directionFromAngles(a.yaw, a.pitch, this.aimDir);
    this.shooter = a;
    for (let p = 0; p < s.pellets; p++) {
      spreadDirection(this.aimDir, spread, this.random(), this.random(), this.shotDir);
      const r = traceShot(this.origin, this.shotDir, s.range, this.opts.blockers, this.actors, this.skipTarget, this.result);
      const ev = this.shotCount < MAX_SHOT_EVENTS ? this.shots[this.shotCount++] : null;
      let damage = 0, killed = false, victimId = -1;
      if (r.kind === 'player') {
        const victim = this.actors[r.targetIndex];
        victimId = victim.id;
        damage = damageAt(s, r.distance) * (r.part === 'head' ? HITBOXES.headshotMultiplier : 1);
        victim.hp -= damage; victim.sinceDamage = 0; victim.lastAttacker = a.id;
        if (victim.hp <= 0) { this.kill(victim, a, r.part === 'head'); killed = true; }
      }
      if (ev) {
        ev.shooterId = a.id; ev.ox = this.origin.x; ev.oy = this.origin.y; ev.oz = this.origin.z;
        ev.ex = this.origin.x + this.shotDir.x * r.distance; ev.ey = this.origin.y + this.shotDir.y * r.distance;
        ev.ez = this.origin.z + this.shotDir.z * r.distance;
        ev.hitKind = r.kind; ev.victimId = victimId; ev.part = r.part; ev.damage = damage; ev.killed = killed;
      }
    }
    // Recoil moves the real aim (CS style); the client reads yaw/pitch back after the step.
    const jitter = (this.random() * 2 - 1) * s.recoilYawJitterDeg;
    a.pitch = clamp(a.pitch + kick.pitchDeg * DEG, -89 * DEG, 89 * DEG);
    a.yaw += (kick.yawDeg + jitter) * DEG;
    a.intent.pitch = a.pitch; a.intent.yaw = a.yaw;
  }

  private kill(victim: Actor, killer: Actor | null, headshot: boolean): void {
    if (!victim.alive) return;
    victim.alive = false; victim.hp = 0; victim.deaths++;
    victim.vx = 0; victim.vz = 0;
    if (killer) killer.kills++;
    this.kills.push({ killerId: killer ? killer.id : -1, victimId: victim.id, headshot, weapon: killer ? killer.slots[killer.active].stats.id : 'world' });
    if (this.kills.length > 8) this.kills.shift();
  }
}
