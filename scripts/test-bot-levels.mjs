// Bots use stairs and height: on the multi-level nav graph, a bot walks from each spawn to each balcony /
// raised area and back, with BOTH bot motors: the server one (nav grid, no Rapier) and the offline one
// (Rapier KCC). Every 30 Hz sample is checked with the server movement validation.
// Usage: node scripts/test-bot-levels.mjs
import { createServer } from 'vite';
import RAPIER from '@dimforge/rapier3d-compat';

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
try {
  await RAPIER.init({});
  const { loadMods } = await import('./netbot.mjs');
  const mods = await loadMods(vite);
  const { M, nav, grid, map, colliders, upper } = mods;
  const { createActor, createIntent } = await vite.ssrLoadModule('/src/gameplay/actor.ts');
  const { stepOnGrid } = await vite.ssrLoadModule('/src/gameplay/navMotor.ts');
  const { RapierMotor } = await vite.ssrLoadModule('/src/gameplay/rapierMotor.ts');
  const { ClientValidatedMovement, capsuleInsideBoxes } = await vite.ssrLoadModule('/src/gameplay/movementCheck.ts');
  const { BOTS } = await vite.ssrLoadModule('/src/config/bots.ts');
  const authority = new ClientValidatedMovement(colliders, map.bounds, map.killY);
  let nodes = 0, levels = 0;
  for (let c = 0; c < grid.cols * grid.rows; c++) {
    let here = 0;
    for (let k = 0; k < grid.layers; k++) if (Number.isFinite(grid.ground[c * grid.layers + k])) { nodes++; here++; }
    if (here > 1) levels++;
  }
  console.log(`nav: ${nodes} walkable nodes, ${levels} cells with more than one level, ${upper.length} upper areas:`,
    upper.map((u) => `(${u.x.toFixed(1)}, ${u.y.toFixed(2)}, ${u.z.toFixed(1)})`).join(' '));
  check(upper.length >= 2, `upper areas (balconies / walkways) found: ${upper.length}`);

  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  for (const b of colliders) world.createCollider(RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, b.y, b.z));
  world.step();
  const motor = new RapierMotor(RAPIER, world);
  const DT = 1 / 30;
  const verdicts = {};

  /** Follow a nav path like the bot brain (waypoint reach, yaw toward the waypoint). */
  function run(kind, actor, from, to) {
    const path = [];
    const start = nav.nearestWalkable(grid, from.x, from.y, from.z), goal = nav.nearestWalkable(grid, to.x, to.y, to.z);
    if (nav.findPath(grid, start, goal, path) === 0) return { ok: false, reason: 'no path' };
    if (kind === 'kcc') motor.teleport(actor, from.x, from.y + 0.02, from.z);
    else { actor.x = from.x; actor.y = from.y; actor.z = from.z; }
    let i = 0, prev = { x: actor.x, y: actor.y, z: actor.z, crouch: false, walk: false }, violations = 0, t = 0, stuck = 0;
    const intent = actor.intent;
    while (i < path.length && t < 60) {
      const wx = nav.nodeX(grid, path[i]), wz = nav.nodeZ(grid, path[i]);
      const d = Math.hypot(wx - actor.x, wz - actor.z);
      if (d < BOTS.waypointReach) { i++; continue; }
      actor.yaw = Math.atan2(-(wx - actor.x), -(wz - actor.z));
      Object.assign(intent, createIntent(), { forward: 1, yaw: actor.yaw });
      const before = { x: actor.x, z: actor.z };
      if (kind === 'kcc') { motor.step(actor, intent, DT, false, 1); world.step(); } else stepOnGrid(actor, grid, DT, 1, colliders);
      t += DT;
      stuck = Math.hypot(actor.x - before.x, actor.z - before.z) < 0.01 ? stuck + 1 : 0;
      if (stuck > 60) {
        const len = Math.hypot(wx - actor.x, wz - actor.z), nx = actor.x + (wx - actor.x) / len * 0.18, nz = actor.z + (wz - actor.z) / len * 0.18;
        const g = nav.groundAt(grid, nx, actor.y, nz);
        const blockers = Number.isFinite(g) ? colliders.filter((b) => capsuleInsideBoxes(nx, Math.max(g, actor.y), nz, false, [b]))
          .map((b) => `c(${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)}) ${b.w.toFixed(2)}x${b.h.toFixed(2)}x${b.d.toFixed(2)}`) : [];
        return { ok: false, reason: `stuck at (${actor.x.toFixed(2)}, ${actor.y.toFixed(2)}, ${actor.z.toFixed(2)}) -> wp (${wx.toFixed(2)}, ${nav.nodeY(grid, path[i]).toFixed(2)}, ${wz.toFixed(2)}) ground ${g} blockers ${blockers.join(' ')}`, t };
      }
      const next = { x: actor.x, y: actor.y, z: actor.z, crouch: false, walk: false };
      const v = authority.check(prev, next, DT, 1);
      if (v !== 'ok') { violations++; verdicts[v] = (verdicts[v] ?? 0) + 1; }
      prev = next;
    }
    const end = Math.hypot(actor.x - to.x, actor.z - to.z), dy = Math.abs(actor.y - to.y);
    return { ok: i >= path.length && dy < 0.5 && end < 2, t, violations, reason: `ended ${end.toFixed(2)} m / ${dy.toFixed(2)} m off` };
  }

  const spawns = [M.spawnPoints(map, 'A')[0], M.spawnPoints(map, 'B')[0]];
  let a = 0;
  for (const kind of ['grid', 'kcc']) {
    const actor = createActor(++a, 'A', 'bot', true, 0);
    if (kind === 'kcc') motor.add(actor);
    for (const s of spawns) for (const u of upper) {
      const there = run(kind, actor, { x: s.x, y: s.y, z: s.z }, u);
      const back = there.ok ? run(kind, actor, { x: actor.x, y: actor.y, z: actor.z }, { x: s.x, y: s.y, z: s.z }) : { ok: false, reason: 'skipped' };
      const label = `${kind === 'grid' ? 'server bot (nav grid)' : 'offline bot (Rapier KCC)'}: spawn (${s.x}, ${s.z}) -> area (${u.x.toFixed(1)}, ${u.y.toFixed(2)}, ${u.z.toFixed(1)}) and back`;
      check(there.ok && back.ok && there.violations === 0 && back.violations === 0,
        `${label}: ${there.ok ? `${there.t.toFixed(1)} s` : there.reason} / ${back.ok ? `${back.t.toFixed(1)} s` : back.reason}, corrections ${(there.violations ?? 0) + (back.violations ?? 0)}`);
    }
  }
  if (Object.keys(verdicts).length) console.log('validation verdicts:', JSON.stringify(verdicts));
  console.log(failed ? `BOT LEVELS TEST FAILED (${failed})` : 'BOT LEVELS TEST PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e);
  process.exitCode = 1;
} finally {
  await vite.close();
}
