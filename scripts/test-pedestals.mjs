// Cornucopia pedestals on the server: standing on and walking around a pedestal gives no snap-backs, walking
// through one is snapped back, server bots walk around them (never inside) and still take loot.
// Usage: node scripts/test-pedestals.mjs
import { createServer } from 'vite';
import { loadMods, walkTo } from './netbot.mjs';

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
async function waitFor(fn, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(25); } return null; }
try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const { pedestalBoxes } = await vite.ssrLoadModule('/src/gameplay/items.ts');
  const { capsuleInsideBoxes } = await vite.ssrLoadModule('/src/gameplay/movementCheck.ts');
  const { buildMapNav } = await vite.ssrLoadModule('/src/gameplay/mapNav.ts');
  const { ITEMS } = await vite.ssrLoadModule('/src/config/items.ts');
  const mods = await loadMods(vite);
  const peds = pedestalBoxes(mods.map.lootSpots);
  // The scripted walker uses a nav grid that knows the pedestals, like the server bots.
  mods.grid = buildMapNav([...mods.colliders, ...peds], mods.map.bounds, mods.map.boxes.filter((b) => b.kind === 'stair'), mods.M.spawnPoints(mods.map, 'A')[0], mods.map.zones).nav;
  const walk = async (net, x, z) => {
    for (let i = 0; i < 5; i++) { await walkTo(mods, net, x, z); await sleep(300); if (Math.hypot(net.me.x - x, net.me.z - z) < 0.3) return true; }
    return false;
  };
  const a = new GameNet(); await a.connect();
  const pump = setInterval(() => a.update(), 10);
  await a.createPrivateRoom('Alice', 1, true, 'normal', 'cornucopia', true, '');
  await waitFor(() => a.me && a.room && a.players.size === 8, 5000);
  await waitFor(() => a.room.phase === 'live', 15000);
  // A floor pedestal with open floor around it; start from a walkable nav cell about 1 m from its centre.
  const cand = mods.map.lootSpots.filter((p) => p.y < 1).map((p) => {
    const c = mods.nav.nearestWalkable(mods.grid, p.x + 1, p.y, p.z);
    const sx = mods.nav.nodeX(mods.grid, c), sz = mods.nav.nodeZ(mods.grid, c);
    return { p, sx, sz, R: Math.hypot(sx - p.x, sz - p.z), t0: Math.atan2(sz - p.z, sx - p.x) };
  }).filter((k) => k.R > 0.85 && k.R < 1.6 && Array.from({ length: 33 }, (_, i) => k.t0 + (i / 32 - 0.5) * Math.PI)
    .every((t) => !capsuleInsideBoxes(k.p.x + Math.cos(t) * k.R, k.p.y, k.p.z + Math.sin(t) * k.R, false, mods.colliders)))
    .sort((u, v) => Math.hypot(u.sx - a.me.x, u.sz - a.me.z) - Math.hypot(v.sx - a.me.x, v.sz - a.me.z));
  if (!cand.length) throw new Error("no pedestal candidate");
  const { p: spot, R, t0 } = cand[0];
  check(await walk(a, cand[0].sx, cand[0].sz), `walked next to a pedestal at (${spot.x}, ${spot.z}), ${R.toFixed(2)} m from its centre`);
  const send = (x, y, z, vx = 0, vz = 0) => a.sendMove({ x, y, z, vx, vy: 0, vz, yaw: 0, pitch: 0, crouch: false, grounded: true, walk: false });
  let c0 = a.corrections, y = a.me.y;
  // Walk half way around it close to its side (+-90 degrees and back), about 3 m/s.
  const arc = (u) => t0 + Math.sin(u) * Math.PI / 2;
  for (let i = 1; i <= 64; i++) { const t = arc((i / 64) * Math.PI * 2); send(spot.x + Math.cos(t) * R, y, spot.z + Math.sin(t) * R); await sleep(1000 / 30); }
  await sleep(400);
  check(a.corrections === c0, `walking around the pedestal (${R.toFixed(2)} m from its centre): ${a.corrections - c0} snap-backs`);
  // Jump onto it: rise, move over, land on top.
  c0 = a.corrections;
  const top = spot.y + ITEMS.pedestalHeight;
  for (let i = 1; i <= 6; i++) { send(spot.x + Math.cos(t0) * R, y + (top + 0.1 - y) * i / 6, spot.z + Math.sin(t0) * R); await sleep(1000 / 30); }
  for (let i = 1; i <= 10; i++) { send(spot.x + Math.cos(t0) * R * (1 - i / 10), top + 0.1, spot.z + Math.sin(t0) * R * (1 - i / 10)); await sleep(1000 / 30); }
  send(spot.x, top, spot.z); await sleep(1000 / 30);
  for (let i = 0; i < 10; i++) { send(spot.x, top, spot.z); await sleep(1000 / 30); }
  await sleep(400);
  check(a.corrections === c0 && Math.abs(a.me.y - top) < 0.05, `standing on the pedestal (y ${a.me.y.toFixed(2)}): ${a.corrections - c0} snap-backs`);
  // Step down and walk straight through it at floor height: snapped back.
  for (let i = 1; i <= 8; i++) { send(spot.x + R * i / 8, top + 0.1, spot.z); await sleep(1000 / 30); }
  for (let i = 1; i <= 6; i++) { send(spot.x + R, top - (top - y) * i / 6, spot.z); await sleep(1000 / 30); }
  await sleep(300);
  c0 = a.corrections;
  for (let i = 1; i <= 20; i++) { send(spot.x + R - (2 * R) * i / 20, y, spot.z); await sleep(1000 / 30); if (a.corrections > c0) break; }
  await sleep(400);
  check(a.corrections > c0, 'walking through a pedestal is snapped back (the server sees it)');
  // Bots: 20 s of play.
  await sleep(20000);
  const bots = [...a.players.values()].filter((p) => p.isBot);
  check(bots.every((p) => !p.alive || !capsuleInsideBoxes(p.x, p.y, p.z, false, peds)), 'no bot is inside a pedestal');
  check(bots.reduce((n, p) => n + p.violations, 0) === 0, `server bots: ${bots.reduce((n, p) => n + p.violations, 0)} movement violations`);
  check(bots.some((p) => p.primary !== ''), `bots still take loot (${bots.filter((p) => p.primary !== '').map((p) => p.primary).join(', ')})`);
  clearInterval(pump); a.disconnect();
  console.log(failed ? `PEDESTALS TEST FAILED (${failed})` : 'PEDESTALS TEST PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) { console.log('ERROR', e); process.exitCode = 1; }
finally { await vite.close(); setTimeout(() => process.exit(), 200); }
