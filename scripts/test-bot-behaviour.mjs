// Bot behaviour test (offline simulation in Node, 8 bots incl. the idle "local" slot turned into a bot):
// bots spread over the three routes, use cover (hide to reload / when hurt), peek (expose <-> hide), and the
// tick stays cheap. Usage: node scripts/test-bot-behaviour.mjs [simSeconds] [difficulty]
import { createServer } from 'vite';
import RAPIER from '@dimforge/rapier3d-compat';

const simSeconds = Number(process.argv[2] || 180), difficulty = process.argv[3] || 'normal';
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
try {
  await RAPIER.init({});
  const M = await vite.ssrLoadModule('/src/maps/index.ts');
  const { Simulation } = await vite.ssrLoadModule('/src/gameplay/simulation.ts');
  const { RapierMotor } = await vite.ssrLoadModule('/src/gameplay/rapierMotor.ts');
  const { buildMapNav } = await vite.ssrLoadModule('/src/gameplay/mapNav.ts');
  const { createBrain, brainState } = await vite.ssrLoadModule('/src/gameplay/botBrain.ts');
  const { createIntent } = await vite.ssrLoadModule('/src/gameplay/actor.ts');
  const { BOT_TACTICS, BOT_SKILLS } = await vite.ssrLoadModule('/src/config/bots.ts');
  const { MAP_ID } = await vite.ssrLoadModule('/src/config/game.ts');
  const map = M.loadMapData(MAP_ID);
  const colliders = M.mapColliders(map).boxes;
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  for (const b of colliders) world.createCollider(RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, b.y, b.z));
  world.step();
  const spawnsA = M.spawnPoints(map, 'A'), spawnsB = M.spawnPoints(map, 'B');
  const t0 = performance.now();
  const { nav, upper, cover, routes } = buildMapNav(colliders, map.bounds, map.boxes.filter((b) => b.kind === 'stair'), spawnsA[0], map.zones);
  console.log(`nav + cover + routes built in ${(performance.now() - t0).toFixed(0)} ms: ${cover.length} cover spots, routes ${routes.map((r) => r.length).join('/')}`);
  const sim = new Simulation({ blockers: M.mapShotBlockers(map).boxes, spawnsA, spawnsB,
    goals: [...map.zones.map((z) => ({ x: z.x, y: 0, z: z.z })), ...spawnsA, ...spawnsB, ...upper], cover, routes, nav,
    motor: new RapierMotor(RAPIER, world), killY: map.killY, localName: 'bot0', botNames: ['b'], characterIndices: [0], freezeTime: 1 });
  // All 8 actors are bots with the chosen skill (the local slot too).
  sim.actors[0].isBot = true;
  // 'mixed': team A hard vs team B easy (difficulty must matter).
  const skillOf = (team) => BOT_SKILLS[difficulty === 'mixed' ? (team === 'A' ? 'hard' : 'easy') : difficulty];
  for (const a of sim.actors) sim.brains.set(a.id, createBrain(skillOf(a.team)));
  const intent = createIntent();
  const band = (z) => (z > BOT_TACTICS.routeSplitZ ? 'north' : z < -BOT_TACTICS.routeSplitZ ? 'south' : 'mid');
  const bandsByRound = new Map(); // round -> Set of `${team}:${band}` reached in the first 12 s of the round
  const stats = { engagements: 0, withCover: 0, hideTicks: 0, hideWhileReloading: 0, peeks: 0, kills: 0 };
  const prev = new Map();
  const dt = 1 / 60, ticks = Math.round(simSeconds / dt), times = [];
  let roundStartT = 0, lastRound = 0;
  for (let i = 0; i < ticks; i++) {
    const t1 = performance.now();
    sim.update(dt, intent);
    world.step();
    times.push(performance.now() - t1);
    const r = sim.round;
    if (r.round !== lastRound) { lastRound = r.round; roundStartT = sim.time; }
    if (r.phase !== 'live') continue;
    if (!bandsByRound.has(r.round)) bandsByRound.set(r.round, new Set());
    for (const a of sim.actors) {
      if (!a.alive) continue;
      // Only far from the own spawn (the route actually taken), in the first 12 s of the round.
      const home = a.team === 'A' ? spawnsA[0] : spawnsB[0];
      if (sim.time - roundStartT < 13 && Math.abs(a.x - home.x) > 12) bandsByRound.get(r.round).add(`${a.team}:${band(a.z)}`);
      const s = brainState(sim.brains.get(a.id)), p = prev.get(a.id);
      if (s.engaged && !(p && p.engaged)) { stats.engagements++; }
      if (s.engaged && s.hasCover && !(p && p.hasCover)) stats.withCover++;
      if (s.phase === 'hide') { stats.hideTicks++; if (a.slots[a.active].reloadLeft > 0) stats.hideWhileReloading++; }
      if (p && p.phase === 'hide' && s.phase === 'expose') stats.peeks++;
      prev.set(a.id, s);
    }
  }
  stats.kills = sim.actors.reduce((n, a) => n + a.kills, 0);
  times.sort((a, b) => a - b);
  const routesPerTeamRound = [...bandsByRound.values()].map((set) => ['A', 'B'].map((t) => ['north', 'mid', 'south'].filter((b) => set.has(`${t}:${b}`)).length));
  const avgRoutes = routesPerTeamRound.flat().reduce((x, y) => x + y, 0) / Math.max(1, routesPerTeamRound.flat().length);
  console.log(`${difficulty}: rounds ${sim.round.round}, kills ${stats.kills}, routes used per team per round ${JSON.stringify(routesPerTeamRound)}`);
  console.log(`engagements ${stats.engagements}, with cover ${stats.withCover}, peeks ${stats.peeks}, hide time ${(stats.hideTicks * dt).toFixed(1)} s (reloading in cover ${(stats.hideWhileReloading * dt).toFixed(1)} s)`);
  console.log(`tick: median ${times[times.length >> 1].toFixed(3)} ms, p99 ${times[Math.floor(times.length * 0.99)].toFixed(3)} ms`);
  check(avgRoutes >= 2, `bots spread over the routes: ${avgRoutes.toFixed(2)} of 3 routes used per team per round on average`);
  if (difficulty === 'mixed') {
    const killsA = sim.actors.filter((a) => a.team === 'A').reduce((n, a) => n + a.kills, 0), killsB = stats.kills - killsA;
    console.log(`mixed: hard team A ${killsA} kills, ${sim.round.scoreA} rounds; easy team B ${killsB} kills, ${sim.round.scoreB} rounds`);
    check(killsA > killsB * 1.5 && sim.round.scoreA > sim.round.scoreB, 'hard bots clearly beat easy bots');
  }
  check(difficulty === 'easy' || (stats.withCover > 0 && stats.peeks > 0), 'bots fight from cover and peek');
  check(difficulty === 'easy' || stats.hideWhileReloading > 0, 'bots reload in cover');
  check(stats.kills > 0, 'bots still kill each other');
  check(times[Math.floor(times.length * 0.99)] < 5, 'tick p99 under 5 ms');
  console.log(failed ? `BOT BEHAVIOUR TEST FAILED (${failed})` : 'BOT BEHAVIOUR TEST PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e);
  process.exitCode = 1;
} finally {
  await vite.close();
}
