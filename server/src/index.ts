// Voxel Arena SpacetimeDB module (M2a): rooms by code, quick play with bots, client movement with
// server validation (GAME.md 6.6), server bots on the nav grid. Hits, rounds and lag compensation: M2b.
import { schema, table, t, SenderError, type InferSchema, type ReducerCtx } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';
import { NET } from '../../src/config/net.ts';
import { BOTS } from '../../src/config/bots.ts';
import { MATCH } from '../../src/config/rounds.ts';
import { DEG } from '../../src/gameplay/math.ts';
import { updateBot, type BotWorld } from '../../src/gameplay/botBrain.ts';
import { stepOnGrid } from '../../src/gameplay/navMotor.ts';
import type { MoveSample } from '../../src/gameplay/movementCheck.ts';
import type { TeamId } from '../../src/gameplay/round.ts';
import { actorFor, brainFor, forgetActor, getNav, getWorld } from './world.ts';

const room = table({ name: 'room', public: true }, {
  id: t.u64().primaryKey().autoInc(),
  code: t.string().unique(),
  isPrivate: t.bool(),
  /** 'warmup' in M2a; round phases come in M2b. */
  phase: t.string(),
  createdAt: t.timestamp(),
});

const player = table({ name: 'player', public: true }, {
  id: t.u64().primaryKey().autoInc(),
  roomId: t.u64().index('btree'),
  /** Identity hex of the human owner; '' for bots. */
  ownerHex: t.string().index('btree'),
  isBot: t.bool(),
  name: t.string(),
  character: t.u16(),
  team: t.string(),
  x: t.f32(), y: t.f32(), z: t.f32(),
  vx: t.f32(), vy: t.f32(), vz: t.f32(),
  yaw: t.f32(), pitch: t.f32(),
  crouch: t.bool(), grounded: t.bool(), walk: t.bool(),
  /** Last accepted move seq (humans) or tick count (bots). */
  seq: t.u32(),
  /** Bumped when the server moves the player (spawn, snap-back); the client then snaps to x/y/z. */
  correctionSeq: t.u32(),
  violations: t.u32(),
  hp: t.f32(),
  alive: t.bool(),
  weapon: t.u8(),
  lastMoveAt: t.timestamp(),
});

const tickTimer = table({ name: 'tick_timer' }, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
});

const spacetimedb = schema({ room, player, tickTimer });
export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;
type PlayerRow = ReturnType<Ctx['db']['player']['id']['find']> & {};
type RoomRow = ReturnType<Ctx['db']['room']['id']['find']> & {};

const TICK_DT = 1 / NET.tickRateHz;

function cleanName(name: string): string {
  const n = name.replace(/[^\p{L}\p{N}_ .-]/gu, '').trim().slice(0, NET.nameMaxLength);
  return n.length >= NET.nameMinLength ? n : `Player${n}`;
}

function newRoomCode(ctx: Ctx): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < NET.roomCodeLength; i++) {
      code += NET.roomCodeAlphabet[ctx.random.integerInRange(0, NET.roomCodeAlphabet.length - 1)];
    }
    if (!ctx.db.room.code.find(code)) return code;
  }
}

function playersIn(ctx: Ctx, roomId: bigint): PlayerRow[] { return [...ctx.db.player.roomId.filter(roomId)]; }

function spawnRow(ctx: Ctx, roomId: bigint, team: TeamId, isBot: boolean, ownerHex: string, name: string, character: number,
  spawnIndex: number): void {
  const spots = getWorld().spawns[team];
  const s = spots[spawnIndex % spots.length];
  ctx.db.player.insert({
    id: 0n, roomId, ownerHex, isBot, name, character, team, x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0,
    yaw: s.yaw, pitch: 0, crouch: false, grounded: true, walk: false, seq: 0, correctionSeq: 1, violations: 0,
    hp: MATCH.maxHealth, alive: true, weapon: 0, lastMoveAt: ctx.timestamp,
  });
}

/** Fill both teams up to MATCH.teamSize with bots. */
function fillBots(ctx: Ctx, roomId: bigint): void {
  const rows = playersIn(ctx, roomId);
  for (const team of ['A', 'B'] as const) {
    let count = rows.filter((r) => r.team === team).length;
    while (count < MATCH.teamSize) {
      spawnRow(ctx, roomId, team, true, '', `Bot ${ctx.random.integerInRange(10, 99)}`, ctx.random.integerInRange(1, 64), count);
      count++;
    }
  }
}

function removeOwnRows(ctx: Ctx): void {
  const hex = ctx.sender.toHexString();
  for (const row of [...ctx.db.player.ownerHex.filter(hex)]) {
    ctx.db.player.id.delete(row.id);
    forgetActor(Number(row.id));
    closeRoomIfEmpty(ctx, row.roomId);
  }
}

function closeRoomIfEmpty(ctx: Ctx, roomId: bigint): void {
  const rows = playersIn(ctx, roomId);
  if (rows.some((r) => !r.isBot)) {
    fillBots(ctx, roomId); // a human left: a bot takes the place
    return;
  }
  for (const r of rows) { ctx.db.player.id.delete(r.id); forgetActor(Number(r.id)); }
  ctx.db.room.id.delete(roomId);
}

/** Put the caller into a room: pick the team with fewer humans, replace one of its bots. */
function joinRoom(ctx: Ctx, r: RoomRow, name: string, character: number): void {
  removeOwnRows(ctx);
  const rows = playersIn(ctx, r.id);
  const humans = (team: string) => rows.filter((p) => p.team === team && !p.isBot).length;
  if (humans('A') + humans('B') >= MATCH.teamSize * 2) throw new SenderError('room is full');
  const team: TeamId = humans('A') <= humans('B') ? 'A' : 'B';
  const bot = rows.find((p) => p.team === team && p.isBot);
  if (bot) { ctx.db.player.id.delete(bot.id); forgetActor(Number(bot.id)); }
  const teamCount = rows.filter((p) => p.team === team).length - (bot ? 1 : 0);
  spawnRow(ctx, r.id, team, false, ctx.sender.toHexString(), cleanName(name), character, teamCount);
  fillBots(ctx, r.id);
}

function createRoom(ctx: Ctx, isPrivate: boolean): RoomRow {
  getNav(); // build the nav grid now, not during a tick
  return ctx.db.room.insert({ id: 0n, code: newRoomCode(ctx), isPrivate, phase: 'warmup', createdAt: ctx.timestamp });
}

export const init = spacetimedb.init((ctx) => {
  ctx.db.tickTimer.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.interval(BigInt(Math.round(1_000_000 / NET.tickRateHz))) });
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => { removeOwnRows(ctx); });

export const joinQuick = spacetimedb.reducer({ name: t.string(), character: t.u16() }, (ctx, { name, character }) => {
  let target: RoomRow | null = null;
  for (const r of ctx.db.room.iter()) {
    if (r.isPrivate) continue;
    const humans = playersIn(ctx, r.id).filter((p) => !p.isBot).length;
    if (humans < MATCH.teamSize * 2) { target = r; break; }
  }
  joinRoom(ctx, target ?? createRoom(ctx, false), name, character);
});

export const createPrivateRoom = spacetimedb.reducer({ name: t.string(), character: t.u16() }, (ctx, { name, character }) => {
  joinRoom(ctx, createRoom(ctx, true), name, character);
});

export const joinByCode = spacetimedb.reducer({ code: t.string(), name: t.string(), character: t.u16() }, (ctx, { code, name, character }) => {
  const r = ctx.db.room.code.find(code.trim().toUpperCase());
  if (!r) throw new SenderError('no room with this code');
  joinRoom(ctx, r, name, character);
});

export const leaveRoom = spacetimedb.reducer((ctx) => { removeOwnRows(ctx); });

/** Client-reported movement (owner decision 2026-10-30): validated, snapped back on violation. */
export const move = spacetimedb.reducer({
  seq: t.u32(), ack: t.u32(), x: t.f32(), y: t.f32(), z: t.f32(), vx: t.f32(), vy: t.f32(), vz: t.f32(),
  yaw: t.f32(), pitch: t.f32(), crouch: t.bool(), grounded: t.bool(), walk: t.bool(),
}, (ctx, m) => {
  const row = ctx.db.player.ownerHex.filter(ctx.sender.toHexString()).next().value;
  if (!row || !row.alive) return;
  // Ignore stale or out-of-order messages, and moves sent before the client saw our last correction.
  if (m.seq <= row.seq || m.ack < row.correctionSeq) return;
  const elapsed = Number(ctx.timestamp.microsSinceUnixEpoch - row.lastMoveAt.microsSinceUnixEpoch) / 1e6;
  const prev: MoveSample = { x: row.x, y: row.y, z: row.z, crouch: row.crouch, walk: row.walk };
  const next: MoveSample = { x: m.x, y: m.y, z: m.z, crouch: m.crouch, walk: m.walk };
  const verdict = getWorld().movement.check(prev, next, elapsed, 1);
  const pitch = Math.max(-89 * DEG, Math.min(89 * DEG, m.pitch));
  if (verdict === 'ok') {
    ctx.db.player.id.update({ ...row, x: m.x, y: m.y, z: m.z, vx: m.vx, vy: m.vy, vz: m.vz, yaw: m.yaw, pitch,
      crouch: m.crouch, grounded: m.grounded, walk: m.walk, seq: m.seq, lastMoveAt: ctx.timestamp });
  } else {
    console.info(`move rejected: player ${row.id} ${verdict}`);
    ctx.db.player.id.update({ ...row, yaw: m.yaw, pitch, vx: 0, vy: 0, vz: 0, seq: m.seq,
      correctionSeq: row.correctionSeq + 1, violations: row.violations + 1, lastMoveAt: ctx.timestamp });
  }
});

/** 30 Hz: move bots of every room. */
export const tick = spacetimedb.reducer({ onSchedule: tickTimer }, { timer: tickTimer.rowType }, (ctx) => {
  const rooms = [...ctx.db.room.iter()];
  if (rooms.length === 0) return;
  const world = getWorld(), nav = getNav();
  // A* budget per tick for the whole module (all rooms share the CPU).
  let pathBudget: number = BOTS.maxPathsPerTick;
  const random = () => ctx.random();
  for (const r of rooms) {
    const rows = playersIn(ctx, r.id);
    const actors = rows.map((row) => {
      const a = actorFor(Number(row.id), row.team as TeamId, row.isBot);
      a.team = row.team as TeamId; a.x = row.x; a.y = row.y; a.z = row.z; a.yaw = row.yaw; a.pitch = row.pitch;
      a.crouching = row.crouch; a.alive = row.alive; a.hp = row.hp;
      return a;
    });
    const botWorld: BotWorld = { actors, blockers: world.blockers, nav, goals: world.goals, random, pathBudget };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i], a = actors[i];
      if (!row.isBot || !row.alive) continue;
      updateBot(a, brainFor(Number(row.id)), botWorld, TICK_DT);
      a.yaw = a.intent.yaw; a.pitch = a.intent.pitch;
      stepOnGrid(a, nav, TICK_DT, 1);
      const verdict = world.movement.check(
        { x: row.x, y: row.y, z: row.z, crouch: false, walk: false },
        { x: a.x, y: a.y, z: a.z, crouch: false, walk: a.intent.walk }, TICK_DT, 1);
      if (verdict !== 'ok') { a.x = row.x; a.y = row.y; a.z = row.z; a.vx = 0; a.vz = 0; }
      ctx.db.player.id.update({ ...row, x: a.x, y: a.y, z: a.z, vx: a.vx, vy: 0, vz: a.vz, yaw: a.yaw, pitch: a.pitch,
        walk: a.intent.walk, grounded: true, seq: row.seq + 1, violations: row.violations + (verdict === 'ok' ? 0 : 1),
        lastMoveAt: ctx.timestamp });
    }
    pathBudget = botWorld.pathBudget;
  }
});
