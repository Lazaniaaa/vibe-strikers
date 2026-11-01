// Keyboard + mouse -> PlayerIntent. Pointer lock for mouse look.
import { KEYS, MOUSE } from '../../src/config/input';
import type { PlayerIntent } from '../../src/gameplay/actor';
import { createIntent } from '../../src/gameplay/actor';
import { clamp, DEG } from '../../src/gameplay/math';

export class Input {
  readonly intent: PlayerIntent = createIntent();
  private keys = new Set<string>();
  private fireHeld = false;
  private dx = 0;
  private dy = 0;
  private slotRequest = -1;
  /** Index into LOADOUT.primaries chosen with 7/8/9, -1 = none (read once with takePrimaryRequest). */
  private primaryRequest = -1;
  /** Taps shorter than one frame still count. */
  private pressed = new Set<string>();
  private element: HTMLElement;
  /** Debug overrides (tests). */
  debugFire: boolean | null = null;
  debugLook: { yaw: number; pitch: number } | null = null;
  debugAds: boolean | null = null;
  /** ADS (right mouse): toggled state and held state; which one counts depends on the ADS mode setting. */
  private adsToggled = false;
  private adsHeld = false;
  /** Second-person view (V): toggled state; held = key down. debugSecondPerson overrides (tests). */
  private secondToggled = false;
  debugSecondPerson: boolean | null = null;
  /** Ping request (Z or middle mouse), read once with takePing. */
  private pingRequest = false;
  takePing(): boolean { const p = this.pingRequest; this.pingRequest = false; return p; }
  /** Called once per Enter / click while the match is over. */
  onConfirm: (() => void) | null = null;

  constructor(element: HTMLElement) {
    this.element = element;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    element.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  takePrimaryRequest(): number { const r = this.primaryRequest; this.primaryRequest = -1; return r; }

  /** True while a key (KeyboardEvent.code) is held. */
  isDown(code: string): boolean { return this.keys.has(code); }

  /** Tests: act as if the pointer were locked (headless browsers cannot lock it). */
  debugUnlocked = false;

  get locked(): boolean { return this.debugUnlocked || document.pointerLockElement === this.element; }

  requestLock(): void {
    try { const p = this.element.requestPointerLock() as unknown; if (p instanceof Promise) p.catch(() => undefined); } catch { /* not allowed here */ }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === KEYS.slot1) this.slotRequest = 0;
    if (e.code === KEYS.slot2) this.slotRequest = 1;
    if (e.code === KEYS.slot3) this.slotRequest = 2;
    const primary = KEYS.primaryKeys.indexOf(e.code);
    if (primary >= 0) this.primaryRequest = primary;
    if (e.code === 'Enter') this.onConfirm?.();
    if (e.code === KEYS.secondPerson && !e.repeat) this.secondToggled = !this.secondToggled;
    if (e.code === KEYS.ping && !e.repeat) this.pingRequest = true;
    if (e.code === KEYS.jump || e.code === KEYS.crouch || e.code === KEYS.scoreboard) e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onBlur = () => { this.keys.clear(); this.pressed.clear(); this.fireHeld = false; this.adsHeld = false; };
  private onMouseDown = (e: MouseEvent) => {
    if (!this.locked) { this.requestLock(); this.onConfirm?.(); return; }
    if (e.button === 0) this.fireHeld = true;
    if (e.button === 2) { this.adsHeld = true; this.adsToggled = !this.adsToggled; }
    if (e.button === 1) { this.pingRequest = true; e.preventDefault(); }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.fireHeld = false;
    if (e.button === 2) this.adsHeld = false;
  };

  /** Wants to aim down sights (debugAds overrides for tests). */
  wantAds(mode: 'toggle' | 'hold'): boolean { return this.debugAds ?? (mode === 'hold' ? this.adsHeld : this.adsToggled); }

  /** Wants the second-person view (V; toggle or hold). */
  wantSecondPerson(mode: 'toggle' | 'hold'): boolean {
    return this.debugSecondPerson ?? (mode === 'hold' ? this.keys.has(KEYS.secondPerson) : this.secondToggled);
  }

  /** Weapon switch, reload start and death leave ADS (owner 2026-10-31). */
  cancelAds(): void { this.adsToggled = false; }
  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.dx += e.movementX; this.dy += e.movementY;
  };

  /** Build this frame's intent starting from the actor's current (recoil-adjusted) view angles. */
  sample(currentYaw: number, currentPitch: number, sensitivity: number = MOUSE.sensitivity): PlayerIntent {
    const k = this.keys, p = this.pressed, i = this.intent;
    i.forward = (k.has(KEYS.forward) ? 1 : 0) - (k.has(KEYS.back) ? 1 : 0);
    i.right = (k.has(KEYS.right) ? 1 : 0) - (k.has(KEYS.left) ? 1 : 0);
    i.jump = k.has(KEYS.jump) || p.has(KEYS.jump);
    i.crouch = k.has(KEYS.crouch) || k.has(KEYS.crouchAlt);
    i.walk = k.has(KEYS.walk);
    i.reload = k.has(KEYS.reload) || p.has(KEYS.reload);
    i.use = p.has(KEYS.use);
    p.clear();
    i.fire = this.debugFire ?? (this.fireHeld && this.locked);
    i.slot = this.slotRequest; this.slotRequest = -1;
    if (this.debugLook) { i.yaw = this.debugLook.yaw; i.pitch = this.debugLook.pitch; }
    else {
      i.yaw = currentYaw - this.dx * sensitivity;
      i.pitch = clamp(currentPitch - this.dy * sensitivity, -MOUSE.maxPitchDeg * DEG, MOUSE.maxPitchDeg * DEG);
    }
    this.dx = 0; this.dy = 0;
    return i;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.element.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}
