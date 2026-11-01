// Player movement numbers (GAME.md section 3). Used by the Rapier KCC motor.

export const MOVEMENT = {
  runSpeed: 5.5,
  walkSpeed: 2.6,
  crouchSpeed: 2.2,
  gravity: 22,
  jumpVelocity: 7.0,
  /** Fraction of ground control while airborne. */
  airControl: 0.3,
  /** Horizontal acceleration on the ground, m/s². */
  groundAccel: 60,
  /** Small downward speed while grounded so snap-to-ground keeps contact. */
  groundStickSpeed: 1,
  /** Max fall speed, m/s. */
  maxFallSpeed: 40,
  /** Coyote time: a jump still works this long after running off a ledge, s. */
  coyoteTime: 0.1,
  /** Jump buffer: a jump pressed this long before landing fires on landing, s. */
  jumpBufferTime: 0.1,
} as const;

export const CAPSULE = {
  radius: 0.45,
  height: 1.8,
  crouchHeight: 1.3,
  eyeHeight: 1.62,
  crouchEyeHeight: 1.12,
  /** Eye height change speed when crouching, m/s. */
  crouchTransitionSpeed: 6,
} as const;

/** Rapier KinematicCharacterController settings. */
export const KCC = {
  offset: 0.02,
  autostepMaxHeight: 0.35,
  autostepMinWidth: 0.15,
  snapToGround: 0.3,
  maxSlopeClimbDeg: 46,
  minSlopeSlideDeg: 50,
} as const;

/** Largest simulation step; slower frames are simulated in slow motion instead of tunnelling. */
export const MAX_FRAME_DT = 0.05;
