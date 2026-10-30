// Player movement with Rapier's KinematicCharacterController (CLAUDE.md rule 3).
// Velocity / gravity / jump / crouch rules come from src/config/movement.ts.
import type { Capsule, Collider, ColliderDesc, KinematicCharacterController, Shape, World } from '@dimforge/rapier3d-compat';
import { CAPSULE, KCC, MOVEMENT } from '../config/movement.ts';
import type { Actor, PlayerIntent } from './actor.ts';

/** The parts of the Rapier module this motor needs (works with @react-three/rapier's `rapier`). */
export interface RapierApi { ColliderDesc: typeof ColliderDesc; Capsule: typeof Capsule }

/** Actor capsules are in group 2 and filter nothing: map queries never see them. */
const ACTOR_GROUPS = 0x0002_0000;
/** Query groups: everything that accepts group 0xffff (map colliders use the default groups). */
const QUERY_GROUPS = 0xffff_ffff;

const STAND_HALF = (CAPSULE.height - 2 * CAPSULE.radius) / 2;
const CROUCH_HALF = (CAPSULE.crouchHeight - 2 * CAPSULE.radius) / 2;

export class RapierMotor {
  private world: World;
  private controller: KinematicCharacterController;
  private colliders = new Map<number, Collider>();
  private standShape: Shape;
  private readonly identityRot = { x: 0, y: 0, z: 0, w: 1 };
  private readonly desired = { x: 0, y: 0, z: 0 };
  private readonly center = { x: 0, y: 0, z: 0 };
  private rapier: RapierApi;

  constructor(rapier: RapierApi, world: World) {
    this.rapier = rapier;
    this.world = world;
    this.controller = world.createCharacterController(KCC.offset);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.enableAutostep(KCC.autostepMaxHeight, KCC.autostepMinWidth, false);
    this.controller.enableSnapToGround(KCC.snapToGround);
    this.controller.setMaxSlopeClimbAngle(KCC.maxSlopeClimbDeg * Math.PI / 180);
    this.controller.setMinSlopeSlideAngle(KCC.minSlopeSlideDeg * Math.PI / 180);
    this.controller.setApplyImpulsesToDynamicBodies(false);
    this.standShape = new rapier.Capsule(STAND_HALF, CAPSULE.radius);
  }

  add(actor: Actor): void {
    const desc = this.rapier.ColliderDesc.capsule(STAND_HALF, CAPSULE.radius)
      .setTranslation(actor.x, actor.y + CAPSULE.radius + STAND_HALF, actor.z)
      .setCollisionGroups(ACTOR_GROUPS);
    this.colliders.set(actor.id, this.world.createCollider(desc));
  }

  /** Put an actor at feet position (x, y, z), standing, with zero velocity. */
  teleport(actor: Actor, x: number, y: number, z: number): void {
    actor.x = x; actor.y = y; actor.z = z; actor.vx = 0; actor.vy = 0; actor.vz = 0;
    actor.crouching = false; actor.eyeHeight = CAPSULE.eyeHeight; actor.grounded = false;
    const c = this.colliders.get(actor.id);
    if (!c) return;
    c.setHalfHeight(STAND_HALF);
    c.setTranslation({ x, y: y + CAPSULE.radius + STAND_HALF, z });
  }

  private halfHeight(actor: Actor): number { return actor.crouching ? CROUCH_HALF : STAND_HALF; }

  /** Move one actor for `dt` seconds. `frozen` = freeze phase (look only, no walking or jumping). */
  step(actor: Actor, intent: PlayerIntent, dt: number, frozen: boolean, speedScale: number): void {
    const c = this.colliders.get(actor.id);
    if (!c || dt <= 0) return;

    // Crouch / stand up (only if the standing capsule fits).
    if (intent.crouch && !actor.crouching) {
      actor.crouching = true; c.setHalfHeight(CROUCH_HALF);
    } else if (!intent.crouch && actor.crouching) {
      this.center.x = actor.x; this.center.y = actor.y + CAPSULE.radius + STAND_HALF + KCC.offset; this.center.z = actor.z;
      const blocked = this.world.intersectionWithShape(this.center, this.identityRot, this.standShape, undefined, QUERY_GROUPS, c);
      if (!blocked) { actor.crouching = false; c.setHalfHeight(STAND_HALF); }
    }
    const targetEye = actor.crouching ? CAPSULE.crouchEyeHeight : CAPSULE.eyeHeight;
    const eyeStep = CAPSULE.crouchTransitionSpeed * dt;
    actor.eyeHeight += Math.max(-eyeStep, Math.min(eyeStep, targetEye - actor.eyeHeight));

    // Wish direction from intent, relative to yaw.
    let f = frozen ? 0 : intent.forward, r = frozen ? 0 : intent.right;
    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; }
    const fx = -Math.sin(actor.yaw), fz = -Math.cos(actor.yaw);
    const speed = (actor.crouching ? MOVEMENT.crouchSpeed : intent.walk ? MOVEMENT.walkSpeed : MOVEMENT.runSpeed) * speedScale;
    const tx = (fx * f - fz * r) * speed, tz = (fz * f + fx * r) * speed;
    const accel = MOVEMENT.groundAccel * (actor.grounded ? 1 : MOVEMENT.airControl) * dt;
    let dvx = tx - actor.vx, dvz = tz - actor.vz;
    const dl = Math.hypot(dvx, dvz);
    if (dl > accel) { dvx *= accel / dl; dvz *= accel / dl; }
    // In the air, only steer (never brake below current speed without input).
    if (actor.grounded || len > 0) { actor.vx += dvx; actor.vz += dvz; }

    // Jump (one per press) and gravity.
    if (!intent.jump) actor.jumpLatch = false;
    if (!frozen && intent.jump && !actor.jumpLatch && actor.grounded) {
      actor.vy = MOVEMENT.jumpVelocity; actor.grounded = false; actor.jumpLatch = true;
    }
    actor.vy = Math.max(-MOVEMENT.maxFallSpeed, actor.vy - MOVEMENT.gravity * dt);

    this.desired.x = actor.vx * dt; this.desired.y = actor.vy * dt; this.desired.z = actor.vz * dt;
    this.controller.computeColliderMovement(c, this.desired, undefined, QUERY_GROUPS);
    const m = this.controller.computedMovement();
    const grounded = this.controller.computedGrounded();

    actor.x += m.x; actor.y += m.y; actor.z += m.z;
    this.center.x = actor.x; this.center.y = actor.y + CAPSULE.radius + this.halfHeight(actor); this.center.z = actor.z;
    c.setTranslation(this.center);

    // Velocity follows what actually happened (walls, ceilings, landing).
    actor.vx = m.x / dt; actor.vz = m.z / dt;
    if (grounded && actor.vy <= 0) actor.vy = -MOVEMENT.groundStickSpeed;
    else if (actor.vy > 0 && m.y < this.desired.y * 0.5) actor.vy = 0; // bumped the ceiling
    actor.grounded = grounded;

    // Animation data.
    const hs = Math.hypot(actor.vx, actor.vz);
    actor.moveFraction = Math.min(1, hs / MOVEMENT.runSpeed);
    if (hs > 0.05) {
      // Local direction: +X right, +Z back (poseCharacter convention).
      actor.moveLocalX = (actor.vx * -fz + actor.vz * fx) / hs;
      actor.moveLocalZ = -(actor.vx * fx + actor.vz * fz) / hs;
    } else { actor.moveLocalX = 0; actor.moveLocalZ = -1; }
  }

  remove(actor: Actor): void {
    const c = this.colliders.get(actor.id);
    if (c) { this.world.removeCollider(c, false); this.colliders.delete(actor.id); }
  }
}
