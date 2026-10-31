// One place that builds the bot navigation for a map (offline game, server, tests).
import { BOT_TACTICS, NAV_GRID } from '../config/bots.ts';
import type { AabbBox } from './hitscan.ts';
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
  return { nav, upper, cover: coverPoints(nav, colliders), routes: routes.filter((r) => r.length > 0) };
}
