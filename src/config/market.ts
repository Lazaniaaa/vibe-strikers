// In-game marketplace (GAME.md 6.7, owner 2026-11-05): coins only, no real money. Gameplay economy numbers.
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
} as const;
