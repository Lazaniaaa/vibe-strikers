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
  /** Loot pedestal (Cornucopia): a solid box under the item (client KCC, server validation and bot nav). */
  pedestalSize: 0.7,
  pedestalHeight: 0.5,
  pedestalColor: '#c9b48a',
} as const;

/** Cornucopia (GAME.md 2.2) on the map's lootSpots. All numbers of the mode live here. */
export const CORNUCOPIA = {
  /** What each loot tier holds, assigned to the tier's spots in turn. */
  loot: {
    low: ['ammo', 'shotgun', 'medkit'],
    mid: ['rifle', 'medkit'],
    high: ['sniper', 'boots', 'medkit', 'medkit'],
  } as Readonly<Record<'low' | 'mid' | 'high', readonly string[]>>,
  /** Start: knife + pistol with one magazine. */
  pistolMag: 12,
  pistolReserve: 0,
  /** Pistol rounds in one ammo box. */
  ammoAmount: 24,
  /** Medkit (owner: the only way to regain HP): heals medkitHeal HP over medkitTime seconds. */
  medkitHeal: 60,
  medkitTime: 3,
  /** Rocket boots: extra jumps in the air for the rest of the match. */
  bootsAirJumps: 1,
  bootsJumpVelocity: 7.5,
  /** Glow box under the feet while boosting (placeholder until the character has boot sockets). */
  glowSize: 0.5,
  glowHeight: 0.12,
  glowColor: '#ffb030',
  /** Seconds the glow stays after a boost. */
  glowTime: 0.6,
} as const;

export type LootKind = 'weapon' | 'ammo' | 'medkit' | 'boots';
