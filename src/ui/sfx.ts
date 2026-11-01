// Sound player: Web Audio buffers rendered once per sound, master gain = settings volume, simple distance
// falloff and stereo pan for sounds in the world. The AudioContext starts on the first user gesture.
import { AUDIO, SOUNDS, type SoundName } from '../config/audio.ts';
import { synth } from './sfxSynth.ts';
import { onSettingsChange, settings } from './settings.ts';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  /** Plays per sound (tests / debug). */
  readonly played: Record<string, number> = {};

  /** The shared AudioContext (music uses it too); null until audio can start. */
  context(): AudioContext | null { return this.ensure(); }

  constructor() {
    const unlock = () => { this.ensure(); void this.ctx?.resume().catch(() => undefined); };
    window.addEventListener('mousedown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    onSettingsChange(() => { if (this.master) this.master.gain.value = settings.volume; });
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = settings.volume;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
    return this.ctx;
  }

  private buffer(name: SoundName): AudioBuffer | null {
    const ctx = this.ensure();
    if (!ctx) return null;
    let b = this.buffers.get(name);
    if (!b) {
      const data = synth(SOUNDS[name], ctx.sampleRate);
      b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.copyToChannel(data, 0);
      this.buffers.set(name, b);
    }
    return b;
  }

  /** Play a sound. `gain` 0..1 extra volume, `pan` -1..1. */
  play(name: SoundName, gain = 1, pan = 0): void {
    this.played[name] = (this.played[name] ?? 0) + 1;
    const ctx = this.ctx ?? this.ensure();
    const buf = this.buffer(name);
    if (!ctx || !buf || !this.master || gain <= 0 || settings.volume <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * SOUNDS[name].pitchJitter;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(g).connect(p).connect(this.master);
    src.start();
  }

  /**
   * Play a sound at a world position heard by a listener at (lx, lz) looking along yaw.
   * Falloff: 1 within refDistance, then refDistance / d; silent beyond maxDistance.
   */
  playAt(name: SoundName, x: number, z: number, lx: number, lz: number, yaw: number): void {
    const dx = x - lx, dz = z - lz, dist = Math.hypot(dx, dz);
    if (dist > AUDIO.maxDistance) { this.played[name] = (this.played[name] ?? 0) + 1; return; }
    const gain = dist <= AUDIO.refDistance ? 1 : AUDIO.refDistance / dist;
    // Listener right vector for yaw (yaw 0 looks along -Z, right = +X).
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const pan = dist > 0.01 ? (dx * rx + dz * rz) / dist : 0;
    this.play(name, gain, pan * 0.8);
  }
}

let shared: Sfx | null = null;
export function getSfx(): Sfx { if (!shared) shared = new Sfx(); return shared; }
