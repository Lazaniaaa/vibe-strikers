// Blind A/B sound lab (?soundlab=1): Claude's and Codex's code-made sound sets side by side. Which set is A or B
// is shuffled per sound (kept for the browser tab), both are matched in loudness, and the owner's picks are saved
// in the browser; "Reveal" shows whose was whose and a text summary to paste back.
import { CLAUDE_SOUNDS } from '../../src/ui/sounds/claude';
import { CODEX_SOUNDS } from '../../src/ui/sounds/codex';
import { SOUND_IDS, type SoundId, type SoundSet } from '../../src/ui/sounds/types';

type Owner = 'claude' | 'codex';
type Vote = Owner | 'same';

const LABELS: Record<SoundId, string> = {
  uiHover: 'Button hover', knife: 'Knife', pistol: 'Pistol', rifle: 'Rifle (burst of 6)', sniper: 'Sniper',
  shotgun: 'Shotgun', step: 'Footsteps (4 in a row)', hit: 'Hit (body)', headshot: 'Headshot', loot: 'Loot pickup',
};
/** How a sound is auditioned: count of renders and the gap between them, seconds. */
const REPEAT: Partial<Record<SoundId, [number, number]>> = { rifle: [6, 0.1], step: [4, 0.32], uiHover: [3, 0.22] };
/** Loudness match: the loudest 50 ms window of both versions gets this RMS (peak capped at 0.95). */
const TARGET_RMS = 0.22, WINDOW_S = 0.05;

function store(kind: 'local' | 'session'): Storage | null {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
}

export function startSoundLab(): void {
  const sets: Record<Owner, SoundSet | null> = { claude: CLAUDE_SOUNDS, codex: CODEX_SOUNDS };
  // A/B assignment per sound: true = Claude is A.
  const mapKey = 'soundlab-map', voteKey = 'soundlab-votes';
  let map: Record<string, boolean> = {};
  try { map = JSON.parse(store('session')?.getItem(mapKey) ?? '{}'); } catch { map = {}; }
  for (const id of SOUND_IDS) if (typeof map[id] !== 'boolean') map[id] = Math.random() < 0.5;
  store('session')?.setItem(mapKey, JSON.stringify(map));
  let votes: Record<string, Vote> = {};
  try { votes = JSON.parse(store('local')?.getItem(voteKey) ?? '{}'); } catch { votes = {}; }
  const ownerOf = (id: SoundId, letter: 'A' | 'B'): Owner => ((letter === 'A') === map[id] ? 'claude' : 'codex');

  let ctx: AudioContext | null = null, master: GainNode | null = null;
  const cache = new Map<string, AudioBuffer[]>();
  const audio = () => {
    if (!ctx) { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = volume.valueAsNumber; master.connect(ctx.destination); }
    void ctx.resume();
    return ctx;
  };
  /** Gain that brings the loudest window to TARGET_RMS, capped so the peak stays under 0.95. */
  const matchGain = (s: Float32Array, sr: number) => {
    const w = Math.max(1, Math.round(WINDOW_S * sr));
    let best = 0, sum = 0, peak = 0;
    for (let i = 0; i < s.length; i++) {
      sum += s[i] * s[i]; if (i >= w) sum -= s[i - w] * s[i - w];
      best = Math.max(best, sum); peak = Math.max(peak, Math.abs(s[i]));
    }
    const rms = Math.sqrt(best / Math.min(w, s.length));
    return rms > 0 ? Math.min(TARGET_RMS / rms, 0.95 / peak) : 1;
  };
  const buffers = (owner: Owner, id: SoundId): AudioBuffer[] => {
    const key = `${owner}:${id}`;
    let list = cache.get(key);
    if (!list) {
      const ac = audio(), recipe = sets[owner]![id], [count] = REPEAT[id] ?? [1, 0];
      const renders = Array.from({ length: count }, () => recipe(ac.sampleRate, Math.random));
      const gain = matchGain(renders[0], ac.sampleRate);
      list = renders.map((s) => { const b = ac.createBuffer(1, s.length, ac.sampleRate); b.copyToChannel(s.map((v) => v * gain), 0); return b; });
      cache.set(key, list);
    }
    return list;
  };
  const play = (owner: Owner, id: SoundId, at = 0) => {
    const ac = audio(), [, gap] = REPEAT[id] ?? [1, 0];
    buffers(owner, id).forEach((b, k) => { const src = ac.createBufferSource(); src.buffer = b; src.connect(master!); src.start(ac.currentTime + at + k * gap); });
  };
  const length = (owner: Owner, id: SoundId) => { const list = buffers(owner, id), [, gap] = REPEAT[id] ?? [1, 0]; return (list.length - 1) * gap + list[list.length - 1].duration; };

  const root = document.createElement('div');
  root.className = 'soundlab';
  root.innerHTML = `<style>
    .soundlab { position: fixed; inset: 0; overflow: auto; background: #1b2433; color: #f6efe2; font: 15px system-ui, 'Segoe UI', sans-serif; padding: 24px; }
    .soundlab h1 { font-family: 'Lilita One', system-ui; font-size: 34px; margin: 0 0 6px; letter-spacing: .5px; }
    .soundlab p { margin: 4px 0 14px; opacity: .85; max-width: 760px; }
    .soundlab table { border-collapse: collapse; }
    .soundlab td { padding: 7px 8px; border-bottom: 1px solid #2f3b50; }
    .soundlab button { font: 600 14px system-ui; border: 2px solid #0e131c; border-radius: 9px; background: #f6efe2; color: #0e131c; padding: 6px 12px; cursor: pointer; box-shadow: 2px 2px 0 #0e131c; }
    .soundlab button.play { background: #ffb83d; }
    .soundlab button:disabled { opacity: .35; cursor: default; }
    .soundlab button.on { background: #4fb6ff; }
    .soundlab .owner { font-weight: 700; color: #ffb83d; }
    .soundlab textarea { width: 560px; height: 150px; margin-top: 10px; font: 13px monospace; }
  </style>
  <h1>Sound lab · blind A/B</h1>
  <p>For every sound, play A and B, then pick the better one. A and B are shuffled per sound and matched in loudness,
  so you cannot tell whose is whose. Your picks are saved in this browser. Press "Reveal" at the end.</p>
  <label>Volume <input class="lab-volume" type="range" min="0" max="1" step="0.05" value="0.7"></label>
  <span class="lab-note"></span>
  <table class="lab-rows"></table>
  <p><button class="lab-reveal">Reveal</button> <button class="lab-reset">Clear picks</button></p>
  <div class="lab-result"></div>`;
  document.body.appendChild(root);
  const volume = root.querySelector<HTMLInputElement>('.lab-volume')!;
  volume.addEventListener('input', () => { if (master) master.gain.value = volume.valueAsNumber; });
  const ready = !!sets.codex;
  root.querySelector('.lab-note')!.textContent = ready ? '' : '  Codex set is not in the repo yet: only A plays (no blind comparison yet).';

  const rows = root.querySelector('.lab-rows')!;
  let revealed = false;
  const render = () => {
    rows.innerHTML = '';
    for (const id of SOUND_IDS) {
      const tr = document.createElement('tr');
      const cell = (child?: HTMLElement | string) => { const td = document.createElement('td'); if (child) td.append(child); tr.appendChild(td); return td; };
      cell(LABELS[id]);
      const btn = (text: string, cls: string, onClick: () => void, disabled = false) => {
        const b = document.createElement('button'); b.textContent = text; b.className = cls; b.disabled = disabled; b.addEventListener('click', onClick); return b;
      };
      const a = ready ? ownerOf(id, 'A') : 'claude', b = ownerOf(id, 'B');
      cell(btn('▶ A', 'play', () => play(a, id)));
      cell(btn('▶ B', 'play', () => play(b, id), !ready));
      cell(btn('▶ A then B', 'play', () => { play(a, id); play(b, id, length(a, id) + 0.35); }, !ready));
      for (const [text, vote] of [['A better', a], ['B better', b], ['Same', 'same']] as [string, Vote][]) {
        cell(btn(text, votes[id] === vote ? 'on' : '', () => { votes[id] = vote; store('local')?.setItem(voteKey, JSON.stringify(votes)); render(); }, !ready));
      }
      const who = document.createElement('span'); who.className = 'owner';
      who.textContent = revealed && ready ? `A = ${a}, B = ${b}` : '';
      cell(who);
      rows.appendChild(tr);
    }
  };
  render();
  root.querySelector('.lab-reveal')!.addEventListener('click', () => {
    revealed = true; render();
    const lines = SOUND_IDS.map((id) => `${id}: ${votes[id] ?? 'no pick'}`);
    const count = (o: Vote) => SOUND_IDS.filter((id) => votes[id] === o).length;
    const box = root.querySelector('.lab-result')!;
    box.innerHTML = `<p>Claude ${count('claude')} · Codex ${count('codex')} · same ${count('same')}. Copy this to Claude:</p>`;
    const text = document.createElement('textarea'); text.value = lines.join('\n'); box.appendChild(text);
  });
  root.querySelector('.lab-reset')!.addEventListener('click', () => { votes = {}; store('local')?.removeItem(voteKey); render(); });
}
