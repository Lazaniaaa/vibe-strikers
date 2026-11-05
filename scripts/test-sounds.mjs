// Checks every code-made sound set against SOUND_LIMITS (duration, peak, clicks, render time) and prints a table.
// Usage: node --experimental-strip-types --no-warnings scripts/test-sounds.mjs [--wav <dir>]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SOUND_IDS, SOUND_LIMITS } from '../src/ui/sounds/types.ts';
import { CLAUDE_SOUNDS } from '../src/ui/sounds/claude.ts';
import { CODEX_SOUNDS } from '../src/ui/sounds/codex.ts';
import { ROUND2 } from '../src/ui/sounds/round2.ts';

const SR = 48000;
const wavDir = process.argv.includes('--wav') ? process.argv[process.argv.indexOf('--wav') + 1] : null;

/** Seeded random (mulberry32), so the checks are repeatable. */
function seeded(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function wav(samples) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + samples.length * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36);
  data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return data;
}

let failures = 0;
for (const [name, set] of [['claude', CLAUDE_SOUNDS], ['codex', CODEX_SOUNDS]]) {
  if (!set) { console.log(`${name}: no set yet (skipped)`); continue; }
  const rows = [];
  for (const id of SOUND_IDS) {
    set[id](SR, seeded(1)); // warm-up: time the second render, not the JIT
    const random = seeded(7);
    const t0 = performance.now();
    const s = set[id](SR, random);
    const ms = performance.now() - t0;
    let peak = 0, sum = 0, crossings = 0, finite = true;
    for (let i = 0; i < s.length; i++) {
      if (!Number.isFinite(s[i])) finite = false;
      peak = Math.max(peak, Math.abs(s[i])); sum += s[i] * s[i];
      if (i > 0 && (s[i - 1] < 0) !== (s[i] < 0)) crossings++;
    }
    const dur = s.length / SR, rmsDb = 10 * Math.log10(sum / s.length + 1e-12);
    const errors = [];
    if (!finite) errors.push('NaN');
    if (dur > SOUND_LIMITS.maxDuration[id] + 1e-9) errors.push(`duration ${dur.toFixed(3)} > ${SOUND_LIMITS.maxDuration[id]}`);
    if (peak > SOUND_LIMITS.maxPeak + 1e-6) errors.push(`peak ${peak.toFixed(3)}`);
    if (peak < 0.05) errors.push('silent');
    if (Math.abs(s[0]) > SOUND_LIMITS.edge || Math.abs(s[s.length - 1]) > SOUND_LIMITS.edge) errors.push('click at edge');
    if (ms > SOUND_LIMITS.maxRenderMs) errors.push(`render ${ms.toFixed(1)} ms`);
    failures += errors.length;
    rows.push({ id, dur: dur.toFixed(3), peak: peak.toFixed(2), rmsDb: rmsDb.toFixed(1), zcrHz: Math.round(crossings / dur / 2), ms: ms.toFixed(1), ok: errors.length ? errors.join('; ') : 'ok' });
    if (wavDir) { mkdirSync(wavDir, { recursive: true }); writeFileSync(join(wavDir, `${name}-${id}.wav`), wav(s)); }
  }
  console.log(name); console.table(rows);
}
// Round 2 variants (owner 2026-11-06): same limits; WAVs as round2-<id>-v<n>.wav, plus a rifle burst preview.
const rows2 = [];
for (const [id, list] of Object.entries(ROUND2)) {
  list.forEach((recipe, k) => {
    recipe(SR, seeded(1));
    const t0 = performance.now();
    const s = recipe(SR, seeded(7));
    const ms = performance.now() - t0;
    let peak = 0, sum = 0, finite = true;
    for (let i = 0; i < s.length; i++) { if (!Number.isFinite(s[i])) finite = false; peak = Math.max(peak, Math.abs(s[i])); sum += s[i] * s[i]; }
    const dur = s.length / SR, errors = [];
    if (!finite) errors.push('NaN');
    if (dur > SOUND_LIMITS.maxDuration[id] + 1e-9) errors.push(`duration ${dur.toFixed(3)} > ${SOUND_LIMITS.maxDuration[id]}`);
    if (peak > SOUND_LIMITS.maxPeak + 1e-6) errors.push(`peak ${peak.toFixed(3)}`);
    if (peak < 0.05) errors.push('silent');
    if (Math.abs(s[0]) > SOUND_LIMITS.edge || Math.abs(s[s.length - 1]) > SOUND_LIMITS.edge) errors.push('click at edge');
    if (ms > SOUND_LIMITS.maxRenderMs) errors.push(`render ${ms.toFixed(1)} ms`);
    failures += errors.length;
    rows2.push({ id: `${id} v${k + 1}`, dur: dur.toFixed(3), peak: peak.toFixed(2), rmsDb: (10 * Math.log10(sum / s.length + 1e-12)).toFixed(1), ms: ms.toFixed(1), ok: errors.length ? errors.join('; ') : 'ok' });
    if (wavDir) {
      mkdirSync(wavDir, { recursive: true });
      writeFileSync(join(wavDir, `round2-${id}-v${k + 1}.wav`), wav(s));
      if (id === 'rifle') {
        // Burst preview: 8 shots at the rifle's fire interval (the game plays the same sample each shot).
        const interval = 0.1, burst = new Float32Array(Math.round((interval * 7) * SR) + s.length);
        for (let n = 0; n < 8; n++) { const at = Math.round(n * interval * SR); for (let i = 0; i < s.length; i++) burst[at + i] += s[i]; }
        let m = 0; for (const v of burst) m = Math.max(m, Math.abs(v));
        if (m > 0.95) for (let i = 0; i < burst.length; i++) burst[i] *= 0.95 / m;
        writeFileSync(join(wavDir, `round2-rifle-v${k + 1}-burst.wav`), wav(burst));
      }
    }
  });
}
console.log('round 2 variants'); console.table(rows2);
if (failures) { console.error(`SOUND TEST FAILED (${failures})`); process.exit(1); }
console.log('SOUND TEST PASS');
