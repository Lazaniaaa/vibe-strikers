// Server-relevant cost of the offline simulation (bots, nav, hitscan, Rapier KCC) without rendering.
// Usage: node scripts/bench-sim.mjs [simSeconds] [hz]
import { createServer } from 'vite';
import RAPIER from '@dimforge/rapier3d-compat';

const simSeconds = Number(process.argv[2] || 120), hz = Number(process.argv[3] || 60);
const server = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
try {
  await RAPIER.init();
  const M = await server.ssrLoadModule('/src/maps/index.ts');
  const { Simulation } = await server.ssrLoadModule('/src/gameplay/simulation.ts');
  const { RapierMotor } = await server.ssrLoadModule('/src/gameplay/rapierMotor.ts');
  const nav = await server.ssrLoadModule('/src/gameplay/navGrid.ts');
  const { createIntent } = await server.ssrLoadModule('/src/gameplay/actor.ts');
  const { MAP_ID } = await server.ssrLoadModule('/src/config/game.ts');
  const map = M.loadMapData(MAP_ID);
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  for (const b of M.mapColliders(map).boxes) world.createCollider(RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, b.y, b.z));
  world.step();
  let t = performance.now();
  const spawnsA = M.spawnPoints(map, 'A'), spawnsB = M.spawnPoints(map, 'B');
  const { buildMapNav } = await server.ssrLoadModule('/src/gameplay/mapNav.ts');
  const { nav: grid, upper, cover, routes } = buildMapNav(M.mapColliders(map).boxes, map.bounds, map.boxes.filter((b) => b.kind === 'stair'), spawnsA[0], map.zones);
  const navMs = performance.now() - t;
  let walkable = 0; for (const g of grid.ground) if (!Number.isNaN(g)) walkable++;
  // Instrument findPath through the module object used by botBrain.
  const profile = { bots: 0, motor: 0, weapons: 0 };
  const sim = new Simulation({ blockers: M.mapShotBlockers(map).boxes, spawnsA, spawnsB,
    goals: [...map.zones.map((z) => ({ x: z.x, y: 0, z: z.z })), ...spawnsA, ...spawnsB, ...upper], cover, routes, nav: grid, motor: new RapierMotor(RAPIER, world),
    killY: map.killY, localName: 'idle', botNames: ['b'], characterIndices: [0], freezeTime: 0.1, profile, clock: () => performance.now() });
  // Make the local player a bot too, so all 8 actors think.
  sim.actors[0].isBot = true;
  sim.brains?.set?.(0, sim.brains.get(1) && { ...sim.brains.get(1), path: [] });
  const intent = createIntent();
  const dt = 1 / hz, ticks = Math.round(simSeconds * hz), times = [];
  let worstLate = 0;
  let worst = { ms: 0, tick: 0, bots: 0, motor: 0, weapons: 0, step: 0 };
  for (let i = 0; i < ticks; i++) {
    profile.bots = 0; profile.motor = 0; profile.weapons = 0;
    const t0 = performance.now();
    sim.update(dt, intent);
    const t1 = performance.now(); world.step(); const step = performance.now() - t1;
    const ms = performance.now() - t0; times.push(ms);
    if (i >= 2 * hz && ms > worstLate) worstLate = ms;
    if (ms > worst.ms) worst = { ms, tick: i, bots: profile.bots, motor: profile.motor, weapons: profile.weapons, step };
  }
  times.sort((a, b) => a - b);
  const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))].toFixed(3);
  const kills = sim.actors.reduce((n, a) => n + a.kills, 0);
  console.log(`nav grid ${grid.cols}x${grid.rows}, ${walkable} walkable cells, built in ${navMs.toFixed(1)} ms`);
  console.log(`${ticks} ticks at ${hz} Hz: median ${q(0.5)} ms, p99 ${q(0.99)} ms, max ${times[times.length - 1].toFixed(3)} ms`);
  // findPath cost on its own (random walkable pairs, after warm-up).
  const cells = []; grid.ground.forEach((g, i) => { if (!Number.isNaN(g)) cells.push(i); });
  const out = []; let pathMax = 0, pathTotal = 0;
  for (let i = 0; i < 400; i++) {
    const a = cells[(i * 7919) % cells.length], b = cells[(i * 104729 + 13) % cells.length];
    const t0 = performance.now(); nav.findPath(grid, a, b, out); const ms = performance.now() - t0;
    if (i >= 50) { pathMax = Math.max(pathMax, ms); pathTotal += ms; }
  }
  console.log(`findPath: avg ${(pathTotal / 350).toFixed(3)} ms, max ${pathMax.toFixed(3)} ms (350 random pairs)`);
  console.log(`worst tick after the first 2 s (JIT warm): ${worstLate.toFixed(3)} ms`);
  console.log('worst tick', JSON.stringify(worst, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
  console.log(`rounds played ${sim.round.round}, score ${sim.round.scoreA}:${sim.round.scoreB}, kills ${kills}`);
} finally { await server.close(); }
