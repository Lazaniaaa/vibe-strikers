// One place that builds the bot navigation for a map (offline game, server, tests).
import { NAV_GRID } from '../config/bots.ts';
import type { AabbBox } from './hitscan.ts';
import type { Vec3 } from './math.ts';
import { buildNavGrid, pruneUnreachable, upperAreas, type NavGrid } from './navGrid.ts';

export interface MapNav {
  nav: NavGrid;
  /** Balconies / raised walkways reachable from the ground (one point each): extra roam goals for bots. */
  upper: Vec3[];
}

/**
 * @param colliders mapColliders(map).boxes
 * @param stairs the map's stair boxes (map.boxes with kind 'stair')
 * @param spawn any spawn point: everything not connected to it is removed
 */
export function buildMapNav(colliders: readonly AabbBox[], bounds: { x: number; z: number }, stairs: readonly AabbBox[],
  spawn: Vec3): MapNav {
  const nav = buildNavGrid(colliders, bounds, stairs);
  pruneUnreachable(nav, spawn.x, spawn.y, spawn.z);
  const upper = upperAreas(nav, NAV_GRID.upperMinHeight, NAV_GRID.upperMinNodes).map((a) => ({ x: a.x, y: a.y, z: a.z }));
  return { nav, upper };
}
