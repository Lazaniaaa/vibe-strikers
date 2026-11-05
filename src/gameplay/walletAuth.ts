// Wallet login check (GAME.md 6.8): the text a wallet signs and the EIP-191 signer recovery. Pure; used by the
// server module (verify) and by the tests (sign with test keys). The browser signs through the wallet itself.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { AUTH } from '../config/auth.ts';
import { loginMessage } from './walletMessage.ts';

export { loginMessage };

const utf8 = new TextEncoder();
const HEX = /^0x[0-9a-fA-F]*$/;

function hexBytes(hex: string): Uint8Array {
  const h = hex.slice(2);
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesHex(b: Uint8Array): string {
  let s = '0x';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

/** keccak256("\x19Ethereum Signed Message:\n" + byteLength + message), as personal_sign hashes it. */
export function personalHash(message: string): Uint8Array {
  const body = utf8.encode(message);
  const prefix = utf8.encode(`\x19Ethereum Signed Message:\n${body.length}`);
  const all = new Uint8Array(prefix.length + body.length);
  all.set(prefix);
  all.set(body, prefix.length);
  return keccak_256(all);
}

/** Lowercase 0x address of an uncompressed (65-byte) public key. */
export function addressOfPublicKey(uncompressed: Uint8Array): string {
  return bytesHex(keccak_256(uncompressed.slice(1)).slice(-20));
}

export function isAddress(a: string): boolean { return a.length === 42 && HEX.test(a); }

/** The address that signed `message` (personal_sign, 65-byte r|s|v hex), or null if the signature is malformed. */
export function recoverSigner(message: string, signatureHex: string): string | null {
  if (signatureHex.length !== 132 || !HEX.test(signatureHex)) return null;
  try {
    const raw = hexBytes(signatureHex);
    const v = raw[64];
    const recovery = v >= 27 ? v - 27 : v;
    if (recovery !== 0 && recovery !== 1) return null;
    const sig = secp256k1.Signature.fromBytes(raw.slice(0, 64), 'compact').addRecoveryBit(recovery);
    if (sig.hasHighS()) return null; // reject malleable signatures (wallets always produce low-S)
    return addressOfPublicKey(sig.recoverPublicKey(personalHash(message)).toBytes(false));
  } catch {
    return null;
  }
}

/** Why a login must be refused, or '' if it is valid. `nowMs` is the server time. */
export function loginError(address: string, identityHex: string, issuedAtMs: number, signatureHex: string, nowMs: number): string {
  if (!isAddress(address)) return 'not an address';
  if (!Number.isFinite(issuedAtMs) || issuedAtMs < nowMs - AUTH.maxAgeMs || issuedAtMs > nowMs + AUTH.maxClockSkewMs) {
    return 'login message expired, sign again';
  }
  const signer = recoverSigner(loginMessage(address, identityHex, issuedAtMs), signatureHex);
  if (!signer) return 'bad signature';
  if (signer !== address.toLowerCase()) return 'signature does not match the address';
  return '';
}

/** Test helper: sign the login message with a raw private key (personal_sign format, v = 27/28). */
export function signLogin(privateKey: Uint8Array, identityHex: string, issuedAtMs: number): { address: string; signature: string } {
  const address = addressOfPublicKey(secp256k1.getPublicKey(privateKey, false));
  const msg = loginMessage(address, identityHex, issuedAtMs);
  const sig = secp256k1.sign(personalHash(msg), privateKey, { prehash: false, format: 'recovered' });
  // noble 'recovered' = recovery byte first, then r|s; Ethereum wants r|s|v with v = 27 + recovery.
  const out = new Uint8Array(65);
  out.set(sig.slice(1), 0);
  out[64] = 27 + sig[0];
  return { address, signature: bytesHex(out) };
}
