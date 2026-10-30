// Bot navigation: a 2D grid of walkable cells derived from mapColliders boxes, plus A*.
// Bots walk the lowest walkable surface only (no balconies) in M1.
import { NAV_GRID } from '../config/bots.ts';
import type { AabbBox } from './hitscan.ts';

export interface NavGrid {
  cols: number; rows: number; cell: number; minX: number; minZ: number;
  /** Ground height per cell; NaN = not walkable. */
  ground: Float32Array;
  // A* scratch (reused between searches, no per-search allocation).
  g: Float32Array; parent: Int32Array; visit: Uint32Array; closed: Uint32Array; heap: Int32Array; heapF: Float32Array;
  generation: number;
}

export function buildNavGrid(boxes: readonly AabbBox[], bounds: { x: number; z: number }): NavGrid {
  const cell = NAV_GRID.cell, r = NAV_GRID.agentRadius;
  const cols = Math.ceil((bounds.x * 2) / cell), rows = Math.ceil((bounds.z * 2) / cell);
  const minX = -bounds.x, minZ = -bounds.z, n = cols * rows;
  const ground = new Float32Array(n).fill(Number.NaN);
  const tops: number[] = [];
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const cx = minX + (ix + 0.5) * cell, cz = minZ + (iz + 0.5) * cell;
      tops.length = 0;
      for (const b of boxes) {
        const top = b.y + b.h / 2;
        if (top > NAV_GRID.maxSurfaceY) continue;
        if (Math.abs(cx - b.x) <= b.w / 2 && Math.abs(cz - b.z) <= b.d / 2) tops.push(top);
      }
      tops.sort((a, b) => a - b);
      for (const s of tops) {
        let clear = true;
        for (const b of boxes) {
          const bMin = b.y - b.h / 2, bMax = b.y + b.h / 2;
          if (bMax <= s + NAV_GRID.maxStep || bMin >= s + NAV_GRID.agentHeight) continue;
          if (Math.abs(cx - b.x) < b.w / 2 + r && Math.abs(cz - b.z) < b.d / 2 + r) { clear = false; break; }
        }
        if (clear) { ground[iz * cols + ix] = s; break; }
      }
    }
  }
  return { cols, rows, cell, minX, minZ, ground,
    g: new Float32Array(n), parent: new Int32Array(n), visit: new Uint32Array(n), closed: new Uint32Array(n),
    heap: new Int32Array(n * 8), heapF: new Float32Array(n * 8), generation: 0 };
}

export function cellIndex(grid: NavGrid, x: number, z: number): number {
  const ix = Math.floor((x - grid.minX) / grid.cell), iz = Math.floor((z - grid.minZ) / grid.cell);
  if (ix < 0 || iz < 0 || ix >= grid.cols || iz >= grid.rows) return -1;
  return iz * grid.cols + ix;
}

export function isWalkable(grid: NavGrid, index: number): boolean { return index >= 0 && !Number.isNaN(grid.ground[index]); }

export function cellX(grid: NavGrid, index: number): number { return grid.minX + ((index % grid.cols) + 0.5) * grid.cell; }
export function cellZ(grid: NavGrid, index: number): number { return grid.minZ + (Math.floor(index / grid.cols) + 0.5) * grid.cell; }

/** Nearest walkable cell to (x, z) within `maxRing` cells, or -1. */
export function nearestWalkable(grid: NavGrid, x: number, z: number, maxRing = 8): number {
  const ix = Math.floor((x - grid.minX) / grid.cell), iz = Math.floor((z - grid.minZ) / grid.cell);
  for (let ring = 0; ring <= maxRing; ring++) {
    let best = -1, bestD = Infinity;
    for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      const cx = ix + dx, cz = iz + dz;
      if (cx < 0 || cz < 0 || cx >= grid.cols || cz >= grid.rows) continue;
      const i = cz * grid.cols + cx;
      if (Number.isNaN(grid.ground[i])) continue;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) return best;
  }
  return -1;
}

const NX = [1, -1, 0, 0, 1, 1, -1, -1], NZ = [0, 0, 1, -1, 1, -1, 1, -1];
const NCOST = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

function canStep(grid: NavGrid, a: number, b: number): boolean {
  const ga = grid.ground[a], gb = grid.ground[b];
  return !Number.isNaN(gb) && Math.abs(ga - gb) <= NAV_GRID.maxStep;
}

/**
 * A* from cell `start` to cell `goal`. Writes the simplified path (cell indices, start excluded)
 * into `out` and returns its length (0 = no path or already there).
 */
export function findPath(grid: NavGrid, start: number, goal: number, out: number[]): number {
  out.length = 0;
  if (!isWalkable(grid, start) || !isWalkable(grid, goal) || start === goal) return 0;
  const gen = ++grid.generation;
  const { cols, g, parent, visit, closed, heap, heapF } = grid;
  const gx = goal % cols, gz = Math.floor(goal / cols);
  const h = (i: number) => { const dx = Math.abs((i % cols) - gx), dz = Math.abs(Math.floor(i / cols) - gz); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
  let size = 0;
  const push = (i: number, f: number) => {
    if (size >= heap.length) return;
    let k = size++;
    while (k > 0) { const p = (k - 1) >> 1; if (heapF[p] <= f) break; heap[k] = heap[p]; heapF[k] = heapF[p]; k = p; }
    heap[k] = i; heapF[k] = f;
  };
  const pop = () => {
    const top = heap[0]; const li = heap[--size], lf = heapF[size];
    let k = 0;
    for (;;) { let c = 2 * k + 1; if (c >= size) break; if (c + 1 < size && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= lf) break; heap[k] = heap[c]; heapF[k] = heapF[c]; k = c; }
    heap[k] = li; heapF[k] = lf;
    return top;
  };
  visit[start] = gen; g[start] = 0; parent[start] = -1; push(start, h(start));
  let found = false;
  while (size > 0) {
    const cur = pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === goal) { found = true; break; }
    const cx = cur % cols, cz = Math.floor(cur / cols);
    for (let k = 0; k < 8; k++) {
      const nx = cx + NX[k], nz = cz + NZ[k];
      if (nx < 0 || nz < 0 || nx >= cols || nz >= grid.rows) continue;
      const ni = nz * cols + nx;
      if (closed[ni] === gen || !canStep(grid, cur, ni)) continue;
      // No corner cutting on diagonals.
      if (k >= 4 && (!canStep(grid, cur, cz * cols + nx) || !canStep(grid, cur, nz * cols + cx))) continue;
      const ng = g[cur] + NCOST[k];
      if (visit[ni] !== gen || ng < g[ni]) { visit[ni] = gen; g[ni] = ng; parent[ni] = cur; push(ni, ng + h(ni)); }
    }
  }
  if (!found) return 0;
  // Walk back, keeping only cells where the direction changes.
  let cur = goal, prevDir = -999;
  while (cur !== start && cur >= 0) {
    const p = parent[cur];
    const dir = (cur - p);
    if (dir !== prevDir) out.push(cur);
    prevDir = dir;
    cur = p;
  }
  if (out[0] !== goal) out.unshift(goal);
  out.reverse();
  return out.length;
}

/** Marks every cell not connected to (x, z) as unwalkable (removes isolated roof/wall-top cells). */
export function pruneUnreachable(grid: NavGrid, x: number, z: number): void {
  const start = nearestWalkable(grid, x, z);
  if (start < 0) return;
  const { cols, rows } = grid, seen = new Uint8Array(cols * rows), stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % cols, cz = Math.floor(cur / cols);
    for (let k = 0; k < 4; k++) {
      const nx = cx + NX[k], nz = cz + NZ[k];
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
      const ni = nz * cols + nx;
      if (!seen[ni] && canStep(grid, cur, ni)) { seen[ni] = 1; stack.push(ni); }
    }
  }
  for (let i = 0; i < seen.length; i++) if (!seen[i]) grid.ground[i] = Number.NaN;
}
