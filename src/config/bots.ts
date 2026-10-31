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
  /** Server bots (no Rapier): how fast feet follow the nav-grid ground height, m/s. */
  groundFollowSpeed: 6,
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
  maxSurfaceY: 6,
  /** Walkable surfaces kept per grid cell (ground, stairs, balconies, walkways). */
  layers: 3,
  /** A stair step this much higher than a cell (and only near it) does not block the cell. */
  stepAhead: 0.8,
  /** Cells are wider than stair treads, so neighbouring stair nodes may differ by two risers. */
  stairLinkStep: 0.55,
  /** Upper areas (balconies) used as roam goals: at least this high and this many nodes. */
  upperMinHeight: 1.5,
  upperMinNodes: 12,
} as const;

/** Cover, peeking and routes (GAME.md 7 / owner 2026-10-31). */
export const BOT_TACTICS = {
  /** Go to cover below this HP (and while reloading). */
  lowHp: 45,
  coverCheckInterval: 0.5,
  /** Cover used for peeking must be this close to where the fight started. */
  peekCoverRadius: 6,
  /** Cover searched this far when low on HP. */
  coverSearchRadius: 12,
  /** At most this many cover candidates get a line-of-sight check per search. */
  coverCandidates: 12,
  exposeTimeMin: 1.0,
  exposeTimeMax: 1.8,
  hideTimeMin: 0.6,
  hideTimeMax: 1.2,
  /** In a fight, go to cover to reload when the magazine is below this fraction. */
  reloadInCoverBelow: 0.25,
  /** Seconds to stay hidden when low on HP before peeking again. */
  lowHpHideTime: 2.5,
  /** Cover points: a box at least coverMinHeight above the floor within coverDistance, every coverStride cells. */
  coverDistance: 0.9,
  coverMinHeight: 1.3,
  coverStride: 3,
  /** Routes: zones are north / middle / south of +-routeSplitZ. */
  routeSplitZ: 9,
  /** When picking a roam goal: chance for a point of the bot's route on the enemy side, else the enemy spawn. */
  routeGoalChance: 0.8,
} as const;

/** Bot primaries (owner 2026-11-01): random, at most LOADOUT.maxSnipersPerTeam snipers per team. */
export const BOT_LOADOUT = {
  /** Relative chance of each primary. */
  weights: { rifle: 0.5, shotgun: 0.3, sniper: 0.2 },
} as const;

/** Weapon roles: snipers hold balconies and long sight lines, shotguns push close. */
export const BOT_ROLES = {
  /** Sniper: switch to the pistol when the target is closer than this (m). */
  sniperPistolRange: 7,
  /** Sniper: seconds to hold a perch (balcony) before moving to another. */
  sniperHoldMin: 6,
  sniperHoldMax: 12,
  /** Sniper: chance to pick a perch (balcony) as the next roam goal instead of a route point. */
  sniperPerchChance: 0.85,
  /** Sniper spots: sheltered spots (cover points) with a clear view at least this long (m) along one direction. */
  sniperMinSight: 22,
  sniperSightMax: 60,
  /** At most this many sniper spots, at least this far apart (m). */
  sniperSpots: 16,
  sniperSpotSpacing: 5,
  /** A sniper spot is used by a team if its view points toward the enemy spawn (cosine at least this). */
  sniperFacingCos: 0.6,
  /** Shotgun: keep pushing toward the target until this close (m). */
  shotgunPushRange: 4,
  /** Shotgun: do not shoot from farther than this (m). */
  shotgunFireRange: 14,
} as const;

export type BotDifficulty = 'easy' | 'normal' | 'hard';

/** Per-difficulty skill (owner 2026-10-31): Quick Play uses normal. */
export interface BotSkill {
  reactionTimeMin: number;
  reactionTimeMax: number;
  /** Random aim error, degrees. */
  aimErrorDeg: number;
  headAimChance: number;
  burstMin: number;
  burstMax: number;
  burstPause: number;
  turnRateDeg: number;
  /** Chance to fight from cover (peek / hide) instead of standing in the open. */
  coverChance: number;
}

export const BOT_SKILLS: Readonly<Record<BotDifficulty, BotSkill>> = {
  easy: { reactionTimeMin: 0.6, reactionTimeMax: 0.95, aimErrorDeg: 3.2, headAimChance: 0.05, burstMin: 4, burstMax: 9, burstPause: 0.25,
    turnRateDeg: 220, coverChance: 0.25 },
  normal: { reactionTimeMin: BOTS.reactionTimeMin, reactionTimeMax: BOTS.reactionTimeMax, aimErrorDeg: BOTS.aimErrorDeg,
    headAimChance: BOTS.headAimChance, burstMin: BOTS.burstMin, burstMax: BOTS.burstMax, burstPause: BOTS.burstPause,
    turnRateDeg: BOTS.turnRateDeg, coverChance: 0.65 },
  hard: { reactionTimeMin: 0.22, reactionTimeMax: 0.38, aimErrorDeg: 0.9, headAimChance: 0.35, burstMin: 2, burstMax: 4, burstPause: 0.4,
    turnRateDeg: 480, coverChance: 0.9 },
};

export const DEFAULT_DIFFICULTY: BotDifficulty = 'normal';

/** Display names for offline bots. */
export const BOT_NAMES = ['Bolt', 'Pixel', 'Nova', 'Rook', 'Vexa', 'Mango', 'Juno', 'Ziggy'] as const;
