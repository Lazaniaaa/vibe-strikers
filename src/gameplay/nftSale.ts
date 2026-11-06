// Selling an NFT from a wallet (GAME.md 6.11): the holder signs this text-free structure, the buyer sends it to the contract.
// Pure, shared by the lobby and the contract test. Amounts are wei as bigint; prices are shown in testnet ETH.
import { NFT } from '../config/nft.ts';

const WEI = 10n ** 18n;

/** "0.01" -> wei, or null if it is not a valid price within NFT.sale. */
export function parseEthPrice(text: string): bigint | null {
  const m = /^(\d{1,9})(?:\.(\d{1,18}))?$/.exec(text.trim());
  if (!m) return null;
  const wei = BigInt(m[1]) * WEI + BigInt((m[2] ?? '').padEnd(18, '0') || '0');
  return wei >= BigInt(NFT.sale.minWei) && wei <= BigInt(NFT.sale.maxWei) ? wei : null;
}

/** wei -> "0.01". */
export function formatEth(wei: bigint): string {
  const frac = (wei % WEI).toString().padStart(18, '0').replace(/0+$/, '');
  return `${wei / WEI}${frac ? `.${frac}` : ''}`;
}

export const SALE_TYPES = {
  EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
  Sale: [{ name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }, { name: 'expiry', type: 'uint256' }, { name: 'nonce', type: 'uint256' }],
};

/** What the wallet shows and signs (eth_signTypedData_v4). */
export function saleTypedData(contract: string, chainId: number, tokenId: bigint, price: bigint, expiry: number, nonce: bigint) {
  return {
    types: SALE_TYPES,
    primaryType: 'Sale',
    domain: { name: NFT.name, version: '1', chainId, verifyingContract: contract },
    message: { tokenId: tokenId.toString(), price: price.toString(), expiry: String(expiry), nonce: nonce.toString() },
  };
}
