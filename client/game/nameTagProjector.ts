// Decides which name tags are visible and where (GAME.md / owner 2026-10-31):
// allies always (through walls), enemies only in direct line of sight AND near the crosshair, all within
// NAME_TAGS.maxDistance, scaled with distance, faded near the limit. No allocation per call.
import { Vector3, type PerspectiveCamera } from 'three';
import { NAME_TAGS } from '../../src/config/game';
import { lineOfSight, type AabbBox } from '../../src/gameplay/hitscan';
import { DEG, vec3 } from '../../src/gameplay/math';
import type { NameTags } from '../../src/ui/nameTags';

export class TagProjector {
  private readonly ndc = new Vector3();
  private readonly forward = new Vector3();
  private readonly eye = vec3();
  private readonly target = vec3();
  private readonly scratch = vec3();
  private readonly cosMax = Math.cos(NAME_TAGS.enemyMaxAngleDeg * DEG);
  private tags: NameTags;
  private blockers: readonly AabbBox[];

  constructor(tags: NameTags, blockers: readonly AabbBox[]) { this.tags = tags; this.blockers = blockers; }

  /** Call once per frame after the camera is placed. */
  begin(camera: PerspectiveCamera): void {
    camera.updateMatrixWorld();
    camera.getWorldDirection(this.forward);
    this.eye.x = camera.position.x; this.eye.y = camera.position.y; this.eye.z = camera.position.z;
  }

  /** One player. `hidden` = dead, or the camera is inside this player (killcam / spectate). */
  place(camera: PerspectiveCamera, width: number, height: number, id: number, name: string, ally: boolean,
    x: number, y: number, z: number, hidden: boolean): void {
    const dx = x - this.eye.x, dz = z - this.eye.z;
    const dist = Math.hypot(dx, y + NAME_TAGS.enemyAimHeight - this.eye.y, dz);
    if (hidden || dist > NAME_TAGS.maxDistance) { this.tags.hide(id); return; }
    if (!ally) {
      // Near the crosshair...
      const ty = y + NAME_TAGS.enemyAimHeight - this.eye.y;
      const cos = (dx * this.forward.x + ty * this.forward.y + dz * this.forward.z) / Math.max(1e-6, dist);
      if (cos < this.cosMax) { this.tags.hide(id); return; }
      // ...and visible (no map box in between): no wall hacks.
      this.target.x = x; this.target.y = y + NAME_TAGS.enemyAimHeight; this.target.z = z;
      if (!lineOfSight(this.eye, this.target, this.blockers, this.scratch)) { this.tags.hide(id); return; }
    }
    this.ndc.set(x, y + NAME_TAGS.height, z).project(camera);
    if (this.ndc.z > 1 || this.ndc.z < -1) { this.tags.hide(id); return; }
    const sx = (this.ndc.x + 1) / 2 * width, sy = (1 - this.ndc.y) / 2 * height;
    const scale = Math.min(NAME_TAGS.maxScale, Math.max(NAME_TAGS.minScale, NAME_TAGS.refDistance / Math.max(0.1, dist)));
    const opacity = dist <= NAME_TAGS.fadeStart ? 1 : 1 - (dist - NAME_TAGS.fadeStart) / (NAME_TAGS.maxDistance - NAME_TAGS.fadeStart);
    this.tags.show(id, name, ally, sx, sy, scale, opacity);
  }
}
