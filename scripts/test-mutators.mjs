// Mutators on the server: oneShot (any hit kills), bigHeads (head hit box x2), rocketBoots (everyone has boots),
// fastRun (faster moves accepted), Quick Play = mutator of the day. Usage: node scripts/test-mutators.mjs
import { createServer } from 'vite';
import { loadMods, walkTo, findVisibleSpot } from './netbot.mjs';

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
async function waitFor(fn, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(25); } return null; }
async function walk(mods, net, x, z) {
  for (let i = 0; i < 6; i++) {
    if (await walkTo(mods, net, x, z)) return true;
    await sleep(300);
    await walkTo(mods, net, net.me.x + (i % 2 ? 1.5 : -1.5), net.me.z + (i % 3 ? 1.5 : -1.5));
  }
  return Math.hypot(net.me.x - x, net.me.z - z) < 0.6;
}
try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const { mutatorOfDay } = await vite.ssrLoadModule('/src/config/mutators.ts');
  const { HITBOXES } = await vite.ssrLoadModule('/src/config/hitboxes.ts');
  const { MOVEMENT } = await vite.ssrLoadModule('/src/config/movement.ts');
  const mods = await loadMods(vite);
  const nets = [];
  const client = async () => { const n = new GameNet(); await n.connect(); nets.push(n); return n; };
  const pump = setInterval(() => nets.forEach((n) => n.update()), 10);
  const room = async (mutator) => {
    const a = await client(), c = await client();
    await a.createPrivateRoom('Alice', 1, false, 'normal', 'elimination', true, mutator);
    await waitFor(() => a.me && a.room);
    await c.joinByCode(a.room.code, 'Carl', 2);
    await waitFor(() => c.me && a.players.size === 2);
    return { a, c };
  };
  const shootAt = (a, c, yOff) => {
    const dx = c.me.x - a.me.x, dz = c.me.z - a.me.z, dy = c.me.y + yOff - (a.me.y + 1.62);
    a.fire(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)), a.serverTimeAt(performance.now()));
  };
  const face = async (a, c) => {
    const spot = findVisibleSpot(mods, a.me.x, a.me.y + 1.62, a.me.z, 6, 10, 8);
    await walk(mods, c, spot.x, spot.z);
    await waitFor(() => a.room.phase === 'live', 15000);
    await sleep(600);
  };
  // oneShot
  let { a, c } = await room('oneShot');
  check(a.room.mutator === 'oneShot', `room mutator ${a.room.mutator}`);
  await face(a, c);
  const shots = []; a.onShot = (e) => shots.push(e);
  shootAt(a, c, 0.5);
  await waitFor(() => shots.length > 0, 2000); await sleep(300);
  check(shots[0]?.hitKind === 'player' && !c.me.alive, `oneShot: one rifle body hit kills (${shots[0]?.damage} damage)`);
  a.disconnect(); c.disconnect();
  // bigHeads: aim above the normal head top.
  ({ a, c } = await room('bigHeads'));
  await face(a, c);
  const shots2 = []; a.onShot = (e) => shots2.push(e);
  shootAt(a, c, HITBOXES.head.cy + HITBOXES.head.h / 2 + 0.35);
  await waitFor(() => shots2.length > 0, 2000);
  check(shots2[0]?.hitKind === 'player' && shots2[0].part === 'head', `bigHeads: a shot 0.35 m above the normal head hits the big head (${shots2[0]?.hitKind} ${shots2[0]?.part})`);
  a.disconnect(); c.disconnect();
  // rocketBoots + fastRun
  ({ a, c } = await room('rocketBoots'));
  check(a.me.boots && c.me.boots, 'rocketBoots: everyone spawns with boots');
  a.disconnect(); c.disconnect();
  ({ a, c } = await room('fastRun'));
  await waitFor(() => a.room.phase === 'live', 15000);
  const before = a.corrections, sp = MOVEMENT.runSpeed * 1.3;
  let { x, y, z } = a.me;
  for (let i = 0; i < 20; i++) {
    const dir = i < 10 ? 1 : -1; x += dir * sp / 30;
    a.sendMove({ x, y, z, vx: dir * sp, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: false, grounded: true, walk: false });
    await sleep(1000 / 30);
  }
  await sleep(500);
  check(a.corrections === before, `fastRun: moving at 1.3x run speed is accepted (${a.corrections - before} snap-backs)`);
  a.disconnect(); c.disconnect();
  // Quick Play: mutator of the day.
  const q = await client();
  await q.joinQuick('Quinn', 1);
  await waitFor(() => q.me && q.room);
  check(q.room.mutator === mutatorOfDay(Date.now()), `Quick Play mutator of the day: ${q.room.mutator}`);
  clearInterval(pump);
  for (const n of nets) n.disconnect();
  console.log(failed ? `MUTATORS TEST FAILED (${failed})` : 'MUTATORS TEST PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) { console.log('ERROR', e); process.exitCode = 1; }
finally { await vite.close(); setTimeout(() => process.exit(), 200); }
