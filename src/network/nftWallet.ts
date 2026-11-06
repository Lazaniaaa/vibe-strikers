// The player's wallet in the NFT market (GAME.md 6.11): the seller signs a price for free, the buyer sends the transaction and
// pays the price and the gas. Robinhood Chain testnet only; the wallet asks the player to confirm each step.
import { NFT } from '../config/nft.ts';
import { REWARDS } from '../config/rewards.ts';
import { saleTypedData } from '../gameplay/nftSale.ts';
import { callData, decodeAddress, decodeUint } from './evm.ts';
import { browserWallet } from './walletLogin.ts';

const CHAIN_HEX = `0x${REWARDS.chain.id.toString(16)}`;
const RECEIPT_POLLS = 120, RECEIPT_POLL_MS = 1500;
const DAY_S = 86400;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Eth = NonNullable<ReturnType<typeof browserWallet>>;

/** The wallet on the right account and network. */
async function ready(account: string): Promise<Eth> {
  const eth = browserWallet();
  if (!eth) throw new Error('No wallet found. Install MetaMask.');
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
  if (accounts[0]?.toLowerCase() !== account) throw new Error(`Switch the wallet to ${account}.`);
  if ((await eth.request({ method: 'eth_chainId' })) === CHAIN_HEX) return eth;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e;
    await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: REWARDS.chain.name,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [REWARDS.chain.rpc], blockExplorerUrls: [REWARDS.chain.explorer] }] });
  }
  if ((await eth.request({ method: 'eth_chainId' })) !== CHAIN_HEX) throw new Error(`Switch the wallet to ${REWARDS.chain.name}.`);
  return eth;
}

const readable = (e: unknown): Error => {
  if ((e as { code?: number }).code === 4001) return new Error('Cancelled in the wallet.');
  const text = e instanceof Error ? e.message : String((e as { message?: string }).message ?? e);
  return new Error(/insufficient funds/i.test(text) ? `Not enough test ETH: ${REWARDS.chain.faucet}` : text);
};

/** Free signature of a price by the token's holder. No transaction. */
export async function signNftSale(tokenId: bigint, price: bigint, account: string): Promise<{ expiry: number; signature: string }> {
  try {
    const eth = await ready(account);
    const id = [{ type: 'uint256' as const, value: tokenId }];
    const read = (signature: string) => eth.request({ method: 'eth_call', params: [{ to: NFT.contract, data: callData(signature, id) }, 'latest'] }) as Promise<string>;
    if (decodeAddress(await read('ownerOf(uint256)')) !== account) throw new Error('This NFT is not in this wallet any more.');
    const nonce = decodeUint(await read('saleNonce(uint256)'));
    const expiry = Math.floor(Date.now() / 1000) + NFT.sale.expiryDays * DAY_S;
    const data = saleTypedData(NFT.contract, REWARDS.chain.id, tokenId, price, expiry, nonce);
    const signature = (await eth.request({ method: 'eth_signTypedData_v4', params: [account, JSON.stringify(data)] })) as string;
    return { expiry, signature };
  } catch (e) { throw readable(e); }
}

/** Buy a listed NFT: the buyer's transaction, price and gas. Resolves with the transaction hash when it is mined. */
export async function buyNftOnChain(tokenId: bigint, price: bigint, expiry: number, signature: string, account: string): Promise<string> {
  try {
    const eth = await ready(account);
    const tx = { from: account, to: NFT.contract, value: `0x${price.toString(16)}`,
      data: callData('buy(uint256,uint256,uint256,bytes)', [{ type: 'uint256', value: tokenId }, { type: 'uint256', value: price }, { type: 'uint256', value: BigInt(expiry) }, { type: 'bytes', value: signature }]) };
    const hash = (await eth.request({ method: 'eth_sendTransaction', params: [tx] })) as string;
    for (let i = 0; i < RECEIPT_POLLS; i++) {
      const r = (await eth.request({ method: 'eth_getTransactionReceipt', params: [hash] })) as { status: string } | null;
      if (r) {
        if (r.status !== '0x1') throw new Error('The transaction failed: the listing may be out of date.');
        return hash;
      }
      await wait(RECEIPT_POLL_MS);
    }
    throw new Error('No answer from the chain. Check the wallet.');
  } catch (e) { throw readable(e); }
}
