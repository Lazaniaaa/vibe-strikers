// One place that builds the bot navigation for a map (offline game, server, tests).
import { BOT_ROLES, BOT_TACTICS, NAV_GRID } from '../config/bots.ts';
import { rayBlockers, type AabbBox } from './hitscan.ts';
import type { Vec3 } from './math.ts';
import { buildNavGrid, nodeX, nodeY, nodeZ, pruneUnreachable, upperAreas, type NavGrid } from './navGrid.ts';

export interface MapNav {
  nav: NavGrid;
  /** Balconies / raised walkways reachable from the ground (one point each): extra roam goals for bots. */
  upper: Vec3[];
  /** Walkable spots next to something tall enough to hide behind (bots pick the side the enemy cannot see). */
  cover: Vec3[];
  /** Three route lists (north, middle, south): zone centres and upper areas, so bots spread over the map. */
  routes: Vec3[][];
  /** Sniper spots: balconies (yaw NaN = face the enemy spawn) and sheltered spots with a long clear view along `yaw`. */
  perches: Perch[];
}

export interface Perch extends Vec3 { yaw: number; sight: number }

/** Cover points with the longest clear view (eye height, 8 directions), spaced apart. */
function sightSpots(cover: readonly Vec3[], colliders: readonly AabbBox[]): Perch[] {
  const cand: Perch[] = [], o = { x: 0, y: 0, z: 0 }, d = { x: 0, y: 0, z: 0 };
  for (const c of cover) {
    o.x = c.x; o.y = c.y + 1.6; o.z = c.z;
    let best = 0, yaw = 0;
    for (const [dx, dz] of DIRS) {
      d.x = dx; d.z = dz;
      const len = rayBlockers(o, d, BOT_ROLES.sniperSightMax, colliders);
      if (len > best) { best = len; yaw = Math.atan2(-dx, -dz); }
    }
    if (best >= BOT_ROLES.sniperMinSight) cand.push({ x: c.x, y: c.y, z: c.z, yaw, sight: best });
  }
  cand.sort((a, b) => b.sight - a.sight);
  const out: Perch[] = [];
  for (const p of cand) {
    if (out.length >= BOT_ROLES.sniperSpots) break;
    if (out.every((q) => Math.hypot(q.x - p.x, q.z - p.z) >= BOT_ROLES.sniperSpotSpacing)) out.push(p);
  }
  return out;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, 0.7071], [-0.7071, -0.7071]];

/** Every coverStride-th walkable node that has a tall box within coverDistance. */
function coverPoints(nav: NavGrid, colliders: readonly AabbBox[]): Vec3[] {
  const out: Vec3[] = [], L = nav.layers, stride = BOT_TACTICS.coverStride, d = BOT_TACTICS.coverDistance;
  for (let iz = 0; iz < nav.rows; iz += stride) for (let ix = 0; ix < nav.cols; ix += stride) {
    for (let k = 0; k < L; k++) {
      const node = (iz * nav.cols + ix) * L + k, s = nodeY(nav, node);
      if (Number.isNaN(s)) break;
      const x = nodeX(nav, node), z = nodeZ(nav, node), py = s + 1.0;
      const tall = DIRS.some(([dx, dz]) => colliders.some((b) => b.y + b.h / 2 >= s + BOT_TACTICS.coverMinHeight &&
        Math.abs(x + dx * d - b.x) <= b.w / 2 && Math.abs(py - b.y) <= b.h / 2 && Math.abs(z + dz * d - b.z) <= b.d / 2));
      if (tall) out.push({ x, y: s, z });
    }
  }
  return out;
}

/**
 * @param colliders mapColliders(map).boxes
 * @param stairs the map's stair boxes (map.boxes with kind 'stair')
 * @param spawn any spawn point: everything not connected to it is removed
 * @param zones map zones (route goals)
 */
export function buildMapNav(colliders: readonly AabbBox[], bounds: { x: number; z: number }, stairs: readonly AabbBox[],
  spawn: Vec3, zones: readonly { name: string; x: number; z: number }[] = []): MapNav {
  const nav = buildNavGrid(colliders, bounds, stairs);
  pruneUnreachable(nav, spawn.x, spawn.y, spawn.z);
  const upper = upperAreas(nav, NAV_GRID.upperMinHeight, NAV_GRID.upperMinNodes).map((a) => ({ x: a.x, y: a.y, z: a.z }));
  const routes: Vec3[][] = [[], [], []];
  const route = (z: number) => (z > BOT_TACTICS.routeSplitZ ? 0 : z < -BOT_TACTICS.routeSplitZ ? 2 : 1);
  for (const zone of zones) if (!zone.name.toLowerCase().includes('spawn')) routes[route(zone.z)].push({ x: zone.x, y: 0, z: zone.z });
  for (const u of upper) routes[route(u.z)].push(u);
  const cover = coverPoints(nav, colliders);
  const perches: Perch[] = [...upper.map((u) => ({ ...u, yaw: NaN, sight: 0 })), ...sightSpots(cover, colliders)];
  return { nav, upper, cover, routes: routes.filter((r) => r.length > 0), perches };
}
