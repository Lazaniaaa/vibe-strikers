// Tiny Ethereum ABI helpers for the weekly-rewards admin page and the contract tests (GAME.md 6.9): call data for
// the few types used (address, uint256, string, address[], uint256[]) and decoding of single return words. No chain calls.
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export type AbiArg =
  | { type: 'address'; value: string }
  | { type: 'uint256'; value: bigint }
  | { type: 'string'; value: string }
  | { type: 'bytes'; value: string }
  | { type: 'address[]'; value: readonly string[] }
  | { type: 'uint256[]'; value: readonly bigint[] };

const MAX_U256 = (1n << 256n) - 1n;

function uintWord(n: bigint): string {
  if (n < 0n || n > MAX_U256) throw new Error(`uint256 out of range: ${n}`);
  return n.toString(16).padStart(64, '0');
}
function addressWord(a: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error(`not an address: ${a}`);
  return a.slice(2).toLowerCase().padStart(64, '0');
}

/** 4-byte function selector of a signature such as "transfer(address,uint256)" (hex, no 0x). */
export function selector(signature: string): string {
  return bytesToHex(keccak_256(utf8ToBytes(signature))).slice(0, 8);
}

/** ABI-encoded arguments (hex, no 0x). */
export function encodeArgs(args: readonly AbiArg[]): string {
  const heads: string[] = [], tails: string[] = [];
  let tailBytes = 32 * args.length;
  for (const a of args) {
    if (a.type === 'address') heads.push(addressWord(a.value));
    else if (a.type === 'uint256') heads.push(uintWord(a.value));
    else if (a.type === 'string' || a.type === 'bytes') {
      heads.push(uintWord(BigInt(tailBytes)));
      const hex = a.type === 'string' ? bytesToHex(utf8ToBytes(a.value)) : a.value.replace(/^0x/, ''), words = Math.ceil(hex.length / 64);
      tails.push(uintWord(BigInt(hex.length / 2)) + hex.padEnd(words * 64, '0'));
      tailBytes += 32 * (words + 1);
    } else {
      heads.push(uintWord(BigInt(tailBytes)));
      const items = a.type === 'address[]' ? a.value.map((v) => addressWord(v)) : a.value.map((v) => uintWord(v));
      tails.push(uintWord(BigInt(items.length)) + items.join(''));
      tailBytes += 32 * (items.length + 1);
    }
  }
  return heads.join('') + tails.join('');
}

/** Call data for a function: 0x + selector + arguments. */
export function callData(signature: string, args: readonly AbiArg[] = []): string {
  return `0x${selector(signature)}${encodeArgs(args)}`;
}

/** First return word as a uint256 ('0x' or empty = 0). */
export function decodeUint(hex: string): bigint {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  return h ? BigInt(`0x${h.slice(0, 64)}`) : 0n;
}
/** First return word as an address (lowercase). */
export function decodeAddress(hex: string): string {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  return `0x${h.slice(24, 64).toLowerCase()}`;
}
