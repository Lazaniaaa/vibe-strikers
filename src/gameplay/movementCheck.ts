// Server validation of client-reported movement (GAME.md 6.6, owner decision 2026-10-30).
// Pure TypeScript: runs in the SpacetimeDB module. A fully server-simulated authority can replace
// `ClientValidatedMovement` later behind the same MovementAuthority interface.
import { CAPSULE, MOVEMENT } from '../config/movement.ts';
import { MOVE_CHECK } from '../config/net.ts';
import type { AabbBox } from './hitscan.ts';

export interface MoveSample { x: number; y: number; z: number; crouch: boolean; walk: boolean }

export type MoveVerdict = 'ok' | 'teleport' | 'too-fast' | 'vertical' | 'inside-wall' | 'out-of-map';

export interface MovementAuthority {
  /** Check a move from the last accepted sample `prev` to `next`, `elapsed` seconds later. */
  check(prev: MoveSample, next: MoveSample, elapsed: number, speedScale: number): MoveVerdict;
}

/** Distance from the vertical capsule core segment (feet at y) to an AABB, minus nothing (core only). */
function coreDistanceToBox(x: number, y0: number, y1: number, z: number, b: AabbBox): number {
  const dx = Math.max(b.x - b.w / 2 - x, 0, x - (b.x + b.w / 2));
  const dz = Math.max(b.z - b.d / 2 - z, 0, z - (b.z + b.d / 2));
  const bMin = b.y - b.h / 2, bMax = b.y + b.h / 2;
  const dy = y1 < bMin ? bMin - y1 : y0 > bMax ? y0 - bMax : 0;
  return Math.hypot(dx, dy, dz);
}

/** True when the capsule (feet at x, y, z) overlaps any box by more than the allowed penetration. */
export function capsuleInsideBoxes(x: number, y: number, z: number, crouch: boolean, boxes: readonly AabbBox[]): boolean {
  const r = CAPSULE.radius, h = crouch ? CAPSULE.crouchHeight : CAPSULE.height;
  const y0 = y + r, y1 = y + h - r, limit = r - MOVE_CHECK.capsulePenetration;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    // Cheap reject before the exact distance.
    if (Math.abs(x - b.x) > b.w / 2 + r || Math.abs(z - b.z) > b.d / 2 + r) continue;
    if (coreDistanceToBox(x, y0, y1, z, b) < limit) return true;
  }
  return false;
}

export class ClientValidatedMovement implements MovementAuthority {
  private boxes: readonly AabbBox[];
  private bounds: { x: number; z: number };
  private killY: number;

  constructor(boxes: readonly AabbBox[], bounds: { x: number; z: number }, killY: number) {
    this.boxes = boxes; this.bounds = bounds; this.killY = killY;
  }

  check(prev: MoveSample, next: MoveSample, elapsed: number, speedScale: number): MoveVerdict {
    const t = Math.min(Math.max(elapsed, 0), MOVE_CHECK.maxElapsed) + MOVE_CHECK.burstSlack;
    const dx = next.x - prev.x, dz = next.z - prev.z, dy = next.y - prev.y;
    const horizontal = Math.hypot(dx, dz);
    if (Math.hypot(horizontal, dy) > MOVE_CHECK.teleportDistance) return 'teleport';
    if (Math.abs(next.x) > this.bounds.x + 2 || Math.abs(next.z) > this.bounds.z + 2 || next.y < this.killY - 1) return 'out-of-map';
    // Run speed is the most any state allows (air control keeps at most the ground speed).
    if (horizontal > MOVEMENT.runSpeed * speedScale * MOVE_CHECK.speedTolerance * t) return 'too-fast';
    // Up: one jump (v^2 / 2g) at most per window plus steps; down: free fall at max fall speed.
    const maxUp = (MOVEMENT.jumpVelocity * MOVEMENT.jumpVelocity) / (2 * MOVEMENT.gravity) + MOVE_CHECK.verticalSlack;
    if (dy > maxUp || -dy > MOVEMENT.maxFallSpeed * t + MOVE_CHECK.verticalSlack) return 'vertical';
    if (capsuleInsideBoxes(next.x, next.y, next.z, next.crouch, this.boxes)) return 'inside-wall';
    return 'ok';
  }
}
