// Camera shake when the local player is hit (trauma model, EFFECTS.shake). Roll + a small sideways / vertical offset
// only: the view centre (and so the crosshair) stays on the real aim. No allocation per frame.
import type { Camera } from 'three';
import { EFFECTS } from '../../src/config/game';
import { settings } from '../../src/ui/settings';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

export class CameraShake {
  private trauma = 0;
  private time = 0;

  /** The local player took `damage`. */
  hit(damage: number): void {
    const s = EFFECTS.shake;
    this.trauma = Math.min(1, this.trauma + s.traumaMin + damage * s.traumaPerDamage);
  }

  /** Call once per frame after the camera is placed at the eye. */
  apply(cam: Camera, dt: number): void {
    const s = EFFECTS.shake;
    this.trauma = Math.max(0, this.trauma - s.decayPerSecond * dt);
    this.time += dt;
    if (this.trauma <= 0 || settings.screenShake === 'off') return;
    const k = this.trauma * this.trauma, t = this.time, [f1, f2, f3] = s.freq;
    // Two sines per axis at unrelated frequencies: smooth and non-repeating enough for 0.5 s.
    const n1 = (Math.sin(TAU * f1 * t) + Math.sin(TAU * f2 * t + 1.3)) / 2;
    const n2 = (Math.sin(TAU * f2 * t + 2.1) + Math.sin(TAU * f3 * t + 0.4)) / 2;
    const n3 = (Math.sin(TAU * f3 * t + 3.7) + Math.sin(TAU * f1 * t + 5.2)) / 2;
    cam.rotation.z += s.maxRollDeg * DEG * k * n1;
    cam.translateX(s.maxOffset * k * n2);
    cam.translateY(s.maxOffset * k * n3);
  }
}
