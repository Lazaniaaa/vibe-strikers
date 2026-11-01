// Hitscan: rays against axis-aligned map boxes (mapShotBlockers) and per-player hit volumes.
// Pure TypeScript, no three.js / Rapier, so the server can run the same code.
import { HITBOXES, type HitPart } from '../config/hitboxes.ts';
import type { Vec3 } from './math.ts';

/** Axis-aligned box, centre + size (same shape as ColliderBox from src/maps). */
export interface AabbBox { x: number; y: number; z: number; w: number; h: number; d: number }

/** A player that can be hit. Position is the feet centre. */
export interface HitTarget { id: number; x: number; y: number; z: number; yaw: number; crouching: boolean }

/** Ray vs AABB given by min/max. Returns entry distance in [0, maxDist] or Infinity. */
export function rayAabb(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, maxDist: number): number {
  let tmin = 0, tmax = maxDist;
  if (Math.abs(dx) < 1e-12) { if (ox < minX || ox > maxX) return Infinity; }
  else {
    const inv = 1 / dx; let t1 = (minX - ox) * inv, t2 = (maxX - ox) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dy) < 1e-12) { if (oy < minY || oy > maxY) return Infinity; }
  else {
    const inv = 1 / dy; let t1 = (minY - oy) * inv, t2 = (maxY - oy) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dz) < 1e-12) { if (oz < minZ || oz > maxZ) return Infinity; }
  else {
    const inv = 1 / dz; let t1 = (minZ - oz) * inv, t2 = (maxZ - oz) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity;
  }
  return tmin;
}

/** Nearest distance along the ray to any blocker box, or Infinity. `dir` must be unit length. */
export function rayBlockers(origin: Vec3, dir: Vec3, maxDist: number, boxes: readonly AabbBox[]): number {
  let best = maxDist;
  let hit = false;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const hw = b.w / 2, hh = b.h / 2, hd = b.d / 2;
    const t = rayAabb(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
      b.x - hw, b.y - hh, b.z - hd, b.x + hw, b.y + hh, b.z + hd, best);
    if (t < best) { best = t; hit = true; }
  }
  return hit ? best : Infinity;
}

/** True when nothing blocks the segment from a to b. */
export function lineOfSight(a: Vec3, b: Vec3, boxes: readonly AabbBox[], scratchDir: Vec3): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  scratchDir.x = dx / len; scratchDir.y = dy / len; scratchDir.z = dz / len;
  return rayBlockers(a, scratchDir, len, boxes) === Infinity;
}

/** Ray vs one player's hit volumes (boxes rotate with yaw). Writes the hit part; returns distance or Infinity. */
export function rayPlayer(origin: Vec3, dir: Vec3, maxDist: number, target: HitTarget, partOut: { part: HitPart }, headScale = 1): number {
  // Move the ray into the target's local frame (feet at origin, rotated by -yaw).
  const c = Math.cos(target.yaw), s = Math.sin(target.yaw);
  const rx = origin.x - target.x, rz = origin.z - target.z;
  const ox = c * rx - s * rz, oz = s * rx + c * rz, oy = origin.y - target.y;
  const dx = c * dir.x - s * dir.z, dz = s * dir.x + c * dir.z, dy = dir.y;
  const k = target.crouching ? HITBOXES.crouchScale : 1;
  const head = HITBOXES.head, body = HITBOXES.body;
  // Big heads mutator: the head box grows by headScale, upward from its bottom (the neck).
  const hw = head.w / 2 * headScale, hd = head.d / 2 * headScale, hb = head.cy - head.h / 2, ht = hb + head.h * headScale;
  const th = rayAabb(ox, oy, oz, dx, dy, dz, -hw, hb * k, -hd, hw, ht * k, hd, maxDist);
  const tb = rayAabb(ox, oy, oz, dx, dy, dz, -body.w / 2, (body.cy - body.h / 2) * k, -body.d / 2,
    body.w / 2, (body.cy + body.h / 2) * k, body.d / 2, maxDist);
  if (th === Infinity && tb === Infinity) return Infinity;
  // Headshot = the ray reaches the head box first.
  if (th <= tb) { partOut.part = 'head'; return th; }
  partOut.part = 'body'; return tb;
}

export interface ShotResult {
  /** 'none' = nothing within range, 'world' = map box, 'player' = hit target. */
  kind: 'none' | 'world' | 'player';
  distance: number;
  /** Index into the targets array when kind === 'player'. */
  targetIndex: number;
  part: HitPart;
}

export function createShotResult(): ShotResult { return { kind: 'none', distance: 0, targetIndex: -1, part: 'body' }; }

const partScratch: { part: HitPart } = { part: 'body' };

/**
 * One bullet: nearest of map blockers and targets. `skip(i)` excludes targets (shooter, teammates, dead).
 * Server and client use the same function; the server passes rewound target positions (M2).
 */
export function traceShot(origin: Vec3, dir: Vec3, range: number, boxes: readonly AabbBox[],
  targets: readonly HitTarget[], skip: (index: number) => boolean, out: ShotResult, headScale = 1): ShotResult {
  const wall = rayBlockers(origin, dir, range, boxes);
  let best = wall, bestIndex = -1, bestPart: HitPart = 'body';
  for (let i = 0; i < targets.length; i++) {
    if (skip(i)) continue;
    const t = rayPlayer(origin, dir, best === Infinity ? range : best, targets[i], partScratch, headScale);
    if (t < best) { best = t; bestIndex = i; bestPart = partScratch.part; }
  }
  out.targetIndex = bestIndex;
  out.part = bestPart;
  if (bestIndex >= 0) { out.kind = 'player'; out.distance = best; }
  else if (wall !== Infinity) { out.kind = 'world'; out.distance = wall; }
  else { out.kind = 'none'; out.distance = range; }
  return out;
}
