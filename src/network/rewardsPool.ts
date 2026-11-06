// Live STRIKE balance of the WeeklyDistributor (GAME.md 6.9), read with one eth_call to the public testnet RPC.
// Read only: no wallet, no transaction. Cached for REWARDS.poolRefreshMs; null while unknown or on errors.
import { REWARDS } from '../config/rewards.ts';
import { callData, decodeUint } from './evm.ts';

let balance: bigint | null = null;
let readAt = -Infinity;
let pending: Promise<bigint | null> | null = null;

/** Last known balance (base units), or null. */
export function poolBalance(): bigint | null { return balance; }

/** Explorer page of the distributor ('' before it is deployed). */
export function poolExplorerUrl(): string {
  return REWARDS.distributor ? `${REWARDS.chain.explorer}/address/${REWARDS.distributor}` : '';
}

/** Re-read the balance when the cached one is older than poolRefreshMs; resolves with the newest value. */
export function refreshPoolBalance(): Promise<bigint | null> {
  if (!REWARDS.distributor) return Promise.resolve(null);
  if (pending) return pending;
  if (performance.now() - readAt < REWARDS.poolRefreshMs) return Promise.resolve(balance);
  pending = fetch(REWARDS.chain.rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: REWARDS.distributor, data: callData('balance()') }, 'latest'] }),
  }).then((r) => r.json() as Promise<{ result?: string }>)
    .then((j) => { if (typeof j.result === 'string') { balance = decodeUint(j.result); readAt = performance.now(); } return balance; })
    .catch(() => balance)
    .finally(() => { pending = null; });
  return pending;
}
