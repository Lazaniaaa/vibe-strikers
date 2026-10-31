// SpacetimeDB client for the game (browser and Node test clients).
// - rooms: quick play / private room / join by code
// - movement: send the local KCC result at NET.sendRateHz, snap on server corrections
// - remote players: snapshot buffers for interpolation
// - lagMs: artificial latency, half on sending and half on receiving
import { NET } from '../config/net.ts';
import { DbConnection } from './bindings/index.ts';
import type { Infer } from 'spacetimedb';
import type PlayerRowDef from './bindings/player_table.ts';
import type RoomRowDef from './bindings/room_table.ts';

export type PlayerRow = Infer<typeof PlayerRowDef>;
export type RoomRow = Infer<typeof RoomRowDef>;

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

type Pending = { at: number; kind: 'upsert' | 'delete'; row: PlayerRow } | { at: number; kind: 'room'; row: RoomRow | null };

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
          c.subscriptionBuilder().onApplied(() => resolve()).onError((_ctx) => reject(new Error('subscription failed')))
            .subscribe(['SELECT * FROM player', 'SELECT * FROM room']);
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
    }
    if (n > 0) this.pending.splice(0, n);
    this.room = this.me ? this.allRooms.get(this.me.roomId) ?? null : null;
  }

  private applyRow(row: PlayerRow, now: number): void {
    this.allPlayers.set(row.id, row);
    if (row.ownerHex === this.identityHex && !row.isBot) {
      const roomChanged = !this.me || this.me.roomId !== row.roomId;
      this.me = row;
      if (roomChanged) {
        this.players.clear(); this.buffers.clear();
        for (const r of this.allPlayers.values()) if (r.roomId === row.roomId) this.track(r, now);
      }
      if (row.correctionSeq > this.ackCorrection) {
        this.ackCorrection = row.correctionSeq;
        this.corrections++;
        this.onCorrection?.(row);
      }
      if (roomChanged) return;
    }
    if (this.me && row.roomId === this.me.roomId) this.track(row, now);
    else if (this.players.delete(row.id)) { this.buffers.delete(row.id); this.onPlayerRemoved?.(row.id); }
  }

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
  createPrivateRoom(name: string, character: number): Promise<void> { return this.call(() => this.conn!.reducers.createPrivateRoom({ name, character })); }
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
    void this.call(() => this.conn!.reducers.move(msg)).catch(() => undefined);
  }

  disconnect(): void { this.conn?.disconnect(); }
}
