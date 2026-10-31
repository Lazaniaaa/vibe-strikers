// Server bot movement without Rapier: walk on the nav grid (walkable cells, ground height per cell).
// Bots never leave walkable cells, so they cannot enter walls; they do not jump.
import { BOTS } from '../config/bots.ts';
import { MOVEMENT } from '../config/movement.ts';
import type { Actor } from './actor.ts';
import { cellIndex, isWalkable, type NavGrid } from './navGrid.ts';

export function stepOnGrid(actor: Actor, grid: NavGrid, dt: number, speedScale: number): void {
  const intent = actor.intent;
  let f = intent.forward, r = intent.right;
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }
  const fx = -Math.sin(actor.yaw), fz = -Math.cos(actor.yaw);
  const speed = (intent.walk ? MOVEMENT.walkSpeed : MOVEMENT.runSpeed) * speedScale;
  let vx = (fx * f - fz * r) * speed, vz = (fz * f + fx * r) * speed;
  let nx = actor.x + vx * dt, nz = actor.z + vz * dt;
  // Slide along blocked axes.
  if (!isWalkable(grid, cellIndex(grid, nx, nz))) {
    if (isWalkable(grid, cellIndex(grid, nx, actor.z))) { nz = actor.z; vz = 0; }
    else if (isWalkable(grid, cellIndex(grid, actor.x, nz))) { nx = actor.x; vx = 0; }
    else { nx = actor.x; nz = actor.z; vx = 0; vz = 0; }
  }
  const cell = cellIndex(grid, nx, nz);
  const ground = isWalkable(grid, cell) ? grid.ground[cell] : actor.y;
  const dy = ground - actor.y, step = BOTS.groundFollowSpeed * dt;
  actor.y += Math.max(-step, Math.min(step, dy));
  actor.vx = vx; actor.vz = vz; actor.vy = 0;
  actor.x = nx; actor.z = nz;
  actor.grounded = true;
  actor.crouching = false;
  const hs = Math.hypot(vx, vz);
  actor.moveFraction = Math.min(1, hs / MOVEMENT.runSpeed);
  if (hs > 0.05) {
    actor.moveLocalX = (vx * -fz + vz * fx) / hs;
    actor.moveLocalZ = -(vx * fx + vz * fz) / hs;
  } else { actor.moveLocalX = 0; actor.moveLocalZ = -1; }
}
