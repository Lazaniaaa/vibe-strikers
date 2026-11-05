// Browser wallet login (GAME.md 6.8): ask an injected Ethereum wallet (EIP-1193, e.g. MetaMask) to sign the
// login text, then send the signature to the server. Only `eth_requestAccounts` and `personal_sign` are used:
// no transactions, no chain switching. Testnet only (AUTH.network); mainnet is never used.
import { loginMessage } from '../gameplay/walletMessage.ts';
import type { GameNet } from './client.ts';

interface Eip1193 { request(args: { method: string; params?: unknown[] }): Promise<unknown> }

export function browserWallet(): Eip1193 | null {
  const eth = (globalThis as { ethereum?: Eip1193 }).ethereum;
  return eth && typeof eth.request === 'function' ? eth : null;
}

function utf8Hex(text: string): string {
  let s = '0x';
  for (const b of new TextEncoder().encode(text)) s += b.toString(16).padStart(2, '0');
  return s;
}

/** Log in with the browser wallet; resolves with the address. Rejects with a short readable reason. */
export async function loginWithBrowserWallet(net: GameNet): Promise<string> {
  const eth = browserWallet();
  if (!eth) throw new Error('No Ethereum wallet found. Install MetaMask to log in.');
  let address: string;
  let signature: string;
  const issuedAtMs = Date.now();
  try {
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
    if (!accounts?.length) throw new Error('no account');
    address = accounts[0].toLowerCase();
    signature = (await eth.request({ method: 'personal_sign', params: [utf8Hex(loginMessage(address, net.identityHex, issuedAtMs)), address] })) as string;
  } catch (e) {
    const code = (e as { code?: number }).code;
    throw new Error(code === 4001 ? 'Login cancelled in the wallet.' : 'The wallet did not sign. Try again.');
  }
  await net.login(address, issuedAtMs, signature);
  return address;
}
