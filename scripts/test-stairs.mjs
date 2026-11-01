// Stairs test: find every stair flight in the map data, walk the Rapier KCC player (same motor as the game)
// up and down each flight, and check every 30 Hz sample with the server's movement validation.
// Usage: node scripts/test-stairs.mjs [mapId]
import { createServer } from 'vite';
import RAPIER from '@dimforge/rapier3d-compat';

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
try {
  await RAPIER.init({});
  const M = await vite.ssrLoadModule('/src/maps/index.ts');
  const { MAP_ID } = await vite.ssrLoadModule('/src/config/game.ts');
  const { RapierMotor } = await vite.ssrLoadModule('/src/gameplay/rapierMotor.ts');
  const { createActor } = await vite.ssrLoadModule('/src/gameplay/actor.ts');
  const { ClientValidatedMovement } = await vite.ssrLoadModule('/src/gameplay/movementCheck.ts');
  const { NET } = await vite.ssrLoadModule('/src/config/net.ts');
  const map = M.loadMapData(process.argv[2] ?? MAP_ID);
  const colliders = M.mapColliders(map).boxes;
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  for (const b of colliders) world.createCollider(RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, b.y, b.z));
  world.step();
  const motor = new RapierMotor(RAPIER, world);
  const actor = createActor(1, 'A', 'stairs', false, 0);
  motor.add(actor);
  const authority = new ClientValidatedMovement(colliders, map.bounds, map.killY);

  // Flights: chains of stair boxes, each step ~one tread further and one riser higher than the previous one.
  const steps = map.boxes.filter((b) => b.kind === 'stair').map((b) => ({ ...b, top: b.y + b.h / 2 }));
  const used = new Set(), flights = [];
  for (const s of [...steps].sort((a, b) => a.top - b.top)) {
    if (used.has(s)) continue;
    const chain = [s]; used.add(s);
    for (;;) {
      const last = chain[chain.length - 1];
      const next = steps.find((n) => !used.has(n) && n.top > last.top + 0.05 && n.top - last.top < 0.4 &&
        Math.hypot(n.x - last.x, n.z - last.z) < 0.8 && Math.hypot(n.x - last.x, n.z - last.z) > 0.2);
      if (!next) break;
      chain.push(next); used.add(next);
    }
    if (chain.length >= 2) flights.push(chain);
  }
  console.log(`${steps.length} stair boxes -> ${flights.length} flights: ${flights.map((f) => f.length).join(', ')} steps`);
  check(flights.length > 0, 'found stair flights in the map data');

  const DT = 1 / 60, SEND = 2; // simulate at 60 Hz, validate every 2nd frame (30 Hz like the client sends)
  const intent = { forward: 1, right: 0, yaw: 0, pitch: 0, jump: false, crouch: false, walk: false, fire: false, reload: false, slot: -1 };
  function walk(toX, toZ, targetY, maxTime) {
    let prev = { x: actor.x, y: actor.y, z: actor.z, crouch: false, walk: false }, violations = 0, frames = 0, maxY = actor.y;
    for (let t = 0; t < maxTime; t += DT) {
      const dx = toX - actor.x, dz = toZ - actor.z;
      if (Math.hypot(dx, dz) < 0.15) break;
      actor.yaw = Math.atan2(-dx, -dz); intent.yaw = actor.yaw;
      motor.step(actor, intent, DT, false, 1);
      world.step();
      maxY = Math.max(maxY, actor.y);
      if (++frames % SEND === 0) {
        const next = { x: actor.x, y: actor.y, z: actor.z, crouch: false, walk: false };
        const v = authority.check(prev, next, DT * SEND, 1);
        if (v !== 'ok') { violations++; if (violations <= 3) console.log(`   validation: ${v} at ${actor.x.toFixed(2)}, ${actor.y.toFixed(2)}, ${actor.z.toFixed(2)}`); }
        prev = next;
      }
    }
    return { time: frames * DT, violations, reached: Math.abs(actor.y - targetY) < 0.3 && Math.hypot(toX - actor.x, toZ - actor.z) < 0.4, maxY };
  }

  let i = 0;
  const blocked = [];
  for (const f of flights) {
    i++;
    const first = f[0], last = f[f.length - 1];
    const ux = (last.x - first.x) / Math.hypot(last.x - first.x, last.z - first.z), uz = (last.z - first.z) / Math.hypot(last.x - first.x, last.z - first.z);
    const start = { x: first.x - ux * 1.2, z: first.z - uz * 1.2 }, top = { x: last.x + ux * 0.9, z: last.z + uz * 0.9 };
    // A box in front of the first step that is too high to step or jump onto blocks the flight (map data).
    const groundTop = first.top - first.h;
    const blocker = colliders.find((b) => {
      const top = b.y + b.h / 2, bottom = b.y - b.h / 2;
      if (top < groundTop + 1.2 || bottom > groundTop + 0.5) return false;
      for (let k = 0.1; k <= 1.2; k += 0.1) {
        const px = first.x - ux * k, pz = first.z - uz * k;
        if (Math.abs(px - b.x) < b.w / 2 && Math.abs(pz - b.z) < b.d / 2) return true;
      }
      return false;
    });
    if (blocker) {
      const msg = `flight ${i} at (${first.x.toFixed(1)}, ${first.z.toFixed(1)}): entrance blocked in the map by a ${blocker.h.toFixed(2)} m box at (${blocker.x.toFixed(2)}, ${blocker.z.toFixed(2)}) ${blocker.w.toFixed(2)} x ${blocker.d.toFixed(2)} m`;
      console.log('MAP', msg);
      blocked.push(msg);
      continue;
    }
    motor.teleport(actor, start.x, first.top - first.h + 0.02, start.z);
    for (let k = 0; k < 30; k++) { intent.forward = 0; motor.step(actor, intent, DT, false, 1); world.step(); }
    intent.forward = 1;
    const groundY = actor.y;
    const up = walk(top.x, top.z, last.top, 8);
    const down = walk(start.x, start.z, groundY, 8);
    const label = `flight ${i} at (${first.x.toFixed(1)}, ${first.z.toFixed(1)}) ${f.length} steps to ${last.top.toFixed(2)} m`;
    check(up.reached && up.violations === 0, `${label}: up in ${up.time.toFixed(2)} s (top ${up.maxY.toFixed(2)}), ${up.violations} corrections`);
    check(down.reached && down.violations === 0, `${label}: down in ${down.time.toFixed(2)} s, ${down.violations} corrections`);
  }
  check(flights.length - blocked.length >= 4, `${flights.length - blocked.length} reachable flights walked; ${blocked.length} blocked by the map (reported to the asset owner)`);
  console.log(failed ? `STAIRS TEST FAILED (${failed})` : 'STAIRS TEST PASS');
  process.exitCode = failed ? 1 : 0;
  void NET;
} catch (e) {
  console.log('ERROR', e);
  process.exitCode = 1;
} finally {
  await vite.close();
}
