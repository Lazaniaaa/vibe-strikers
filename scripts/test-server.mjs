// Server integration test against a local SpacetimeDB (`spacetime start` + `npm run server:publish`).
// Part 1 (room with bots): rooms by code, bots move, a leaving player is replaced by a bot.
// Part 2 (1v1 room, no bots): movement validation (legit + 4 cheats), then combat: hits, fire rate,
// ammo, reload, weapon switch, kill -> round end -> respawn.
// Usage: node scripts/test-server.mjs
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

try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const { MATCH, ROUND_PRESETS } = await vite.ssrLoadModule('/src/config/rounds.ts');
  const { WEAPON_STATS } = await vite.ssrLoadModule('/src/config/weapons.ts');
  const { capsuleInsideBoxes } = await vite.ssrLoadModule('/src/gameplay/movementCheck.ts');
  const mods = await loadMods(vite);
  const colliders = mods.colliders;
  const PRESET = ROUND_PRESETS[MATCH.preset];
  const nets = [];
  const client = async () => { const n = new GameNet(); await n.connect(); nets.push(n); return n; };
  const pump = setInterval(() => nets.forEach((n) => n.update()), 10);

  // ---------------- Part 1: room with bots
  const a = await client(), b = await client();
  check(a.identityHex && b.identityHex && a.identityHex !== b.identityHex, 'two clients connected with different identities');
  await a.createPrivateRoom('Alice', 3, true);
  const roomA = await waitFor(() => a.me && a.room);
  check(!!roomA && roomA.isPrivate && roomA.code.length === 5, `private room created, code ${roomA?.code}`);
  await b.joinByCode(roomA.code.toLowerCase(), 'Bob', 7);
  await waitFor(() => b.me && b.me.roomId === a.me.roomId);
  check(b.me?.roomId === a.me?.roomId, 'second client joined by code (lower case accepted)');
  await waitFor(() => a.players.size === MATCH.teamSize * 2 && b.players.size === MATCH.teamSize * 2);
  const humans = [...a.players.values()].filter((p) => !p.isBot);
  check(a.players.size === MATCH.teamSize * 2 && humans.length === 2, `room has ${a.players.size} players, ${humans.length} humans`);
  check(a.me.team !== b.me.team, `humans on different teams (${a.me.team} / ${b.me.team})`);
  const { characters } = await vite.ssrLoadModule('/src/characters/characters.ts');
  const botChars = [...a.players.values()].filter((p) => p.isBot).map((p) => p.character);
  check(a.players.get(b.me.id)?.character === 7 && botChars.every((c) => c >= 0 && c < characters.length),
    `chosen character is shown to others (Bob = 7), bots get valid random characters (${botChars.join(',')})`);
  // Subscriptions are per room: a client in another room is invisible here.
  const d = await client();
  await d.joinQuick('Dora', 1);
  await waitFor(() => d.me && d.players.size === MATCH.teamSize * 2);
  await sleep(500);
  check(d.me.roomId !== a.me.roomId && a.knownRoomIds().length === 1 && d.knownRoomIds().length === 1,
    `rows of other rooms are not sent (A knows ${a.knownRoomIds().length} room, D knows ${d.knownRoomIds().length})`);
  d.disconnect();
  let wrong = null;
  try { await a.joinByCode('ZZZZZ', 'Alice', 3); } catch (e) { wrong = e; }
  check(!!wrong, `joining a missing code fails (${a.lastError})`);
  check(a.room?.phase === 'freeze', `round 1 starts with the freeze phase (${a.room?.phase})`);
  await waitFor(() => a.room?.phase === 'live', (PRESET.freezeTime + 2) * 1000);
  check(a.room?.phase === 'live', 'freeze ends, round is live');
  const bots0 = new Map([...a.players.values()].filter((p) => p.isBot).map((p) => [p.id, { x: p.x, z: p.z }]));
  await sleep(2500);
  const movedBots = [...a.players.values()].filter((p) => p.isBot && Math.hypot(p.x - bots0.get(p.id).x, p.z - bots0.get(p.id).z) > 1).length;
  check(movedBots >= 3, `server bots move (${movedBots} of ${bots0.size} moved > 1 m in 2.5 s)`);
  check([...a.players.values()].filter((p) => p.isBot && capsuleInsideBoxes(p.x, p.y, p.z, false, colliders)).length === 0, 'no bot is inside a wall');
  // Bots shoot: within 40 s some bot kills someone (bots fight each other and the idle humans).
  const botKills = [];
  a.onKill = (k) => botKills.push(k);
  await waitFor(() => botKills.length > 0, 40000);
  const killer = botKills[0] && a.players.get(botKills[0].killerId);
  check(botKills.length > 0 && killer?.isBot, `bots shoot and kill (${botKills.length} kill(s), first by ${killer?.name})`);
  a.onKill = null;
  b.disconnect();
  await waitFor(() => [...a.players.values()].filter((p) => !p.isBot).length === 1 && a.players.size === MATCH.teamSize * 2, 4000);
  check([...a.players.values()].filter((p) => !p.isBot).length === 1 && a.players.size === MATCH.teamSize * 2, 'after a client leaves, bots refill the room');

  // ---------------- Part 2: 1v1 room without bots
  await a.createPrivateRoom('Alice', 3, false, 'hard');
  await waitFor(() => a.room && !a.room.bots && a.players.size === 1);
  const c = await client();
  await c.joinByCode(a.room.code, 'Carl', 12);
  await waitFor(() => c.me && a.players.size === 2);
  check(a.players.size === 2 && !a.room.bots, `room without bots: ${a.players.size} players`);
  check(a.room.difficulty === 'hard' && roomA.difficulty === 'normal', `room difficulty stored (private 'hard'; default '${roomA.difficulty}')`);

  // Movement validation.
  const me = { ...a.me };
  const base = { x: me.x, y: me.y, z: me.z, vx: 0, vy: 0, vz: 0, yaw: me.yaw, pitch: 0, crouch: false, grounded: true, walk: true };
  const c0 = a.corrections;
  for (let i = 0; i < 20; i++) {
    a.sendMove({ ...base, x: base.x + Math.sin(i / 3) * 0.3, z: base.z + Math.cos(i / 3) * 0.3 - 0.3 });
    await sleep(1000 / 30);
  }
  await sleep(300);
  check(a.corrections === c0, `legit moves accepted (snap-backs ${a.corrections - c0})`);
  const seenByC = c.players.get(a.me.id);
  check(seenByC && Math.hypot(seenByC.x - a.me.x, seenByC.z - a.me.z) < 0.01 && Math.hypot(seenByC.x - me.x, seenByC.z - me.z) > 0.01,
    'the other client sees the movement');
  const expectSnap = async (label, sample) => {
    const before = a.corrections, pos = { x: a.me.x, y: a.me.y, z: a.me.z };
    a.sendMove({ ...base, ...sample });
    const ok = await waitFor(() => a.corrections > before, 2000);
    check(!!ok && Math.hypot(a.me.x - pos.x, a.me.z - pos.z) < 0.01, `${label}: snapped back to the last valid position`);
    await sleep(100);
  };
  await expectSnap('teleport 10 m', { x: a.me.x + 10, z: a.me.z });
  await expectSnap('too fast (2.6 m in one message)', { x: a.me.x + 2.6, z: a.me.z });
  await expectSnap('flying up 3 m', { y: a.me.y + 3 });
  {
    let target = null;
    for (const bx of colliders) {
      if (bx.h < 1.5 || bx.y - bx.h / 2 > a.me.y + 0.3) continue;
      const px = Math.max(bx.x - bx.w / 2, Math.min(bx.x + bx.w / 2, a.me.x));
      const pz = Math.max(bx.z - bx.d / 2, Math.min(bx.z + bx.d / 2, a.me.z));
      const d = Math.hypot(px - a.me.x, pz - a.me.z);
      if (d > 0.5 && (!target || d < target.d)) target = { x: bx.x, z: bx.z, d };
    }
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
  check(a.me.violations >= 4, `violations counted on the server (${a.me.violations})`);

  // Combat: Carl walks (legally) to a spot Alice can see, then stands still.
  const eyeY = a.me.y + 1.62;
  const spot = findVisibleSpot(mods, a.me.x, eyeY, a.me.z);
  check(!!spot, `found a visible spot ${spot?.d.toFixed(1)} m from Alice`);
  const walked = await walkTo(mods, c, spot.x, spot.z);
  check(walked && c.corrections === 0, `Carl walked ${Math.hypot(spot.x - c.me.x, spot.z - c.me.z) < 0.6 ? 'to the spot' : 'NOT to the spot'} with 0 snap-backs (legal long walk)`);
  await waitFor(() => a.room?.phase === 'live', 30000);
  const aimAt = (net, target) => {
    const dx = target.x - net.me.x, dz = target.z - net.me.z, dy = target.y + 0.5 - (net.me.y + 1.62);
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  };
  await sleep(300);
  const shots = [];
  a.onShot = (e) => shots.push(e);
  const kills = [];
  a.onKill = (k) => kills.push(k);
  let aim = aimAt(a, c.me);
  a.fire(aim.yaw, aim.pitch, a.serverTimeAt(performance.now()));
  await waitFor(() => shots.length >= 1, 3000);
  const rifle = WEAPON_STATS.rifle;
  check(shots[0]?.hitKind === 'player' && Math.abs(c.me.hp - (100 - rifle.damage)) < 0.01, `rifle hit: server event ${shots[0]?.hitKind}, Carl HP ${c.me?.hp}`);
  await waitFor(() => a.me.mag === rifle.magSize - 1, 2000);
  check(a.me.mag === rifle.magSize - 1, `server ammo after 1 shot: ${a.me.mag}`);
  // Fire rate: 10 fire messages at once; the server accepts at most the slack (2 shots).
  await sleep(300);
  const before = shots.length;
  aim = aimAt(a, c.me);
  for (let i = 0; i < 10; i++) a.fire(aim.yaw, aim.pitch + 0.2, a.serverTimeAt(performance.now())); // aim above: no damage
  await sleep(800);
  const accepted = shots.length - before;
  check(accepted >= 1 && accepted <= 2, `fire rate enforced: 10 messages at once, ${accepted} shots accepted`);
  check(a.me.mag === rifle.magSize - 1 - accepted, `server ammo matches accepted shots (${a.me.mag})`);
  // Kill: keep shooting at Carl's body (one shot per 150 ms).
  for (let i = 0; i < 8 && c.me.alive; i++) {
    aim = aimAt(a, c.me);
    a.fire(aim.yaw, aim.pitch, a.serverTimeAt(performance.now()));
    await sleep(150);
  }
  await waitFor(() => kills.length > 0, 2000);
  check(!c.me.alive && kills[0]?.killerId === a.me.id && kills[0]?.victimId === c.me.id, `Carl killed, kill event (${kills.length})`);
  check(a.me.kills === 1 && c.me.deaths === 1, `kills/deaths counted (${a.me.kills} / ${c.me.deaths})`);
  await waitFor(() => a.room?.phase === 'roundEnd', 2000);
  check(a.room?.phase === 'roundEnd' && a.room.scoreA + a.room.scoreB === 1 && a.room.lastWinner === a.me.team,
    `round ends: winner ${a.room?.lastWinner}, score ${a.room?.scoreA}:${a.room?.scoreB}`);
  // Reload during round end.
  a.reload();
  await waitFor(() => a.me.reloading, 2000);
  check(a.me.reloading, 'reload started on the server');
  await waitFor(() => a.me.mag === rifle.magSize && !a.me.reloading, (rifle.reloadTime + 2) * 1000);
  check(a.me.mag === rifle.magSize && a.me.reserve < rifle.reserve, `reload done: ${a.me.mag} / ${a.me.reserve}`);
  a.switchWeapon(1);
  await waitFor(() => a.me.weapon === 1, 2000);
  check(a.me.weapon === 1 && a.me.mag === WEAPON_STATS.pistol.magSize, `switched to pistol (${a.me.mag} rounds)`);
  // Next round: everyone respawns.
  const spawnBefore = c.me.spawnCount;
  await waitFor(() => a.room?.phase === 'freeze' && c.me.alive, (PRESET.roundEndTime + 2) * 1000);
  check(a.room?.phase === 'freeze' && a.room.round === 2 && c.me.alive && c.me.hp === 100 && c.me.spawnCount === spawnBefore + 1,
    `round 2: Carl respawned with ${c.me.hp} HP`);
  check(a.me.weapon === 0 && a.me.mag === rifle.magSize && a.me.reserve === rifle.reserve, 'respawn resets weapons and ammo');
  let aim2;
  // ---------------- Weapons (round 2): loadout, sniper limit, knife, scoped sniper, shotgun pellets.
  await a.setPrimary('sniper');
  await waitFor(() => a.me.primary === 'sniper', 2000);
  check(a.me.primary === 'sniper' && a.me.weapon === 0 && a.me.mag === WEAPON_STATS.sniper.magSize,
    `primary changed to sniper during the freeze phase (mag ${a.me.mag})`);
  const e = await client();
  await e.joinByCode(a.room.code, 'Eve', 2);
  await waitFor(() => e.me);
  let sniperError = '';
  try { await e.setPrimary('sniper'); } catch (err) { sniperError = e.lastError; }
  check(e.me.team === a.me.team && sniperError.includes('sniper'), `max 1 sniper per team: teammate rejected ("${sniperError}")`);
  e.disconnect();
  const walked2 = await walkTo(mods, c, spot.x, spot.z);
  check(walked2, 'Carl walked back to the visible spot');
  await waitFor(() => a.room?.phase === 'live', 20000);
  await sleep(300);
  shots.length = 0;
  a.switchWeapon(2);
  await waitFor(() => a.me.weapon === 2, 2000);
  await sleep(WEAPON_STATS.knife.equipTime * 1000 + 100);
  aim = aimAt(a, c.me);
  a.fire(aim.yaw, aim.pitch, a.serverTimeAt(performance.now()));
  await waitFor(() => shots.length >= 1, 2000);
  check(shots[0]?.weapon === 'knife' && shots[0].hitKind !== 'player' && c.me.hp === 100,
    `knife does not reach ${spot.d.toFixed(1)} m (event ${shots[0]?.weapon} ${shots[0]?.hitKind})`);
  a.switchWeapon(0);
  await waitFor(() => a.me.weapon === 0, 2000);
  await sleep(WEAPON_STATS.sniper.equipTime * 1000 + 100);
  shots.length = 0;
  aim = aimAt(a, c.me);
  a.fire(aim.yaw, aim.pitch, a.serverTimeAt(performance.now()), true);
  await waitFor(() => shots.length >= 1, 2000);
  await waitFor(() => !c.me.alive, 2000);
  check(shots[0]?.weapon === 'sniper' && shots[0].hitKind === 'player' && !c.me.alive, `scoped sniper body shot kills (${shots[0]?.damage} damage)`);
  await waitFor(() => a.room?.phase === 'roundEnd', 3000);
  await a.setPrimary('shotgun');
  check(a.me.nextPrimary === 'shotgun' || (await waitFor(() => a.me.nextPrimary === 'shotgun', 2000)), 'shotgun chosen during round end (next round)');
  await waitFor(() => a.room?.phase === 'freeze' && a.room.round === 3, 8000);
  check(a.me.primary === 'shotgun' && a.me.mag === WEAPON_STATS.shotgun.magSize, `round 3 starts with the shotgun (${a.me.primary}, ${a.me.mag})`);
  await waitFor(() => a.room?.phase === 'live', 8000);
  await sleep(WEAPON_STATS.shotgun.equipTime * 1000);
  shots.length = 0;
  a.fire(a.me.yaw, 0.3, a.serverTimeAt(performance.now()));
  await waitFor(() => shots.length >= WEAPON_STATS.shotgun.pellets, 2000);
  await sleep(200);
  check(shots.length === WEAPON_STATS.shotgun.pellets && shots.every((x) => x.weapon === 'shotgun'), `shotgun fires ${shots.length} pellets`);

  check(a.pingMs > 0 && a.me.ping > 0, `ping measured (${a.pingMs.toFixed(1)} ms) and reported to the server (${a.me.ping} ms)`);

  clearInterval(pump);
  for (const n of nets) n.disconnect();
  console.log(failed ? `SERVER TEST FAILED (${failed})` : 'SERVER TEST PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e);
  process.exitCode = 1;
} finally {
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
