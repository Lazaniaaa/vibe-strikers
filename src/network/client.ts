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

export type PlayerRow = Infer<typeof PlayerRowDef>;
export type RoomRow = Infer<typeof RoomRowDef>;
export type ShotEvent = Infer<typeof ShotEventDef>;
export type KillEvent = Infer<typeof KillEventDef>;

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
  | { at: number; kind: 'shot'; row: ShotEvent } | { at: number; kind: 'kill'; row: KillEvent };

export class GameNet {
  conn: DbConnection | null = null;
  identityHex = '';
  /** My player row as last received (after artificial lag). */
  me: PlayerRow | null = null;
  room: RoomRow | null = null;
  /** Rows of players in my room, by id (includes me). */
  readonly players = new Map<bigint, PlayerRow>();
  readonly buffers = new Map<bigint, SnapshotBuffer>();
  /** Called when the server moved me (spawn or snap-back). */
  onCorrection: ((row: PlayerRow) => void) | null = null;
  onPlayerRemoved: ((id: bigint) => void) | null = null;
  /** Server events of my room (after artificial lag). */
  onShot: ((e: ShotEvent) => void) | null = null;
  onKill: ((e: KillEvent) => void) | null = null;
  /** Called when I (re)spawn: take position AND view direction from the row. */
  onSpawn: ((row: PlayerRow) => void) | null = null;
  lastError = '';
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
          this.opts.onToken?.(token);
          this.attach(c);
          // Only my own row until I am in a room; then the rows and events of that room (subscribeRoom).
          c.subscriptionBuilder().onApplied(() => resolve()).onError((_ctx) => reject(new Error('subscription failed')))
            .subscribe(`SELECT * FROM player WHERE owner_hex = '${this.identityHex}'`);
        })
        .onConnectError((_ctx, err) => reject(err))
        .onDisconnect((_ctx, err) => { this.lastError = err ? String(err) : 'disconnected'; })
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
    c.db.room.onInsert((_ctx, row) => { this.allRooms.set(row.id, row); });
    c.db.room.onUpdate((_ctx, _old, row) => { this.allRooms.set(row.id, row); });
    c.db.room.onDelete((_ctx, row) => { this.allRooms.delete(row.id); });
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
      if (this.me && row.seq > this.me.seq) this.measurePing(row.seq, now);
      this.me = row;
      if (roomChanged) this.subscribeRoom(row.roomId);
      if (roomChanged) {
        this.players.clear(); this.buffers.clear();
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

  private call(fn: () => Promise<void>): Promise<void> {
    const run = () => fn().catch((e: unknown) => { this.lastError = e instanceof Error ? e.message : String(e); throw e; });
    if (this.lagMs <= 0) return run();
    return new Promise((resolve, reject) => setTimeout(() => run().then(resolve, reject), this.lagMs / 2));
  }

  joinQuick(name: string, character: number): Promise<void> { return this.call(() => this.conn!.reducers.joinQuick({ name, character })); }
  createPrivateRoom(name: string, character: number, bots = true): Promise<void> {
    return this.call(() => this.conn!.reducers.createPrivateRoom({ name, character, bots }));
  }
  joinByCode(code: string, name: string, character: number): Promise<void> { return this.call(() => this.conn!.reducers.joinByCode({ code, name, character })); }
  leave(): Promise<void> { return this.call(() => this.conn!.reducers.leaveRoom({})); }

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
  fire(yaw: number, pitch: number, viewTimeMs: number): void {
    if (!this.conn) return;
    const msg = { seq: ++this.fireSeq, yaw, pitch, viewTimeMs };
    void this.call(() => this.conn!.reducers.fire(msg)).catch(() => undefined);
  }

  reload(): void { if (this.conn) void this.call(() => this.conn!.reducers.reload({})).catch(() => undefined); }

  switchWeapon(slot: number): void { if (this.conn) void this.call(() => this.conn!.reducers.switchWeapon({ slot })).catch(() => undefined); }

  disconnect(): void { this.conn?.disconnect(); }
}
