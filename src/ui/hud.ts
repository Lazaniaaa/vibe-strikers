import { TEAM_COLORS } from '../config/game.ts';
// Plain-DOM HUD. The game loop writes into it directly (no React state in the frame loop).
// Text updates are throttled by the caller; only changed values touch the DOM.

export interface KillFeedEntry { killer: string; killerAlly: boolean; victim: string; victimAlly: boolean; weapon: string; headshot: boolean }

export interface HudView {
  hp: number;
  alive: boolean;
  weapon: string;
  mag: number;
  reserve: number;
  reloading: boolean;
  /** Melee weapon: no ammo counter. */
  melee?: boolean;
  phase: 'freeze' | 'live' | 'roundEnd' | 'matchEnd';
  timeLeft: number;
  round: number;
  scoreA: number;
  scoreB: number;
  aliveA: number;
  aliveB: number;
  center: string;
  sub: string;
  /** Last kills, newest last. Names are coloured ally / enemy as seen by the local player. */
  feed: readonly KillFeedEntry[];
  /** Room / status line (top right, above the kill feed). */
  roomInfo: string;
  /** Replaces the team score line (Cornucopia / free-for-all). */
  scoreLine?: string;
  /** Recent team pings ("Name pinged · 12 m"), newest last. */
  pings?: string;
  /** Pick-up hint near an item on the ground ('' = none). */
  hint?: string;
  fps: number;
  perf: string;
  locked: boolean;
}

function el(tag: string, cls: string, parent: HTMLElement, text = ''): HTMLElement {
  const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; parent.appendChild(e); return e;
}

export class Hud {
  private root: HTMLElement;
  private hp: HTMLElement; private ammo: HTMLElement; private weapon: HTMLElement;
  private timer: HTMLElement; private score: HTMLElement; private center: HTMLElement; private sub: HTMLElement;
  private feed: HTMLElement; private perf: HTMLElement; private crosshair: HTMLElement; private hit: HTMLElement;
  private damage: HTMLElement;
  /** The "click to play" overlay (shown while the mouse is not captured); extra buttons can be added to it. */
  readonly overlay: HTMLElement;
  private last = new Map<HTMLElement, string>();
  private room: HTMLElement;
  private hint: HTMLElement;
  private pings: HTMLElement;
  private lastFeed = '';
  private lastGap = -1;
  private hitLeft = 0;
  private damageLeft = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    root.classList.add('hud');
    this.damage = el('div', 'hud-damage', root);
    this.crosshair = el('div', 'hud-crosshair', root);
    for (const side of ['t', 'b', 'l', 'r']) el('i', `hud-ch hud-ch-${side}`, this.crosshair);
    this.hit = el('div', 'hud-hit', root, '✕');
    const top = el('div', 'hud-top', root);
    this.score = el('div', 'hud-score', top);
    this.timer = el('div', 'hud-timer', top);
    this.center = el('div', 'hud-center', root);
    this.sub = el('div', 'hud-sub', root);
    this.room = el('div', 'hud-room', root);
    this.hint = el('div', 'hud-hint', root);
    this.pings = el('div', 'hud-pings', root);
    this.feed = el('div', 'hud-feed', root);
    root.style.setProperty('--ally', TEAM_COLORS.ally);
    root.style.setProperty('--enemy', TEAM_COLORS.enemy);
    const bottom = el('div', 'hud-bottom', root);
    this.hp = el('div', 'hud-hp', bottom);
    const right = el('div', 'hud-right', bottom);
    this.weapon = el('div', 'hud-weapon', right);
    this.ammo = el('div', 'hud-ammo', right);
    this.perf = el('div', 'hud-perf', root);
    this.overlay = el('div', 'hud-overlay', root);
    el('div', 'hud-overlay-title', this.overlay, 'Click to play');
    el('div', 'hud-overlay-keys', this.overlay,
      'WASD move · Mouse aim · LMB fire · R reload · 1 primary · 2 pistol · 3 knife · 7/8/9 rifle/shotgun/sniper · RMB aim · E pick up · V second person · Z / middle mouse ping · Tab scores · Space jump · C / Ctrl crouch · Shift walk · Esc release mouse');
  }

  private set(e: HTMLElement, text: string): void {
    if (this.last.get(e) === text) return;
    this.last.set(e, text); e.textContent = text;
  }

  /** Throttled text update (call ~10 times per second). */
  update(v: HudView): void {
    this.set(this.hp, v.alive ? `HP ${Math.max(0, Math.ceil(v.hp))}` : 'DEAD');
    this.set(this.weapon, v.reloading ? `${v.weapon} · reloading` : v.weapon);
    this.set(this.ammo, v.melee ? '—' : `${v.mag} / ${v.reserve}`);
    const t = Math.max(0, Math.ceil(v.timeLeft));
    this.set(this.timer, v.phase === 'matchEnd' ? '--:--' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    this.set(this.score, v.scoreLine || `A ${v.scoreA} · round ${v.round} · ${v.scoreB} B    alive ${v.aliveA} v ${v.aliveB}`);
    this.set(this.center, v.center);
    this.set(this.sub, v.sub);
    this.set(this.room, v.roomInfo);
    this.set(this.hint, v.hint ?? '');
    this.set(this.pings, v.pings ?? '');
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    const side = (ally: boolean) => (ally ? 'ally' : 'enemy');
    const html = v.feed.map((k) => `<div><span class="${side(k.killerAlly)}">${esc(k.killer)}</span> [${esc(k.weapon)}${k.headshot ? ' HS' : ''}] ` +
      `<span class="${side(k.victimAlly)}">${esc(k.victim)}</span></div>`).join('');
    if (html !== this.lastFeed) { this.lastFeed = html; this.feed.innerHTML = html; }
    this.set(this.perf, `FPS ${v.fps} · ${v.perf}`);
    const overlay = v.locked ? 'none' : 'flex';
    if (this.overlay.style.display !== overlay) this.overlay.style.display = overlay;
    this.root.classList.toggle('hud-dead', !v.alive);
  }

  /** Per-frame: crosshair gap (pixels) and flash timers. */
  frame(dt: number, gapPx: number): void {
    const g = Math.round(gapPx);
    if (g !== this.lastGap) { this.lastGap = g; this.crosshair.style.setProperty('--gap', `${g}px`); }
    if (this.hitLeft > 0) { this.hitLeft -= dt; if (this.hitLeft <= 0) this.hit.style.opacity = '0'; }
    if (this.damageLeft > 0) {
      this.damageLeft -= dt;
      this.damage.style.opacity = this.damageLeft > 0 ? String(Math.min(1, this.damageLeft * 2)) : '0';
    }
  }

  hitMarker(headshot: boolean, kill: boolean, time: number): void {
    this.hitLeft = time;
    this.hit.style.opacity = '1';
    this.hit.style.color = kill ? '#ff3b3b' : headshot ? '#ffd23b' : '#ffffff';
  }

  damageFlash(time: number): void { this.damageLeft = time; }

  /** "Leave match" with an "Are you sure?" step, on the Esc overlay. */
  addLeaveButton(onLeave: () => void): void {
    const wrap = el('div', 'hud-leave', this.overlay);
    const leave = el('button', 'hud-settings-btn hud-leave-btn', wrap, 'Leave match');
    const confirm = el('div', 'hud-leave-confirm', wrap);
    el('span', '', confirm, 'Are you sure? ');
    const yes = el('button', 'hud-settings-btn hud-leave-yes', confirm, 'Yes, leave');
    const no = el('button', 'hud-settings-btn hud-leave-no', confirm, 'No');
    confirm.style.display = 'none';
    const stop = (e: Event) => e.stopPropagation();
    for (const b of [leave, yes, no]) b.addEventListener('mousedown', stop);
    leave.addEventListener('click', (e) => { stop(e); confirm.style.display = ''; leave.style.display = 'none'; });
    no.addEventListener('click', (e) => { stop(e); confirm.style.display = 'none'; leave.style.display = ''; });
    yes.addEventListener('click', (e) => { stop(e); onLeave(); });
  }

  /** Remove everything this HUD added (back to the menu). */
  dispose(): void {
    this.root.replaceChildren();
    this.root.className = '';
  }

  setCrosshairHidden(hidden: boolean): void { this.root.classList.toggle('hud-no-crosshair', hidden); }

  /** Crosshair colour and line length (settings). */
  setCrosshairStyle(color: string, size: number): void {
    this.crosshair.style.setProperty('--ch-color', color);
    this.crosshair.style.setProperty('--ch-size', `${size}px`);
  }
}
