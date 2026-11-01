// Generative music (GAME.md 12): a small step sequencer playing synth notes (the same ZzFX-style synth as the
// sound effects; buffers rendered once per note). Moods: menu / calm (calm loop), round (light rhythm), tension
// (last seconds), plus win / lose stings. Volume = settings.musicVolume x settings.volume.
import { MUSIC, type SoundDef } from '../config/audio.ts';
import { synth } from './sfxSynth.ts';
import { onSettingsChange, settings } from './settings.ts';
import { getSfx } from './sfx.ts';

export type MusicMood = 'off' | 'menu' | 'calm' | 'round' | 'tension';
type Inst = 'pad' | 'bass' | 'arp' | 'hat' | 'sting';

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  mood: MusicMood = 'off';
  /** Notes scheduled so far, per instrument (tests / debug). */
  readonly notes: Record<string, number> = {};
  stings = { win: 0, lose: 0 };
  private gain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private step = 0;
  private nextTime = 0;
  private timer = 0;

  constructor() {
    onSettingsChange(() => this.applyVolume());
    this.timer = window.setInterval(() => this.tick(), MUSIC.tickMs);
  }

  setMood(m: MusicMood): void { this.mood = m; }

  /** A short win / lose sting (round or match end). */
  sting(win: boolean): void {
    const ctx = this.ctx();
    if (!ctx || ctx.state !== 'running') return;
    const seq = win ? MUSIC.win : MUSIC.lose, dt = 60 / MUSIC.tempo.round / 2;
    seq.forEach((n, i) => this.note('sting', MUSIC.root + 24 + n, ctx.currentTime + 0.05 + i * dt));
    if (win) this.stings.win++; else this.stings.lose++;
  }

  private ctx(): AudioContext | null {
    const ctx = getSfx().context();
    if (ctx && !this.gain) { this.gain = ctx.createGain(); this.gain.connect(ctx.destination); this.applyVolume(); }
    return ctx;
  }

  private applyVolume(): void { if (this.gain) this.gain.gain.value = settings.musicVolume * settings.volume * MUSIC.mix; }

  private buffer(inst: Inst, midi: number, ctx: AudioContext): AudioBuffer {
    const key = `${inst}:${midi}`;
    let b = this.buffers.get(key);
    if (!b) {
      const f = midiHz(midi), def: SoundDef = { ...MUSIC[inst], freq: f, freqEnd: f };
      const data = synth(def, ctx.sampleRate);
      b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.copyToChannel(data, 0);
      this.buffers.set(key, b);
    }
    return b;
  }

  private note(inst: Inst, midi: number, when: number): void {
    const ctx = this.ctx();
    if (!ctx || !this.gain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(inst, midi, ctx);
    src.connect(this.gain);
    src.start(when);
    this.notes[inst] = (this.notes[inst] ?? 0) + 1;
  }

  /** Schedule the 8th-note steps that start within the look-ahead window. */
  private tick(): void {
    const ctx = this.ctx();
    if (!ctx || ctx.state !== 'running' || this.mood === 'off' || settings.musicVolume <= 0) { this.nextTime = 0; return; }
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + MUSIC.lookAhead) {
      this.playStep(this.step, this.nextTime);
      this.step = (this.step + 1) % 32;
      this.nextTime += 60 / MUSIC.tempo[this.mood] / 2;
    }
  }

  /** One 8th-note step of the 4-bar loop (8 steps per bar). */
  private playStep(step: number, t: number): void {
    const bar = step >> 3, beat = step & 7, chord = MUSIC.root + MUSIC.chords[bar % MUSIC.chords.length];
    const triad = [0, 3, 7]; // minor-ish colour for every chord keeps it simple and moody
    const m = this.mood;
    // Pad: chord at the start of every bar (all moods; softer feeling comes from the slower tempo).
    if (beat === 0) for (const n of triad) this.note('pad', chord + 12 + n, t);
    if (m === 'menu' || m === 'calm') {
      if (beat === 4) this.note('arp', chord + 24 + triad[(bar + step) % 3], t);
      return;
    }
    // Round: bass on the beats, soft hats on the off-beats, a sparse arpeggio.
    if (beat % 2 === 0) this.note('bass', chord, t);
    if (beat % 2 === 1) this.note('hat', 60, t);
    if (m === 'round' && (beat === 3 || beat === 6)) this.note('arp', chord + 24 + triad[beat % 3], t);
    // Tension: bass on every step, busy arpeggio an octave up.
    if (m === 'tension') {
      if (beat % 2 === 1) this.note('bass', chord, t);
      this.note('arp', chord + 24 + triad[step % 3] + (beat >= 4 ? 12 : 0), t);
    }
  }

  dispose(): void { window.clearInterval(this.timer); }
}

let shared: Music | null = null;
export function getMusic(): Music { if (!shared) shared = new Music(); return shared; }

/** Follows a match: mood from the phase, a sting when a live round ends (win = my team / me). Call ~10 Hz. */
export class MusicDirector {
  private last = '';
  update(phase: string, timeLeft: number, winner: string, myTeam: string): void {
    const m = getMusic();
    m.setMood(moodFor(phase, timeLeft));
    if (this.last === 'live' && (phase === 'roundEnd' || phase === 'matchEnd')) m.sting(winner !== '' && winner === myTeam);
    this.last = phase;
  }
}

/** Mood for a round phase and the seconds left. */
export function moodFor(phase: string, timeLeft: number, tensionTime: number = MUSIC.tensionTime): MusicMood {
  if (phase === 'live') return timeLeft <= tensionTime ? 'tension' : 'round';
  return 'calm';
}
