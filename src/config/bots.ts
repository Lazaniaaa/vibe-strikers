// Bot behaviour numbers (M1 offline bots; reused by the server in M2).

export const BOTS = {
  /** How often a bot re-checks what it can see, seconds. */
  thinkInterval: 0.1,
  visionRange: 55,
  /** Full field of view, degrees. */
  visionFovDeg: 120,
  /** Delay between first seeing an enemy and the first shot, seconds (random in range). */
  reactionTimeMin: 0.35,
  reactionTimeMax: 0.6,
  /** Turn speed while aiming, degrees per second. */
  turnRateDeg: 360,
  /** Shoot only when aim error is below this, degrees. */
  fireConeDeg: 4,
  /** Extra random aim error, degrees (the weapon spread is added on top). */
  aimErrorDeg: 1.6,
  /** Chance that a bot aims at the head instead of the body. */
  headAimChance: 0.2,
  /** Rifle burst length (shots) and pause between bursts, seconds. */
  burstMin: 3,
  burstMax: 6,
  burstPause: 0.35,
  /** Seconds a bot remembers where it last saw an enemy. */
  memoryTime: 4,
  /** Bots move slower than players while engaging. */
  engageMoveScale: 0.45,
  repathInterval: 1.5,
  /** At most this many A* searches per simulation tick for all bots together (no round-start spike). */
  maxPathsPerTick: 2,
  /** If a bot moved less than this in stuckTime seconds, it repaths. */
  stuckDistance: 0.4,
  stuckTime: 1.0,
  waypointReach: 0.6,
} as const;

/** Navigation grid built from mapColliders (bots only walk the lowest level). */
export const NAV_GRID = {
  cell: 0.5,
  /** Agent radius used to inflate blocked cells. */
  agentRadius: 0.5,
  agentHeight: 1.8,
  /** Max height difference between neighbouring cells. */
  maxStep: 0.4,
  /** Surfaces higher than this are never walkable for bots. */
  maxSurfaceY: 3.5,
} as const;

/** Display names for offline bots. */
export const BOT_NAMES = ['Bolt', 'Pixel', 'Nova', 'Rook', 'Vexa', 'Mango', 'Juno', 'Ziggy'] as const;
