// Bot navigation: a multi-level grid graph derived from mapColliders boxes, plus A*.
// Every grid cell can hold up to NAV_GRID.layers walkable surfaces (ground, stairs, balconies, walkways);
// a node is (cell, layer). Neighbouring nodes connect when the height difference is a step (<= maxStep).
// Built once per map; shared by offline bots and server bots.
import { NAV_GRID } from '../config/bots.ts';
import type { AabbBox } from './hitscan.ts';

export interface NavGrid {
  cols: number; rows: number; cell: number; minX: number; minZ: number;
  /** Surfaces per cell. Node index = cellIndex * layers + layer. */
  layers: number;
  /** Ground height per node; NaN = no surface. Layers of a cell are sorted bottom to top. */
  ground: Float32Array;
  /** 1 = the node's surface is a stair step (links to it may climb stairLinkStep). */
  stair: Uint8Array;
  // A* scratch (reused between searches, no per-search allocation).
  g: Float32Array; parent: Int32Array; visit: Uint32Array; closed: Uint32Array; heap: Int32Array; heapF: Float32Array;
  generation: number;
}

/** Cell centres on (or in a ~1 cm gap between) box edges count as inside (e.g. stair treads 0.448 m apart 0.45 m). */
const EPS = 0.01;

const key = (b: AabbBox) => `${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)},${b.w.toFixed(3)},${b.h.toFixed(3)},${b.d.toFixed(3)}`;

/**
 * @param steppable boxes that are made to be walked on (stairs): when they are only NEAR a cell (agent radius)
 *   and at most `stepAhead` above its surface, they do not block it, so a stair flight is a chain of nodes.
 */
export function buildNavGrid(boxes: readonly AabbBox[], bounds: { x: number; z: number }, steppable: readonly AabbBox[] = []): NavGrid {
  const cell = NAV_GRID.cell, r = NAV_GRID.agentRadius, L = NAV_GRID.layers;
  const cols = Math.ceil((bounds.x * 2) / cell), rows = Math.ceil((bounds.z * 2) / cell);
  const minX = -bounds.x, minZ = -bounds.z, cells = cols * rows, n = cells * L;
  const ground = new Float32Array(n).fill(Number.NaN), stair = new Uint8Array(n);
  const stairKeys = new Set(steppable.map(key));
  const isStep = boxes.map((b) => stairKeys.has(key(b)));
  // Bin boxes by cell column (inflated by the agent radius) so each cell only checks nearby boxes.
  const bins: number[][] = Array.from({ length: cells }, () => []);
  boxes.forEach((b, i) => {
    const x0 = Math.max(0, Math.floor((b.x - b.w / 2 - r - minX) / cell)), x1 = Math.min(cols - 1, Math.floor((b.x + b.w / 2 + r - minX) / cell));
    const z0 = Math.max(0, Math.floor((b.z - b.d / 2 - r - minZ) / cell)), z1 = Math.min(rows - 1, Math.floor((b.z + b.d / 2 + r - minZ) / cell));
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) bins[iz * cols + ix].push(i);
  });
  const tops: number[] = [], topIsStep: boolean[] = [], order: number[] = [];
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const c = iz * cols + ix, near = bins[c];
      const cx = minX + (ix + 0.5) * cell, cz = minZ + (iz + 0.5) * cell;
      tops.length = 0; topIsStep.length = 0; order.length = 0;
      for (const i of near) {
        const b = boxes[i], top = b.y + b.h / 2;
        if (top > NAV_GRID.maxSurfaceY) continue;
        if (Math.abs(cx - b.x) <= b.w / 2 + EPS && Math.abs(cz - b.z) <= b.d / 2 + EPS) { order.push(tops.length); tops.push(top); topIsStep.push(isStep[i]); }
      }
      order.sort((a, b) => tops[a] - tops[b]);
      let layer = 0;
      for (let t = 0; t < order.length && layer < L; t++) {
        const s = tops[order[t]];
        if (t > 0 && s - tops[order[t - 1]] < 1e-3) continue;
        let clear = true;
        for (const i of near) {
          const b = boxes[i], bMin = b.y - b.h / 2, bMax = b.y + b.h / 2;
          if (bMax <= s + NAV_GRID.maxStep || bMin >= s + NAV_GRID.agentHeight) continue;
          const over = Math.abs(cx - b.x) <= b.w / 2 + EPS && Math.abs(cz - b.z) <= b.d / 2 + EPS;
          if (!over && !(Math.abs(cx - b.x) < b.w / 2 + r && Math.abs(cz - b.z) < b.d / 2 + r)) continue;
          // On a stair, the next steps (up to stepAhead higher) are climbable, not obstacles. Beside a stair
          // (ground next to its side), only a single step counts as climbable: higher steps are a wall.
          if (!over && isStep[i] && topIsStep[order[t]] && bMax <= s + NAV_GRID.stepAhead) continue;
          clear = false; break;
        }
        if (!clear) continue;
        // Stacked boxes (a step on its support): surfaces less than a step apart are one surface, the top one.
        if (layer > 0 && s - ground[c * L + layer - 1] <= NAV_GRID.maxStep) layer--;
        stair[c * L + layer] = topIsStep[order[t]] ? 1 : 0; ground[c * L + layer++] = s;
      }
    }
  }
  return { cols, rows, cell, minX, minZ, layers: L, ground, stair,
    g: new Float32Array(n), parent: new Int32Array(n), visit: new Uint32Array(n), closed: new Uint32Array(n),
    heap: new Int32Array(n * 8), heapF: new Float32Array(n * 8), generation: 0 };
}

/** Grid cell under (x, z), -1 outside. */
export function cellIndex(grid: NavGrid, x: number, z: number): number {
  const ix = Math.floor((x - grid.minX) / grid.cell), iz = Math.floor((z - grid.minZ) / grid.cell);
  if (ix < 0 || iz < 0 || ix >= grid.cols || iz >= grid.rows) return -1;
  return iz * grid.cols + ix;
}

export function isWalkable(grid: NavGrid, node: number): boolean { return node >= 0 && !Number.isNaN(grid.ground[node]); }

export function nodeX(grid: NavGrid, node: number): number { return grid.minX + ((Math.floor(node / grid.layers) % grid.cols) + 0.5) * grid.cell; }
export function nodeZ(grid: NavGrid, node: number): number { return grid.minZ + (Math.floor(Math.floor(node / grid.layers) / grid.cols) + 0.5) * grid.cell; }
export function nodeY(grid: NavGrid, node: number): number { return grid.ground[node]; }

/** The surface of the cell under (x, z) closest to height y (within reach), NaN if none. */
export function groundAt(grid: NavGrid, x: number, y: number, z: number, reach: number = NAV_GRID.maxStep * 1.5): number {
  const c = cellIndex(grid, x, z);
  if (c < 0) return Number.NaN;
  let best = Number.NaN, bestD = reach;
  for (let k = 0; k < grid.layers; k++) {
    const g = grid.ground[c * grid.layers + k];
    if (Number.isNaN(g)) break;
    const d = Math.abs(g - y);
    if (d <= bestD) { bestD = d; best = g; }
  }
  return best;
}

/** Nearest walkable node to (x, y, z) within `maxRing` cells (vertical distance counts double). */
export function nearestWalkable(grid: NavGrid, x: number, y: number, z: number, maxRing = 8): number {
  const ix = Math.floor((x - grid.minX) / grid.cell), iz = Math.floor((z - grid.minZ) / grid.cell), L = grid.layers;
  let best = -1, bestD = Infinity;
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      const cx = ix + dx, cz = iz + dz;
      if (cx < 0 || cz < 0 || cx >= grid.cols || cz >= grid.rows) continue;
      const c = cz * grid.cols + cx;
      for (let k = 0; k < L; k++) {
        const g = grid.ground[c * L + k];
        if (Number.isNaN(g)) break;
        const d = Math.hypot(dx * grid.cell, dz * grid.cell) + Math.abs(g - y) * 2;
        if (d < bestD) { bestD = d; best = c * L + k; }
      }
    }
    // Rings further out cannot be closer than one more cell of horizontal distance.
    if (best >= 0 && bestD <= (ring + 1) * grid.cell) break;
  }
  return best;
}

const NX = [1, -1, 0, 0, 1, 1, -1, -1], NZ = [0, 0, 1, -1, 1, -1, 1, -1];
const NCOST = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

/** Layer of cell `c` reachable from height h (one step; more on stairs), -1 if none. */
function stepLayer(grid: NavGrid, c: number, h: number, fromStair = false): number {
  const L = grid.layers;
  let best = -1, bestD = Infinity;
  for (let k = 0; k < L; k++) {
    const g = grid.ground[c * L + k];
    if (Number.isNaN(g)) break;
    const d = Math.abs(g - h);
    const limit = fromStair && grid.stair[c * L + k] ? NAV_GRID.stairLinkStep : NAV_GRID.maxStep;
    if (d <= limit + 1e-6 && d < bestD) { bestD = d; best = k; }
  }
  return best;
}

/**
 * A* from node `start` to node `goal`. Writes the simplified path (node indices, start excluded) into `out`
 * and returns its length (0 = no path or already there).
 */
export function findPath(grid: NavGrid, start: number, goal: number, out: number[]): number {
  out.length = 0;
  if (!isWalkable(grid, start) || !isWalkable(grid, goal) || start === goal) return 0;
  const gen = ++grid.generation;
  const { cols, rows, layers: L, g, parent, visit, closed, heap, heapF } = grid;
  const goalCell = Math.floor(goal / L), gx = goalCell % cols, gz = Math.floor(goalCell / cols), gy = grid.ground[goal];
  const h = (node: number) => {
    const c = Math.floor(node / L), dx = Math.abs((c % cols) - gx), dz = Math.abs(Math.floor(c / cols) - gz);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz) + Math.abs(grid.ground[node] - gy) / grid.cell;
  };
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
    const cc = Math.floor(cur / L), cx = cc % cols, cz = Math.floor(cc / cols), ch = grid.ground[cur], cs = grid.stair[cur] === 1;
    for (let k = 0; k < 8; k++) {
      const nx = cx + NX[k], nz = cz + NZ[k];
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
      const nl = stepLayer(grid, nz * cols + nx, ch, cs);
      if (nl < 0) continue;
      const ni = (nz * cols + nx) * L + nl;
      if (closed[ni] === gen) continue;
      // No corner cutting on diagonals.
      if (k >= 4 && (stepLayer(grid, cz * cols + nx, ch, cs) < 0 || stepLayer(grid, nz * cols + cx, ch, cs) < 0)) continue;
      const ng = g[cur] + NCOST[k] + Math.abs(grid.ground[ni] - ch) / grid.cell;
      if (visit[ni] !== gen || ng < g[ni]) { visit[ni] = gen; g[ni] = ng; parent[ni] = cur; push(ni, ng + h(ni)); }
    }
  }
  if (!found) return 0;
  // Walk back, keeping only nodes where the direction (in x, z, or height change) changes.
  let cur = goal, prevDir = Number.NaN;
  while (cur !== start && cur >= 0) {
    const p = parent[cur];
    const dir = (Math.floor(cur / L) - Math.floor(p / L)) * 1000 + Math.sign(Math.round((grid.ground[cur] - grid.ground[p]) * 100));
    if (dir !== prevDir) out.push(cur);
    prevDir = dir;
    cur = p;
  }
  out.reverse();
  return out.length;
}

/** Marks every node not connected to (x, y, z) as unwalkable (removes isolated roofs / wall tops). */
export function pruneUnreachable(grid: NavGrid, x: number, y: number, z: number): void {
  const start = nearestWalkable(grid, x, y, z);
  if (start < 0) return;
  const { cols, rows, layers: L } = grid, seen = new Uint8Array(cols * rows * L), stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    const cc = Math.floor(cur / L), cx = cc % cols, cz = Math.floor(cc / cols), ch = grid.ground[cur];
    for (let k = 0; k < 4; k++) {
      const nx = cx + NX[k], nz = cz + NZ[k];
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
      const nl = stepLayer(grid, nz * cols + nx, ch, grid.stair[cur] === 1);
      if (nl < 0) continue;
      const ni = (nz * cols + nx) * L + nl;
      if (!seen[ni]) { seen[ni] = 1; stack.push(ni); }
    }
  }
  for (let i = 0; i < seen.length; i++) if (!seen[i]) grid.ground[i] = Number.NaN;
  // Keep each cell's layers packed bottom-up after pruning (layer scans stop at the first NaN).
  for (let c = 0; c < cols * rows; c++) {
    let w = 0;
    for (let k = 0; k < L; k++) {
      const g = grid.ground[c * L + k];
      if (!Number.isNaN(g)) { grid.ground[c * L + w] = g; grid.stair[c * L + w] = grid.stair[c * L + k]; w++; }
    }
    for (; w < L; w++) { grid.ground[c * L + w] = Number.NaN; grid.stair[c * L + w] = 0; }
  }
}

/** Upper-level areas (balconies, walkways): connected groups of nodes at least `minHeight` above the ground. */
export function upperAreas(grid: NavGrid, minHeight: number, minNodes: number): { x: number; y: number; z: number; nodes: number }[] {
  const { cols, rows, layers: L } = grid, seen = new Uint8Array(cols * rows * L), areas: { x: number; y: number; z: number; nodes: number }[] = [];
  for (let s = 0; s < seen.length; s++) {
    if (seen[s] || Number.isNaN(grid.ground[s]) || grid.ground[s] < minHeight) continue;
    const stack = [s], members: number[] = [];
    seen[s] = 1;
    while (stack.length) {
      const cur = stack.pop()!; members.push(cur);
      const cc = Math.floor(cur / L), cx = cc % cols, cz = Math.floor(cc / cols), ch = grid.ground[cur];
      for (let k = 0; k < 4; k++) {
        const nx = cx + NX[k], nz = cz + NZ[k];
        if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
        const nl = stepLayer(grid, nz * cols + nx, ch, grid.stair[cur] === 1);
        if (nl < 0) continue;
        const ni = (nz * cols + nx) * L + nl;
        if (!seen[ni] && grid.ground[ni] >= minHeight) { seen[ni] = 1; stack.push(ni); }
      }
    }
    if (members.length < minNodes) continue;
    // Representative point: the member closest to the area's centre.
    let mx = 0, mz = 0;
    for (const m of members) { mx += nodeX(grid, m); mz += nodeZ(grid, m); }
    mx /= members.length; mz /= members.length;
    let bestNode = members[0], bestD = Infinity;
    for (const m of members) { const d = Math.hypot(nodeX(grid, m) - mx, nodeZ(grid, m) - mz); if (d < bestD) { bestD = d; bestNode = m; } }
    areas.push({ x: nodeX(grid, bestNode), y: nodeY(grid, bestNode), z: nodeZ(grid, bestNode), nodes: members.length });
  }
  return areas;
}
