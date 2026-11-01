// ADS for the local player only (GAME.md 5): blend, world FOV, mouse speed, sniper scope overlay.
// Other players never see it; the server only gets "scoped" with sniper shots (accuracy).
import type { PerspectiveCamera } from 'three';
import { ADS } from '../../src/config/settings';
import { SCOPED_ADS } from '../../src/config/weapons';
import { settings } from '../../src/ui/settings';
import { adsSensitivityScale, createScopeOverlay, fovForAds, HIP_FOV, scopeOverlayOpacity, type WeaponId } from '../../src/weapons';

export class AdsController {
  /** 0 = hip, 1 = fully aimed. */
  value = 0;
  private overlay: HTMLElement;
  private lastFov = -1;
  private lastOpacity = -1;

  constructor(hudRoot: HTMLElement) {
    this.overlay = createScopeOverlay();
    this.overlay.classList.add('hud-scope');
    this.overlay.style.opacity = '0';
    hudRoot.appendChild(this.overlay);
  }

  /** Advance the blend toward `want` (knife never aims). */
  update(dt: number, want: boolean, weapon: WeaponId): void {
    const target = want && weapon !== 'knife' ? 1 : 0;
    const step = ADS.blendSpeed * dt;
    this.value = target > this.value ? Math.min(target, this.value + step) : Math.max(target, this.value - step);
  }

  reset(): void { this.value = 0; }

  scoped(weapon: WeaponId): boolean { return weapon === 'sniper' && this.value >= SCOPED_ADS; }

  /** Mouse radians per pixel right now. */
  sensitivity(weapon: WeaponId): number { return settings.sensitivity * adsSensitivityScale(weapon, this.value); }

  /** World camera FOV from the settings FOV, zoomed like the asset's fovForAds (hip = HIP_FOV). */
  apply(camera: PerspectiveCamera, weapon: WeaponId): void {
    const fov = settings.fov * fovForAds(weapon, this.value) / HIP_FOV;
    if (Math.abs(fov - this.lastFov) > 1e-3) { this.lastFov = fov; camera.fov = fov; camera.updateProjectionMatrix(); }
    const opacity = weapon === 'sniper' ? scopeOverlayOpacity(this.value) : 0;
    if (Math.abs(opacity - this.lastOpacity) > 1e-3) {
      this.lastOpacity = opacity;
      this.overlay.style.opacity = String(opacity);
      this.overlay.style.visibility = opacity > 0 ? 'visible' : 'hidden';
    }
  }

  /** The game crosshair is hidden while aiming down sights (the sight / scope is the aim point). */
  get hideCrosshair(): boolean { return this.value > 0.5; }

  dispose(): void { this.overlay.remove(); }
}
