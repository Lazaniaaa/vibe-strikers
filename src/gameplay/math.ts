// Small allocation-free vector helpers on plain objects (shared by client and server).

export interface Vec3 { x: number; y: number; z: number }

export const DEG = Math.PI / 180;

export function vec3(x = 0, y = 0, z = 0): Vec3 { return { x, y, z }; }

export function setVec(out: Vec3, x: number, y: number, z: number): Vec3 { out.x = x; out.y = y; out.z = z; return out; }

export function copyVec(out: Vec3, v: Vec3): Vec3 { out.x = v.x; out.y = v.y; out.z = v.z; return out; }

export function clamp(v: number, min: number, max: number): number { return v < min ? min : v > max ? max : v; }

/** Forward unit vector for yaw/pitch. Yaw 0 looks along -Z, positive yaw turns left (three.js rotation.y). */
export function directionFromAngles(yaw: number, pitch: number, out: Vec3): Vec3 {
  const cp = Math.cos(pitch);
  return setVec(out, -Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

/** Yaw/pitch that look along (dx, dy, dz). */
export function yawTo(dx: number, dz: number): number { return Math.atan2(-dx, -dz); }
export function pitchTo(dx: number, dy: number, dz: number): number { return Math.atan2(dy, Math.hypot(dx, dz)); }

/** Shortest signed angle from a to b, radians. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Random direction inside a cone of half-angle `spreadRad` around unit vector `dir`.
 * `r1`, `r2` are uniform randoms in [0, 1) (passed in so the server can use its own RNG).
 */
export function spreadDirection(dir: Vec3, spreadRad: number, r1: number, r2: number, out: Vec3): Vec3 {
  if (spreadRad <= 0) return copyVec(out, dir);
  // Orthonormal basis around dir.
  let ux = 0, uy = 1, uz = 0;
  if (Math.abs(dir.y) > 0.95) { ux = 1; uy = 0; }
  // a = normalize(cross(dir, up)), b = cross(a, dir)
  let ax = dir.y * uz - dir.z * uy, ay = dir.z * ux - dir.x * uz, az = dir.x * uy - dir.y * ux;
  const al = Math.hypot(ax, ay, az); ax /= al; ay /= al; az /= al;
  const bx = ay * dir.z - az * dir.y, by = az * dir.x - ax * dir.z, bz = ax * dir.y - ay * dir.x;
  const radius = Math.tan(spreadRad) * Math.sqrt(r1), angle = r2 * Math.PI * 2;
  const ca = Math.cos(angle) * radius, sa = Math.sin(angle) * radius;
  const x = dir.x + ax * ca + bx * sa, y = dir.y + ay * ca + by * sa, z = dir.z + az * ca + bz * sa;
  const l = Math.hypot(x, y, z);
  return setVec(out, x / l, y / l, z / l);
}
