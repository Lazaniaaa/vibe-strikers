// Voxel Arena SpacetimeDB module.
// M2a: rooms by code, quick play with bots, client movement with server validation (GAME.md 6.6),
//      server bots on the nav grid.
// M2b: server-authoritative weapons (rate, ammo, reload, spread), lag-compensated hits (pose history
//      rewound to the client's view time, capped by maxRewindMs), HP / kills, bots shoot, Elimination rounds.
import { schema, table, t, SenderError, type InferSchema, type ReducerCtx } from 'spacetimedb/server';
import { Identity, ScheduleAt } from 'spacetimedb';
import { characters } from '../../src/characters/characters.ts';
import { BOT_SKILLS, BOTS, DEFAULT_DIFFICULTY, type BotDifficulty } from '../../src/config/bots.ts';
import { HITBOXES } from '../../src/config/hitboxes.ts';
import { CAPSULE, MOVEMENT } from '../../src/config/movement.ts';
import { FIRE_CHECK, NET } from '../../src/config/net.ts';
import { MATCH } from '../../src/config/rounds.ts';
import { CORNUCOPIA, ITEMS } from '../../src/config/items.ts';
import { PINGS } from '../../src/config/pings.ts';
import { isMutator, mutatorOfDay, mutatorRules } from '../../src/config/mutators.ts';
import { LOADOUT, loadoutFor, WEAPON_STATS } from '../../src/config/weapons.ts';
import type { WeaponId } from '../../src/weapons/types.ts';
import { setPrimary, type Actor } from '../../src/gameplay/actor.ts';
import { pickBotPrimary, resetBrain, updateBot, type BotWorld } from '../../src/gameplay/botBrain.ts';
import { cornucopiaLoadout, inPickupRange, lootAmmo, nearestItem, primaryState, tickHeal, useItem, type WeaponState } from '../../src/gameplay/items.ts';
import { ffaTeam, isFfaTeam, lootPlan, presetFor, tickModeRound, type GameMode } from '../../src/gameplay/mode.ts';
import { createShotResult, traceShot, type HitTarget } from '../../src/gameplay/hitscan.ts';
import { DEG, directionFromAngles, spreadDirection, vec3 } from '../../src/gameplay/math.ts';
import { stepOnGrid } from '../../src/gameplay/navMotor.ts';
import type { MoveSample } from '../../src/gameplay/movementCheck.ts';
import { restartMatch, type RoundPhase, type RoundState, type TeamId } from '../../src/gameplay/round.ts';
import { canFire, cancelReload, consumeShot, damageAt, resetSlot, spreadDeg, startReload, tickSlot } from '../../src/gameplay/weaponLogic.ts';
import { actorFor, brainFor, forgetActor, getNav, getWorld, historyFor, terrainFor } from './world.ts';
import { MARKET } from '../../src/config/market.ts';
import { AUTH } from '../../src/config/auth.ts';
import { loginError } from '../../src/gameplay/walletAuth.ts';
import { weekOf } from '../../src/gameplay/rewards.ts';
import { CATALOG, matchPays, matchReward, priceError, RateLimiter, saleFee, starterRefs, utcDay } from '../../src/gameplay/market.ts';

const room = table({ name: 'room', public: true }, {
  id: t.u64().primaryKey().autoInc(),
  code: t.string().unique(),
  isPrivate: t.bool(),
  /** Fill empty slots with bots (quick play: always; private rooms: chosen by the creator). */
  bots: t.bool(),
  /** Bot difficulty: 'easy' | 'normal' | 'hard' (quick play: normal). */
  difficulty: t.string(),
  /** 'elimination' | 'cornucopia' */
  mode: t.string(),
  /** Cornucopia: teams (true) or free-for-all (false). Elimination: always true. */
  teams: t.bool(),
  /** Mutator id (GAME.md 8) or '' = none. */
  mutator: t.string(),
  phase: t.string(),
  round: t.u32(),
  scoreA: t.u32(),
  scoreB: t.u32(),
  /** Seconds left in the current phase. */
  timeLeft: t.f32(),
  /** 'A' | 'B' | 'draw' | '' */
  lastWinner: t.string(),
  matchWinner: t.string(),
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
  /** Bumped on every (re)spawn; the client then also takes the spawn yaw. */
  spawnCount: t.u32(),
  violations: t.u32(),
  hp: t.f32(),
  alive: t.bool(),
  /** Active weapon slot: 0 primary, 1 pistol, 2 knife. */
  weapon: t.u8(),
  /** Primary weapon id in use this round. */
  primary: t.string(),
  /** Primary chosen for the next round (applied at once during the freeze phase). */
  nextPrimary: t.string(),
  mag: t.u16(),
  reserve: t.u16(),
  reloading: t.bool(),
  kills: t.u32(),
  deaths: t.u32(),
  /** Medkit healing: seconds left. */
  healLeft: t.f32(),
  /** Cornucopia rocket boots (double jump). */
  boots: t.bool(),
  /** Round-trip time reported by the client (ms); 0 for bots. */
  ping: t.u16(),
  /** Server time of this pose (move accepted / bot tick); clients use it to map their view to server time. */
  lastMoveAt: t.timestamp(),
});

/** One bullet (tracers, hit markers). Event table: clients only get inserts. */
const shotEvent = table({ name: 'shot_event', public: true, event: true }, {
  roomId: t.u64(),
  shooterId: t.u64(),
  ox: t.f32(), oy: t.f32(), oz: t.f32(),
  ex: t.f32(), ey: t.f32(), ez: t.f32(),
  /** 'none' | 'world' | 'player' */
  hitKind: t.string(),
  victimId: t.u64(),
  /** 'head' | 'body' */
  part: t.string(),
  damage: t.f32(),
  killed: t.bool(),
  /** Weapon id that fired. */
  weapon: t.string(),
  /** How far the target poses were rewound (ms). */
  rewindMs: t.f32(),
  /** Debug for lag-compensation tests: would the same ray hit the CURRENT (not rewound) poses? */
  hitWithoutRewind: t.bool(),
});

const killEvent = table({ name: 'kill_event', public: true, event: true }, {
  roomId: t.u64(),
  killerId: t.u64(),
  victimId: t.u64(),
  headshot: t.bool(),
  weapon: t.string(),
});

/** Items on the ground: weapon drops (GAME.md 2.1). Cleared when a round starts. */
const item = table({ name: 'item', public: true }, {
  id: t.u64().primaryKey().autoInc(),
  roomId: t.u64().index('btree'),
  /** 'weapon' */
  kind: t.string(),
  /** Weapon id for kind 'weapon'. */
  weapon: t.string(),
  mag: t.u16(),
  reserve: t.u16(),
  /** Floor position (feet height). */
  x: t.f32(), y: t.f32(), z: t.f32(),
  /** Cornucopia loot on a pedestal (not a drop). */
  pedestal: t.bool(),
});

/** Team ping (marker for teammates). Event table: one row per receiving human; row-level security (below) lets each
 *  client see only the rows addressed to it, so a modified client cannot read enemy pings. */
const pingEvent = table({ name: 'ping_event', public: true, event: true }, {
  /** The client this row is for (a teammate of the pinger, or the pinger). */
  recipient: t.identity(),
  roomId: t.u64(),
  playerId: t.u64(),
  team: t.string(),
  x: t.f32(), y: t.f32(), z: t.f32(),
});

const tickTimer = table({ name: 'tick_timer' }, {
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
});

// Wallet login (GAME.md 6.8): which account (lowercase 0x address) a connection is logged in as.
// A client only receives its own row (sessionVisibility). Several connections may share one address (devices).
const session = table({ name: 'session', public: true }, {
  identity: t.identity().primaryKey(),
  address: t.string().index('btree'),
  at: t.timestamp(),
});

// Marketplace (GAME.md 6.7): coins and tradable items per account (wallet address). Public for now (balances visible).
const wallet = table({ name: 'wallet', public: true }, {
  /** Account address (lowercase 0x...). */
  owner: t.string().primaryKey(),
  coins: t.u32(),
  createdAt: t.timestamp(),
  /** UTC day (YYYY-MM-DD) of the last first-win-of-the-day bonus; '' = never. */
  lastWinDay: t.string(),
});

/** One copy of a catalog item; exactly one owner. */
const ownedItem = table({ name: 'owned_item', public: true }, {
  id: t.u64().primaryKey().autoInc(),
  owner: t.string().index('btree'),
  /** Catalog id (src/gameplay/market.ts), e.g. 'character:vibe-vibers-viber-142', 'emote:wave'. */
  ref: t.string(),
  acquiredAt: t.timestamp(),
});

const listing = table({ name: 'listing', public: true }, {
  id: t.u64().primaryKey().autoInc(),
  itemId: t.u64().unique(),
  seller: t.string().index('btree'),
  ref: t.string(),
  price: t.u32(),
  createdAt: t.timestamp(),
});

/** Sales log (last MARKET.tradeHistory kept). */
const trade = table({ name: 'trade', public: true }, {
  id: t.u64().primaryKey().autoInc(),
  itemId: t.u64(),
  ref: t.string(),
  seller: t.string(),
  buyer: t.string(),
  price: t.u32(),
  fee: t.u32(),
  at: t.timestamp(),
});

/** One row (id 0): coins ever created and destroyed, so sum(wallet.coins) == minted - burned. */
const economy = table({ name: 'economy', public: true }, {
  id: t.u32().primaryKey(),
  minted: t.u64(),
  burned: t.u64(),
});

/** When the current match of a room started (match rewards need a minimum length). */
const matchClock = table({ name: 'match_clock' }, {
  roomId: t.u64().primaryKey(),
  startedAt: t.timestamp(),
});

/** Headshot kills per player row in the current match (for the match reward). */
const matchStat = table({ name: 'match_stat' }, {
  playerId: t.u64().primaryKey(),
  headshots: t.u32(),
});

/** All-time stats per account for the leaderboard (GAME.md 6.8): every online match counts. */
const playerStat = table({ name: 'player_stat', public: true }, {
  owner: t.string().primaryKey(),
  /** Player name in the last match. */
  name: t.string(),
  matches: t.u32(),
  wins: t.u32(),
  kills: t.u32(),
  deaths: t.u32(),
  headshots: t.u32(),
});

/** Stats per account per week (Monday 00:00 UTC) for the weekly STRIKE rewards (GAME.md 6.9). */
const weekStat = table({ name: 'week_stat', public: true }, {
  /** `${week}:${owner}` */
  id: t.string().primaryKey(),
  week: t.u32().index('btree'),
  owner: t.string(),
  name: t.string(),
  matches: t.u32(),
  wins: t.u32(),
  kills: t.u32(),
  headshots: t.u32(),
});

const spacetimedb = schema({ room, player, shotEvent, killEvent, item, pingEvent, tickTimer, session, wallet, ownedItem, listing, trade, economy, matchStat, matchClock, playerStat, weekStat });
export default spacetimedb;

/** Row-level security: a client only receives the ping rows addressed to it. */
export const pingVisibility = spacetimedb.clientVisibilityFilter.sql('SELECT * FROM ping_event WHERE recipient = :sender');
/** Row-level security: a client only receives its own login session. */
export const sessionVisibility = spacetimedb.clientVisibilityFilter.sql('SELECT * FROM session WHERE identity = :sender');

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;
type PlayerRow = ReturnType<Ctx['db']['player']['id']['find']> & {};
type RoomRow = ReturnType<Ctx['db']['room']['id']['find']> & {};

const TICK_DT = 1 / NET.tickRateHz;
const modeOf = (r: RoomRow) => (r.mode === 'cornucopia' ? 'cornucopia' : 'elimination') as GameMode;
const rulesOf = (r: RoomRow) => mutatorRules(r.mutator);
const isFfa = (r: RoomRow) => modeOf(r) === 'cornucopia' && !r.teams;

const nowMs = (ctx: Ctx) => Number(ctx.timestamp.microsSinceUnixEpoch) / 1000;

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

/** The simulation object for a row (weapons, bot brain state live in module memory; rows are the truth for the rest). */
function actorOf(row: PlayerRow): Actor {
  const a = actorFor(Number(row.id), row.team as TeamId, row.isBot);
  a.team = row.team as TeamId; a.x = row.x; a.y = row.y; a.z = row.z; a.yaw = row.yaw; a.pitch = row.pitch;
  a.crouching = row.crouch; a.alive = row.alive; a.hp = row.hp; a.grounded = row.grounded;
  a.hasPrimary = row.primary !== '';
  if (a.hasPrimary) setPrimary(a, row.primary as WeaponId);
  a.boots = row.boots; a.healLeft = row.healLeft;
  if (a.active !== row.weapon && row.weapon < a.slots.length) a.active = row.weapon;
  a.eyeHeight = row.crouch ? CAPSULE.crouchEyeHeight : CAPSULE.eyeHeight;
  return a;
}

function fullAmmo(primary: WeaponId): { mag: number; reserve: number } {
  const s = WEAPON_STATS[loadoutFor(primary)[0]];
  return { mag: s.magSize, reserve: s.reserve };
}

function spawnRow(ctx: Ctx, r: RoomRow, team: TeamId, isBot: boolean, ownerHex: string, name: string, character: number,
  spawnIndex: number, primary: WeaponId = LOADOUT.defaultPrimary): void {
  // Cornucopia has one life per match: joining after the freeze phase means spectating until the next match.
  const alive = !(modeOf(r) === 'cornucopia' && r.phase !== 'freeze');
  const roomId = r.id, corn = modeOf(r) === 'cornucopia';
  const terrain = terrainFor(corn);
  const spots = isFfaTeam(team) ? terrain.ffaSpawns : terrain.spawns[team];
  const s = spots[spawnIndex % spots.length];
  const ammo = corn ? { mag: CORNUCOPIA.pistolMag, reserve: CORNUCOPIA.pistolReserve } : fullAmmo(primary);
  const row = ctx.db.player.insert({
    id: 0n, roomId, ownerHex, isBot, name, character: character % characters.length, team, x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0,
    yaw: s.yaw, pitch: 0, crouch: false, grounded: true, walk: false, seq: 0, correctionSeq: 1, spawnCount: 1, violations: 0,
    hp: alive ? MATCH.maxHealth : 0, alive, weapon: corn ? 1 : 0, primary: corn ? '' : primary, nextPrimary: corn ? '' : primary,
    mag: ammo.mag, reserve: ammo.reserve, reloading: false, kills: 0, deaths: 0, healLeft: 0, boots: rulesOf(r).boots, ping: 0, lastMoveAt: ctx.timestamp,
  });
  const sa = actorFor(Number(row.id), team, isBot);
  if (corn) cornucopiaLoadout(sa);
  sa.boots = rulesOf(r).boots;
}

/** A free team id for free-for-all ('F1', 'F2', ...). */
function freeFfaTeam(rows: readonly PlayerRow[]): TeamId {
  for (let i = 1; ; i++) { const t = ffaTeam(i); if (!rows.some((p) => p.team === t)) return t; }
}

/** Fill both teams up to MATCH.teamSize with bots (if the room uses bots). */
function fillBots(ctx: Ctx, r: RoomRow): void {
  if (!r.bots) return;
  const rows = playersIn(ctx, r.id);
  if (isFfa(r)) {
    while (rows.length < MATCH.teamSize * 2) {
      const team = freeFfaTeam(rows);
      spawnRow(ctx, r, team, true, '', `Bot ${ctx.random.integerInRange(10, 99)}`, ctx.random.integerInRange(0, characters.length - 1), rows.length);
      rows.push({ team } as PlayerRow);
    }
    return;
  }
  for (const team of ['A', 'B'] as const) {
    let count = rows.filter((p) => p.team === team).length;
    // Random primaries, at most LOADOUT.maxSnipersPerTeam snipers per team.
    let snipers = rows.filter((p) => p.team === team && p.nextPrimary === 'sniper').length;
    while (count < MATCH.teamSize) {
      const primary = pickBotPrimary(() => ctx.random(), snipers >= LOADOUT.maxSnipersPerTeam);
      if (primary === 'sniper') snipers++;
      spawnRow(ctx, r, team, true, '', `Bot ${ctx.random.integerInRange(10, 99)}`,
        ctx.random.integerInRange(0, characters.length - 1), count, primary);
      count++;
    }
  }
}

/** Delete a player row and everything kept per player row. */
function dropPlayer(ctx: Ctx, id: bigint): void {
  ctx.db.player.id.delete(id);
  ctx.db.matchStat.playerId.delete(id);
  forgetActor(Number(id));
}

function removeOwnRows(ctx: Ctx): void {
  const hex = ctx.sender.toHexString();
  for (const row of [...ctx.db.player.ownerHex.filter(hex)]) {
    dropPlayer(ctx, row.id);
    closeRoomIfEmpty(ctx, row.roomId);
  }
}

function closeRoomIfEmpty(ctx: Ctx, roomId: bigint): void {
  const r = ctx.db.room.id.find(roomId);
  const rows = playersIn(ctx, roomId);
  if (r && rows.some((p) => !p.isBot)) {
    fillBots(ctx, r); // a human left: a bot takes the place
    return;
  }
  for (const p of rows) { dropPlayer(ctx, p.id); }
  clearItems(ctx, roomId);
  ctx.db.matchClock.roomId.delete(roomId);
  if (r) ctx.db.room.id.delete(roomId);
}

/** Put the caller into a room: pick the team with fewer humans, replace one of its bots. */
function joinRoom(ctx: Ctx, r: RoomRow, name: string, character: number): void {
  removeOwnRows(ctx);
  const rows = playersIn(ctx, r.id);
  const humans = (team: string) => rows.filter((p) => p.team === team && !p.isBot).length;
  if (rows.filter((p) => !p.isBot).length >= MATCH.teamSize * 2) throw new SenderError('room is full');
  if (isFfa(r)) {
    // Free-for-all: take a bot's place (and its team id), else a new team id.
    const bot = rows.find((p) => p.isBot);
    if (bot) { dropPlayer(ctx, bot.id); }
    const team = bot ? (bot.team as TeamId) : freeFfaTeam(rows);
    spawnRow(ctx, r, team, false, ctx.sender.toHexString(), cleanName(name), character, rows.length);
    fillBots(ctx, r);
    return;
  }
  const team: TeamId = humans('A') <= humans('B') ? 'A' : 'B';
  const bot = rows.find((p) => p.team === team && p.isBot);
  if (bot) { dropPlayer(ctx, bot.id); }
  const teamCount = rows.filter((p) => p.team === team).length - (bot ? 1 : 0);
  spawnRow(ctx, r, team, false, ctx.sender.toHexString(), cleanName(name), character, teamCount);
  fillBots(ctx, r);
}

/** The 30 Hz tick runs only while rooms exist (no idle cost on a hosted server). */
function ensureTick(ctx: Ctx): void {
  if (ctx.db.tickTimer.iter().next().done) {
    ctx.db.tickTimer.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.interval(BigInt(Math.round(1_000_000 / NET.tickRateHz))) });
  }
}

function createRoom(ctx: Ctx, isPrivate: boolean, bots: boolean, difficulty: BotDifficulty = DEFAULT_DIFFICULTY,
  mode: GameMode = 'elimination', teams = true, mutator = ''): RoomRow {
  ensureTick(ctx);
  terrainFor(mode === 'cornucopia'); // build the nav grid now, not during a tick
  const r = ctx.db.room.insert({ id: 0n, code: newRoomCode(ctx), isPrivate, bots, difficulty, mode, teams: mode === 'elimination' || teams, mutator: isMutator(mutator) ? mutator : '',
    phase: 'freeze', round: 1, scoreA: 0, scoreB: 0, timeLeft: presetFor(mode).freezeTime, lastWinner: '', matchWinner: '', createdAt: ctx.timestamp });
  if (mode === 'cornucopia') spawnLoot(ctx, r.id);
  ctx.db.matchClock.insert({ roomId: r.id, startedAt: ctx.timestamp });
  return r;
}

// ---------------------------------------------------------------------------------------------
// Combat

const shot = createShotResult(), shotNow = createShotResult();
const origin = vec3(), aimDir = vec3(), dir = vec3();

/** Write ammo / weapon / reload state to the row if it changed. Returns the (possibly updated) row. */
function syncAmmo(ctx: Ctx, row: PlayerRow, a: Actor): PlayerRow {
  const slot = a.slots[a.active];
  const reloading = slot.reloadLeft > 0;
  if (row.mag === slot.mag && row.reserve === slot.reserve && row.reloading === reloading && row.weapon === a.active) return row;
  const next = { ...row, mag: slot.mag, reserve: slot.reserve, reloading, weapon: a.active };
  ctx.db.player.id.update(next);
  return next;
}

function kill(ctx: Ctx, r: RoomRow, victimId: bigint, killerId: bigint, headshot: boolean, weapon: string): void {
  const v = ctx.db.player.id.find(victimId);
  if (!v || !v.alive) return;
  const va = actorOf(v);
  if (va.hasPrimary) dropItem(ctx, r.id, primaryState(va), v.x, v.y, v.z);
  ctx.db.player.id.update({ ...v, hp: 0, alive: false, deaths: v.deaths + 1, vx: 0, vy: 0, vz: 0, reloading: false });
  actorFor(Number(v.id), v.team as TeamId, v.isBot).alive = false;
  bumpStat(ctx, v, { deaths: 1 });
  const k = ctx.db.player.id.find(killerId);
  if (k && k.id !== v.id) {
    ctx.db.player.id.update({ ...k, kills: k.kills + 1 });
    bumpStat(ctx, k, { kills: 1, headshots: headshot ? 1 : 0 });
    if (headshot && !k.isBot) {
      const st = ctx.db.matchStat.playerId.find(k.id);
      if (st) ctx.db.matchStat.playerId.update({ ...st, headshots: st.headshots + 1 });
      else ctx.db.matchStat.insert({ playerId: k.id, headshots: 1 });
    }
  }
  ctx.db.killEvent.insert({ roomId: r.id, killerId, victimId, headshot, weapon });
}

// ---------------------------------------------------------------------------------------------
// Items on the ground

/** A weapon with its ammo on the floor at (x, y, z). Keeps at most ITEMS.maxDropsPerRoom (oldest go first). */
function dropItem(ctx: Ctx, roomId: bigint, w: WeaponState, x: number, y: number, z: number): void {
  ctx.db.item.insert({ id: 0n, roomId, kind: 'weapon', weapon: w.weapon, mag: w.mag, reserve: w.reserve, x, y, z, pedestal: false });
  const all = [...ctx.db.item.roomId.filter(roomId)].filter((it) => !it.pedestal);
  if (all.length <= ITEMS.maxDropsPerRoom) return;
  all.sort((a, b) => (a.id < b.id ? -1 : 1));
  for (let i = 0; i < all.length - ITEMS.maxDropsPerRoom; i++) ctx.db.item.id.delete(all[i].id);
}

function clearItems(ctx: Ctx, roomId: bigint): void {
  for (const it of [...ctx.db.item.roomId.filter(roomId)]) ctx.db.item.id.delete(it.id);
}

/** Cornucopia: loot on pedestals at the map's lootSpots (GAME.md 2.2, CORNUCOPIA.loot). */
function spawnLoot(ctx: Ctx, roomId: bigint): void {
  for (const l of lootPlan(getWorld().lootSpots)) {
    const ammo = lootAmmo(l.kind, l.weapon);
    ctx.db.item.insert({ id: 0n, roomId, kind: l.kind, weapon: l.weapon, mag: ammo.mag, reserve: ammo.reserve, x: l.x, y: l.y, z: l.z, pedestal: true });
  }
}

type ItemRow = ReturnType<Ctx['db']['item']['id']['find']> & {};

/** E on an item (humans and bots): validated by the caller (range, phase). Writes the player row. */
function pickUpItem(ctx: Ctx, r: RoomRow, row: PlayerRow, a: Actor, it: ItemRow): void {
  if (it.kind === 'weapon' && !LOADOUT.primaries.includes(it.weapon as WeaponId)) return;
  const dropped: WeaponState[] = [];
  if (!useItem(a, it, (w) => dropped.push(w))) return;
  ctx.db.item.id.delete(it.id);
  for (const w of dropped) dropItem(ctx, r.id, w, row.x, row.y, row.z);
  const slot = a.slots[a.active];
  ctx.db.player.id.update({ ...row, primary: a.hasPrimary ? a.slots[0].stats.id : '', weapon: a.active, mag: slot.mag, reserve: slot.reserve,
    reloading: false, boots: a.boots, healLeft: a.healLeft });
}

/**
 * One trigger pull from `shooter` at (yaw, pitch), validated by the caller. Targets are rewound by `rewindMs`.
 * Same code for humans (rewind = their view time) and bots (rewind 0).
 */
function fireShot(ctx: Ctx, r: RoomRow, shooter: PlayerRow, a: Actor, yaw: number, pitch: number, rewindMs: number,
  scoped: boolean): void {
  const world = getWorld();
  const slot = a.slots[a.active], s = slot.stats;
  const moveFraction = Math.min(1, Math.hypot(shooter.vx, shooter.vz) / MOVEMENT.runSpeed);
  const spread = spreadDeg(slot, moveFraction, !shooter.grounded, scoped) * DEG;
  consumeShot(slot);
  a.fireAnimLeft = s.fireAnimTime;
  origin.x = shooter.x; origin.y = shooter.y + (shooter.crouch ? CAPSULE.crouchEyeHeight : CAPSULE.eyeHeight); origin.z = shooter.z;
  directionFromAngles(yaw, pitch, aimDir);
  // Targets: enemies alive now, at their rewound pose and at their current pose.
  const rows = playersIn(ctx, r.id).filter((p) => p.alive && p.id !== shooter.id && (MATCH.friendlyFire || p.team !== shooter.team));
  const at = nowMs(ctx) - rewindMs;
  const past: HitTarget[] = [], now: HitTarget[] = [];
  for (const p of rows) {
    const id = Number(p.id);
    const target: HitTarget = { id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, crouching: p.crouch };
    now.push({ ...target });
    historyFor(id).sampleAt(at, target);
    past.push(target);
  }
  const keep = () => false;
  for (let i = 0; i < s.pellets; i++) {
    spreadDirection(aimDir, spread, ctx.random(), ctx.random(), dir);
    const rules = rulesOf(r);
    traceShot(origin, dir, s.range, world.blockers, past, keep, shot, rules.headScale);
    traceShot(origin, dir, s.range, world.blockers, now, keep, shotNow, rules.headScale);
    let damage = 0, killed = false, victimId = 0n;
    if (shot.kind === 'player') {
      const victim = rows[shot.targetIndex];
      victimId = victim.id;
      damage = rules.oneShot ? MATCH.maxHealth * 10 : damageAt(s, shot.distance) * (shot.part === 'head' ? HITBOXES.headshotMultiplier : 1);
      const v = ctx.db.player.id.find(victim.id);
      if (v && v.alive) {
        const hp = v.hp - damage;
        if (hp <= 0) { kill(ctx, r, v.id, shooter.id, shot.part === 'head', s.id); killed = true; }
        else {
          ctx.db.player.id.update({ ...v, hp });
          const va = actorFor(Number(v.id), v.team as TeamId, v.isBot);
          va.sinceDamage = 0; va.lastAttacker = Number(shooter.id);
        }
      }
    }
    ctx.db.shotEvent.insert({
      roomId: r.id, shooterId: shooter.id, ox: origin.x, oy: origin.y, oz: origin.z,
      ex: origin.x + dir.x * shot.distance, ey: origin.y + dir.y * shot.distance, ez: origin.z + dir.z * shot.distance,
      hitKind: shot.kind, victimId, part: shot.part, damage, killed, weapon: s.id, rewindMs,
      hitWithoutRewind: shotNow.kind === 'player' && rows[shotNow.targetIndex].id === victimId && victimId !== 0n,
    });
  }
}

/** Everyone back to the team spawns with full HP and ammo. */
function respawnAll(ctx: Ctx, r: RoomRow, resetScores: boolean): void {
  clearItems(ctx, r.id);
  if (resetScores) { // a new match starts now
    ctx.db.matchClock.roomId.delete(r.id);
    ctx.db.matchClock.insert({ roomId: r.id, startedAt: ctx.timestamp });
  }
  const corn = modeOf(r) === 'cornucopia';
  if (corn) spawnLoot(ctx, r.id);
  const rows = playersIn(ctx, r.id).sort((p, q) => (p.id < q.id ? -1 : 1));
  const index: Record<string, number> = { A: 0, B: 0, F: 0 };
  for (const p of rows) {
    if (resetScores) ctx.db.matchStat.playerId.delete(p.id); // a new match: headshots count from 0
    const team = p.team as TeamId, ffa = isFfaTeam(team);
    const spots = ffa ? terrainFor(corn).ffaSpawns : terrainFor(corn).spawns[team];
    const s = spots[index[ffa ? 'F' : team]++ % spots.length];
    const a = actorFor(Number(p.id), team, p.isBot);
    const primary = loadoutFor(p.nextPrimary as WeaponId)[0];
    setPrimary(a, primary);
    for (const slot of a.slots) resetSlot(slot);
    a.active = 0; a.equipLeft = 0; a.fireAnimLeft = 0; a.alive = true; a.hp = MATCH.maxHealth; a.lastAttacker = -1; a.sinceDamage = 99;
    a.hasPrimary = true; a.boots = false; a.healLeft = 0;
    if (corn) cornucopiaLoadout(a);
    a.boots = rulesOf(r).boots;
    historyFor(Number(p.id)).clear();
    if (p.isBot) resetBrain(brainFor(Number(p.id)));
    const slot = a.slots[a.active];
    ctx.db.player.id.update({ ...p, x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, yaw: s.yaw, pitch: 0, crouch: false,
      grounded: true, hp: MATCH.maxHealth, alive: true, weapon: a.active, primary: corn ? '' : primary, mag: slot.mag, reserve: slot.reserve,
      reloading: false, healLeft: 0, boots: a.boots,
      correctionSeq: p.correctionSeq + 1, spawnCount: p.spawnCount + 1, lastMoveAt: ctx.timestamp,
      kills: resetScores ? 0 : p.kills, deaths: resetScores ? 0 : p.deaths });
  }
}

function roundStateOf(r: RoomRow): RoundState {
  return { phase: r.phase as RoundPhase, timeLeft: r.timeLeft, round: r.round, scoreA: r.scoreA, scoreB: r.scoreB,
    lastWinner: r.lastWinner === '' ? null : (r.lastWinner as 'A' | 'B' | 'draw'),
    matchWinner: r.matchWinner === '' ? null : (r.matchWinner as TeamId) };
}

/** Advance the room's round state; respawns on a new round / match. */
function tickRoom(ctx: Ctx, r: RoomRow): RoomRow {
  const state = roundStateOf(r), preset = presetFor(modeOf(r));
  if (state.phase === 'matchEnd') {
    state.timeLeft -= TICK_DT;
    if (state.timeLeft <= 0) { restartMatch(state, preset); respawnAll(ctx, r, true); }
  } else {
    const ev = tickModeRound(state, preset, TICK_DT, ctx.db.player.roomId.filter(r.id), isFfa(r));
    if (ev === 'roundStart') respawnAll(ctx, r, false);
    if (ev === 'matchEnd') { state.timeLeft = MATCH.matchRestartTime; payMatch(ctx, r, state.matchWinner ?? ''); }
  }
  const next = { ...r, phase: state.phase, timeLeft: Math.max(0, state.timeLeft), round: state.round, scoreA: state.scoreA,
    scoreB: state.scoreB, lastWinner: state.lastWinner ?? '', matchWinner: state.matchWinner ?? '' };
  ctx.db.room.id.update(next);
  return next;
}

// ---------------------------------------------------------------------------------------------
// Marketplace (GAME.md 6.7)

type WalletRow = ReturnType<Ctx['db']['wallet']['owner']['find']> & {};
type StatRow = ReturnType<Ctx['db']['playerStat']['owner']['find']> & {};
const U32_MAX = 0xffffffff;
/** Market actions per account (module memory: attempts count, refused ones too). */
const marketLimiter = new RateLimiter(MARKET.rateLimit.actions, MARKET.rateLimit.windowMs);
/** Login attempts per identity. */
const loginLimiter = new RateLimiter(AUTH.rateLimit.actions, AUTH.rateLimit.windowMs);

function economyRow(ctx: Ctx) {
  return ctx.db.economy.id.find(0) ?? ctx.db.economy.insert({ id: 0, minted: 0n, burned: 0n });
}
function mint(ctx: Ctx, coins: number): void { const e = economyRow(ctx); ctx.db.economy.id.update({ ...e, minted: e.minted + BigInt(coins) }); }
function burn(ctx: Ctx, coins: number): void { const e = economyRow(ctx); ctx.db.economy.id.update({ ...e, burned: e.burned + BigInt(coins) }); }

/** The account (address) a connection is logged in as, or '' for a guest. */
function accountOf(ctx: Ctx, who: Identity): string { return ctx.db.session.identity.find(who)?.address ?? ''; }
/** The account of a player row ('' for bots and guests). */
function accountOfPlayer(ctx: Ctx, p: PlayerRow): string {
  return p.isBot || p.ownerHex === '' ? '' : accountOf(ctx, Identity.fromString(p.ownerHex));
}

/** The account's wallet; a new one gets the start coins and the starter items. */
function ensureWallet(ctx: Ctx, owner: string): WalletRow {
  const found = ctx.db.wallet.owner.find(owner);
  if (found) return found;
  const w = ctx.db.wallet.insert({ owner, coins: MARKET.startCoins, createdAt: ctx.timestamp, lastWinDay: '' });
  mint(ctx, MARKET.startCoins);
  for (const ref of starterRefs(CATALOG, () => ctx.random())) ctx.db.ownedItem.insert({ id: 0n, owner, ref, acquiredAt: ctx.timestamp });
  return w;
}

/** Add coins to a wallet (minted). Clamped at the u32 limit; the clamped part is never minted. */
function payCoins(ctx: Ctx, w: WalletRow, coins: number, extra: Partial<WalletRow> = {}): void {
  const paid = Math.min(coins, U32_MAX - w.coins);
  ctx.db.wallet.owner.update({ ...w, ...extra, coins: w.coins + paid });
  mint(ctx, paid);
}

/** Add to a logged-in player's all-time and this week's stats (bots and guests have none). */
function bumpStat(ctx: Ctx, p: PlayerRow, d: Partial<Omit<StatRow, 'owner' | 'name'>>): void {
  const owner = accountOfPlayer(ctx, p);
  if (!owner) return;
  const s = ctx.db.playerStat.owner.find(owner)
    ?? ctx.db.playerStat.insert({ owner, name: p.name, matches: 0, wins: 0, kills: 0, deaths: 0, headshots: 0 });
  const add = (a: number, b = 0) => Math.min(U32_MAX, a + b);
  ctx.db.playerStat.owner.update({ ...s, name: p.name, matches: add(s.matches, d.matches), wins: add(s.wins, d.wins),
    kills: add(s.kills, d.kills), deaths: add(s.deaths, d.deaths), headshots: add(s.headshots, d.headshots) });
  const week = weekOf(nowMs(ctx)), id = `${week}:${owner}`;
  const w = ctx.db.weekStat.id.find(id)
    ?? ctx.db.weekStat.insert({ id, week, owner, name: p.name, matches: 0, wins: 0, kills: 0, headshots: 0 });
  ctx.db.weekStat.id.update({ ...w, name: p.name, matches: add(w.matches, d.matches), wins: add(w.wins, d.wins),
    kills: add(w.kills, d.kills), headshots: add(w.headshots, d.headshots) });
}

/** Match end: stats for every logged-in human (every online match counts); coins only for a real match. */
function payMatch(ctx: Ctx, r: RoomRow, winner: string): void {
  const day = utcDay(nowMs(ctx)), rows = playersIn(ctx, r.id);
  const clock = ctx.db.matchClock.roomId.find(r.id);
  const seconds = clock ? (nowMs(ctx) - Number(clock.startedAt.microsSinceUnixEpoch) / 1000) / 1000 : 0;
  const pays = matchPays(rows.length, seconds);
  for (const p of rows) {
    const owner = accountOfPlayer(ctx, p);
    const headshots = ctx.db.matchStat.playerId.find(p.id)?.headshots ?? 0;
    ctx.db.matchStat.playerId.delete(p.id);
    if (!owner) continue;
    const won = winner !== '' && p.team === winner;
    bumpStat(ctx, p, { matches: 1, wins: won ? 1 : 0 });
    if (!pays) continue;
    const w = ensureWallet(ctx, owner);
    const first = won && w.lastWinDay !== day;
    payCoins(ctx, w, matchReward(won, p.kills, headshots, first), first ? { lastWinDay: day } : {});
  }
}

/** Market reducers: the caller must be logged in; returns its account. */
function marketGate(ctx: Ctx): string {
  const owner = accountOf(ctx, ctx.sender);
  if (!owner) throw new SenderError('log in with a wallet first');
  if (!marketLimiter.allow(owner, nowMs(ctx))) throw new SenderError('too many market actions, wait a moment');
  return owner;
}

/** Wallet login (GAME.md 6.8): a personal_sign signature of loginMessage(address, own identity, issuedAtMs). */
export const login = spacetimedb.reducer({ address: t.string(), issuedAtMs: t.f64(), signature: t.string() }, (ctx, { address, issuedAtMs, signature }) => {
  if (!loginLimiter.allow(ctx.sender.toHexString(), nowMs(ctx))) throw new SenderError('too many login attempts, wait a moment');
  const error = loginError(address, ctx.sender.toHexString(), issuedAtMs, signature, nowMs(ctx));
  if (error) throw new SenderError(error);
  const owner = address.toLowerCase();
  const row = { identity: ctx.sender, address: owner, at: ctx.timestamp };
  if (ctx.db.session.identity.find(ctx.sender)) ctx.db.session.identity.update(row);
  else ctx.db.session.insert(row);
  ensureWallet(ctx, owner);
});

export const logout = spacetimedb.reducer((ctx) => { ctx.db.session.identity.delete(ctx.sender); });

export const listItem = spacetimedb.reducer({ itemId: t.u64(), price: t.u32() }, (ctx, { itemId, price }) => {
  const me = marketGate(ctx);
  const error = priceError(price);
  if (error) throw new SenderError(error);
  const it = ctx.db.ownedItem.id.find(itemId);
  if (!it || it.owner !== me) throw new SenderError('you do not own this item');
  if (ctx.db.listing.itemId.find(itemId)) throw new SenderError('this item is already listed');
  let open = 0;
  for (const _ of ctx.db.listing.seller.filter(me)) open++;
  if (open >= MARKET.maxListingsPerSeller) throw new SenderError(`at most ${MARKET.maxListingsPerSeller} listings at once`);
  ctx.db.listing.insert({ id: 0n, itemId, seller: me, ref: it.ref, price, createdAt: ctx.timestamp });
});

export const cancelListing = spacetimedb.reducer({ listingId: t.u64() }, (ctx, { listingId }) => {
  const me = marketGate(ctx);
  const l = ctx.db.listing.id.find(listingId);
  if (!l) throw new SenderError('listing is gone');
  if (l.seller !== me) throw new SenderError('not your listing');
  ctx.db.listing.id.delete(l.id);
});

export const buyListing = spacetimedb.reducer({ listingId: t.u64(), expectedPrice: t.u32() }, (ctx, { listingId, expectedPrice }) => {
  const me = marketGate(ctx);
  const l = ctx.db.listing.id.find(listingId);
  if (!l) throw new SenderError('listing is gone');
  if (l.seller === me) throw new SenderError('you cannot buy your own listing');
  if (l.price !== expectedPrice) throw new SenderError('price changed');
  const it = ctx.db.ownedItem.id.find(l.itemId);
  if (!it || it.owner !== l.seller) throw new SenderError('listing is invalid');
  const buyer = ensureWallet(ctx, me);
  if (buyer.coins < l.price) throw new SenderError('not enough coins');
  const seller = ctx.db.wallet.owner.find(l.seller);
  if (!seller) throw new SenderError('seller has no wallet');
  const fee = saleFee(l.price), net = l.price - fee;
  if (seller.coins + net > U32_MAX) throw new SenderError('seller wallet is full');
  ctx.db.wallet.owner.update({ ...buyer, coins: buyer.coins - l.price });
  ctx.db.wallet.owner.update({ ...seller, coins: seller.coins + net });
  burn(ctx, fee);
  ctx.db.ownedItem.id.update({ ...it, owner: me, acquiredAt: ctx.timestamp });
  ctx.db.listing.id.delete(l.id);
  ctx.db.trade.insert({ id: 0n, itemId: it.id, ref: it.ref, seller: l.seller, buyer: me, price: l.price, fee, at: ctx.timestamp });
  // Keep the last MARKET.tradeHistory trades.
  let excess = Number(ctx.db.trade.count()) - MARKET.tradeHistory;
  if (excess > 0) {
    const ids = [...ctx.db.trade.iter()].map((tr) => tr.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const id of ids) { if (excess-- <= 0) break; ctx.db.trade.id.delete(id); }
  }
});

// ---------------------------------------------------------------------------------------------
// Reducers

export const init = spacetimedb.init((ctx) => {
  // The tick starts with the first room (ensureTick) and stops when the last room closes.
  if (ctx.db.room.iter().next().done) return;
  ensureTick(ctx);
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => { removeOwnRows(ctx); });

export const joinQuick = spacetimedb.reducer({ name: t.string(), character: t.u16() }, (ctx, { name, character }) => {
  let target: RoomRow | null = null;
  for (const r of ctx.db.room.iter()) {
    if (r.isPrivate) continue;
    const humans = playersIn(ctx, r.id).filter((p) => !p.isBot).length;
    if (humans < MATCH.teamSize * 2) { target = r; break; }
  }
  // Quick Play: Elimination with the mutator of the day (UTC date).
  joinRoom(ctx, target ?? createRoom(ctx, false, true, DEFAULT_DIFFICULTY, 'elimination', true, mutatorOfDay(nowMs(ctx))), name, character);
});

export const createPrivateRoom = spacetimedb.reducer({ name: t.string(), character: t.u16(), bots: t.bool(), difficulty: t.string(),
  mode: t.string(), teams: t.bool(), mutator: t.string() },
  (ctx, { name, character, bots, difficulty, mode, teams, mutator }) => {
    const level: BotDifficulty = difficulty in BOT_SKILLS ? (difficulty as BotDifficulty) : DEFAULT_DIFFICULTY;
    joinRoom(ctx, createRoom(ctx, true, bots, level, mode === 'cornucopia' ? 'cornucopia' : 'elimination', teams, mutator), name, character);
});

export const joinByCode = spacetimedb.reducer({ code: t.string(), name: t.string(), character: t.u16() }, (ctx, { code, name, character }) => {
  const r = ctx.db.room.code.find(code.trim().toUpperCase());
  if (!r) throw new SenderError('no room with this code');
  joinRoom(ctx, r, name, character);
});

export const leaveRoom = spacetimedb.reducer((ctx) => { removeOwnRows(ctx); });

function myRow(ctx: Ctx): PlayerRow | undefined { return ctx.db.player.ownerHex.filter(ctx.sender.toHexString()).next().value; }

/** Client-reported movement (owner decision 2026-10-30): validated, snapped back on violation. */
export const move = spacetimedb.reducer({
  seq: t.u32(), ack: t.u32(), x: t.f32(), y: t.f32(), z: t.f32(), vx: t.f32(), vy: t.f32(), vz: t.f32(),
  yaw: t.f32(), pitch: t.f32(), crouch: t.bool(), grounded: t.bool(), walk: t.bool(),
}, (ctx, m) => {
  const row = myRow(ctx);
  if (!row || !row.alive) return;
  // Ignore stale or out-of-order messages, and moves sent before the client saw our last correction.
  if (m.seq <= row.seq || m.ack < row.correctionSeq) return;
  const elapsed = Number(ctx.timestamp.microsSinceUnixEpoch - row.lastMoveAt.microsSinceUnixEpoch) / 1e6;
  const prev: MoveSample = { x: row.x, y: row.y, z: row.z, crouch: row.crouch, walk: row.walk };
  const next: MoveSample = { x: m.x, y: m.y, z: m.z, crouch: m.crouch, walk: m.walk };
  const a = actorFor(Number(row.id), row.team as TeamId, false);
  const room = ctx.db.room.id.find(row.roomId);
  const verdict = terrainFor(!!room && modeOf(room) === 'cornucopia').movement.check(prev, next, elapsed, a.slots[a.active].stats.moveSpeedScale * (room ? rulesOf(room).speedScale : 1));
  const pitch = Math.max(-89 * DEG, Math.min(89 * DEG, m.pitch));
  if (verdict === 'ok') {
    ctx.db.player.id.update({ ...row, x: m.x, y: m.y, z: m.z, vx: m.vx, vy: m.vy, vz: m.vz, yaw: m.yaw, pitch,
      crouch: m.crouch, grounded: m.grounded, walk: m.walk, seq: m.seq, lastMoveAt: ctx.timestamp });
    historyFor(Number(row.id)).push(nowMs(ctx), m.x, m.y, m.z, m.yaw, m.crouch);
  } else {
    console.info(`move rejected: player ${row.id} ${verdict}`);
    ctx.db.player.id.update({ ...row, yaw: m.yaw, pitch, vx: 0, vy: 0, vz: 0, seq: m.seq,
      correctionSeq: row.correctionSeq + 1, violations: row.violations + 1, lastMoveAt: ctx.timestamp });
  }
});

/** One trigger pull. viewTimeMs = server time (ms) of the world the client was showing (lag compensation). */
/** scoped = the shooter is fully aimed (ADS); only changes accuracy (sniper), never shown to others. */
export const fire = spacetimedb.reducer({ seq: t.u32(), yaw: t.f32(), pitch: t.f32(), viewTimeMs: t.f64(), scoped: t.bool() }, (ctx, m) => {
  const row = myRow(ctx);
  if (!row || !row.alive) return;
  const r = ctx.db.room.id.find(row.roomId);
  if (!r || r.phase !== 'live') return;
  const a = actorOf(row);
  const slot = a.slots[a.active];
  // Fire rate with a little slack for network bunching; ammo; reload; draw time.
  if (a.equipLeft > 0 || slot.cooldown > FIRE_CHECK.cooldownSlack) return;
  if (slot.stats.magSize > 0 && slot.mag <= 0) return;
  if (slot.reloadLeft > 0 && !slot.stats.reloadPerShell) return;
  const maxRewind = r.isPrivate ? NET.maxRewindMsPrivate : NET.maxRewindMsPublic;
  const rewind = Math.max(0, Math.min(maxRewind, nowMs(ctx) - m.viewTimeMs));
  fireShot(ctx, r, row, a, m.yaw, Math.max(-89 * DEG, Math.min(89 * DEG, m.pitch)), rewind, m.scoped);
  const updated = ctx.db.player.id.find(row.id);
  if (updated) syncAmmo(ctx, updated, a);
});

/** Choose the primary weapon (rifle / shotgun / sniper). Applies now during the freeze phase, else next round. */
export const setPrimaryWeapon = spacetimedb.reducer({ weapon: t.string() }, (ctx, { weapon }) => {
  const row = myRow(ctx);
  if (!row) return;
  const want = weapon as WeaponId;
  if (!LOADOUT.primaries.includes(want)) throw new SenderError('not a primary weapon');
  const rr = ctx.db.room.id.find(row.roomId);
  if (rr && modeOf(rr) === 'cornucopia') throw new SenderError('Cornucopia: find weapons on the pedestals');
  if (want === 'sniper') {
    // Picked-up snipers do not count; a bot sniper gives its place to a human (takes a rifle).
    const mates = playersIn(ctx, row.roomId).filter((p) => p.id !== row.id && p.team === row.team && p.nextPrimary === 'sniper');
    if (mates.filter((p) => !p.isBot).length >= LOADOUT.maxSnipersPerTeam) throw new SenderError('your team already has a sniper');
    const phase = ctx.db.room.id.find(row.roomId)?.phase;
    for (const bot of mates.filter((p) => p.isBot)) {
      const swap = phase === 'freeze' && bot.primary === 'sniper';
      if (swap) { const ba = actorFor(Number(bot.id), bot.team as TeamId, true); setPrimary(ba, 'rifle'); ba.active = 0; }
      const ammo = fullAmmo('rifle');
      ctx.db.player.id.update({ ...bot, nextPrimary: 'rifle', ...(swap ? { primary: 'rifle', weapon: 0, mag: ammo.mag, reserve: ammo.reserve } : {}) });
    }
  }
  const r = ctx.db.room.id.find(row.roomId);
  if (r && r.phase === 'freeze' && row.alive) {
    const a = actorFor(Number(row.id), row.team as TeamId, false);
    setPrimary(a, want);
    resetSlot(a.slots[0]);
    if (a.active === 0) a.equipLeft = a.slots[0].stats.equipTime;
    const next = { ...row, primary: want, nextPrimary: want };
    ctx.db.player.id.update(next);
    syncAmmo(ctx, next, a);
  } else {
    ctx.db.player.id.update({ ...row, nextPrimary: want });
  }
});

/** E on an item: a weapon swaps the primary (the old one drops where the player stands). Live phase only. */
export const pickUp = spacetimedb.reducer({ itemId: t.u64() }, (ctx, { itemId }) => {
  const row = myRow(ctx);
  if (!row || !row.alive) return;
  const it = ctx.db.item.id.find(itemId);
  const r = ctx.db.room.id.find(row.roomId);
  if (!it || it.roomId !== row.roomId || !r || r.phase !== 'live') return;
  if (!inPickupRange(it, row.x, row.y, row.z, ITEMS.serverSlack)) return;
  pickUpItem(ctx, r, row, actorOf(row), it);
});

/** Last ping time per player id (module memory; rate limit). */
const lastPing = new Map<bigint, number>();

/** Team ping: a marker where the player looks (the client casts the ray). Rate-limited, range-checked. */
export const ping = spacetimedb.reducer({ x: t.f32(), y: t.f32(), z: t.f32() }, (ctx, { x, y, z }) => {
  const row = myRow(ctx);
  if (!row || !row.alive || ![x, y, z].every(Number.isFinite)) return;
  if (Math.hypot(x - row.x, y - row.y, z - row.z) > PINGS.maxDistance + PINGS.serverSlack) return;
  const now = nowMs(ctx), last = lastPing.get(row.id) ?? -Infinity;
  if (now - last < PINGS.cooldown * 1000) return;
  lastPing.set(row.id, now);
  // Only to the pinger's human teammates (free-for-all: every player is its own team, so only the pinger).
  for (const p of playersIn(ctx, row.roomId)) {
    if (p.isBot || p.team !== row.team || p.ownerHex === '') continue;
    ctx.db.pingEvent.insert({ recipient: Identity.fromString(p.ownerHex), roomId: row.roomId, playerId: row.id, team: row.team, x, y, z });
  }
});

/** The client's measured round-trip time, for the scoreboard. */
export const reportPing = spacetimedb.reducer({ ms: t.u16() }, (ctx, { ms }) => {
  const row = myRow(ctx);
  if (row && row.ping !== ms) ctx.db.player.id.update({ ...row, ping: ms });
});

export const reload = spacetimedb.reducer((ctx) => {
  const row = myRow(ctx);
  if (!row || !row.alive) return;
  const a = actorOf(row);
  startReload(a.slots[a.active]);
  syncAmmo(ctx, row, a);
});

export const switchWeapon = spacetimedb.reducer({ slot: t.u8() }, (ctx, { slot }) => {
  const row = myRow(ctx);
  if (!row || !row.alive) return;
  const a = actorOf(row);
  if (slot >= a.slots.length || slot === a.active || (slot === 0 && !a.hasPrimary)) return;
  cancelReload(a.slots[a.active]);
  a.active = slot;
  a.equipLeft = a.slots[slot].stats.equipTime;
  syncAmmo(ctx, row, a);
});

/** 30 Hz: rounds, weapon timers, pose history, bots of every room. */
export const tick = spacetimedb.reducer({ onSchedule: tickTimer }, { timer: tickTimer.rowType }, (ctx, { timer }) => {
  const rooms = [...ctx.db.room.iter()];
  if (rooms.length === 0) { ctx.db.tickTimer.scheduledId.delete(timer.scheduledId); return; }
  const world = getWorld();
  const tNow = nowMs(ctx);
  // A* budget per tick for the whole module (all rooms share the CPU).
  let pathBudget: number = BOTS.maxPathsPerTick;
  const random = () => ctx.random();
  for (const r0 of rooms) {
    const r = tickRoom(ctx, r0);
    const live = r.phase === 'live';
    const rows = playersIn(ctx, r.id);
    const actors = rows.map(actorOf);
    // Weapon timers and pose history for everyone.
    for (let i = 0; i < rows.length; i++) {
      const a = actors[i];
      tickSlot(a.slots[a.active], TICK_DT);
      if (a.equipLeft > 0) a.equipLeft = Math.max(0, a.equipLeft - TICK_DT);
      if (a.fireAnimLeft > 0) a.fireAnimLeft = Math.max(0, a.fireAnimLeft - TICK_DT);
      a.sinceDamage += TICK_DT;
      if (a.healLeft > 0 && rows[i].alive) {
        tickHeal(a, TICK_DT);
        rows[i] = { ...rows[i], hp: a.hp, healLeft: a.healLeft };
        ctx.db.player.id.update(rows[i]);
      }
      if (rows[i].alive) historyFor(Number(rows[i].id)).push(tNow, rows[i].x, rows[i].y, rows[i].z, rows[i].yaw, rows[i].crouch);
      if (!rows[i].isBot) syncAmmo(ctx, rows[i], a);
    }
    if (r.phase === 'freeze' || r.phase === 'matchEnd') continue;
    const terrain = terrainFor(modeOf(r) === 'cornucopia');
    const botWorld: BotWorld = { actors, blockers: world.blockers, nav: terrain.nav, goals: world.goals, cover: world.cover, routes: world.routes, perches: world.perches,
      items: undefined,
      spawns: { A: world.spawns.A[0], B: world.spawns.B[0] }, random, pathBudget };
    let roomItems: ItemRow[] = modeOf(r) === 'cornucopia' ? [...ctx.db.item.roomId.filter(r.id)] : [];
    if (modeOf(r) === 'cornucopia') botWorld.items = roomItems;
    for (let i = 0; i < rows.length; i++) {
      const row = ctx.db.player.id.find(rows[i].id);
      const a = actors[i];
      if (!row || !row.isBot || !row.alive) continue;
      a.alive = row.alive; a.hp = row.hp;
      const brain = brainFor(Number(row.id));
      brain.skill = BOT_SKILLS[(r.difficulty in BOT_SKILLS ? r.difficulty : DEFAULT_DIFFICULTY) as BotDifficulty];
      updateBot(a, brain, botWorld, TICK_DT);
      a.yaw = a.intent.yaw; a.pitch = a.intent.pitch;
      if (a.intent.use && live && roomItems.length) {
        const k = nearestItem(roomItems, row.x, row.y, row.z);
        const it = k >= 0 ? ctx.db.item.id.find(roomItems[k].id) : undefined;
        if (it) { pickUpItem(ctx, r, row, a, it); roomItems = [...ctx.db.item.roomId.filter(r.id)]; botWorld.items = roomItems; }
      }
      const sw = a.intent.slot;
      if (sw >= 0 && sw < a.slots.length && sw !== a.active && (sw !== 0 || a.hasPrimary)) {
        cancelReload(a.slots[a.active]);
        a.active = sw; a.equipLeft = a.slots[sw].stats.equipTime; a.fireLatch = false;
      }
      const slot = a.slots[a.active];
      if (a.intent.reload) startReload(slot);
      if (!a.intent.fire) a.fireLatch = false;
      if (live && a.intent.fire && a.equipLeft <= 0 && canFire(slot) && (slot.stats.automatic || !a.fireLatch)) {
        fireShot(ctx, r, { ...row, yaw: a.yaw, pitch: a.pitch }, a, a.yaw, a.pitch, 0, a.intent.aim);
        a.fireLatch = true;
      }
      const speed = rulesOf(r).speedScale;
      stepOnGrid(a, terrain.nav, TICK_DT, slot.stats.moveSpeedScale * speed, terrain.colliders);
      const verdict = terrain.movement.check(
        { x: row.x, y: row.y, z: row.z, crouch: false, walk: false },
        { x: a.x, y: a.y, z: a.z, crouch: false, walk: a.intent.walk }, TICK_DT, speed);
      if (verdict !== 'ok') { a.x = row.x; a.y = row.y; a.z = row.z; a.vx = 0; a.vz = 0; }
      const after = ctx.db.player.id.find(row.id) ?? row; // HP may have changed this tick
      ctx.db.player.id.update({ ...after, x: a.x, y: a.y, z: a.z, vx: a.vx, vy: 0, vz: a.vz, yaw: a.yaw, pitch: a.pitch,
        walk: a.intent.walk, grounded: true, seq: row.seq + 1, violations: row.violations + (verdict === 'ok' ? 0 : 1),
        mag: slot.mag, reserve: slot.reserve, reloading: slot.reloadLeft > 0, weapon: a.active, lastMoveAt: ctx.timestamp });
    }
    pathBudget = botWorld.pathBudget;
  }
});
