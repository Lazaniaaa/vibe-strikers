// Lag compensation: recent hit-volume poses per player, sampled at a past server time (GAME.md 6.4).
import type { HitTarget } from './hitscan.ts';

interface PoseSample { t: number; x: number; y: number; z: number; yaw: number; crouching: boolean }

/** Ring buffer of poses with server times in ms. */
export class PoseHistory {
  private items: PoseSample[] = [];
  private head = 0;
  private count = 0;
  private size: number;

  constructor(size: number) {
    this.size = size;
    for (let i = 0; i < size; i++) this.items.push({ t: 0, x: 0, y: 0, z: 0, yaw: 0, crouching: false });
  }

  push(t: number, x: number, y: number, z: number, yaw: number, crouching: boolean): void {
    // Same time again (several writes in one tick): overwrite the newest.
    if (this.count > 0 && this.at(0).t === t) this.head = (this.head - 1 + this.size) % this.size;
    else this.count = Math.min(this.size, this.count + 1);
    const s = this.items[this.head];
    s.t = t; s.x = x; s.y = y; s.z = z; s.yaw = yaw; s.crouching = crouching;
    this.head = (this.head + 1) % this.size;
  }

  clear(): void { this.count = 0; }

  private at(i: number): PoseSample { return this.items[(this.head - 1 - i + this.size * 2) % this.size]; }

  /** Pose at time t (interpolated; clamped to the oldest/newest sample). Writes x/y/z/yaw/crouching into out. */
  sampleAt(t: number, out: HitTarget): boolean {
    if (this.count === 0) return false;
    let newer = this.at(0);
    if (t >= newer.t || this.count === 1) { copy(newer, out); return true; }
    for (let i = 1; i < this.count; i++) {
      const older = this.at(i);
      if (older.t <= t) {
        const k = (t - older.t) / Math.max(1e-6, newer.t - older.t);
        out.x = older.x + (newer.x - older.x) * k; out.y = older.y + (newer.y - older.y) * k; out.z = older.z + (newer.z - older.z) * k;
        let d = (newer.yaw - older.yaw) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
        out.yaw = older.yaw + d * k; out.crouching = k < 0.5 ? older.crouching : newer.crouching;
        return true;
      }
      newer = older;
    }
    copy(this.at(this.count - 1), out);
    return true;
  }
}

function copy(s: PoseSample, out: HitTarget): void { out.x = s.x; out.y = s.y; out.z = s.z; out.yaw = s.yaw; out.crouching = s.crouching; }
