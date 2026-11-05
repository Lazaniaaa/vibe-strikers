// Global game settings. Gameplay numbers only live under src/config/.

/** Active map id from src/maps (`mapIds`). One line to switch lanes. */
export const MAP_ID = 'toy-town-l1-r1';

/** Lobby-only presentation. No gameplay values; scene tuning and UI colours live here. */
export const MENU = {
  palette: { ink: '#253644', panel: '#FFF8E9', panelLight: '#F1E7D4', cream: '#FFFCF4',
    muted: '#65727A', line: '#253644', accent: '#FFB83D', accentDark: '#C88024',
    teal: '#68C9D0', sky: '#A8D2E6', portrait: '#BDD9DF', ring: '#89E9E3', shadow: '#172D3E',
    key: '#FFF3DF', rim: '#B9E7FF', error: '#A03A32', errorBg: '#FFE1D7' },
  displayFont: "'Lilita One', 'Arial Rounded MT Bold', system-ui, sans-serif",
  lazyDelayMs: 32, prefetchDelayMs: 800, nameMaxLength: 16, codeMaxLength: 5,
  turntableSpeed: 0.065, initialYaw: -0.18, idleYawRange: 0.18, maxDelta: 0.05, timeScale: 0.001,
  exposure: 1, minPixelRatio: 1, maxPixelRatio: 1.25,
  sky: { size: 2, top: '#0099DB', horizon: '#C0CBDC' },
  world: { fov: 31, near: 0.1, far: 160, position: [1.4, 2.7, -7.5], target: [0, 0.75, 0],
    driftSpeed: 0.07, driftX: 0.07, driftZ: 0.035, driftY: 0.025 },
  hero: { keyPosition: [1, 3, -5], keyIntensity: 2.6, rimPosition: [-3, 3, 2], rimIntensity: 1.1 },
  light: { sun: { color: '#EAD4AA', intensity: 2.5, position: [-3, 6, -4] },
    ambient: { color: '#C0CBDC', intensity: 0.75 },
    hemisphere: { sky: '#C0CBDC', ground: '#B86F50', intensity: 0.65 } },
  clouds: { speed: 0.025, driftX: 0.7, driftZ: 0.2 },
  portrait: { size: 128, intervalMs: 0, perBatch: 2, fov: 33, near: 0.1, far: 20,
    position: [2.7, 2.15, -4.5], target: [0, 1.05, 0], yaw: -0.12, pixelDelta: 12, minimumPixels: 128 },
  shadow: { size: 1024, extent: 2.5, near: 0.5, far: 15, bias: -0.00008, normalBias: 0.018 },
  metrics: { interval: 1, warmupFrames: 30 },
  review: { frames: 3, intervalMs: 200, buttonLeft: 28, buttonBottom: 88 },
  animationReview: { size: 192, labelHeight: 24, columns: 3, span: 3.5, targetY: 1.05,
    camera: [1.2, 1.9, -5], near: .1, far: 20, step: 1/60, idleTimes: [0, 1.4, 2.8],
    emoteFractions: [.2, .5, .8], examples: [3, 0, 18], font: '12px system-ui',
    buttonLeft: 28, buttonBottom: 122 },
} as const;

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

/**
 * Auto resolution (setting "Auto resolution", default on): every `window` seconds the average FPS is checked.
 * Below `lowFps` -> one pixel-ratio level down; `highFps` or more for `upAfter` seconds -> one level up.
 * The GPU frame time (WebGL timer query, when the browser has it) decides: low FPS with an idle GPU (CPU bound,
 * browser frame cap) never lowers the resolution, and a raise happens only when the scaled GPU time still fits.
 * A raise that drops FPS again is not retried for `retryAfter` seconds. Levels above the start ratio (screen DPR capped by
 * RENDER.maxPixelRatio) are skipped.
 */
export const AUTO_RESOLUTION = {
  levels: [1.5, 1.25, 1, 0.85, 0.75],
  window: 1,
  lowFps: 52,
  highFps: 58,
  upAfter: 8,
  /** GPU ms per frame: below this, low FPS is not the GPU's fault (no drop). 16.7 ms = 60 FPS. */
  gpuBusyMs: 12,
  /** Predicted GPU ms per frame after a raise must stay below this. */
  gpuRaiseMs: 11,
  /** Timer queries in the fixed pool (results arrive a few frames late). */
  gpuQueries: 8,
  /** No decisions during the first seconds (loading, shader compile), seconds. */
  warmup: 3,
  /** Windows skipped after every change (render targets are re-created, FPS settles). */
  settleWindows: 1,
  /** A "do not raise above / do not drop below" limit is forgotten after this many seconds. */
  retryAfter: 30,
  /** Frames longer than this (tab switch, loading hitch) restart the current window, seconds. */
  maxFrameTime: 0.25,
} as const;

/** GPU names that mean built-in (integrated) graphics: the settings panel then shows the "High performance" hint. */
export const INTEGRATED_GPU = /intel|uhd|iris|radeon\(tm\) graphics|radeon graphics|vega \d|adreno|mali/i;
