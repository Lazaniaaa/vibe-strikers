// Module-level caches: map data, nav grid and bot brains. Built once per module instance
// (the probe showed module globals survive between reducer calls; a rebuild after a restart is safe).
import { loadMapData, mapColliders, mapShotBlockers, spawnPoints, type SpawnPoint } from '../../src/maps/index.ts';
import { MAP_ID } from '../../src/config/game.ts';
import { createActor, type Actor } from '../../src/gameplay/actor.ts';
import { createBrain, type BotBrain } from '../../src/gameplay/botBrain.ts';
import type { AabbBox } from '../../src/gameplay/hitscan.ts';
import type { Vec3 } from '../../src/gameplay/math.ts';
import { ClientValidatedMovement, type MovementAuthority } from '../../src/gameplay/movementCheck.ts';
import { buildNavGrid, pruneUnreachable, type NavGrid } from '../../src/gameplay/navGrid.ts';
import type { TeamId } from '../../src/gameplay/round.ts';

export interface World {
  mapId: string;
  colliders: readonly AabbBox[];
  blockers: readonly AabbBox[];
  spawns: Record<TeamId, readonly SpawnPoint[]>;
  goals: readonly Vec3[];
  killY: number;
  movement: MovementAuthority;
  nav: NavGrid | null;
}

let world: World | null = null;

/** Map data and validation (cheap). */
export function getWorld(): World {
  if (!world) {
    const map = loadMapData(MAP_ID);
    const colliders = mapColliders(map).boxes;
    const spawnsA = spawnPoints(map, 'A'), spawnsB = spawnPoints(map, 'B');
    world = {
      mapId: MAP_ID, colliders, blockers: mapShotBlockers(map).boxes, spawns: { A: spawnsA, B: spawnsB },
      goals: [...map.zones.map((z) => ({ x: z.x, y: 0, z: z.z })), ...spawnsA, ...spawnsB],
      killY: map.killY, movement: new ClientValidatedMovement(colliders, map.bounds, map.killY), nav: null,
    };
  }
  return world;
}

/** Nav grid (~0.8 s to build once in the module): call when a room is created, not inside a busy tick. */
export function getNav(): NavGrid {
  const w = getWorld();
  if (!w.nav) {
    const map = loadMapData(w.mapId);
    const nav = buildNavGrid(w.colliders, map.bounds);
    pruneUnreachable(nav, w.spawns.A[0].x, w.spawns.A[0].z);
    w.nav = nav;
  }
  return w.nav;
}

/** Simulation objects per player row id (bots get a brain). Rows stay the source of truth. */
const actors = new Map<number, Actor>();
const brains = new Map<number, BotBrain>();

export function actorFor(id: number, team: TeamId, isBot: boolean): Actor {
  let a = actors.get(id);
  if (!a) {
    a = createActor(id, team, '', isBot, 0);
    actors.set(id, a);
    if (isBot) brains.set(id, createBrain());
  }
  return a;
}

export function brainFor(id: number): BotBrain {
  let b = brains.get(id);
  if (!b) { b = createBrain(); brains.set(id, b); }
  return b;
}

export function forgetActor(id: number): void { actors.delete(id); brains.delete(id); }
