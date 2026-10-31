// Scripted network client helpers for tests: walk along the nav grid at a legal speed, strafe, find a
// spot in line of sight. `mods` = modules loaded through Vite SSR (see loadMods).
export async function loadMods(vite) {
  const M = await vite.ssrLoadModule('/src/maps/index.ts');
  const nav = await vite.ssrLoadModule('/src/gameplay/navGrid.ts');
  const { buildMapNav } = await vite.ssrLoadModule('/src/gameplay/mapNav.ts');
  const hit = await vite.ssrLoadModule('/src/gameplay/hitscan.ts');
  const { MAP_ID } = await vite.ssrLoadModule('/src/config/game.ts');
  const map = M.loadMapData(MAP_ID);
  const colliders = M.mapColliders(map).boxes, blockers = M.mapShotBlockers(map).boxes;
  const spawnA = M.spawnPoints(map, 'A')[0];
  const { nav: grid, upper } = buildMapNav(colliders, map.bounds, map.boxes.filter((b) => b.kind === 'stair'), spawnA);
  return { M, nav, hit, map, colliders, blockers, grid, upper };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HZ = 30;

function moveMsg(net, x, y, z, vx, vz, yaw) {
  return { x, y, z, vx, vy: 0, vz, yaw, pitch: 0, crouch: false, grounded: true, walk: false };
}

/** Walk `net` (a GameNet in a room) to (tx, tz) along an A* path at `speed` m/s. Returns false if stopped. */
export async function walkTo(mods, net, tx, tz, speed = 4.5, ty = 0) {
  const { nav, grid } = mods;
  const path = [];
  const start = nav.nearestWalkable(grid, net.me.x, net.me.y, net.me.z), goal = nav.nearestWalkable(grid, tx, ty, tz);
  nav.findPath(grid, start, goal, path);
  let x = net.me.x, z = net.me.z, y = net.me.y;
  const before = net.corrections;
  for (const c of path) {
    const wx = nav.nodeX(grid, c), wz = nav.nodeZ(grid, c);
    for (;;) {
      const dx = wx - x, dz = wz - z, d = Math.hypot(dx, dz);
      if (d < 0.05) break;
      const step = Math.min(d, speed / HZ);
      x += dx / d * step; z += dz / d * step;
      const g = nav.groundAt(grid, x, y, z);
      if (Number.isFinite(g)) y += Math.max(-0.2, Math.min(0.2, g - y));
      net.sendMove(moveMsg(net, x, y, z, dx / d * speed, dz / d * speed, Math.atan2(-dx, -dz)));
      await sleep(1000 / HZ);
      if (!net.me || !net.me.alive || net.corrections !== before) return false;
    }
  }
  return true;
}

/** A walkable cell at minDist..maxDist from (ex, ey, ez) whose chest point is visible from that eye. */
export function findVisibleSpot(mods, ex, ey, ez, minDist = 6, maxDist = 14, ideal = 9) {
  const { nav, grid, hit, blockers } = mods;
  const eye = { x: ex, y: ey, z: ez }, chest = { x: 0, y: 0, z: 0 }, scratch = { x: 0, y: 0, z: 0 };
  let best = null;
  for (let i = 0; i < grid.ground.length; i++) {
    const g = grid.ground[i];
    if (!Number.isFinite(g) || g > 0.1) continue; // ground level only
    const x = nav.nodeX(grid, i), z = nav.nodeZ(grid, i), d = Math.hypot(x - ex, z - ez);
    if (d < minDist || d > maxDist) continue;
    chest.x = x; chest.y = g + 1.0; chest.z = z;
    if (!hit.lineOfSight(eye, chest, blockers, scratch)) continue;
    // Room to strafe 1.5 m both ways across the line of sight, all visible.
    const px = -(z - ez) / d, pz = (x - ex) / d;
    let ok = true;
    for (const k of [-1.5, -0.75, 0.75, 1.5]) {
      const sx = x + px * k, sz = z + pz * k, sg = nav.groundAt(grid, sx, g, sz);
      if (!Number.isFinite(sg) || Math.abs(sg - g) > 0.1) { ok = false; break; }
      chest.x = sx; chest.z = sz;
      if (!hit.lineOfSight(eye, chest, blockers, scratch)) { ok = false; break; }
    }
    if (!ok) continue;
    const score = Math.abs(d - ideal);
    if (!best || score < best.score) best = { x, y: g, z, px, pz, score, d };
  }
  return best;
}

/** Strafe back and forth across (spot.px, spot.pz) by +-amp metres at `speed` until stop() returns true. */
export async function strafe(net, spot, stop, amp = 1.5, speed = 4.5) {
  let k = 0, dir = 1;
  while (!stop() && net.me && net.me.alive) {
    k += dir * speed / HZ;
    if (Math.abs(k) >= amp) { k = Math.sign(k) * amp; dir = -dir; }
    const x = spot.x + spot.px * k, z = spot.z + spot.pz * k;
    net.sendMove(moveMsg(net, x, spot.y, z, spot.px * dir * speed, spot.pz * dir * speed, 0));
    await sleep(1000 / HZ);
  }
}
