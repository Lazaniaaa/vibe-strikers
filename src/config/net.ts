// Networking numbers (GAME.md 6). Shared by client and server.

export const NET = {
  /** Default SpacetimeDB address for local play; the page can override it with ?server=ws://host:port. */
  serverUri: 'ws://127.0.0.1:3000',
  databaseName: 'voxel-arena',
  /** Client sends its movement this many times per second. */
  sendRateHz: 30,
  /** Server tick (bots, rounds) per second. */
  tickRateHz: 30,
  interpolationDelayMs: 100,
  maxRewindMsPublic: 250,
  maxRewindMsPrivate: 300,
  roomCodeLength: 5,
  /** Characters used in room codes (no 0/O/1/I). */
  roomCodeAlphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  nameMinLength: 3,
  nameMaxLength: 16,
} as const;

/** Server-side validation of client movement (GAME.md 6.6). */
export const MOVE_CHECK = {
  /** Allowed horizontal speed = state speed x this. */
  speedTolerance: 1.2,
  /** Extra seconds of movement allowed per message, for network bunching. */
  burstSlack: 0.2,
  /** The elapsed time used for checks is capped (a long pause does not allow a long jump). */
  maxElapsed: 0.5,
  /** Any single message moving further than this is a teleport. */
  teleportDistance: 4,
  /** Extra upward metres allowed per message (steps, landing on stairs). */
  verticalSlack: 0.45,
  /** The capsule may touch a box by this much (KCC skin offset + float error). */
  capsulePenetration: 0.08,
} as const;
