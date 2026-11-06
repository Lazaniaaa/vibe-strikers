// In-game marketplace (GAME.md 6.7, owner 2026-11-05): coins only, no real money. Gameplay economy numbers.
export type RarityId = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const MARKET = {
  /** Coins in a new wallet. */
  startCoins: 200,
  /** Starter set for a new player (distinct catalog items, random). */
  starter: { characters: 3, emotes: 1 },
  /** Coins per match (humans only, paid at match end). */
  reward: { win: 50, loss: 20, kill: 5, headshot: 2, matchCap: 150, firstWinOfDay: 50,
    /** A match pays only with at least this many players in the room at the end (bots count) ... */
    minPlayers: 2,
    /** ... and only if it lasted this long (seconds from the match start): no farming of empty or instant matches. */
    minMatchSeconds: 60 },
  /** Allowed listing price, integer coins. */
  price: { min: 10, max: 5000 },
  /** Share of every sale that is burned (taken out of the economy); at least 1 coin. */
  feeRate: 0.05,
  /** Open listings per seller. */
  maxListingsPerSeller: 20,
  /** Market reducers per identity: at most `actions` within `windowMs`. */
  rateLimit: { actions: 8, windowMs: 2000 },
  /** Trades kept in the `trade` table (oldest are deleted). */
  tradeHistory: 500,
  /** How long the "item sold" notice stays in the lobby. */
  saleNoticeMs: 7000,
  /**
   * How rare a catalog item is (visual label for the market, no gameplay effect). `tiers` run from most common to
   * rarest. Items in `items` have a fixed tier: emotes given to new players stay common, season rewards are high and
   * legendary comes only from there. Every other item gets a stable tier from its id by `weights` (percent), so changing
   * the weights moves items between tiers. `mythic` is kept for season NFTs (GAME.md 6.7).
   */
  rarity: {
    tiers: ['common', 'rare', 'epic', 'legendary', 'mythic'] as readonly RarityId[],
    weights: { common: 83, rare: 12, epic: 5 },
    items: {
      'emote:wave': 'common',
      'emote:shrug': 'common',
      'emote:hop': 'rare',
      'emote:dance': 'epic',
      'emote:cheer': 'legendary',
      'character:vibe-vibers-viber-142': 'rare',
      'character:vibe-vibers-bureau-25': 'epic',
      'character:vibe-vibers-viber-extra-20': 'legendary',
    } as Readonly<Record<string, RarityId>>,
    /** New players' starter set contains nothing above this tier. */
    starterMax: 'common' as RarityId,
    /** Price suggested when an item has no listing and no sale yet (coins). */
    basePrice: { common: 50, rare: 200, epic: 400, legendary: 800, mythic: 2000 } as Readonly<Record<RarityId, number>>,
  },
} as const;
