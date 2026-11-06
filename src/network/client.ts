// SpacetimeDB client for the game (browser and Node test clients).
// - rooms: quick play / private room / join by code
// - movement: send the local KCC result at NET.sendRateHz, snap on server corrections
// - remote players: snapshot buffers for interpolation
// - lagMs: artificial latency, half on sending and half on receiving
import { NET } from '../config/net.ts';
import { DbConnection, type SubscriptionHandle } from './bindings/index.ts';
import type { Infer } from 'spacetimedb';
import type PlayerRowDef from './bindings/player_table.ts';
import type RoomRowDef from './bindings/room_table.ts';
import type ShotEventDef from './bindings/shot_event_table.ts';
import type KillEventDef from './bindings/kill_event_table.ts';
import type ItemRowDef from './bindings/item_table.ts';
import type PingEventDef from './bindings/ping_event_table.ts';
import type WalletDef from './bindings/wallet_table.ts';
import type OwnedItemDef from './bindings/owned_item_table.ts';
import type ListingDef from './bindings/listing_table.ts';
import type TradeDef from './bindings/trade_table.ts';
import type EconomyDef from './bindings/economy_table.ts';
import type PlayerStatDef from './bindings/player_stat_table.ts';
import type SessionDef from './bindings/session_table.ts';
import type WeekStatDef from './bindings/week_stat_table.ts';
import type PlayerProgressDef from './bindings/player_progress_table.ts';
import type SeasonProgressDef from './bindings/season_progress_table.ts';
import type QuestProgressDef from './bindings/quest_progress_table.ts';
import type DayStreakDef from './bindings/day_streak_table.ts';
import type NftDef from './bindings/nft_table.ts';
import { weekOf } from '../gameplay/rewards.ts';
import { SEASON, type QuestKind } from '../config/season.ts';
import { questScope } from '../gameplay/progression.ts';

export type PlayerRow = Infer<typeof PlayerRowDef>;
export type RoomRow = Infer<typeof RoomRowDef>;
export type ShotEvent = Infer<typeof ShotEventDef>;
export type KillEvent = Infer<typeof KillEventDef>;
export type ItemRow = Infer<typeof ItemRowDef>;
export type PingEvent = Infer<typeof PingEventDef>;
export type WalletRow = Infer<typeof WalletDef>;
export type OwnedItemRow = Infer<typeof OwnedItemDef>;
export type ListingRow = Infer<typeof ListingDef>;
export type TradeRow = Infer<typeof TradeDef>;
export type EconomyRow = Infer<typeof EconomyDef>;
export type PlayerStatRow = Infer<typeof PlayerStatDef>;
export type SessionRow = Infer<typeof SessionDef>;
export type WeekStatRow = Infer<typeof WeekStatDef>;
export type NftRow = Infer<typeof NftDef>;
export type PlayerProgressRow = Infer<typeof PlayerProgressDef>;
export type SeasonProgressRow = Infer<typeof SeasonProgressDef>;
export type QuestProgressRow = Infer<typeof QuestProgressDef>;
export type DayStreakRow = Infer<typeof DayStreakDef>;

/** Marketplace rows (GAME.md 6.7, 6.8), kept current after GameNet.subscribeMarket. No artificial lag. */
export class MarketView {
  /** The account (lowercase 0x address) this connection is logged in as; '' = guest. */
  account = '';
  /** My wallet (null for a guest). */
  wallet: WalletRow | null = null;
  /** Every wallet by account (public: the leaderboard shows coins). */
  readonly wallets = new Map<string, WalletRow>();
  /** Owned items by id (only mine, or all for an auditor subscription). */
  readonly items = new Map<bigint, OwnedItemRow>();
  /** All-time stats by account (leaderboard). */
  readonly stats = new Map<string, PlayerStatRow>();
  /** The week subscribed (weekOf at subscribe time) and its stats by account (weekly STRIKE rewards). */
  week = 0;
  readonly weekStats = new Map<string, WeekStatRow>();
  /** Season skin NFTs by item ref (GAME.md 6.11). */
  readonly nfts = new Map<string, NftRow>();
  /** Total XP by account (player level, GAME.md 6.10). */
  readonly progress = new Map<string, PlayerProgressRow>();
  /** This season's track by account. */
  readonly seasonProgress = new Map<string, SeasonProgressRow>();
  /** Day streaks by account. */
  readonly streaks = new Map<string, DayStreakRow>();
  /** Current periods of the missions and their rows by id (`${scope}:${owner}`). */
  questScopes: Record<QuestKind, string> = { day: '', week: '', season: '' };
  readonly quests = new Map<string, QuestProgressRow>();
  /** My row of a mission period, if I have played in it. */
  myQuests(kind: QuestKind): QuestProgressRow | undefined { return this.quests.get(`${this.questScopes[kind]}:${this.account}`); }
  readonly listings = new Map<bigint, ListingRow>();
  readonly trades = new Map<bigint, TradeRow>();
  economy: EconomyRow | null = null;
  /** Bumped on every change (UI redraw check). */
  version = 0;
}

/** Samples kept for the server clock offset estimate (about 2 s of updates). */
const OFFSET_SAMPLES = 64;
/** Move seqs remembered for ping measurement. */
const PING_RING = 128;
/** Smoothing of the ping estimate (weight of a new sample). */
const PING_SMOOTHING = 0.2;
/** How often the measured ping is sent to the server (ms). */
const PING_REPORT_MS = 2000;

/** One received state of a player, stamped with the local receive time (ms). */
export interface Snapshot {
  t: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number;
  crouch: boolean; grounded: boolean; alive: boolean;
}

const BUFFER = 32;

export class SnapshotBuffer {
  readonly items: Snapshot[] = [];
  private head = 0;
  count = 0;

  constructor() {
    for (let i = 0; i < BUFFER; i++) {
      this.items.push({ t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: false, grounded: true, alive: true });
    }
  }

  push(t: number, row: PlayerRow): void {
    const s = this.items[this.head];
    s.t = t; s.x = row.x; s.y = row.y; s.z = row.z; s.vx = row.vx; s.vy = row.vy; s.vz = row.vz;
    s.yaw = row.yaw; s.pitch = row.pitch; s.crouch = row.crouch; s.grounded = row.grounded; s.alive = row.alive;
    this.head = (this.head + 1) % BUFFER;
    this.count = Math.min(BUFFER, this.count + 1);
  }

  /** i = 0 is the newest snapshot. */
  at(i: number): Snapshot { return this.items[(this.head - 1 - i + BUFFER * 2) % BUFFER]; }

  /**
   * Interpolated state at local time `t` written into `out`. Between two snapshots: linear (yaw along
   * the short arc); after the newest: hold it (no extrapolation in M2a).
   */
  sample(t: number, out: Snapshot): boolean {
    if (this.count === 0) return false;
    let newer = this.at(0);
    if (t >= newer.t || this.count === 1) { Object.assign(out, newer); return true; }
    for (let i = 1; i < this.count; i++) {
      const older = this.at(i);
      if (older.t <= t) {
        const k = (t - older.t) / Math.max(1e-6, newer.t - older.t);
        out.t = t;
        out.x = older.x + (newer.x - older.x) * k; out.y = older.y + (newer.y - older.y) * k; out.z = older.z + (newer.z - older.z) * k;
        out.vx = older.vx + (newer.vx - older.vx) * k; out.vy = older.vy + (newer.vy - older.vy) * k; out.vz = older.vz + (newer.vz - older.vz) * k;
        let dyaw = (newer.yaw - older.yaw) % (Math.PI * 2);
        if (dyaw > Math.PI) dyaw -= Math.PI * 2; if (dyaw < -Math.PI) dyaw += Math.PI * 2;
        out.yaw = older.yaw + dyaw * k; out.pitch = older.pitch + (newer.pitch - older.pitch) * k;
        out.crouch = k < 0.5 ? older.crouch : newer.crouch; out.grounded = newer.grounded; out.alive = newer.alive;
        return true;
      }
      newer = older;
    }
    Object.assign(out, this.at(this.count - 1));
    return true;
  }
}

export interface LocalMove {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  yaw: number; pitch: number; crouch: boolean; grounded: boolean; walk: boolean;
}

export interface NetOptions {
  uri?: string;
  databaseName?: string;
  /** Saved auth token (per browser tab), so a reload keeps the same identity. */
  token?: string;
  onToken?: (token: string) => void;
  /** Artificial round-trip latency in ms (half each way). */
  lagMs?: number;
  /** Local clock in ms (performance.now in the browser). */
  now?: () => number;
}

type Pending = { at: number; kind: 'upsert' | 'delete'; row: PlayerRow }
  | { at: number; kind: 'shot'; row: ShotEvent } | { at: number; kind: 'kill'; row: KillEvent }
  | { at: number; kind: 'item' | 'itemDelete'; row: ItemRow } | { at: number; kind: 'ping'; row: PingEvent };

export class GameNet {
  conn: DbConnection | null = null;
  identityHex = '';
  /** My player row as last received (after artificial lag). */
  me: PlayerRow | null = null;
  room: RoomRow | null = null;
  /** Rows of players in my room, by id (includes me). */
  readonly players = new Map<bigint, PlayerRow>();
  readonly buffers = new Map<bigint, SnapshotBuffer>();
  /** Items on the ground in my room, by id. */
  readonly items = new Map<bigint, ItemRow>();
  /** Called when the server moved me (spawn or snap-back). */
  onCorrection: ((row: PlayerRow) => void) | null = null;
  onPlayerRemoved: ((id: bigint) => void) | null = null;
  /** Server events of my room (after artificial lag). */
  onShot: ((e: ShotEvent) => void) | null = null;
  onKill: ((e: KillEvent) => void) | null = null;
  /** Team pings of my room (all teams; the app shows only its own team's). */
  onPing: ((e: PingEvent) => void) | null = null;
  /** Called when I (re)spawn: take position AND view direction from the row. */
  onSpawn: ((row: PlayerRow) => void) | null = null;
  lastError = '';
  /** True between onConnect and a disconnect; reducer calls are refused while false. */
  connected = false;
  /** Rejecters of reducer calls still waiting for the server (failed at once when the connection drops). */
  private inflight = new Set<(e: Error) => void>();
  /** Corrections seen (spawns included). */
  corrections = 0;
  private opts: NetOptions;
  private now: () => number;
  private pending: Pending[] = [];
  private seq = 0;
  private ackCorrection = 0;
  private sendAccumulator = 0;
  private allRooms = new Map<bigint, RoomRow>();
  /** Every player row we know (callbacks arrive in any order; the room view is rebuilt from this). */
  private allPlayers = new Map<bigint, PlayerRow>();
  /** (server pose time - local receive time) samples; their max approximates server clock - one-way delay. */
  private offsets: number[] = [];
  private offsetIndex = 0;
  private lastSpawnCount = 0;
  private fireSeq = 0;
  private roomSub: { id: bigint; handle: SubscriptionHandle } | null = null;
  /** Local send time per move seq (ring), to measure the round trip when the server acknowledges it. */
  private sentAt = new Float64Array(PING_RING);
  private lastPingReport = 0;
  /** Smoothed round-trip time (ms), measured from move acknowledgements. */
  pingMs = 0;
  /** Marketplace view; empty until subscribeMarket. */
  readonly market = new MarketView();
  /** Called after any marketplace change. */
  onMarketChange: (() => void) | null = null;
  private marketSub: SubscriptionHandle | null = null;
  /** My items (follows the logged-in account). */
  private itemsSub: SubscriptionHandle | null = null;
  private questSub: SubscriptionHandle | null = null;
  private marketAll = false;

  constructor(opts: NetOptions = {}) {
    this.opts = opts;
    this.now = opts.now ?? (() => performance.now());
  }

  get lagMs(): number { return this.opts.lagMs ?? 0; }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = DbConnection.builder()
        .withUri(this.opts.uri ?? NET.serverUri)
        .withDatabaseName(this.opts.databaseName ?? NET.databaseName)
        .withToken(this.opts.token)
        .onConnect((c, identity, token) => {
          this.identityHex = identity.toHexString();
          this.connected = true;
          this.opts.onToken?.(token);
          this.attach(c);
          // Only my own row until I am in a room; then the rows and events of that room (subscribeRoom).
          c.subscriptionBuilder().onApplied(() => resolve()).onError((_ctx) => reject(new Error('subscription failed')))
            .subscribe(`SELECT * FROM player WHERE owner_hex = '${this.identityHex}'`);
        })
        .onConnectError((_ctx, err) => reject(err))
        .onDisconnect((_ctx, err) => { this.lastError = err ? String(err) : 'disconnected'; this.dropped(); })
        .build();
      this.conn = conn;
    });
  }

  private queue(p: Pending): void { this.pending.push(p); }

  private attach(c: DbConnection): void {
    const delay = () => this.now() + this.lagMs / 2;
    c.db.player.onInsert((_ctx, row) => this.queue({ at: delay(), kind: 'upsert', row }));
    c.db.player.onUpdate((_ctx, _old, row) => this.queue({ at: delay(), kind: 'upsert', row }));
    c.db.player.onDelete((_ctx, row) => this.queue({ at: delay(), kind: 'delete', row }));
    c.db.shotEvent.onInsert((_ctx, row) => this.queue({ at: delay(), kind: 'shot', row }));
    c.db.killEvent.onInsert((_ctx, row) => this.queue({ at: delay(), kind: 'kill', row }));
    c.db.pingEvent.onInsert((_ctx, row) => this.queue({ at: delay(), kind: 'ping', row }));
    c.db.item.onInsert((_ctx, row) => this.queue({ at: delay(), kind: 'item', row }));
    c.db.item.onUpdate((_ctx, _old, row) => this.queue({ at: delay(), kind: 'item', row }));
    c.db.item.onDelete((_ctx, row) => this.queue({ at: delay(), kind: 'itemDelete', row }));
    c.db.room.onInsert((_ctx, row) => { this.allRooms.set(row.id, row); });
    c.db.room.onUpdate((_ctx, _old, row) => { this.allRooms.set(row.id, row); });
    c.db.room.onDelete((_ctx, row) => { this.allRooms.delete(row.id); });
    const m = this.market, changed = () => { m.version++; this.onMarketChange?.(); };
    const setWallet = (row: WalletRow) => {
      m.wallets.set(row.owner, row);
      if (row.owner === m.account) m.wallet = row;
      changed();
    };
    c.db.wallet.onInsert((_ctx, row) => setWallet(row));
    c.db.wallet.onUpdate((_ctx, _old, row) => setWallet(row));
    c.db.wallet.onDelete((_ctx, row) => {
      m.wallets.delete(row.owner);
      if (row.owner === m.account) m.wallet = null;
      changed();
    });
    // My login session (row-level security: only my own row arrives).
    c.db.session.onInsert((_ctx, row) => this.setAccount(row.address));
    c.db.session.onUpdate((_ctx, _old, row) => this.setAccount(row.address));
    c.db.session.onDelete(() => this.setAccount(''));
    c.db.playerStat.onInsert((_ctx, row) => { m.stats.set(row.owner, row); changed(); });
    c.db.playerStat.onUpdate((_ctx, _old, row) => { m.stats.set(row.owner, row); changed(); });
    c.db.playerStat.onDelete((_ctx, row) => { m.stats.delete(row.owner); changed(); });
    const setWeek = (row: WeekStatRow) => { if (row.week === m.week) { m.weekStats.set(row.owner, row); changed(); } };
    c.db.weekStat.onInsert((_ctx, row) => setWeek(row));
    c.db.weekStat.onUpdate((_ctx, _old, row) => setWeek(row));
    c.db.weekStat.onDelete((_ctx, row) => { if (m.weekStats.get(row.owner)?.id === row.id) { m.weekStats.delete(row.owner); changed(); } });
    c.db.playerProgress.onInsert((_ctx, row) => { m.progress.set(row.owner, row); changed(); });
    c.db.playerProgress.onUpdate((_ctx, _old, row) => { m.progress.set(row.owner, row); changed(); });
    c.db.playerProgress.onDelete((_ctx, row) => { m.progress.delete(row.owner); changed(); });
    c.db.seasonProgress.onInsert((_ctx, row) => { m.seasonProgress.set(row.owner, row); changed(); });
    c.db.seasonProgress.onUpdate((_ctx, _old, row) => { m.seasonProgress.set(row.owner, row); changed(); });
    c.db.seasonProgress.onDelete((_ctx, row) => { m.seasonProgress.delete(row.owner); changed(); });
    c.db.dayStreak.onInsert((_ctx, row) => { m.streaks.set(row.owner, row); changed(); });
    c.db.dayStreak.onUpdate((_ctx, _old, row) => { m.streaks.set(row.owner, row); changed(); });
    c.db.dayStreak.onDelete((_ctx, row) => { m.streaks.delete(row.owner); changed(); });
    c.db.questProgress.onInsert((_ctx, row) => { m.quests.set(row.id, row); changed(); });
    c.db.questProgress.onUpdate((_ctx, _old, row) => { m.quests.set(row.id, row); changed(); });
    c.db.questProgress.onDelete((_ctx, row) => { m.quests.delete(row.id); changed(); });
    c.db.ownedItem.onInsert((_ctx, row) => { m.items.set(row.id, row); changed(); });
    c.db.ownedItem.onUpdate((_ctx, _old, row) => { m.items.set(row.id, row); changed(); });
    c.db.ownedItem.onDelete((_ctx, row) => { m.items.delete(row.id); changed(); });
    c.db.listing.onInsert((_ctx, row) => { m.listings.set(row.id, row); changed(); });
    c.db.listing.onUpdate((_ctx, _old, row) => { m.listings.set(row.id, row); changed(); });
    c.db.listing.onDelete((_ctx, row) => { m.listings.delete(row.id); changed(); });
    c.db.trade.onInsert((_ctx, row) => { m.trades.set(row.id, row); changed(); });
    c.db.trade.onDelete((_ctx, row) => { m.trades.delete(row.id); changed(); });
    c.db.nft.onInsert((_ctx, row) => { m.nfts.set(row.ref, row); changed(); });
    c.db.nft.onUpdate((_ctx, _old, row) => { m.nfts.set(row.ref, row); changed(); });
    c.db.nft.onDelete((_ctx, row) => { m.nfts.delete(row.ref); changed(); });
    c.db.economy.onInsert((_ctx, row) => { m.economy = row; changed(); });
    c.db.economy.onUpdate((_ctx, _old, row) => { m.economy = row; changed(); });
  }

  /** Logged in as another account (or logged out): follow my wallet and items. */
  private setAccount(address: string): void {
    const m = this.market;
    if (m.account === address) return;
    m.account = address;
    m.wallet = address ? m.wallets.get(address) ?? null : null;
    if (!this.marketAll) {
      if (this.itemsSub?.isActive()) this.itemsSub.unsubscribe();
      this.itemsSub = null;
      m.items.clear();
      if (address && this.conn && /^0x[0-9a-f]{40}$/.test(address)) {
        this.itemsSub = this.conn.subscriptionBuilder().subscribe(`SELECT * FROM owned_item WHERE owner = '${address}'`);
      }
    }
    m.version++;
    this.onMarketChange?.();
  }

  /**
   * Subscribe to the marketplace: my session, wallets, my items (once logged in), every listing, recent trades,
   * stats and the economy row. `all` (tests / audits): every owned item too.
   */
  subscribeMarket(all = false): Promise<void> {
    if (!this.conn) return Promise.reject(new Error('not connected'));
    if (this.marketSub) return Promise.resolve();
    this.marketAll = all;
    const queries = ['SELECT * FROM session', 'SELECT * FROM wallet', 'SELECT * FROM listing', 'SELECT * FROM trade', 'SELECT * FROM nft',
      'SELECT * FROM economy', 'SELECT * FROM player_stat'];
    this.market.week = weekOf(Date.now());
    queries.push(`SELECT * FROM week_stat WHERE week = ${this.market.week}`, 'SELECT * FROM player_progress', 'SELECT * FROM day_streak',
      `SELECT * FROM season_progress WHERE season = ${SEASON.id}`);
    this.syncQuests();
    if (all) queries.push('SELECT * FROM owned_item');
    return new Promise((resolve, reject) => {
      this.marketSub = this.conn!.subscriptionBuilder()
        .onApplied(() => resolve())
        .onError(() => { this.marketSub = null; reject(new Error('market subscription failed')); })
        .subscribe(queries);
    });
  }

  /** Follow the current mission periods: (re)subscribes when a day or week has turned. Cheap to call often. */
  syncQuests(): void {
    if (!this.conn) return;
    const m = this.market, now = Date.now();
    const scopes: Record<QuestKind, string> = { day: questScope('day', now), week: questScope('week', now), season: questScope('season', now) };
    if (this.questSub && scopes.day === m.questScopes.day && scopes.week === m.questScopes.week) return;
    if (this.questSub?.isActive()) this.questSub.unsubscribe();
    m.questScopes = scopes;
    m.quests.clear();
    this.questSub = this.conn.subscriptionBuilder().onApplied(() => { m.version++; this.onMarketChange?.(); })
      .subscribe(Object.values(scopes).map((s) => `SELECT * FROM quest_progress WHERE scope = '${s}'`));
  }

  /** Wallet login (GAME.md 6.8): a personal_sign signature of loginMessage(address, identityHex, issuedAtMs). */
  login(address: string, issuedAtMs: number, signature: string): Promise<void> {
    return this.call(() => this.conn!.reducers.login({ address, issuedAtMs, signature }));
  }
  logout(): Promise<void> { return this.call(() => this.conn!.reducers.logout({})); }
  /** Take every season reward reached and not yet claimed (GAME.md 6.10). */
  claimSeasonRewards(): Promise<void> { return this.call(() => this.conn!.reducers.claimSeasonRewards({})); }
  /** Ask for one of my NFTs to be sent to my wallet (GAME.md 6.11). */
  requestNftSend(itemId: bigint): Promise<void> { return this.call(() => this.conn!.reducers.requestNftSend({ itemId })); }

  /** Put one of my items on the market (integer coins, MARKET.price). Rejects with the server's reason. */
  listItem(itemId: bigint, price: number): Promise<void> { return this.call(() => this.conn!.reducers.listItem({ itemId, price })); }
  cancelListing(listingId: bigint): Promise<void> { return this.call(() => this.conn!.reducers.cancelListing({ listingId })); }
  /** Buy a listing at the price I saw (the server refuses if it changed). */
  buyListing(listingId: bigint, expectedPrice: number): Promise<void> {
    return this.call(() => this.conn!.reducers.buyListing({ listingId, expectedPrice }));
  }

  /** Apply received updates whose (artificial) delay has passed. Call every frame. */
  update(): void {
    const now = this.now();
    let n = 0;
    for (const p of this.pending) {
      if (p.at > now) break;
      n++;
      if (p.kind === 'upsert') this.applyRow(p.row, now);
      else if (p.kind === 'delete') this.removeRow(p.row);
      else if (p.kind === 'shot') { if (this.me && p.row.roomId === this.me.roomId) this.onShot?.(p.row); }
      else if (p.kind === 'kill') { if (this.me && p.row.roomId === this.me.roomId) this.onKill?.(p.row); }
      else if (p.kind === 'item') { if (this.me && p.row.roomId === this.me.roomId) this.items.set(p.row.id, p.row); }
      else if (p.kind === 'itemDelete') this.items.delete(p.row.id);
      else if (p.kind === 'ping') { if (this.me && p.row.roomId === this.me.roomId) this.onPing?.(p.row); }
    }
    if (n > 0) this.pending.splice(0, n);
    this.room = this.me ? this.allRooms.get(this.me.roomId) ?? null : null;
  }

  private applyRow(row: PlayerRow, now: number): void {
    this.allPlayers.set(row.id, row);
    const sample = Number(row.lastMoveAt.microsSinceUnixEpoch) / 1000 - now;
    if (this.offsets.length < OFFSET_SAMPLES) this.offsets.push(sample);
    else { this.offsets[this.offsetIndex] = sample; this.offsetIndex = (this.offsetIndex + 1) % OFFSET_SAMPLES; }
    if (row.ownerHex === this.identityHex && !row.isBot) {
      const roomChanged = !this.me || this.me.roomId !== row.roomId;
      // A new player row (joined / rejoined a room) starts its own correction and spawn counters.
      if (!this.me || this.me.id !== row.id) { this.ackCorrection = 0; this.lastSpawnCount = 0; this.corrections = 0; }
      else if (row.seq > this.me.seq) this.measurePing(row.seq, now);
      this.me = row;
      if (roomChanged) this.subscribeRoom(row.roomId);
      if (roomChanged) {
        this.players.clear(); this.buffers.clear(); this.items.clear();
        for (const r of this.allPlayers.values()) if (r.roomId === row.roomId) this.track(r, now);
      }
      if (row.correctionSeq > this.ackCorrection) {
        this.ackCorrection = row.correctionSeq;
        if (row.spawnCount !== this.lastSpawnCount) { this.lastSpawnCount = row.spawnCount; this.onSpawn?.(row); }
        else { this.corrections++; this.onCorrection?.(row); }
      }
      if (roomChanged) return;
    }
    if (this.me && row.roomId === this.me.roomId) this.track(row, now);
    else if (this.players.delete(row.id)) { this.buffers.delete(row.id); this.onPlayerRemoved?.(row.id); }
  }

  private measurePing(seq: number, now: number): void {
    const sent = this.sentAt[seq % PING_RING];
    if (sent <= 0 || now < sent) return;
    const rtt = now - sent;
    this.pingMs = this.pingMs === 0 ? rtt : this.pingMs + (rtt - this.pingMs) * PING_SMOOTHING;
    if (now - this.lastPingReport >= PING_REPORT_MS && this.conn) {
      this.lastPingReport = now;
      const ms = Math.min(65535, Math.round(this.pingMs));
      void this.call(() => this.conn!.reducers.reportPing({ ms })).catch(() => undefined);
    }
  }

  /** Subscribe to one room's rows and events; drop the previous room's subscription once the new one is live. */
  private subscribeRoom(roomId: bigint): void {
    if (!this.conn || this.roomSub?.id === roomId) return;
    const old = this.roomSub;
    const handle = this.conn.subscriptionBuilder()
      .onApplied(() => { if (old && old.handle.isActive()) old.handle.unsubscribe(); })
      .subscribe([
        `SELECT * FROM player WHERE room_id = ${roomId}`,
        `SELECT * FROM room WHERE id = ${roomId}`,
        `SELECT * FROM shot_event WHERE room_id = ${roomId}`,
        `SELECT * FROM kill_event WHERE room_id = ${roomId}`,
        `SELECT * FROM item WHERE room_id = ${roomId}`,
        `SELECT * FROM ping_event WHERE room_id = ${roomId}`,
      ]);
    this.roomSub = { id: roomId, handle };
  }

  /** Room ids of all player rows this client has received (tests: only my room). */
  knownRoomIds(): bigint[] { return [...new Set([...this.allPlayers.values()].map((r) => r.roomId))]; }

  private track(row: PlayerRow, now: number): void {
    this.players.set(row.id, row);
    let buf = this.buffers.get(row.id);
    if (!buf) { buf = new SnapshotBuffer(); this.buffers.set(row.id, buf); }
    buf.push(now, row);
  }

  private removeRow(row: PlayerRow): void {
    this.allPlayers.delete(row.id);
    if (this.me && row.id === this.me.id) { this.me = null; this.players.clear(); this.buffers.clear(); return; }
    if (this.players.delete(row.id)) { this.buffers.delete(row.id); this.onPlayerRemoved?.(row.id); }
  }

  /** Connection closed: refuse new calls and fail the ones still waiting (their answer will never come). */
  private dropped(): void {
    this.connected = false;
    const waiting = [...this.inflight];
    this.inflight.clear();
    for (const fail of waiting) fail(new Error('connection lost'));
  }

  private call(fn: () => Promise<void>): Promise<void> {
    // A call on a closed connection would never settle: refuse it at once.
    if (!this.connected) return Promise.reject(new Error('not connected'));
    const run = () => new Promise<void>((resolve, reject) => {
      if (!this.connected) { reject(new Error('not connected')); return; } // dropped during the artificial lag
      const fail = (e: Error) => { this.inflight.delete(fail); reject(e); };
      this.inflight.add(fail);
      let sent: Promise<void>;
      try { sent = fn(); } catch (e) { fail(e instanceof Error ? e : new Error(String(e))); return; }
      sent.then(() => { if (this.inflight.delete(fail)) resolve(); }, (e: unknown) => {
        this.lastError = e instanceof Error ? e.message : String(e);
        if (this.inflight.delete(fail)) reject(e);
      });
    });
    if (this.lagMs <= 0) return run();
    return new Promise((resolve, reject) => setTimeout(() => run().then(resolve, reject), this.lagMs / 2));
  }

  joinQuick(name: string, character: number): Promise<void> { return this.call(() => this.conn!.reducers.joinQuick({ name, character })); }
  createPrivateRoom(name: string, character: number, bots = true, difficulty = 'normal', mode = 'elimination', teams = true, mutator = ''): Promise<void> {
    return this.call(() => this.conn!.reducers.createPrivateRoom({ name, character, bots, difficulty, mode, teams, mutator }));
  }
  joinByCode(code: string, name: string, character: number): Promise<void> { return this.call(() => this.conn!.reducers.joinByCode({ code, name, character })); }
  /** Leave the room (the server gives the slot back to a bot) and forget its rows; the connection stays. */
  async leave(): Promise<void> {
    await this.call(() => this.conn!.reducers.leaveRoom({})).catch(() => undefined);
    if (this.roomSub && this.roomSub.handle.isActive()) this.roomSub.handle.unsubscribe();
    this.roomSub = null;
    this.me = null; this.room = null;
    this.players.clear(); this.buffers.clear(); this.allPlayers.clear(); this.items.clear(); this.pending.length = 0;
    this.onCorrection = null; this.onSpawn = null; this.onShot = null; this.onKill = null; this.onPing = null; this.onPlayerRemoved = null;
  }

  /** Send the local movement at NET.sendRateHz. Call every frame with the frame time. */
  tickSend(dt: number, m: LocalMove): void {
    if (!this.me || !this.conn) return;
    this.sendAccumulator += dt;
    const interval = 1 / NET.sendRateHz;
    if (this.sendAccumulator < interval) return;
    this.sendAccumulator %= interval;
    this.sendMove(m);
  }

  sendMove(m: LocalMove): void {
    if (!this.conn) return;
    const msg = { seq: ++this.seq, ack: this.ackCorrection, ...m };
    this.sentAt[msg.seq % PING_RING] = this.now();
    void this.call(() => this.conn!.reducers.move(msg)).catch(() => undefined);
  }

  /** Server time (ms) that corresponds to a local time on the receive clock (e.g. the interpolated render time). */
  serverTimeAt(localMs: number): number {
    let best = -Infinity;
    for (const o of this.offsets) if (o > best) best = o;
    return localMs + (best === -Infinity ? 0 : best);
  }

  /** One trigger pull at (yaw, pitch); viewTimeMs = server time of what the player was seeing. */
  fire(yaw: number, pitch: number, viewTimeMs: number, scoped = false): void {
    if (!this.conn) return;
    const msg = { seq: ++this.fireSeq, yaw, pitch, viewTimeMs, scoped };
    void this.call(() => this.conn!.reducers.fire(msg)).catch(() => undefined);
  }

  /** Choose the primary (rifle / shotgun / sniper); rejects if the team already has a sniper. */
  setPrimary(weapon: string): Promise<void> { return this.call(() => this.conn!.reducers.setPrimaryWeapon({ weapon })); }

  /** Team ping at a world point (the server rate-limits it). */
  ping(x: number, y: number, z: number): void { if (this.conn) void this.call(() => this.conn!.reducers.ping({ x, y, z })).catch(() => undefined); }

  /** E on an item on the ground (the server checks range and phase). */
  /** Use / pick up an item; resolves true if the server accepted it (the client then plays the loot sound). */
  pickUp(itemId: bigint): Promise<boolean> {
    if (!this.conn) return Promise.resolve(false);
    return this.call(() => this.conn!.reducers.pickUp({ itemId })).then(() => true, () => false);
  }

  reload(): void { if (this.conn) void this.call(() => this.conn!.reducers.reload({})).catch(() => undefined); }

  switchWeapon(slot: number): void { if (this.conn) void this.call(() => this.conn!.reducers.switchWeapon({ slot })).catch(() => undefined); }

  disconnect(): void { this.dropped(); this.conn?.disconnect(); }
}
