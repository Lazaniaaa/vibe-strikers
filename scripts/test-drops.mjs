// Weapon drops (GAME.md 2.1) against the local server: a dead player's primary drops with its ammo,
// E (pick_up) swaps the primary (the old one drops), range is checked, drops are cleared when the next round starts.
// 4 humans, no bots (2v2) so the round stays live after one death.
// Usage: node scripts/test-drops.mjs
import { createServer } from 'vite';
import { loadMods, walkTo, findVisibleSpot } from './netbot.mjs';

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(25); }
  return null;
}

/** walkTo, retried from the corrected position after a snap-back (the scripted walk is not a real KCC). */
async function walk(mods, net, x, z) {
  for (let i = 0; i < 4; i++) {
    if (await walkTo(mods, net, x, z)) return true;
    await sleep(300);
  }
  return Math.hypot(net.me.x - x, net.me.z - z) < 0.6;
}

try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const { WEAPON_STATS } = await vite.ssrLoadModule('/src/config/weapons.ts');
  const mods = await loadMods(vite);
  const nets = [];
  const client = async () => { const n = new GameNet(); await n.connect(); nets.push(n); return n; };
  const pump = setInterval(() => nets.forEach((n) => n.update()), 10);
  const a = await client(), c = await client(), e = await client(), f = await client();
  await a.createPrivateRoom('Alice', 1, false);
  await waitFor(() => a.me && a.room);
  for (const [n, name] of [[c, 'Carl'], [e, 'Eve'], [f, 'Fred']]) { await n.joinByCode(a.room.code, name, 2); await waitFor(() => n.me); }
  check(a.me.team === e.me.team && c.me.team === f.me.team && a.me.team !== c.me.team, `2v2 (${a.me.team}${e.me.team} v ${c.me.team}${f.me.team})`);
  await c.setPrimary('shotgun');
  await waitFor(() => c.me.primary === 'shotgun', 2000);
  const spot = findVisibleSpot(mods, a.me.x, a.me.y + 1.62, a.me.z, 6, 12, 8);
  check(await walk(mods, c, spot.x, spot.z), 'Carl walked to a spot in view of Alice');
  await waitFor(() => a.room?.phase === 'live', 20000);
  check(a.room.phase === 'live' && a.items.size === 0, `round live, no items yet (${a.items.size})`);
  // Carl fires 2 shells so the dropped shotgun carries 4 / 24.
  await sleep(WEAPON_STATS.shotgun.equipTime * 1000 + 100);
  c.fire(0, 1.2, c.serverTimeAt(performance.now()));
  await sleep(WEAPON_STATS.shotgun.fireInterval * 1000 + 150);
  c.fire(0, 1.2, c.serverTimeAt(performance.now()));
  await waitFor(() => c.me.mag === WEAPON_STATS.shotgun.magSize - 2, 2000);
  // Alice kills Carl with the rifle.
  const aimAt = (net, t) => {
    const dx = t.x - net.me.x, dz = t.z - net.me.z, dy = t.y + 0.5 - (net.me.y + 1.62);
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  };
  let fired = 0;
  for (let i = 0; i < 12 && c.me.alive; i++) {
    const aim = aimAt(a, c.me);
    a.fire(aim.yaw, aim.pitch, a.serverTimeAt(performance.now()));
    fired++;
    await sleep(150);
  }
  await waitFor(() => !c.me.alive && a.items.size === 1, 2000);
  const drop = [...a.items.values()][0];
  check(!c.me.alive && a.room.phase === 'live', `Carl died, round still live (${a.room.phase})`);
  check(drop?.kind === 'weapon' && drop.weapon === 'shotgun' && drop.mag === WEAPON_STATS.shotgun.magSize - 2 && drop.reserve === WEAPON_STATS.shotgun.reserve,
    `Carl's primary dropped with its ammo: ${drop?.weapon} ${drop?.mag} / ${drop?.reserve}`);
  check(drop && Math.hypot(drop.x - c.me.x, drop.z - c.me.z) < 0.01, 'drop lies where Carl died');
  check(e.items.size === 1 && f.items.size === 1, 'every client in the room sees the drop');
  // Too far: nothing happens.
  a.pickUp(drop.id);
  await sleep(500);
  check(a.items.has(drop.id) && a.me.primary === 'rifle', `pick-up from ${Math.hypot(drop.x - a.me.x, drop.z - a.me.z).toFixed(1)} m is rejected`);
  // Walk over it and press E.
  const ammoBefore = a.me.mag;
  check(await walk(mods, a, drop.x, drop.z), 'Alice walked to the drop');
  a.pickUp(drop.id);
  await waitFor(() => a.me.primary === 'shotgun', 2000);
  check(a.me.primary === 'shotgun' && a.me.weapon === 0 && a.me.mag === WEAPON_STATS.shotgun.magSize - 2 && a.me.reserve === WEAPON_STATS.shotgun.reserve,
    `pick-up swaps the primary and draws it: ${a.me.primary} ${a.me.mag} / ${a.me.reserve}`);
  await waitFor(() => a.items.size === 1 && !a.items.has(drop.id), 2000);
  const old = [...a.items.values()][0];
  check(old?.weapon === 'rifle' && old.mag === ammoBefore && Math.hypot(old.x - a.me.x, old.z - a.me.z) < 0.5,
    `old rifle dropped at Alice's feet with its ammo (${old?.mag} / ${old?.reserve}, fired ${fired})`);
  check(a.me.nextPrimary === 'rifle', `next round loadout unchanged (${a.me.nextPrimary})`);
  // Fire the picked-up shotgun: the server uses it.
  const shots = [];
  a.onShot = (s) => shots.push(s);
  await sleep(WEAPON_STATS.shotgun.equipTime * 1000 + 100);
  a.fire(0, 1.2, a.serverTimeAt(performance.now()));
  await waitFor(() => shots.length >= WEAPON_STATS.shotgun.pellets, 2000);
  check(shots.length === WEAPON_STATS.shotgun.pellets && shots[0].weapon === 'shotgun', `picked-up shotgun fires ${shots.length} pellets`);
  // Swap back.
  a.pickUp(old.id);
  await waitFor(() => a.me.primary === 'rifle', 2000);
  check(a.me.primary === 'rifle' && a.me.mag === ammoBefore, `swap back to the rifle (${a.me.mag})`);
  // Round end -> next round: drops cleared, loadout restored.
  f.disconnect();
  await waitFor(() => a.room?.phase === 'roundEnd', 3000);
  check(a.items.size >= 1, `drops stay during round end (${a.items.size})`);
  await waitFor(() => a.room?.phase === 'freeze' && a.room.round === 2, 8000);
  await waitFor(() => a.items.size === 0, 2000);
  check(a.room.phase === 'freeze' && a.items.size === 0 && e.items.size === 0, `next round: drops cleared (${a.items.size})`);
  check(a.me.primary === 'rifle' && c.me.primary === 'shotgun' && c.me.alive, `loadouts restored (${a.me.primary}, ${c.me.primary})`);
  clearInterval(pump);
  for (const n of nets) n.disconnect();
  console.log(failed ? `DROPS TEST FAILED (${failed})` : 'DROPS TEST PASS');
  process.exitCode = failed ? 1 : 0;
} catch (err) {
  console.log('ERROR', err);
  process.exitCode = 1;
} finally {
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
