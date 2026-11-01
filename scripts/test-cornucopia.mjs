// Cornucopia (GAME.md 2.2) against the local server, free-for-all, 2 humans, no bots:
// loot on pedestals by tier, knife + pistol with one magazine, ammo / weapon / medkit / boots pick-ups,
// heal over time, one life: the last player alive wins, then a new match with fresh loot.
// Usage: node scripts/test-cornucopia.mjs
import { createServer } from 'vite';
import { loadMods, walkTo } from './netbot.mjs';

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(25); }
  return null;
}
/** walkTo, retried after a snap-back via a small detour (the scripted walker is not a KCC and can clip a corner). */
async function walk(mods, net, x, z, y = 0) {
  for (let i = 0; i < 6; i++) {
    if (await walkTo(mods, net, x, z, 4.5, y)) return true;
    await sleep(300);
    const k = i + 1, ox = net.me.x + (k % 2 ? 1.5 : -1.5), oz = net.me.z + (k % 3 ? 1.5 : -1.5);
    await walkTo(mods, net, ox, oz);
    await sleep(200);
  }
  return Math.hypot(net.me.x - x, net.me.z - z) < 0.6;
}

try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const { WEAPON_STATS } = await vite.ssrLoadModule('/src/config/weapons.ts');
  const { CORNUCOPIA } = await vite.ssrLoadModule('/src/config/items.ts');
  const { MATCH } = await vite.ssrLoadModule('/src/config/rounds.ts');
  const mods = await loadMods(vite);
  // Pedestals are solid on the server: the scripted walker uses a nav grid that knows them (stops beside them).
  {
    const { pedestalBoxes } = await vite.ssrLoadModule('/src/gameplay/items.ts');
    const { buildMapNav } = await vite.ssrLoadModule('/src/gameplay/mapNav.ts');
    mods.grid = buildMapNav([...mods.colliders, ...pedestalBoxes(mods.map.lootSpots)], mods.map.bounds,
      mods.map.boxes.filter((b) => b.kind === 'stair'), mods.M.spawnPoints(mods.map, 'A')[0], mods.map.zones).nav;
  }
  const nets = [];
  const client = async () => { const n = new GameNet(); await n.connect(); nets.push(n); return n; };
  const pump = setInterval(() => nets.forEach((n) => n.update()), 10);
  const a = await client(), c = await client();
  await a.createPrivateRoom('Alice', 1, false, 'normal', 'cornucopia', false);
  await waitFor(() => a.me && a.room);
  await c.joinByCode(a.room.code, 'Carl', 2);
  await waitFor(() => c.me && a.players.size === 2);
  check(a.room.mode === 'cornucopia' && !a.room.teams, `room mode ${a.room.mode}, teams ${a.room.teams}`);
  check(a.me.team.startsWith('F') && c.me.team.startsWith('F') && a.me.team !== c.me.team, `free-for-all teams ${a.me.team} / ${c.me.team}`);
  check(a.me.primary === '' && a.me.weapon === 1 && a.me.mag === CORNUCOPIA.pistolMag && a.me.reserve === CORNUCOPIA.pistolReserve,
    `start: no primary, pistol ${a.me.mag} / ${a.me.reserve}`);
  await waitFor(() => a.items.size === mods.map.lootSpots.length, 3000);
  const items = [...a.items.values()];
  const count = (k, w) => items.filter((i) => i.kind === k && (!w || i.weapon === w)).length;
  check(items.length === mods.map.lootSpots.length && items.every((i) => i.pedestal),
    `${items.length} loot items on pedestals: ammo ${count('ammo')}, shotgun ${count('weapon', 'shotgun')}, rifle ${count('weapon', 'rifle')}, sniper ${count('weapon', 'sniper')}, medkit ${count('medkit')}, boots ${count('boots')}`);
  const high = items.filter((i) => i.y > 1);
  check(high.some((i) => i.weapon === 'sniper') && high.some((i) => i.kind === 'boots') && count('weapon', 'sniper') === 1,
    'centre (high tier, balconies): sniper, boots, medkits');
  check(items.filter((i) => i.kind === 'weapon' && i.weapon === 'rifle').every((i) => i.mag === WEAPON_STATS.rifle.magSize), 'loot weapons come with full ammo');
  let setErr = '';
  try { await a.setPrimary('rifle'); } catch { setErr = a.lastError; }
  check(setErr.includes('Cornucopia'), `no loadout choice in Cornucopia ("${setErr}")`);
  await waitFor(() => a.room.phase === 'live', 10000);
  // Late join: spectate until the next match (one life per match).
  const d = await client();
  await d.joinByCode(a.room.code, 'Dora', 3);
  await waitFor(() => d.me, 3000);
  check(d.me && !d.me.alive && d.me.hp === 0, `a player joining a running match spectates (alive ${d.me?.alive})`);
  a.switchWeapon(0);
  await sleep(400);
  check(a.me.weapon === 1, 'slot 1 (primary) cannot be drawn without a primary');
  const nearest = (net, pred) => [...net.items.values()].filter(pred).sort((p, q) => Math.hypot(p.x - net.me.x, p.z - net.me.z) - Math.hypot(q.x - net.me.x, q.z - net.me.z))[0];
  // Ammo.
  let it = nearest(a, (i) => i.kind === 'ammo');
  check(await walk(mods, a, it.x, it.z), 'Alice walked to an ammo box');
  a.pickUp(it.id);
  await waitFor(() => a.me.reserve === CORNUCOPIA.pistolReserve + CORNUCOPIA.ammoAmount, 2000);
  check(a.me.reserve === CORNUCOPIA.pistolReserve + CORNUCOPIA.ammoAmount && !a.items.has(it.id), `ammo box: pistol reserve ${a.me.reserve}`);
  // First weapon: nothing drops.
  it = nearest(a, (i) => i.kind === 'weapon' && i.weapon === 'shotgun');
  check(await walk(mods, a, it.x, it.z), 'Alice walked to a shotgun pedestal');
  const before = a.items.size;
  a.pickUp(it.id);
  await waitFor(() => a.me.primary === 'shotgun', 2000);
  await sleep(300);
  check(a.me.primary === 'shotgun' && a.me.weapon === 0 && a.items.size === before - 1, `shotgun taken, drawn, no drop (items ${before} -> ${a.items.size})`);
  // Medkit at full HP: refused.
  it = nearest(a, (i) => i.kind === 'medkit' && i.y < 1);
  check(await walk(mods, a, it.x, it.z), 'Alice walked to a medkit');
  a.pickUp(it.id);
  await sleep(500);
  check(a.items.has(it.id) && a.me.healLeft === 0, 'medkit at full HP is not used');
  // Carl comes close and shoots Alice once with the pistol.
  check(await walk(mods, c, a.me.x + 2.5, a.me.z), 'Carl walked next to Alice');
  await sleep(WEAPON_STATS.pistol.equipTime * 1000);
  const aim = () => { const dx = a.me.x - c.me.x, dz = a.me.z - c.me.z, dy = a.me.y + 0.5 - (c.me.y + 1.62); return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
  for (let i = 0; i < 3 && a.me.hp === MATCH.maxHealth; i++) { const t = aim(); c.fire(t.yaw, t.pitch, c.serverTimeAt(performance.now())); await sleep(400); }
  const hurt = a.me.hp;
  check(hurt < MATCH.maxHealth, `Alice hurt: ${hurt} HP`);
  a.pickUp(it.id);
  await waitFor(() => a.me.healLeft > 0, 2000);
  check(a.me.healLeft > 0 && !a.items.has(it.id), 'medkit used (healing)');
  await sleep(CORNUCOPIA.medkitTime * 1000 + 400);
  const healed = Math.min(MATCH.maxHealth, hurt + CORNUCOPIA.medkitHeal);
  check(Math.abs(a.me.hp - healed) < 0.6 && a.me.healLeft === 0, `healed over ${CORNUCOPIA.medkitTime} s: ${hurt} -> ${a.me.hp.toFixed(1)} HP`);
  // Boots lie on a balcony: the scripted walker cannot climb stairs (not a KCC), so boots are checked in the
  // offline browser test (scripts/e2e-cornucopia.cjs) and the unit test; the server uses the same useItem().
  // One life: Alice kills Carl with the shotgun from close up; last one standing wins the match.
  check(await walk(mods, c, a.me.x + 2, a.me.z), 'Carl came close again');
  await sleep(300);
  for (let i = 0; i < 6 && c.me.alive; i++) {
    const dx = c.me.x - a.me.x, dz = c.me.z - a.me.z, dy = c.me.y + 0.6 - (a.me.y + 1.62);
    a.fire(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)), a.serverTimeAt(performance.now()));
    await sleep(WEAPON_STATS.shotgun.fireInterval * 1000 + 100);
  }
  await waitFor(() => a.room.phase === 'matchEnd', 3000);
  check(!c.me.alive && !d.me.alive && a.room.phase === 'matchEnd' && a.room.matchWinner === a.me.team, `Carl dead, match over: winner ${a.room.matchWinner} (Alice ${a.me.team})`);
  await waitFor(() => a.room.phase === 'freeze', (MATCH.matchRestartTime + 3) * 1000);
  await waitFor(() => a.items.size === mods.map.lootSpots.length && a.me.primary === '', 3000);
  check(d.me.alive, 'the late joiner plays in the next match');
  check(a.room.phase === 'freeze' && c.me.alive && a.me.primary === '' && !a.me.boots && a.items.size === mods.map.lootSpots.length,
    `new match: everyone alive, no primary, no boots, fresh loot (${a.items.size})`);
  clearInterval(pump);
  for (const n of nets) n.disconnect();
  console.log(failed ? `CORNUCOPIA TEST FAILED (${failed})` : 'CORNUCOPIA TEST PASS');
  process.exitCode = failed ? 1 : 0;
} catch (err) {
  console.log('ERROR', err);
  process.exitCode = 1;
} finally {
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
