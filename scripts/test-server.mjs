// M2a server integration test against a local SpacetimeDB (`spacetime start` + `npm run server:publish`).
// Usage: node scripts/test-server.mjs
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }

async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(25); }
  return null;
}

try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const M = await vite.ssrLoadModule('/src/maps/index.ts');
  const { MAP_ID } = await vite.ssrLoadModule('/src/config/game.ts');
  const { MATCH } = await vite.ssrLoadModule('/src/config/rounds.ts');
  const { capsuleInsideBoxes } = await vite.ssrLoadModule('/src/gameplay/movementCheck.ts');
  const colliders = M.mapColliders(M.loadMapData(MAP_ID)).boxes;
  const pump = (...nets) => setInterval(() => nets.forEach((n) => n.update()), 10);

  const a = new GameNet(), b = new GameNet();
  await a.connect(); await b.connect();
  const timer = pump(a, b);
  check(a.identityHex && b.identityHex && a.identityHex !== b.identityHex, 'two clients connected with different identities');

  await a.createPrivateRoom('Alice', 3);
  const roomA = await waitFor(() => a.me && a.room);
  check(!!roomA && roomA.isPrivate && roomA.code.length === 5, `private room created, code ${roomA?.code}`);
  await b.joinByCode(roomA.code.toLowerCase(), 'Bob', 7);
  await waitFor(() => b.me && b.me.roomId === a.me.roomId);
  check(b.me?.roomId === a.me?.roomId, 'second client joined by code (lower case accepted)');
  await waitFor(() => a.players.size === MATCH.teamSize * 2 && b.players.size === MATCH.teamSize * 2);
  const humans = [...a.players.values()].filter((p) => !p.isBot);
  check(a.players.size === MATCH.teamSize * 2 && humans.length === 2, `room has ${a.players.size} players, ${humans.length} humans`);
  check(a.me.team !== b.me.team, `humans on different teams (${a.me.team} / ${b.me.team})`);
  let wrong = null;
  try { await a.joinByCode('ZZZZZ', 'Alice', 3); } catch (e) { wrong = e; }
  check(!!wrong, `joining a missing code fails (${a.lastError})`);
  await waitFor(() => a.me);

  // Bots move on the server.
  const bots0 = new Map([...a.players.values()].filter((p) => p.isBot).map((p) => [p.id, { x: p.x, z: p.z }]));
  await sleep(2500);
  const movedBots = [...a.players.values()].filter((p) => p.isBot && Math.hypot(p.x - bots0.get(p.id).x, p.z - bots0.get(p.id).z) > 1).length;
  check(movedBots >= 3, `server bots move (${movedBots} of ${bots0.size} moved > 1 m in 2.5 s)`);
  const botsInWalls = [...a.players.values()].filter((p) => p.isBot && capsuleInsideBoxes(p.x, p.y, p.z, false, colliders)).length;
  check(botsInWalls === 0, 'no bot is inside a wall');

  // Legit movement: small steps around the spawn at walking speed.
  const me = { ...a.me };
  const base = { x: me.x, y: me.y, z: me.z, vx: 0, vy: 0, vz: 0, yaw: me.yaw, pitch: 0, crouch: false, grounded: true, walk: true };
  const c0 = a.corrections;
  for (let i = 0; i < 20; i++) {
    a.sendMove({ ...base, x: base.x + Math.sin(i / 3) * 0.3, z: base.z + Math.cos(i / 3) * 0.3 - 0.3 });
    await sleep(1000 / 30);
  }
  await sleep(300);
  check(a.corrections === c0, `legit moves accepted (corrections ${a.corrections - c0})`);
  const seenByB = b.players.get(a.me.id);
  check(seenByB && Math.hypot(seenByB.x - a.me.x, seenByB.z - a.me.z) < 0.01 && Math.hypot(seenByB.x - me.x, seenByB.z - me.z) > 0.01,
    'the other client sees the movement');

  const expectSnap = async (label, sample) => {
    const before = a.corrections, pos = { x: a.me.x, y: a.me.y, z: a.me.z };
    a.sendMove({ ...base, ...sample });
    const ok = await waitFor(() => a.corrections > before, 2000);
    check(!!ok && Math.hypot(a.me.x - pos.x, a.me.z - pos.z) < 0.01, `${label}: snapped back to the last valid position`);
  };
  await expectSnap('teleport 10 m', { x: a.me.x + 10, z: a.me.z });
  await sleep(100);
  // Too fast: 2 m in one 33 ms message is about 60 m/s (under the teleport limit).
  await expectSnap('too fast (2.6 m in one message)', { x: a.me.x + 2.6, z: a.me.z });
  await sleep(100);
  await expectSnap('flying up 3 m', { y: a.me.y + 3 });
  await sleep(100);
  // Inside a wall: walk at a legal speed straight into the nearest tall box; the server must stop us outside it.
  let target = null;
  for (const bx of colliders) {
    if (bx.h < 1.5 || bx.y - bx.h / 2 > a.me.y + 0.3) continue;
    const px = Math.max(bx.x - bx.w / 2, Math.min(bx.x + bx.w / 2, a.me.x));
    const pz = Math.max(bx.z - bx.d / 2, Math.min(bx.z + bx.d / 2, a.me.z));
    const d = Math.hypot(px - a.me.x, pz - a.me.z);
    if (d > 0.5 && (!target || d < target.d)) target = { x: bx.x, z: bx.z, d };
  }
  {
    const before = a.corrections, start = { x: a.me.x, z: a.me.z };
    const len = Math.hypot(target.x - start.x, target.z - start.z), step = 4.5 / 30;
    let x = start.x, z = start.z;
    for (let i = 0; i < Math.ceil(len / step) && a.corrections === before; i++) {
      x += (target.x - start.x) / len * step; z += (target.z - start.z) / len * step;
      a.sendMove({ ...base, x, z, walk: false });
      await sleep(1000 / 30);
    }
    await waitFor(() => a.corrections > before, 2000);
    check(a.corrections > before && !capsuleInsideBoxes(a.me.x, a.me.y, a.me.z, false, colliders),
      `walking into a wall (${target.d.toFixed(1)} m away): stopped and snapped back outside the wall`);
  }
  const violations = a.me.violations;
  check(violations >= 3, `violations counted on the server (${violations})`);

  // Leaving: a bot takes the place.
  b.disconnect();
  await waitFor(() => [...a.players.values()].filter((p) => !p.isBot).length === 1 && a.players.size === MATCH.teamSize * 2, 4000);
  check([...a.players.values()].filter((p) => !p.isBot).length === 1 && a.players.size === MATCH.teamSize * 2, 'after a client leaves, bots refill the room');

  clearInterval(timer);
  a.disconnect();
  console.log(failed ? `SERVER TEST FAILED (${failed})` : 'SERVER TEST PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e);
  process.exitCode = 1;
} finally {
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
