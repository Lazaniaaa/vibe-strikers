// Hit volumes (GAME.md section 3). IDENTICAL for every character, separate from the capsule.
// Boxes are centred on the player's feet position (x, z) and rotate with yaw.

export const HITBOXES = {
  head: { w: 0.9, h: 0.9, d: 0.8, cy: 1.35 },
  body: { w: 0.9, h: 0.89, d: 0.6, cy: 0.445 },
  headshotMultiplier: 2.5,
  /** Crouching scales both boxes vertically by crouchHeight / height. */
  crouchScale: 1.3 / 1.8,
} as const;

export type HitPart = 'head' | 'body';
