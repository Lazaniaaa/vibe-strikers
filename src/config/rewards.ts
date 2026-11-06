// Weekly STRIKE token rewards (owner 2026-11-06, GAME.md 6.9). Testnet only: Robinhood Chain testnet. Points come
// from online matches of logged-in players; the owner pays each finished week from the distributor contract with
// the local admin page (client/admin.html). Players never sign a transaction.

const DAY_MS = 24 * 60 * 60 * 1000;

export const REWARDS = {
  token: {
    symbol: 'STRIKE',
    /** The owner's ERC-20 on Robinhood Chain testnet (18 decimals, supply 1 000 000 000). */
    address: '0x472E0121ac3BBC3474477B8319e8402a65FAC1fA',
    decimals: 18,
  },
  chain: {
    id: 46630,
    name: 'Robinhood Chain testnet',
    rpc: 'https://rpc.testnet.chain.robinhood.com',
    explorer: 'https://explorer.testnet.chain.robinhood.com',
  },
  /** WeeklyDistributor contract (contracts/WeeklyDistributor.sol), deployed and funded by the owner 2026-11-06. */
  distributor: '0x5da751e2e288a5e1e8c6a80be24caac67ab988fb',
  /** Points per counted event in the week. */
  points: { win: 10, match: 2, kill: 1, headshot: 1 },
  /** Weeks start Monday 00:00 UTC (the Unix epoch was a Thursday, so 4 days in). */
  weekStartOffsetMs: 4 * DAY_MS,
  weekMs: 7 * DAY_MS,
  /** Pool shown in LEADERS for the current week (owner: 10% of supply, may all go out in week 1). */
  weekPoolTokens: 100_000_000,
  /** At most this share of a week's pool per wallet (basis points: 1000 = 10%). The rest stays in the contract. */
  maxShareBps: 1000,
  /** Wallets with fewer points in the week get nothing. */
  minPoints: 10,
  /** LEADERS re-reads the distributor's live balance from the RPC at most this often. */
  poolRefreshMs: 60_000,
  /** Recipients per distribute() transaction (about 51k gas each, so about 5M gas per transaction). */
  batchSize: 100,
} as const;
