/** Dependency-free metadata: safe to import before the lazy Three.js lobby chunk. */
export const LOBBY_EMOTES = [
  { id: 'wave', name: 'Wave', duration: 2.2 },
  { id: 'cheer', name: 'Cheer', duration: 1.8 },
  { id: 'dance', name: 'Dance', duration: 3.2 },
  { id: 'shrug', name: 'Shrug', duration: 1.8 },
  { id: 'hop', name: 'Joy hop', duration: 1.4 },
] as const;
export type LobbyEmoteId = typeof LOBBY_EMOTES[number]['id'];

/** Radians/metres/seconds. Deliberately separate from all match pose tuning. */
export const LOBBY_ANIMATION = {
  tau: Math.PI * 2, maxDelta: .1, blend: .2,
  idlePeriod: 4.2, glancePeriod: 8.8, glanceGatePeriod: 10.4,
  breathing: .006, breathingScale: .008, weightShift: .012, armSway: .025,
  relaxedPitch: .035, relaxedRoll: .06, minimumRollStep: .01, maximumRelaxedRoll: 1.25,
  floorMargin: .025, clearance: .006, axisEpsilon: 1e-9,
  headYaw: .12, headPitch: .018, torsoPitch: .009,
  waveRoll: 2.04, waveSway: .1, wavePitch: .07, waveCycles: 2.5,
  cheerRoll: 2.08, cheerSway: .06, cheerCycles: 2, cheerBounce: .025,
  danceRoll: .52, dancePitch: .12, danceYaw: .1, danceShift: .035,
  danceCycles: 2, danceLegPitch: .12, danceLegRoll: .045, danceFootLift: .035,
  shrugRoll: .64, shrugLift: .035, shrugHead: .09,
  hopHeight: .16, hopRoll: 1.35, hopLegPitch: .08,
  seedOffset: 2166136261, seedPrime: 16777619, seedRange: 4294967296,
} as const;
