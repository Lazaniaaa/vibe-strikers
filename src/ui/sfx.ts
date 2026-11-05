// Sound player: Web Audio buffers rendered once per sound, master gain = settings volume, simple distance
// falloff and stereo pan for sounds in the world. The AudioContext starts on the first user gesture.
import { AUDIO, PICKED_SOUNDS, SOUNDS, STEP_VARIANTS, type SoundName } from '../config/audio.ts';
import { synth } from './sfxSynth.ts';
import { PICKED_RECIPES } from './sounds/picks.ts';

/** Gain and pitch variation of a sound: the picked recipe's (PICKED_SOUNDS) or the synth def's. */
function mixOf(name: SoundName): { gain: number; jitter: number } {
  const p = (PICKED_SOUNDS as Partial<Record<SoundName, { gain: number; jitter: number }>>)[name];
  return p ?? { gain: 1, jitter: SOUNDS[name].pitchJitter };
}
import { onSettingsChange, settings } from './settings.ts';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Rendered buffers per sound (footsteps: STEP_VARIANTS different renders). */
  private buffers = new Map<SoundName, AudioBuffer[]>();
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
      // Render every sound once, right after audio unlocks (a few ms in total), not on the first shot.
      setTimeout(() => { for (const name of Object.keys(SOUNDS) as SoundName[]) this.buffer(name); }, 0);
    } catch { this.ctx = null; }
    return this.ctx;
  }

  private buffer(name: SoundName): AudioBuffer | null {
    const ctx = this.ensure();
    if (!ctx) return null;
    let list = this.buffers.get(name);
    if (!list) {
      const recipe = PICKED_RECIPES[name];
      const renders = recipe && name === 'step' ? STEP_VARIANTS : 1;
      list = [];
      for (let k = 0; k < renders; k++) {
        const data = recipe ? recipe(ctx.sampleRate, Math.random) : synth(SOUNDS[name], ctx.sampleRate);
        const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
        b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
        list.push(b);
      }
      this.buffers.set(name, list);
    }
    return list.length === 1 ? list[0] : list[Math.floor(Math.random() * list.length)];
  }

  /** Play a sound. `gain` 0..1 extra volume, `pan` -1..1. */
  play(name: SoundName, gain = 1, pan = 0): void {
    this.played[name] = (this.played[name] ?? 0) + 1;
    const ctx = this.ctx ?? this.ensure();
    const buf = this.buffer(name);
    if (!ctx || !buf || !this.master || gain <= 0 || settings.volume <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const m = mixOf(name);
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * m.jitter;
    const g = ctx.createGain();
    g.gain.value = gain * m.gain;
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
