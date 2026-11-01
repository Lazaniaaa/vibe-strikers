// Second-person view (GAME.md 5, `V`): the camera stands in front of the player and looks back at the own
// character (HIP hold), 2.5 m away, pulled in by walls. Shooting is disabled in this view (reloading works).
import type { PerspectiveCamera } from 'three';
import { SECOND_PERSON } from '../../src/config/settings';
import type { Actor } from '../../src/gameplay/actor';
import { rayBlockers, type AabbBox } from '../../src/gameplay/hitscan';
import { directionFromAngles, vec3 } from '../../src/gameplay/math';
import { AvatarRig } from './visuals';

export class SecondPersonView {
  /** The own character, drawn only in this view. */
  readonly rig: AvatarRig;
  active = false;
  /** Current camera distance (after the wall ray). */
  distance = 0;
  private readonly eye = vec3();
  private readonly dir = vec3();

  constructor(local: Actor) {
    this.rig = new AvatarRig(local, null);
    this.rig.root.visible = false;
  }

  /** Call every frame after the local actor moved. Returns whether the view is active. */
  update(want: boolean, local: Actor, dt: number): boolean {
    this.active = want && local.alive;
    if (this.active) this.rig.sync(local, dt);
    this.rig.root.visible = this.active;
    return this.active;
  }

  /** Put the camera in front of the eye, looking back; a ray against the map keeps it out of walls. */
  place(cam: PerspectiveCamera, local: Actor, blockers: readonly AabbBox[]): void {
    const e = this.eye, d = this.dir;
    e.x = local.x; e.y = local.y + local.eyeHeight; e.z = local.z;
    directionFromAngles(local.yaw, local.pitch, d);
    const hit = rayBlockers(e, d, SECOND_PERSON.distance + SECOND_PERSON.wallMargin, blockers);
    this.distance = Math.max(SECOND_PERSON.minDistance, Math.min(SECOND_PERSON.distance, hit - SECOND_PERSON.wallMargin));
    cam.position.set(e.x + d.x * this.distance, e.y + d.y * this.distance, e.z + d.z * this.distance);
    cam.rotation.set(-local.pitch, local.yaw + Math.PI, 0);
  }
}
