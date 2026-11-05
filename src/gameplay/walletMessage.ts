// The text a wallet signs to log in (GAME.md 6.8). No crypto here, so the browser can import it cheaply;
// the signature check is in walletAuth.ts.
import { AUTH } from '../config/auth.ts';

/** The exact text the player signs. It names the game session (identity) so it cannot be reused by another one. */
export function loginMessage(address: string, identityHex: string, issuedAtMs: number): string {
  return [
    `${AUTH.appName} sign-in (${AUTH.network} only).`,
    'This signature only proves you own this address. It is not a transaction and costs nothing.',
    `${AUTH.appName} never uses mainnet and never asks for funds.`,
    '',
    `Address: ${address.toLowerCase()}`,
    `Session: ${identityHex.toLowerCase()}`,
    `Issued: ${new Date(issuedAtMs).toISOString()}`,
  ].join('\n');
}

/** 0x1234…abcd for the UI. */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
