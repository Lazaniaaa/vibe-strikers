// Global game settings. Gameplay numbers only live under src/config/.

/** Active map id from src/maps (`mapIds`). One line to switch lanes. */
export const MAP_ID = 'toy-town-l1-r1';

export const CAMERA = {
  /** Default hip FOV in degrees (settings may change it later). */
  fov: 70,
  near: 0.05,
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
  shadowExtent: 40,
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
} as const;

export const LOCAL_PLAYER = {
  name: 'You',
  /** Index into the characters list until character select exists (M3). */
  characterIndex: 0,
} as const;

/** Third-person character posing (visual only, never on the server). */
export const POSE = {
  /**
   * Characters whose firearm hold solver costs 100-1200 ms per poseCharacter call (measured
   * 2026-10-30, see docs/PROGRESS.md). Bots never use them until the asset owner fixes it.
   */
  botCharacterExclude: ['vibe-vibers-viber-142', 'vibe-vibers-bureau-roll-40-10'] as readonly string[],
  /** A rig whose firearm pose ever takes longer than this switches to the cheap no-weapon pose. */
  slowCallMs: 12,
  /** Dead bodies are posed this many frames, then left alone. */
  deadPoseFrames: 2,
} as const;
