// Unit checks for pure gameplay code. Run: npm run test:gameplay
import assert from 'node:assert/strict';
import { WEAPON_STATS } from '../config/weapons.ts';
import { HITBOXES } from '../config/hitboxes.ts';
import { ROUND_PRESETS } from '../config/rounds.ts';
import { createShotResult, rayAabb, rayPlayer, traceShot, type HitTarget } from './hitscan.ts';
import { directionFromAngles, spreadDirection, vec3, DEG } from './math.ts';
import { canFire, consumeShot, createSlot, startReload, tickSlot, damageAt, spreadDeg, cycleProgress } from './weaponLogic.ts';
import { createRoundState, tickRound } from './round.ts';
import { ClientValidatedMovement, capsuleInsideBoxes } from './movementCheck.ts';
import { PoseHistory } from './rewind.ts';
import { synth } from '../ui/sfxSynth.ts';
import { SOUNDS } from '../config/audio.ts';
import { createActor } from './actor.ts';
import { cornucopiaLoadout, nearestItem, primaryState, swapPrimary, tickHeal, useItem } from './items.ts';
import { lootPlan, tickModeRound } from './mode.ts';
import { MUTATOR_IDS, mutatorOfDay, mutatorRules } from '../config/mutators.ts';
import { CORNUCOPIA } from '../config/items.ts';
import { MARKET } from '../config/market.ts';
import { itemRarity, marketPrices, matchPays, matchReward, newSales, priceError, RateLimiter, saleFee, starterRefs, suggestedPrice, textRandom, utcDay, type CatalogItem } from './marketRules.ts';
import { NFT } from '../config/nft.ts';
import { formatEth, parseEthPrice, saleTypedData } from './nftSale.ts';
import { nftListError, nftName, nftRarity, nftRef, nftSeed, nftSkinWord, nftTokenId, parseNftRef } from './nft.ts';
import { AUTH } from '../config/auth.ts';
import { loginError, personalHash, recoverSigner, signLogin } from './walletAuth.ts';
import { loginMessage } from './walletMessage.ts';
import { formatTokens, payoutPlan, toUnits, weekLabel, weekOf, weekPoints, weekStartMs } from './rewards.ts';
import { REWARDS } from '../config/rewards.ts';
import { DAY_MS, DAY_STREAK, PROGRESSION, QUESTS, SEASON } from '../config/season.ts';
import { KILL_STREAK } from '../config/feedback.ts';
import { KillStreak } from './killStreak.ts';
import { AUDIO } from '../config/audio.ts';
import { hearingGain } from './hearing.ts';
import { levelCost, levelOf, matchXp, questEndMs, questLine, questScope, questsDone, questsNewlyDone, questXp, seasonActive, seasonClaim, seasonLevel, seasonReward, streakAfterPlay, streakCoins } from './progression.ts';
import { callData, decodeUint, encodeArgs, selector } from '../network/evm.ts';
import { buildNavGrid, findPath, groundAt, nearestWalkable, nodeY, pruneUnreachable, upperAreas } from './navGrid.ts';

let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log('ok', name); }

test('ray vs aabb', () => {
  assert.equal(rayAabb(0, 0, 0, 1, 0, 0, 2, -1, -1, 3, 1, 1, 100), 2);
  assert.equal(rayAabb(0, 0, 0, -1, 0, 0, 2, -1, -1, 3, 1, 1, 100), Infinity);
  assert.equal(rayAabb(0, 5, 0, 1, 0, 0, 2, -1, -1, 3, 1, 1, 100), Infinity);
  assert.equal(rayAabb(0, 0, 0, 1, 0, 0, 2, -1, -1, 3, 1, 1, 1.5), Infinity);
});

const target: HitTarget = { id: 1, x: 0, y: 0, z: -10, yaw: 0, crouching: false };
const part = { part: 'body' as 'head' | 'body' };

test('headshot when the ray reaches the head box first', () => {
  const t = rayPlayer(vec3(0, HITBOXES.head.cy, 0), vec3(0, 0, -1), 100, target, part);
  assert.equal(part.part, 'head');
  assert.ok(Math.abs(t - (10 - HITBOXES.head.d / 2)) < 1e-9);
});

test('body hit and miss', () => {
  rayPlayer(vec3(0, 0.4, 0), vec3(0, 0, -1), 100, target, part);
  assert.equal(part.part, 'body');
  assert.equal(rayPlayer(vec3(2, 0.4, 0), vec3(0, 0, -1), 100, target, part), Infinity);
});

test('hit boxes rotate with yaw', () => {
  // Body box is 0.9 wide (x) and 0.6 deep (z). Ray along +X at z offset 0.4 misses unrotated, hits at yaw 90 deg.
  const t0: HitTarget = { id: 1, x: 0, y: 0, z: 0, yaw: 0, crouching: false };
  assert.equal(rayPlayer(vec3(-5, 0.4, 0.4), vec3(1, 0, 0), 100, t0, part), Infinity);
  const t90: HitTarget = { ...t0, yaw: Math.PI / 2 };
  assert.ok(rayPlayer(vec3(-5, 0.4, 0.4), vec3(1, 0, 0), 100, t90, part) < 100);
});

test('crouch lowers the head box', () => {
  const crouched: HitTarget = { ...target, crouching: true };
  rayPlayer(vec3(0, HITBOXES.head.cy + 0.3, 0), vec3(0, 0, -1), 100, crouched, part);
  assert.equal(rayPlayer(vec3(0, 1.75, 0), vec3(0, 0, -1), 100, crouched, part), Infinity);
});

test('walls block shots', () => {
  const wall = [{ x: 0, y: 1, z: -5, w: 4, h: 4, d: 0.5 }];
  const r = traceShot(vec3(0, 1.3, 0), vec3(0, 0, -1), 100, wall, [target], () => false, createShotResult());
  assert.equal(r.kind, 'world');
  const r2 = traceShot(vec3(0, 1.3, 0), vec3(0, 0, -1), 100, [], [target], () => false, createShotResult());
  assert.equal(r2.kind, 'player');
  assert.equal(r2.part, 'head');
});

test('direction from angles', () => {
  const d = directionFromAngles(0, 0, vec3());
  assert.ok(Math.abs(d.z + 1) < 1e-12);
  directionFromAngles(Math.PI / 2, 0, d);
  assert.ok(Math.abs(d.x + 1) < 1e-12); // positive yaw turns left (towards -X)
});

test('spread stays inside the cone', () => {
  const dir = vec3(0, 0, -1), out = vec3();
  for (let i = 0; i < 200; i++) {
    spreadDirection(dir, 2 * DEG, Math.random(), Math.random(), out);
    assert.ok(Math.acos(-out.z) <= 2 * DEG + 1e-9);
  }
});

test('rifle: fire rate, magazine, reload', () => {
  const slot = createSlot(WEAPON_STATS.rifle);
  let shots = 0;
  for (let t = 0; t < 1.0001; t += 0.01) {
    while (canFire(slot)) { consumeShot(slot); shots++; }
    tickSlot(slot, 0.01);
  }
  assert.ok(shots >= 10 && shots <= 11, `600 rpm gives 10-11 shots per second, got ${shots}`);
  while (slot.mag > 0) { consumeShot(slot); slot.cooldown = 0; }
  assert.equal(canFire(slot), false);
  assert.equal(startReload(slot), true);
  for (let t = 0; t < WEAPON_STATS.rifle.reloadTime + 0.02; t += 0.01) tickSlot(slot, 0.01);
  assert.equal(slot.mag, 30);
  assert.equal(slot.reserve, 90 - 30);
});

test('pistol: 4 body hits or 2 head hits kill', () => {
  const p = WEAPON_STATS.pistol.damage;
  assert.ok(p * 3 < 100 && p * 4 >= 100);
  assert.ok(p * HITBOXES.headshotMultiplier * 2 >= 100);
  assert.equal(damageAt(WEAPON_STATS.shotgun, 4), 12);
  assert.ok(damageAt(WEAPON_STATS.shotgun, 30) < 12);
});

test('round: elimination, timeout by HP, match end', () => {
  const p = ROUND_PRESETS.test, s = createRoundState(p);
  assert.equal(tickRound(s, p, p.freezeTime + 0.01, { aliveA: 4, aliveB: 4, hpA: 400, hpB: 400 }), 'live');
  assert.equal(tickRound(s, p, 0.1, { aliveA: 2, aliveB: 0, hpA: 150, hpB: 0 }), 'roundEnd');
  assert.equal(s.scoreA, 1);
  assert.equal(tickRound(s, p, p.roundEndTime + 0.01, { aliveA: 2, aliveB: 0, hpA: 150, hpB: 0 }), 'roundStart');
  tickRound(s, p, p.freezeTime + 0.01, { aliveA: 4, aliveB: 4, hpA: 400, hpB: 400 });
  assert.equal(tickRound(s, p, p.roundTime + 0.01, { aliveA: 3, aliveB: 4, hpA: 300, hpB: 250 }), 'roundEnd');
  assert.equal(s.lastWinner, 'A');
  s.scoreA = p.winsToMatch - 1;
  tickRound(s, p, p.roundEndTime + 0.01, { aliveA: 4, aliveB: 4, hpA: 400, hpB: 400 });
  tickRound(s, p, p.freezeTime + 0.01, { aliveA: 4, aliveB: 4, hpA: 400, hpB: 400 });
  assert.equal(tickRound(s, p, 0.1, { aliveA: 1, aliveB: 0, hpA: 10, hpB: 0 }), 'matchEnd');
  assert.equal(s.matchWinner, 'A');
});

test('nav grid: around a wall, up stairs onto a balcony, two levels in one cell', () => {
  const floor = { x: 0, y: -0.5, z: 0, w: 20, h: 1, d: 20 };
  const wall = { x: -3, y: 1.5, z: 0, w: 1, h: 3, d: 14 };
  // Balcony 2 m high over open ground (x 4..8), reached by 7 steps of 0.25 m rising along +x.
  const balcony = { x: 6, y: 1.95, z: 0, w: 4, h: 0.1, d: 4 };
  const steps = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: 4 - 0.45 * (8 - i) + 0.225, y: 0.25 * i - 0.125, z: 0, w: 0.45, h: 0.25, d: 2 }));
  const grid = buildNavGrid([floor, wall, balcony, ...steps], { x: 10, z: 10 }, steps);
  pruneUnreachable(grid, -8, 0, 0);
  assert.ok(Number.isNaN(groundAt(grid, -3, 0, 0)) && Number.isNaN(groundAt(grid, -2.4, 0, 0)), 'wall cell and its agent-radius ring are blocked');
  assert.equal(groundAt(grid, 6.1, 0, 0.1), 0, 'ground under the balcony is walkable');
  assert.ok(Math.abs(groundAt(grid, 6.1, 2, 0.1) - 2) < 1e-6, 'balcony level in the same cell');
  const from = nearestWalkable(grid, -8, 0, 0), to = nearestWalkable(grid, 6, 2, 0), path: number[] = [];
  assert.ok(findPath(grid, from, to, path) > 1, 'path from the ground onto the balcony');
  assert.ok(Math.abs(nodeY(grid, path[path.length - 1]) - 2) < 1e-6);
  const back: number[] = [];
  assert.ok(findPath(grid, to, from, back) > 1, 'and back down');
  const areas = upperAreas(grid, 1.5, 4);
  assert.equal(areas.length, 1, 'one upper area (the balcony)');
});

test('movement validation (GAME.md 6.6)', () => {
  const floor = { x: 0, y: -0.5, z: 0, w: 60, h: 1, d: 60 };
  const wall = { x: 5, y: 1.5, z: 0, w: 1, h: 3, d: 10 };
  const v = new ClientValidatedMovement([floor, wall], { x: 30, z: 30 }, -15);
  const p = { x: 0, y: 0, z: 0, crouch: false, walk: false };
  const dt = 1 / 30;
  assert.equal(v.check(p, { ...p, x: 5.5 * dt }, dt, 1), 'ok');
  assert.equal(v.check(p, { ...p, x: 1.0 }, dt, 1), 'ok', 'bunched messages are allowed by the burst slack');
  assert.equal(v.check(p, { ...p, x: 2.6 }, dt, 1), 'too-fast');
  assert.equal(v.check(p, { ...p, x: 10 }, dt, 1), 'teleport');
  assert.equal(v.check(p, { ...p, y: 1.4 }, dt, 1), 'ok', 'a jump');
  assert.equal(v.check(p, { ...p, y: 2.5 }, dt, 1), 'vertical');
  assert.equal(v.check({ ...p, y: 3 }, p, 0.3, 1), 'ok', 'falling');
  assert.equal(v.check({ ...p, x: 3.5 }, { ...p, x: 4.3 }, 0.2, 1), 'inside-wall');
  assert.equal(capsuleInsideBoxes(4.1, 0, 0, false, [wall]), false, 'touching the wall face is fine');
  assert.equal(v.check(p, { ...p, x: 40 }, 99, 1), 'teleport');
});

test('pose history for lag compensation', () => {
  const h = new PoseHistory(4), out: HitTarget = { id: 1, x: 0, y: 0, z: 0, yaw: 0, crouching: false };
  h.push(1000, 0, 0, 0, 0, false); h.push(1033, 1, 0, 0, 0, false); h.push(1066, 2, 0, 0, 0, true);
  h.sampleAt(1050, out); assert.ok(Math.abs(out.x - (1 + 17 / 33)) < 1e-9);
  h.sampleAt(500, out); assert.equal(out.x, 0, 'clamped to the oldest');
  h.sampleAt(2000, out); assert.equal(out.x, 2); assert.equal(out.crouching, true);
  h.push(1066, 3, 0, 0, 0, true); h.sampleAt(2000, out); assert.equal(out.x, 3, 'same time overwrites');
  h.push(1100, 4, 0, 0, 0, false); h.push(1133, 5, 0, 0, 0, false); h.sampleAt(0, out); assert.equal(out.x, 1, 'ring keeps the newest 4');
});

test('sniper: accurate only when scoped; bolt cycle; knife has no magazine', () => {
  const sn = createSlot(WEAPON_STATS.sniper);
  assert.equal(spreadDeg(sn, 0, false, true), 0);
  assert.equal(spreadDeg(sn, 0, false, false), 8);
  consumeShot(sn);
  tickSlot(sn, WEAPON_STATS.sniper.fireInterval / 2);
  assert.ok(Math.abs((cycleProgress(sn) ?? -1) - 0.5) < 1e-6);
  const rifle = createSlot(WEAPON_STATS.rifle);
  assert.equal(spreadDeg(rifle, 0, false, true), spreadDeg(rifle, 0, false, false), 'ADS does not change rifle spread');
  const knife = createSlot(WEAPON_STATS.knife);
  for (let i = 0; i < 5; i++) { assert.ok(canFire(knife)); consumeShot(knife); tickSlot(knife, WEAPON_STATS.knife.fireInterval); }
  assert.equal(WEAPON_STATS.shotgun.pellets * WEAPON_STATS.shotgun.damage, 96);
});

test('items: nearest in range, swap primary keeps ammo', () => {
  const a = createActor(1, 'A', 'x', false, 0, 'rifle');
  a.slots[0].mag = 7; a.active = 1;
  const items = [{ x: 5, y: 0, z: 0 }, { x: 1, y: 0, z: 0.5 }, { x: 0.5, y: 3, z: 0 }];
  assert.equal(nearestItem(items, 0, 0, 0), 1);
  assert.equal(nearestItem([{ x: 3, y: 0, z: 0 }], 0, 0, 0), -1, 'out of range');
  const old = swapPrimary(a, { weapon: 'shotgun', mag: 4, reserve: 10 });
  assert.deepEqual(old, { weapon: 'rifle', mag: 7, reserve: WEAPON_STATS.rifle.reserve });
  assert.equal(a.active, 0);
  assert.deepEqual(primaryState(a), { weapon: 'shotgun', mag: 4, reserve: 10 });
  assert.ok(a.equipLeft > 0);
});

test('cornucopia: loadout, items, healing, free-for-all winner, loot plan', () => {
  const a = createActor(1, 'A', 'x', false, 0);
  cornucopiaLoadout(a);
  assert.equal(a.hasPrimary, false); assert.equal(a.active, 1);
  assert.deepEqual([a.slots[1].mag, a.slots[1].reserve], [CORNUCOPIA.pistolMag, CORNUCOPIA.pistolReserve]);
  const drops: unknown[] = [];
  const put = (kind: string, weapon = '', mag = 0, reserve = 0) => useItem(a, { x: 0, y: 0, z: 0, kind, weapon, mag, reserve }, (w) => drops.push(w));
  assert.ok(put('ammo', '', 0, 24)); assert.equal(a.slots[1].reserve, CORNUCOPIA.pistolReserve + 24);
  assert.ok(put('weapon', 'shotgun', 6, 24)); assert.equal(a.hasPrimary, true); assert.equal(drops.length, 0, 'first weapon: nothing to drop');
  assert.ok(put('weapon', 'rifle', 30, 90)); assert.equal(drops.length, 1, 'second weapon: the shotgun drops');
  assert.equal(put('medkit'), false, 'full HP');
  a.hp = 30;
  assert.ok(put('medkit'));
  for (let t = 0; t < 4; t += 0.1) tickHeal(a, 0.1);
  assert.ok(Math.abs(a.hp - (30 + CORNUCOPIA.medkitHeal)) < 1e-6 && a.healLeft === 0);
  assert.ok(put('boots')); assert.equal(a.boots, true); assert.equal(put('boots'), false, 'boots only once');
  const st = createRoundState(ROUND_PRESETS.cornucopia);
  st.phase = 'live'; st.timeLeft = 100;
  const ps = [{ team: 'F1', alive: true, hp: 50 }, { team: 'F2', alive: true, hp: 80 }, { team: 'F3', alive: false, hp: 0 }];
  assert.equal(tickModeRound(st, ROUND_PRESETS.cornucopia, 0.1, ps, true), 'none');
  ps[1].alive = false;
  assert.equal(tickModeRound(st, ROUND_PRESETS.cornucopia, 0.1, ps, true), 'matchEnd');
  assert.equal(st.matchWinner, 'F1');
  const loot = lootPlan([{ x: 0, y: 0, z: 0, tier: 'high' }, { x: 1, y: 0, z: 0, tier: 'high' }, { x: 2, y: 0, z: 0, tier: 'low' }]);
  assert.deepEqual(loot.map((l) => l.kind + l.weapon), ['weaponsniper', 'boots', 'ammo']);
});

test('mutators: big head box, mutator of the day, rules', () => {
  const t: HitTarget = { id: 1, x: 0, y: 0, z: -10, yaw: 0, crouching: false };
  const top = HITBOXES.head.cy + HITBOXES.head.h / 2;
  const o = vec3(), d = vec3();
  o.y = top + 0.3; directionFromAngles(0, 0, d);
  const p = { part: 'body' as 'head' | 'body' };
  assert.equal(rayPlayer(o, d, 100, t, p), Infinity, 'normal head: miss above the head');
  assert.ok(rayPlayer(o, d, 100, t, p, 2) < Infinity && p.part === 'head', 'big head: hit');
  const days = new Set(Array.from({ length: MUTATOR_IDS.length }, (_, k) => mutatorOfDay(Date.UTC(2026, 10, 1 + k, 12))));
  assert.equal(days.size, MUTATOR_IDS.length, 'each mutator once in a cycle of days');
  assert.equal(mutatorOfDay(Date.UTC(2026, 10, 1, 0, 1)), mutatorOfDay(Date.UTC(2026, 10, 1, 23, 59)), 'same UTC day, same mutator');
  assert.ok(mutatorRules('oneShot').oneShot && mutatorRules('').speedScale === 1 && mutatorRules('lowGravity').gravityScale < 1);
});

test('procedural sounds render audible, bounded samples', () => {
  for (const [name, def] of Object.entries(SOUNDS)) {
    const data = synth(def, 22050);
    let peak = 0, sum = 0;
    for (const v of data) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    const rms = Math.sqrt(sum / data.length);
    assert.ok(peak <= 1 && rms > 0.005, `${name}: peak ${peak.toFixed(3)} rms ${rms.toFixed(4)}`);
    assert.ok(data.length / 22050 < 1, `${name} is short`);
  }
});

test('wallet login: personal_sign hash, signer recovery, refusals', () => {
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  assert.equal(hex(personalHash('hello world')), 'd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68', 'EIP-191 hash');
  const key = new Uint8Array(32); key[31] = 1; // private key 1 -> well-known address
  const now = 1_800_000_000_000, id = 'c200ab';
  const { address, signature } = signLogin(key, id, now);
  assert.equal(address, '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf');
  assert.equal(recoverSigner(loginMessage(address, id, now), signature), address);
  assert.equal(loginError(address, id, now, signature, now), '');
  assert.equal(loginError(address.toUpperCase().replace('0X', '0x'), id, now, signature, now), '', 'address case does not matter');
  assert.ok(loginError(address, 'c200ac', now, signature, now).includes('does not match'), 'another session');
  assert.ok(loginError(address, id, now, signature, now + AUTH.maxAgeMs + 1).includes('expired'), 'too old');
  assert.ok(loginError(address, id, now, signature, now - AUTH.maxClockSkewMs - 1).includes('expired'), 'from the future');
  assert.ok(loginError(address, id, now, signature.slice(0, -2) + '1d', now), 'bad recovery byte');
  assert.ok(loginError('0x1234', id, now, signature, now).includes('address'), 'not an address');
  assert.ok(loginMessage(address, id, now).includes(AUTH.network) && loginMessage(address, id, now).includes('mainnet'), 'testnet warning in the text');
});

test('market rules: fee, price limits, match reward, rate limit, starter set', () => {
  assert.equal(saleFee(100), Math.floor(100 * MARKET.feeRate));
  assert.equal(saleFee(MARKET.price.min), Math.max(1, Math.floor(MARKET.price.min * MARKET.feeRate)), 'fee at least 1 coin');
  assert.ok(saleFee(MARKET.price.max) < MARKET.price.max);
  assert.equal(priceError(MARKET.price.min), '');
  assert.equal(priceError(MARKET.price.max), '');
  assert.ok(priceError(MARKET.price.min - 1) && priceError(MARKET.price.max + 1) && priceError(10.5), 'bad prices refused');
  const r = MARKET.reward;
  assert.equal(matchReward(false, 0, 0, false), r.loss);
  assert.equal(matchReward(true, 2, 1, false), r.win + 2 * r.kill + r.headshot);
  assert.equal(matchReward(true, 100, 100, false), r.matchCap, 'capped');
  assert.equal(matchReward(true, 100, 100, true), r.matchCap + r.firstWinOfDay, 'first win of the day on top of the cap');
  assert.equal(matchReward(false, 0, 0, true), r.loss, 'no first-win bonus for a loss');
  assert.equal(utcDay(Date.UTC(2026, 10, 5, 23, 59)), '2026-11-05');
  assert.ok(matchPays(r.minPlayers, r.minMatchSeconds), 'a real match pays');
  assert.ok(!matchPays(r.minPlayers - 1, 3600), 'alone in the room: no reward');
  assert.ok(!matchPays(8, r.minMatchSeconds - 1), 'too short: no reward');
  const limit = new RateLimiter(3, 1000);
  assert.deepEqual([0, 10, 20, 30].map((t) => limit.allow('a', t)), [true, true, true, false]);
  assert.ok(limit.allow('b', 30), 'per key');
  assert.ok(limit.allow('a', 1001), 'window slides');
  const cat: CatalogItem[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ ref: `character:c${i}`, kind: 'character' as const, index: i, name: `c${i}` })),
    ...Array.from({ length: 2 }, (_, i) => ({ ref: `emote:e${i}`, kind: 'emote' as const, index: i, name: `e${i}` })),
  ];
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 20; k++) {
    const refs = starterRefs(cat, random);
    assert.equal(refs.length, MARKET.starter.characters + MARKET.starter.emotes);
    assert.equal(new Set(refs).size, refs.length, 'distinct');
    assert.equal(refs.filter((x) => x.startsWith('emote:')).length, MARKET.starter.emotes);
  }
});

test('weekly rewards: weeks, points, payout plan', () => {
  const mon = Date.UTC(2026, 10, 2), sunLast = Date.UTC(2026, 10, 8, 23, 59, 59, 999);
  assert.equal(new Date(mon).getUTCDay(), 1, 'Nov 2 2026 is a Monday');
  assert.equal(weekOf(mon), weekOf(sunLast), 'Monday..Sunday is one week');
  assert.equal(weekOf(mon - 1), weekOf(mon) - 1, 'Sunday before is the previous week');
  assert.equal(weekStartMs(weekOf(sunLast)), mon);
  assert.equal(weekLabel(weekOf(mon)), '2026-11-02 – 2026-11-08');
  const p = REWARDS.points;
  assert.equal(weekPoints({ matches: 3, wins: 2, kills: 7, headshots: 4 }), 3 * p.match + 2 * p.win + 7 * p.kill + 4 * p.headshot);
  const pool = toUnits(1000);
  // Two wallets: equal points, each capped at maxShareBps; one below minPoints gets nothing.
  const plan = payoutPlan([
    { owner: '0xb', matches: 5, wins: 0, kills: 0, headshots: 0 },
    { owner: '0xa', matches: 5, wins: 0, kills: 0, headshots: 0 },
    { owner: '0xc', matches: 1, wins: 0, kills: 0, headshots: 0 },
  ], pool);
  const cap = pool * BigInt(REWARDS.maxShareBps) / 10_000n;
  assert.deepEqual(plan.map((x) => x.owner), ['0xa', '0xb'], 'below min left out, ties by address');
  assert.ok(plan.every((x) => x.amount === cap), 'capped');
  // Many wallets: proportional, sum within the pool.
  const many = Array.from({ length: 50 }, (_, i) => ({ owner: `0x${i}`, matches: 5 + i, wins: 0, kills: 0, headshots: 0 }));
  const big = payoutPlan(many, pool);
  assert.ok(big.reduce((s, x) => s + x.amount, 0n) <= pool && big[0].amount > big[big.length - 1].amount, 'proportional');
  assert.deepEqual(payoutPlan([], pool), []);
  assert.equal(formatTokens(toUnits(1234567)), '1 234 567');
  assert.equal(formatTokens(toUnits(3) / 2n), '1.5');
});

test('ABI call data matches known vectors', () => {
  assert.equal(selector('transfer(address,uint256)'), 'a9059cbb');
  assert.equal(selector('balanceOf(address)'), '70a08231');
  const to = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
  assert.equal(callData('transfer(address,uint256)', [{ type: 'address', value: to }, { type: 'uint256', value: 5n }]),
    `0xa9059cbb${'0'.repeat(24)}${to.slice(2)}${'0'.repeat(63)}5`);
  // uint256, address[2], uint256[1]: heads 3 words, first tail at 0x60, second at 0x60 + 3 * 32 = 0xc0.
  const enc = encodeArgs([{ type: 'uint256', value: 7n }, { type: 'address[]', value: [to, to] }, { type: 'uint256[]', value: [9n] }]);
  const words = enc.match(/.{64}/g)!.map((w) => BigInt(`0x${w}`));
  assert.deepEqual(words.slice(0, 3), [7n, 0x60n, 0xc0n]);
  assert.equal(words[3], 2n);
  assert.deepEqual(words.slice(6), [1n, 9n]);
  assert.equal(decodeUint('0x' + '0'.repeat(62) + '2a'), 42n);
});

test('hearing range: footsteps stop at the short range, shots carry far', () => {
  const s = AUDIO.hearing.step;
  assert.equal(hearingGain('step', s.ref), 1);
  assert.equal(hearingGain('step', (s.ref + s.max) / 2), 0.5);
  assert.equal(hearingGain('step', s.max), 0, 'silent at the limit');
  assert.equal(hearingGain('step', 40), 0);
  assert.ok(hearingGain('shot_rifle', 40) > 0, 'shots are still heard far away');
  assert.equal(hearingGain('shot_rifle', AUDIO.maxDistance + 1), 0);
});

test('levels, season track, missions', () => {
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: levelCost(1) });
  assert.equal(levelOf(levelCost(1) - 1).level, 1);
  assert.deepEqual(levelOf(levelCost(1) + 7), { level: 2, into: 7, need: levelCost(2) });
  assert.ok(levelCost(2) > levelCost(1), 'each level costs a bit more');
  const top = levelOf(0xffffffff);
  assert.deepEqual(top, { level: PROGRESSION.level.max, into: 0, need: 0 }, 'levels stop at the max');
  const x = PROGRESSION.xp;
  assert.equal(matchXp(false, 0, 0, false), x.match);
  assert.equal(matchXp(true, 2, 1, true), x.match + x.win + 2 * x.kill + x.headshot + x.firstWinOfDay);
  assert.equal(matchXp(true, 1000, 1000, false), x.matchCap, 'capped');
  assert.ok(seasonActive(SEASON.startMs) && !seasonActive(SEASON.startMs - 1) && !seasonActive(SEASON.endMs));
  assert.equal(SEASON.endMs - SEASON.startMs, 28 * 24 * 3600 * 1000, '4 weeks');
  assert.equal(seasonLevel(SEASON.xpPerLevel - 1), 0);
  assert.equal(seasonLevel(SEASON.xpPerLevel * 3), 3);
  assert.equal(seasonLevel(0xffffffff), SEASON.levels);
  for (let l = 1; l <= SEASON.levels; l++) {
    const r = seasonReward(l);
    assert.ok(r.coins > 0 || r.item, `level ${l} has a reward`);
    assert.equal(!!r.item, l % 5 === 0, `every fifth level has an item (${l})`);
  }
  assert.ok(seasonReward(SEASON.levels).item && seasonReward(SEASON.levels).coins === SEASON.finalCoins, 'best prize last');
  const all = seasonClaim(0, SEASON.levels);
  assert.equal(all.items.length, 6);
  assert.equal(all.coins, 24 * SEASON.coinsPerLevel + SEASON.finalCoins);
  assert.deepEqual(seasonClaim(5, 5), { coins: 0, items: [] }, 'nothing twice');
  const part = seasonClaim(0, 12), rest = seasonClaim(12, SEASON.levels);
  assert.equal(part.coins + rest.coins, all.coins, 'claiming in parts gives the same total');
  assert.equal(part.items.length + rest.items.length, all.items.length);
});

test('day streak: grows, forgives one missed day a week, pays by day', () => {
  const skip = DAY_STREAK.skipEveryDays;
  const d1 = streakAfterPlay(null, 100)!;
  assert.deepEqual(d1, { lastDay: 100, streak: 1, best: 1, skipDay: 0 });
  assert.equal(streakAfterPlay(d1, 100), null, 'a day counts once');
  const d2 = streakAfterPlay(d1, 101)!;
  assert.equal(d2.streak, 2);
  const skipped = streakAfterPlay(d2, 103)!;
  assert.ok(skipped.streak === 3 && skipped.skipDay === 102, 'one missed day keeps the streak');
  const again = streakAfterPlay(skipped, 105)!;
  assert.equal(again.streak, 1, 'a second missed day within a week breaks it');
  assert.equal(again.best, 3, 'the best stays');
  const later = streakAfterPlay({ ...skipped, lastDay: 102 + skip, streak: 5 }, 102 + skip + 2)!;
  assert.equal(later.streak, 6, 'forgiven again after a week');
  assert.equal(streakAfterPlay(d2, 104)!.streak, 1, 'two missed days break it');
  assert.equal(streakCoins(1), DAY_STREAK.coins[0]);
  assert.equal(streakCoins(DAY_STREAK.coins.length), DAY_STREAK.coins[DAY_STREAK.coins.length - 1], 'the last day pays the most');
  assert.equal(streakCoins(DAY_STREAK.coins.length + 1), DAY_STREAK.coins[0], 'the cycle repeats');
});

test('kill streak banners', () => {
  const w = KILL_STREAK.windowMs, s = new KillStreak();
  assert.equal(s.kill(0, 1, 4), '');
  assert.equal(s.kill(w, 1, 4), KILL_STREAK.labels[2]);
  assert.equal(s.kill(w * 2, 1, 4), KILL_STREAK.labels[3]);
  assert.equal(s.kill(w * 2 + 1, 1, 4), KILL_STREAK.aceLabel, 'all enemies of the round');
  assert.equal(s.kill(w * 9, 2, 4), '', 'a new round starts over');
  assert.equal(s.kill(w * 11, 2, 4), '', 'too slow, no chain');
  const solo = new KillStreak();
  assert.equal(solo.kill(0, 1, 1), '', 'one enemy is not an ace');
  const long = new KillStreak();
  for (let i = 0; i < 9; i++) long.kill(i, 1, 99);
  assert.equal(long.kill(10, 1, 99), KILL_STREAK.labels[KILL_STREAK.labels.length - 1], 'long chains keep the last banner');
});

test('missions: tiers ask for more and pay more, each pays once', () => {
  for (const q of Object.values(QUESTS)) {
    for (let i = 1; i < q.xp.length; i++) assert.ok(q.xp[i] > q.xp[i - 1], 'next tier pays more');
    for (const t of q.tracks) {
      assert.equal(t.targets.length, q.xp.length);
      for (let i = 1; i < t.targets.length; i++) assert.ok(t.targets[i] > t.targets[i - 1], 'next tier asks for more');
    }
  }
  const none = { matches: 0, wins: 0, kills: 0, headshots: 0 };
  const [g1, g2, g3] = QUESTS.day.tracks[0].targets, [x1, x2, x3] = QUESTS.day.xp;
  assert.equal(questsDone('day', none), 0);
  const first = questsDone('day', { ...none, matches: g1 });
  assert.equal(questXp('day', 0, first), x1);
  assert.equal(questXp('day', first, first), 0, 'a tier pays once');
  const second = first | questsDone('day', { ...none, matches: g2 });
  assert.equal(questXp('day', first, second), x2);
  const jump = questsDone('day', { ...none, matches: g3 });
  assert.equal(questXp('day', 0, jump), x1 + x2 + x3, 'a long session pays every tier it passed');
  assert.deepEqual(questLine('day', 0, undefined, 0), { label: QUESTS.day.tracks[0].label(g1), tier: 0, tiers: 3, value: 0, target: g1, xp: x1, complete: false });
  assert.deepEqual(questsNewlyDone('day', first, second), [{ label: QUESTS.day.tracks[0].label(g2), xp: x2 }], 'the card lists only new tiers');
  const line = questLine('day', 0, { ...none, matches: g1 }, first);
  assert.ok(line.tier === 1 && line.target === g2 && line.value === g1 && line.xp === x2, 'moves to the next tier');
  const end = questLine('day', 0, { ...none, matches: 99 }, jump);
  assert.ok(end.complete && end.value === g3 && end.target === g3, 'the last tier stays shown as done');
  const max = questsDone('season', { matches: 1e6, wins: 1e6, kills: 1e6, headshots: 1e6 });
  assert.equal(questXp('season', 0, max), QUESTS.season.tracks.length * QUESTS.season.xp.reduce((a, b) => a + b, 0), 'every line has its own bits');
  const t = Date.UTC(2026, 10, 6, 15);
  assert.equal(questEndMs('day', t), Date.UTC(2026, 10, 7));
  assert.equal(questEndMs('week', t), Date.UTC(2026, 10, 9), 'the week ends on Monday');
  assert.equal(questEndMs('season', t), SEASON.endMs);
  assert.notEqual(questScope('day', t), questScope('day', t + DAY_MS));
  assert.equal(questScope('week', Date.UTC(2026, 10, 2)), questScope('week', Date.UTC(2026, 10, 8, 23)));
  assert.equal(questScope('season', t), `s${SEASON.id}`);
});

test('market: rarity is stable, starter sets stay low, prices and sale notice read the rows', () => {
  const allowed = new Set(MARKET.rarity.tiers);
  for (const ref of Object.keys(MARKET.rarity.items)) assert.ok(allowed.has(itemRarity(ref)), ref);
  assert.equal(itemRarity('character:vibe-vibers-viber-extra-20'), 'legendary');
  assert.equal(itemRarity('character:x'), itemRarity('character:x'));
  const refs = Array.from({ length: 400 }, (_, i) => `character:test-${i}`);
  const counts = new Map<string, number>();
  for (const ref of refs) counts.set(itemRarity(ref), (counts.get(itemRarity(ref)) ?? 0) + 1);
  for (const tier of ['common', 'rare', 'epic'] as const) assert.ok((counts.get(tier) ?? 0) > 0, tier);
  assert.equal(counts.get('legendary'), undefined, 'legendary only from a fixed list');
  assert.ok(counts.get('common')! > counts.get('rare')!);
  const catalog: CatalogItem[] = [...refs.map((ref, index) => ({ ref, kind: 'character' as const, index, name: ref })),
    ...['wave', 'shrug', 'cheer', 'dance', 'hop'].map((id, index) => ({ ref: `emote:${id}`, kind: 'emote' as const, index, name: id }))];
  const max = MARKET.rarity.tiers.indexOf(MARKET.rarity.starterMax);
  for (let seed = 0; seed < 50; seed++) {
    let x = seed + 1;
    const set = starterRefs(catalog, () => (x = (x * 16807) % 2147483647) / 2147483647);
    assert.equal(set.length, MARKET.starter.characters + MARKET.starter.emotes);
    for (const ref of set) assert.ok(MARKET.rarity.tiers.indexOf(itemRarity(ref)) <= max, ref);
  }
  const prices = marketPrices([{ ref: 'a', price: 90 }, { ref: 'a', price: 70 }], [{ id: 2n, ref: 'a', price: 60 }, { id: 5n, ref: 'a', price: 80 }, { id: 3n, ref: 'b', price: 40 }]);
  assert.deepEqual(prices.get('a'), { lowest: 70, last: 80 });
  assert.deepEqual(prices.get('b'), { lowest: 0, last: 40 });
  assert.equal(suggestedPrice('a', prices.get('a')), 70);
  assert.equal(suggestedPrice('b', prices.get('b')), 40);
  assert.equal(suggestedPrice('emote:wave', undefined), MARKET.rarity.basePrice.common);
  for (const price of Object.values(MARKET.rarity.basePrice)) assert.equal(priceError(price), '');
  const row = (id: bigint, seller: string, price: number, ref = 'a') => ({ id, seller, price, ref, fee: saleFee(price) });
  const trades = [row(1n, 'me', 100), row(2n, 'you', 100), row(4n, 'me', 200, 'b')];
  assert.deepEqual(newSales(trades, 'me', 1n), { count: 1, coins: 190, ref: 'b', lastId: 4n });
  assert.deepEqual(newSales(trades, 'me', 4n), { count: 0, coins: 0, ref: '', lastId: 4n });
  assert.equal(newSales(trades, 'me', -1n).lastId, 4n);
  assert.equal(newSales([], 'me', -1n).lastId, 0n);
});

test('market: starter sets are spread evenly over the wallets', () => {
  const cat: CatalogItem[] = [
    ...Array.from({ length: 26 }, (_, i) => ({ ref: `character:test-${i}`, kind: 'character' as const, index: i, name: `c${i}` })),
    ...['wave', 'shrug'].map((id, index) => ({ ref: `emote:${id}`, kind: 'emote' as const, index, name: id })),
  ].filter((c) => MARKET.rarity.tiers.indexOf(itemRarity(c.ref)) <= MARKET.rarity.tiers.indexOf(MARKET.rarity.starterMax));
  const characters = cat.filter((c) => c.kind === 'character').length, wallets = 20000;
  const counts = new Map<string, number>();
  for (let w = 0; w < wallets; w++) {
    for (const ref of starterRefs(cat, textRandom(`0x${w.toString(16).padStart(40, '0')}:0.5`))) counts.set(ref, (counts.get(ref) ?? 0) + 1);
  }
  const expected = wallets * MARKET.starter.characters / characters;
  for (const c of cat.filter((x) => x.kind === 'character')) {
    const seen = counts.get(c.ref) ?? 0;
    assert.ok(Math.abs(seen - expected) < expected * 0.1, `${c.ref}: ${seen}, expected about ${expected}`);
  }
  const random = textRandom('a'), again = textRandom('a');
  assert.equal(random(), again());
  assert.notEqual(textRandom('a')(), textRandom('b')());
});

test('season NFTs: rewards, ids and words', () => {
  const earner = `0x${'ab'.repeat(20)}`;
  const levels = Object.keys(NFT.rewards).map(Number);
  assert.deepEqual(levels, [5, 10, 15, 20, 25, 30]);
  assert.deepEqual(levels.map((l) => NFT.rewards[l].rarity), ['common', 'common', 'rare', 'epic', 'legendary', 'mythic']);
  for (const tier of MARKET.rarity.tiers) assert.ok(NFT.skinArt[tier], tier);
  for (const l of levels) {
    assert.ok(NFT.weaponCodes.includes(NFT.rewards[l].weapon), NFT.rewards[l].weapon);
    assert.ok(l <= SEASON.levels);
  }
  const ref = nftRef(1, 30, earner);
  assert.deepEqual(parseNftRef(ref), { season: 1, level: 30, earner });
  assert.equal(parseNftRef('character:x'), null);
  assert.equal(parseNftRef('nft:1:30:bad'), null);
  assert.equal(nftRarity(ref), 'mythic');
  assert.equal(nftRarity('emote:wave'), null);
  assert.equal(nftRarity(nftRef(1, 6, earner)), null, 'no NFT at this level');
  assert.equal(itemRarity(ref), 'mythic');
  assert.equal(nftName(ref), 'Mythic Rifle skin');
  assert.equal(nftSeed(ref), nftSeed(nftRef(1, 30, earner)));
  assert.notEqual(nftSeed(ref), nftSeed(nftRef(1, 25, earner)));
  assert.equal(nftTokenId(1, 30, earner) & 0xffffn, 30n);
  assert.equal(nftTokenId(1, 30, earner) >> 32n, BigInt(earner));
  const word = nftSkinWord(1, 30, NFT.rewards[30], 7);
  assert.equal(word & 0xffffffffn, 7n);
  assert.equal((word >> 40n) & 0xffn, BigInt(MARKET.rarity.tiers.indexOf('mythic')));
  assert.throws(() => nftSkinWord(1, 30, { weapon: 'spoon', rarity: 'common' }, 1));
  assert.equal(nftListError('game'), '');
  assert.equal(nftListError(undefined), '');
  assert.ok(nftListError('queued'));
  assert.ok(nftListError('sent'));
});

test('NFT sale prices', () => {
  assert.equal(parseEthPrice('0.01'), 10n ** 16n);
  assert.equal(parseEthPrice(' 1.5 '), 15n * 10n ** 17n);
  assert.equal(parseEthPrice('0'), null);
  assert.equal(parseEthPrice('0.00000001'), null, 'below the minimum');
  assert.equal(parseEthPrice('abc'), null);
  assert.equal(parseEthPrice('-1'), null);
  assert.equal(parseEthPrice('1000000'), null, 'above the maximum');
  assert.equal(formatEth(10n ** 16n), '0.01');
  assert.equal(formatEth(15n * 10n ** 17n), '1.5');
  assert.equal(formatEth(10n ** 18n), '1');
  const data = saleTypedData('0x' + '11'.repeat(20), 46630, 5n, 7n, 9, 2n);
  assert.deepEqual(data.message, { tokenId: '5', price: '7', expiry: '9', nonce: '2' });
  assert.equal(data.domain.name, NFT.name);
});

console.log(`${passed} gameplay checks passed`);
