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
import { buildNavGrid, cellIndex, findPath, nearestWalkable, pruneUnreachable } from './navGrid.ts';

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

test('nav grid paths around a wall', () => {
  const floor = { x: 0, y: -0.5, z: 0, w: 20, h: 1, d: 20 };
  const wall = { x: 0, y: 1.5, z: 0, w: 1, h: 3, d: 14 };
  const grid = buildNavGrid([floor, wall], { x: 10, z: 10 });
  assert.equal(grid.ground[cellIndex(grid, 0.1, 0.1)], 3); // wall top before pruning
  pruneUnreachable(grid, -5, 0);
  const a = nearestWalkable(grid, -5, 0), b = nearestWalkable(grid, 5, 0), path: number[] = [];
  assert.ok(findPath(grid, a, b, path) > 1);
  assert.ok(Number.isNaN(grid.ground[cellIndex(grid, 0.1, 0.1)]));
  assert.ok(Number.isNaN(grid.ground[cellIndex(grid, 0.6, 0.1)])); // inflated by agent radius
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

console.log(`${passed} gameplay checks passed`);
