// Bot primaries and weapon roles (offline simulation in Node, all 8 actors are bots):
// random primaries with at most one sniper per team; snipers hold balconies and shoot scoped; shotguns fight close.
// Usage: node scripts/test-bot-roles.mjs [simSeconds]
import { createServer } from 'vite';
import RAPIER from '@dimforge/rapier3d-compat';

const simSeconds = Number(process.argv[2] || 180);
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
try {
  await RAPIER.init({});
  const M = await vite.ssrLoadModule('/src/maps/index.ts');
  const { Simulation } = await vite.ssrLoadModule('/src/gameplay/simulation.ts');
  const { RapierMotor } = await vite.ssrLoadModule('/src/gameplay/rapierMotor.ts');
  const { buildMapNav } = await vite.ssrLoadModule('/src/gameplay/mapNav.ts');
  const { createBrain, pickBotPrimary } = await vite.ssrLoadModule('/src/gameplay/botBrain.ts');
  const { createIntent, setPrimary } = await vite.ssrLoadModule('/src/gameplay/actor.ts');
  const { BOT_SKILLS, BOT_LOADOUT, BOT_ROLES } = await vite.ssrLoadModule('/src/config/bots.ts');
  const { MAP_ID } = await vite.ssrLoadModule('/src/config/game.ts');

  // 1. Primary picks.
  const rnd = seeded(7), counts = { rifle: 0, shotgun: 0, sniper: 0 };
  for (let i = 0; i < 10000; i++) counts[pickBotPrimary(rnd, false)]++;
  const w = BOT_LOADOUT.weights, total = w.rifle + w.shotgun + w.sniper;
  check(Object.keys(counts).every((k) => Math.abs(counts[k] / 10000 - w[k] / total) < 0.03), `random primaries follow the weights ${JSON.stringify(counts)}`);
  let sn = 0;
  for (let i = 0; i < 2000; i++) if (pickBotPrimary(rnd, true) === 'sniper') sn++;
  check(sn === 0, 'no sniper when the team already has one');

  const map = M.loadMapData(MAP_ID);
  const colliders = M.mapColliders(map).boxes;
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  for (const b of colliders) world.createCollider(RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, b.y, b.z));
  world.step();
  const spawnsA = M.spawnPoints(map, 'A'), spawnsB = M.spawnPoints(map, 'B');
  const { nav, upper, cover, routes, perches } = buildMapNav(colliders, map.bounds, map.boxes.filter((b) => b.kind === 'stair'), spawnsA[0], map.zones);
  const dummyMotor = { add() {}, teleport() {}, step() {} };
  console.log(`sniper spots: ${perches.length} (${perches.filter((p) => Number.isNaN(p.yaw)).length} balconies), sight ${perches.filter((p) => p.sight).map((p) => p.sight.toFixed(0)).join(',')}`);
  const make = (seed, motor = new RapierMotor(RAPIER, world)) => new Simulation({ blockers: M.mapShotBlockers(map).boxes, spawnsA, spawnsB,
    goals: [...map.zones.map((z) => ({ x: z.x, y: 0, z: z.z })), ...spawnsA, ...spawnsB, ...upper], cover, routes, perches, nav,
    motor, killY: map.killY, localName: 'bot0', botNames: ['b'], characterIndices: [0], freezeTime: 1,
    random: seeded(seed) });

  // 2. Every new match: at most one sniper per team, and a mix of weapons overall.
  let maxSnipers = 0;
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const s = make(seed, dummyMotor);
    for (const team of ['A', 'B']) maxSnipers = Math.max(maxSnipers, s.actors.filter((a) => a.isBot && a.team === team && a.slots[0].stats.id === 'sniper').length);
    for (const a of s.actors) if (a.isBot) seen.add(a.slots[0].stats.id);
  }
  check(maxSnipers <= 1 && seen.size === 3, `30 matches: max ${maxSnipers} sniper per team, primaries seen: ${[...seen].join(', ')}`);

  // 3. Roles in play: fixed loadout per team: sniper, shotgun, shotgun, rifle (the local slot is a bot too).
  const sim = make(42);
  sim.actors[0].isBot = true;
  for (const a of sim.actors) sim.brains.set(a.id, createBrain(BOT_SKILLS.normal));
  const roles = ['sniper', 'shotgun', 'shotgun', 'rifle'];
  sim.actors.forEach((a, i) => { const p = roles[i % 4]; setPrimary(a, p); sim.loadout.set(a.id, p); });
  sim.restart();
  const intent = createIntent();
  const st = { sniper: { live: 0, high: 0 }, rifle: { live: 0, high: 0 }, shotgun: { live: 0, high: 0 } };
  const hitDist = { sniper: [], shotgun: [], rifle: [], pistol: [] };
  let sniperScopedShots = 0, sniperShots = 0, shotgunFar = 0;
  const kills = { sniper: 0, shotgun: 0, rifle: 0, pistol: 0, knife: 0, world: 0 };
  let seenKills = 0;
  const dt = 1 / 60, ticks = Math.round(simSeconds / dt);
  for (let i = 0; i < ticks; i++) {
    sim.update(dt, intent);
    world.step();
    if (sim.round.phase !== 'live') continue;
    for (const a of sim.actors) {
      if (!a.alive) continue;
      const role = a.slots[0].stats.id;
      st[role].live++;
      if (perches.some((p) => Math.hypot(p.x - a.x, p.z - a.z) < 1.5 && Math.abs(p.y - a.y) < 1)) st[role].high++;
    }
    for (let k = 0; k < sim.shotCount; k++) {
      const e = sim.shots[k], shooter = sim.actors[e.shooterId], wpn = shooter.slots[shooter.active].stats.id;
      const d = Math.hypot(e.ex - e.ox, e.ez - e.oz);
      if (wpn === 'sniper') { sniperShots++; if (shooter.intent.aim && shooter.moveFraction < 0.1) sniperScopedShots++; }
      if (e.hitKind === 'player') hitDist[wpn]?.push(d);
      if (wpn === 'shotgun' && e.hitKind === 'player' && d > BOT_ROLES.shotgunFireRange + 1) shotgunFar++;
    }
    while (seenKills < sim.kills.length) kills[sim.kills[seenKills++].weapon]++;
    if (sim.kills.length > 6) { sim.kills.length = 0; seenKills = 0; }
    if (sim.round.phase === 'matchEnd') sim.restart();
  }
  const frac = (r) => (st[r].live ? st[r].high / st[r].live : 0);
  const avg = (l) => (l.length ? l.reduce((x, y) => x + y, 0) / l.length : NaN);
  console.log(`time at sniper spots (balconies, long sight lines): sniper ${(frac('sniper') * 100).toFixed(0)}%, rifle ${(frac('rifle') * 100).toFixed(0)}%, shotgun ${(frac('shotgun') * 100).toFixed(0)}%`);
  console.log(`hit distance: sniper ${avg(hitDist.sniper).toFixed(1)} m (${hitDist.sniper.length}), rifle ${avg(hitDist.rifle).toFixed(1)} m (${hitDist.rifle.length}), shotgun ${avg(hitDist.shotgun).toFixed(1)} m (${hitDist.shotgun.length} pellets), pistol ${hitDist.pistol.length}`);
  console.log('kills by weapon:', JSON.stringify(kills));
  check(frac('sniper') > 0.15 && frac('sniper') > 3 * frac('rifle'), 'snipers spend much more time at sniper spots than rifles');
  check(sniperShots > 0 && sniperScopedShots / sniperShots > 0.8, `snipers shoot standing and scoped (${sniperScopedShots}/${sniperShots})`);
  check(hitDist.shotgun.length > 0 && avg(hitDist.shotgun) < avg(hitDist.rifle), 'shotguns hit from closer than rifles');
  // A pellet can hit a second player behind the target, so a few far hits are fine.
  check(shotgunFar <= hitDist.shotgun.length * 0.1, `shotguns fire only at close targets (${shotgunFar} of ${hitDist.shotgun.length} pellet hits beyond ${BOT_ROLES.shotgunFireRange + 1} m)`);
  check(hitDist.sniper.length === 0 || avg(hitDist.sniper) > avg(hitDist.shotgun), 'snipers hit from farther than shotguns');
  console.log(failed ? `BOT ROLES TEST FAILED (${failed})` : 'BOT ROLES TEST PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e);
  process.exitCode = 1;
} finally {
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
