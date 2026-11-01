// Team pings (GAME.md 9 / 6.2): middle mouse or Z marks the spot you look at for your team.
export const PINGS = {
  /** Seconds a ping marker stays. */
  duration: 5,
  /** Server: at most one ping per player this often (seconds). */
  cooldown: 1.0,
  /** Ray length from the eye (m); also the server's max distance (+ slack). */
  maxDistance: 80,
  serverSlack: 5,
  /** Marker: diamond size (m), beam height (m), colour. Drawn through walls. */
  size: 0.35,
  beamHeight: 2.2,
  color: '#ffe14d',
  /** At most this many markers at once (oldest replaced). */
  maxMarkers: 8,
} as const;
