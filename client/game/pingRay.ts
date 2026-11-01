// Where a ping lands: the first map box along the view ray (null when looking at the sky).
import { PINGS } from '../../src/config/pings';
import type { Actor } from '../../src/gameplay/actor';
import { rayBlockers, type AabbBox } from '../../src/gameplay/hitscan';
import { directionFromAngles, vec3, type Vec3 } from '../../src/gameplay/math';

const eye = vec3(), dir = vec3(), out = vec3();

export function pingPoint(local: Actor, blockers: readonly AabbBox[]): Vec3 | null {
  eye.x = local.x; eye.y = local.y + local.eyeHeight; eye.z = local.z;
  directionFromAngles(local.yaw, local.pitch, dir);
  const d = rayBlockers(eye, dir, PINGS.maxDistance, blockers);
  if (d >= PINGS.maxDistance) return null;
  out.x = eye.x + dir.x * (d - 0.05); out.y = eye.y + dir.y * (d - 0.05); out.z = eye.z + dir.z * (d - 0.05);
  return out;
}
