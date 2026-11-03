// Global game settings. Gameplay numbers only live under src/config/.

/** Active map id from src/maps (`mapIds`). One line to switch lanes. */
export const MAP_ID = 'toy-town-l1-r1';

export const CAMERA = {
  /** Default hip FOV in degrees (settings may change it later). */
  fov: 70,
  /**
   * World near plane, metres. 0.1 (was 0.05) doubles depth precision (less z-fighting far away); safe because the eye
   * is never closer than ~0.18 m to a box (capsule radius 0.45, crouch ceiling) and the viewmodel has its own camera.
   */
  near: 0.1,
  far: 180,
  /** Eye height above the feet, metres. */
  eyeHeight: 1.62,
} as const;

/** Viewmodel pass: fixed FOV, like the weapons preview. */
export const VIEWMODEL_CAMERA = { fov: 70, near: 0.05, far: 20 } as const;

/** Render budget (see docs/PROGRESS.md). Checked in the smoke test and later in the HUD. */
export const RENDER_BUDGET = {
  maxTriangles: 200_000,
  maxDrawCalls: 120,
} as const;

export const RENDER = {
  shadows: true,
  shadowMapSize: 2048,
  /** Half-size of the sun's orthographic shadow camera, metres (covers the 70 x 70 m map). */
  shadowExtent: 48,
  /** Distance of the sun light from the map centre along its direction. */
  sunDistance: 60,
  /** Cap on devicePixelRatio (performance on high-DPI laptops). */
  maxPixelRatio: 1.5,
} as const;

/** Visual effect timings (not gameplay). */
export const EFFECTS = {
  tracerLife: 0.05,
  tracerWidth: 0.025,
  tracerPool: 32,
  impactLife: 0.35,
  impactSize: 0.08,
  impactPool: 32,
  muzzleFlashFraction: 0.5,
  viewPunchRecover: 14,
  hitMarkerTime: 0.18,
  damageFlashTime: 0.35,
  /**
   * Camera shake when the local player is hit (trauma model): each hit adds trauma (more for more damage), trauma
   * decays per second, the shake = max x trauma² x smooth noise. Roll + a small position offset only, so the
   * crosshair keeps pointing where the shot will go.
   */
  shake: {
    traumaMin: 0.35,
    /** Extra trauma per point of damage (100 damage = +0.3). */
    traumaPerDamage: 0.003,
    decayPerSecond: 1.6,
    maxRollDeg: 4,
    maxOffset: 0.06,
    /** Noise frequencies, Hz (two sines per axis, so the motion is smooth, not random jitter). */
    freq: [17, 23, 29],
  },
  /** Voxel chips flying off a bullet impact (one instanced mesh, pooled). */
  chips: {
    pool: 128,
    perWorldHit: 6,
    perPlayerHit: 8,
    perHeadshot: 12,
    size: 0.06,
    /** Random size factor range (min, max) applied to `size`. */
    sizeRange: [0.6, 1.2],
    life: 0.45,
    /** Launch speed range, m/s: partly back toward the shooter (`back*`) plus a random sideways spread and lift. */
    speed: [1.2, 3],
    backWorld: 0.6,
    backPlayer: 0.15,
    spread: 0.8,
    upBias: 1.2,
    gravity: 12,
    worldColor: '#7d7264',
    playerColor: '#fff1a8',
    headshotColor: '#ff8a5c',
  },
} as const;

export const LOCAL_PLAYER = {
  name: 'You',
  /** Index into the characters list until character select exists (M3). */
  characterIndex: 0,
} as const;

/** Third-person character posing (visual only, never on the server). */
export const POSE = {
  /** Character ids bots must not use (empty: the asset owner fixed the slow holds on 2026-10-31). */
  botCharacterExclude: [] as readonly string[],
  /** Silent safety net: a rig whose firearm pose ever takes longer than this uses the no-weapon pose. */
  slowCallMs: 12,
  /** Dead bodies are posed this many frames, then left alone. */
  deadPoseFrames: 2,
} as const;

/** After death (GAME.md 2.1): killcam from the killer's view, then spectate living teammates. */
export const KILLCAM = { duration: 3 } as const;

/**
 * Team colours as seen by the local player (same in name tags, kill feed, scoreboard, death markers).
 * Blue vs orange-red with different brightness stays distinguishable for common colour blindness.
 */
export const TEAM_COLORS = {
  ally: '#4fb6ff',
  enemy: '#e8452c',
} as const;

/** Dead bodies: death pose for bodyTime, sinking during the last sinkTime, then hidden (marker stays). */
export const DEATH = {
  bodyTime: 1.0,
  sinkTime: 0.35,
  sinkDepth: 0.7,
  marker: { size: 0.8, height: 0.02, opacity: 0.5, crossLength: 0.55, crossWidth: 0.1, crossOpacity: 0.85, lift: 0.02 },
} as const;

/** Name tags above players (ally: always, through walls; enemy: only in line of sight near the crosshair). */
export const NAME_TAGS = {
  /** Tag anchor above the feet, metres (above the ally marker). */
  height: 2.45,
  /** Tags fade out between fadeStart and maxDistance (metres). */
  fadeStart: 30,
  maxDistance: 40,
  /** Scale 1 at refDistance, clamped to [minScale, maxScale]. */
  refDistance: 8,
  minScale: 0.6,
  maxScale: 1,
  /** Enemy tag only within this angle from the crosshair (degrees). */
  enemyMaxAngleDeg: 7,
  /** Line-of-sight target on the enemy: this height above the feet. */
  enemyAimHeight: 1.35,
} as const;
/** All render tuning lives here; no gameplay values. */
export const LIGHTING = {
  baseline: { radius: 1, extent: 40, bias: -0.0005, normalBias: 0.03 },
  actorShadowParts: ['head-boxes', 'torso-boxes'] as readonly string[],
  /** Frames between re-applying the actor / weapon shadow policy (new rigs appear rarely). */
  shadowPolicyEvery: 15,
  exposure: 1, shadowBias: -0.0002, shadowNormalBias: 0.025, shadowRadius: 2,
  shadowNear: 1, shadowFar: 140, skySize: 2, skyRise: 0.65,
  ao: { radius: 0.65, falloff: 1, intensity: 1.8, samples: 8, denoiseSamples: 4, denoiseRadius: 6, denoiseIterations: 1, halfRes: true },
  review: { frames: 90, warmup: 30, width: 1280, height: 720,
    views: [
      { id: 'spawn-a', position: [-28.5, 2.12, -5], target: [-22, 1.8, 5] },
      { id: 'fountain', position: [-8, 3, -8], target: [0, 1, 1] },
      { id: 'balcony', position: [-8, 4.12, -16], target: [0, 1.5, 0] },
      { id: 'spawn-b', position: [28.5, 2.12, -5], target: [22, 1.8, 5] },
    ],
  },
} as const;
