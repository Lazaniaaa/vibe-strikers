// Items on the ground: weapon drops (Elimination, GAME.md 2.1) and Cornucopia loot (GAME.md 2.2).

export const ITEMS = {
  /** Horizontal distance (m) from the feet within which E picks an item up. */
  pickupRadius: 1.6,
  /** Max height difference (m) between the feet and the item. */
  pickupMaxDy: 1.4,
  /** Extra distance the server allows (network delay between client and server positions). */
  serverSlack: 0.8,
  /** Oldest drops are removed above this count per room. */
  maxDropsPerRoom: 16,
  /** Rendering: model height above the floor, spin (rad/s), bob. */
  modelHeight: 0.55,
  spinSpeed: 1.4,
  bobHeight: 0.06,
  bobSpeed: 2.2,
  /** Weapon models on the ground are scaled up a little so they are easy to see. */
  weaponScale: 1.0,
} as const;
