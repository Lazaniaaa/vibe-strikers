// Server bot movement without Rapier: walk on the multi-level nav grid. The body (capsule) is tested against
// the map boxes with the same check the server uses to validate movement, so bots never enter walls, steps
// or props; they slide along them. Bots do not jump.
import { BOTS } from '../config/bots.ts';
import { CAPSULE, KCC, MOVEMENT } from '../config/movement.ts';
import type { Actor } from './actor.ts';
import type { AabbBox } from './hitscan.ts';
import { capsuleOverlapsBox } from './movementCheck.ts';
import { groundAt, type NavGrid } from './navGrid.ts';

/** Feet height at (x, z) for a body coming from height y moving along (dx, dz), NaN if not walkable. */
function feetAt(grid: NavGrid, x: number, y: number, z: number, dx: number, dz: number, dt: number): number {
  const g = groundAt(grid, x, y, z);
  if (Number.isNaN(g)) return Number.NaN;
  // A higher step within the body radius ahead: be up there already (like the KCC autostep).
  let ground = g;
  const len = Math.hypot(dx, dz);
  if (len > 1e-4) {
    const ahead = groundAt(grid, x + (dx / len) * CAPSULE.radius, y, z + (dz / len) * CAPSULE.radius);
    if (!Number.isNaN(ahead) && ahead > ground) ground = ahead;
  }
  // Up at once, down smoothly.
  return ground > y ? ground : Math.max(ground, y - BOTS.groundFollowSpeed * dt);
}

export function stepOnGrid(actor: Actor, grid: NavGrid, dt: number, speedScale: number, boxes: readonly AabbBox[] = []): void {
  const intent = actor.intent;
  let f = intent.forward, r = intent.right;
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }
  const fx = -Math.sin(actor.yaw), fz = -Math.cos(actor.yaw);
  const speed = (intent.walk ? MOVEMENT.walkSpeed : MOVEMENT.runSpeed) * speedScale;
  let vx = (fx * f - fz * r) * speed, vz = (fz * f + fx * r) * speed;
  // Like the KCC: the body stands on the highest box it touches if that box is within autostep height;
  // anything higher blocks the move.
  const tryMove = (x: number, z: number): number => {
    let y = feetAt(grid, x, actor.y, z, x - actor.x, z - actor.z, dt);
    if (Number.isNaN(y)) return Number.NaN;
    for (let pass = 0; pass < 3; pass++) {
      let top = -Infinity;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (capsuleOverlapsBox(x, y, z, false, b)) top = Math.max(top, b.y + b.h / 2);
      }
      if (top === -Infinity) return y;
      if (top > y + KCC.autostepMaxHeight) return Number.NaN;
      y = top + 1e-3;
    }
    return Number.NaN;
  };
  let nx = actor.x + vx * dt, nz = actor.z + vz * dt;
  let ny = tryMove(nx, nz);
  // Slide along blocked axes.
  if (Number.isNaN(ny)) {
    ny = tryMove(nx, actor.z);
    if (!Number.isNaN(ny)) { nz = actor.z; vz = 0; }
    else {
      ny = tryMove(actor.x, nz);
      if (!Number.isNaN(ny)) { nx = actor.x; vx = 0; }
      else { nx = actor.x; nz = actor.z; vx = 0; vz = 0; ny = actor.y; }
    }
  }
  actor.x = nx; actor.y = ny; actor.z = nz;
  actor.vx = vx; actor.vz = vz; actor.vy = 0;
  actor.grounded = true;
  actor.crouching = false;
  const hs = Math.hypot(vx, vz);
  actor.moveFraction = Math.min(1, hs / MOVEMENT.runSpeed);
  if (hs > 0.05) {
    actor.moveLocalX = (vx * -fz + vz * fx) / hs;
    actor.moveLocalZ = -(vx * fx + vz * fz) / hs;
  } else { actor.moveLocalX = 0; actor.moveLocalZ = -1; }
}
