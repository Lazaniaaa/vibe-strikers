// Wallet login (owner 2026-11-05/06): sign a text message with an Ethereum wallet (EIP-191 personal_sign).
// No transactions, no chain calls. Testnet only: Robinhood Chain testnet (an Ethereum L2); mainnet is never used.
export const AUTH = {
  /** Shown in the message the wallet asks to sign. */
  appName: 'Vibe Strikers',
  network: 'Robinhood Chain testnet',
  /** A signed login message is accepted only this long after its issue time ... */
  maxAgeMs: 5 * 60 * 1000,
  /** ... and at most this far in the future (clock difference between the browser and the server). */
  maxClockSkewMs: 60 * 1000,
  /** Login attempts per identity: at most `actions` within `windowMs`. */
  rateLimit: { actions: 5, windowMs: 10_000 },
} as const;
