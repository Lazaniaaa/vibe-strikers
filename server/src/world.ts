// Module-level caches: map data, nav grid and bot brains. Built once per module instance
// (the probe showed module globals survive between reducer calls; a rebuild after a restart is safe).
import { loadMapData, mapColliders, mapShotBlockers, spawnPoints, type SpawnPoint } from '../../src/maps/index.ts';
import { MAP_ID } from '../../src/config/game.ts';
import { createActor, type Actor } from '../../src/gameplay/actor.ts';
import { createBrain, type BotBrain } from '../../src/gameplay/botBrain.ts';
import type { AabbBox } from '../../src/gameplay/hitscan.ts';
import type { Vec3 } from '../../src/gameplay/math.ts';
import { ClientValidatedMovement, type MovementAuthority } from '../../src/gameplay/movementCheck.ts';
import type { NavGrid } from '../../src/gameplay/navGrid.ts';
import { buildMapNav, type Perch } from '../../src/gameplay/mapNav.ts';
import { pedestalBoxes, spawnsClearOf } from '../../src/gameplay/items.ts';
import type { TeamId } from '../../src/gameplay/round.ts';
import { PoseHistory } from '../../src/gameplay/rewind.ts';
import { NET } from '../../src/config/net.ts';

export interface World {
  mapId: string;
  colliders: readonly AabbBox[];
  blockers: readonly AabbBox[];
  spawns: Record<TeamId, readonly SpawnPoint[]>;
  /** Free-for-all spawns. */
  ffaSpawns: readonly SpawnPoint[];
  /** Cornucopia loot spots (map data). */
  lootSpots: readonly { x: number; y: number; z: number; tier: 'low' | 'mid' | 'high' }[];
  /** Roam goals; balcony points are added when the nav grid is built. */
  goals: Vec3[];
  killY: number;
  movement: MovementAuthority;
  /** Bot cover spots and route goals (filled with the nav grid). */
  cover: Vec3[];
  routes: Vec3[][];
  /** Sniper spots (balconies, long sight lines). */
  perches: Perch[];
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
      ffaSpawns: spawnPoints(map, 'ffa'), lootSpots: map.lootSpots,
      goals: [...map.zones.map((z) => ({ x: z.x, y: 0, z: z.z })), ...spawnsA, ...spawnsB],
      killY: map.killY, movement: new ClientValidatedMovement(colliders, map.bounds, map.killY), nav: null, cover: [], routes: [], perches: [],
    };
  }
  return world;
}

/** Nav grid (~0.8 s to build once in the module): call when a room is created, not inside a busy tick. */
export function getNav(): NavGrid {
  const w = getWorld();
  if (!w.nav) {
    const map = loadMapData(w.mapId);
    const { nav, upper, cover, routes, perches } = buildMapNav(w.colliders, map.bounds, map.boxes.filter((b) => b.kind === 'stair'), w.spawns.A[0], map.zones);
    w.goals.push(...upper);
    w.perches = perches;
    w.cover = cover; w.routes = routes;
    w.nav = nav;
  }
  return w.nav;
}

/** Solid world for one room: map boxes (+ Cornucopia pedestals), its movement validation and its bot nav grid. */
export interface Terrain { colliders: readonly AabbBox[]; movement: MovementAuthority; nav: NavGrid;
  /** Spawn points not blocked by pedestals. */
  spawns: Record<TeamId, readonly SpawnPoint[]>; ffaSpawns: readonly SpawnPoint[] }

let cornTerrain: Terrain | null = null;

/** Elimination: the map. Cornucopia: the map + pedestal boxes (built once, ~0.1-0.8 s; call at room creation). */
export function terrainFor(cornucopia: boolean): Terrain {
  const w = getWorld(), nav = getNav();
  if (!cornucopia) return { colliders: w.colliders, movement: w.movement, nav, spawns: w.spawns, ffaSpawns: w.ffaSpawns };
  if (!cornTerrain) {
    const map = loadMapData(w.mapId);
    const peds = pedestalBoxes(map.lootSpots);
    const colliders = [...w.colliders, ...peds];
    const built = buildMapNav(colliders, map.bounds, map.boxes.filter((b) => b.kind === 'stair'), w.spawns.A[0], map.zones);
    cornTerrain = { colliders, movement: new ClientValidatedMovement(colliders, map.bounds, map.killY), nav: built.nav,
      spawns: { A: spawnsClearOf(w.spawns.A, peds), B: spawnsClearOf(w.spawns.B, peds) }, ffaSpawns: spawnsClearOf(w.ffaSpawns, peds) };
  }
  return cornTerrain;
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

/** Recent hit-volume poses per player (lag compensation). */
const histories = new Map<number, PoseHistory>();

export function historyFor(id: number): PoseHistory {
  let h = histories.get(id);
  if (!h) { h = new PoseHistory(NET.rewindHistory); histories.set(id, h); }
  return h;
}

export function forgetActor(id: number): void { actors.delete(id); brains.delete(id); histories.delete(id); }
