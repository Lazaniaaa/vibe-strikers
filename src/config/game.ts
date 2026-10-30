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
