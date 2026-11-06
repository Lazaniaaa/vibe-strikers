// SeasonSkins contract test on an in-process EVM (@ethereumjs/evm, no chain, no keys): deploy from contracts/build/, mint in
// batches, resend, check every guard and standard transfers.
// Usage: node --experimental-strip-types --no-warnings scripts/test-nft-contract.mjs
import { readFileSync } from 'node:fs';
import { createEVM } from '@ethereumjs/evm';
import { createAddressFromString, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { callData, decodeAddress, decodeUint, selector } from '../src/network/evm.ts';
import { nftRef, nftSeed, nftSkinWord, nftTokenId, nftReward } from '../src/gameplay/nft.ts';

const ART = JSON.parse(readFileSync(new URL('../contracts/build/SeasonSkins.json', import.meta.url), 'utf8'));
let failures = 0;
const check = (ok, what) => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };

const evm = await createEVM();
const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const OWNER = addr(0xa11ce), STRANGER = addr(0xbad), P1 = addr(0x1001), P2 = addr(0x1002);

async function run(from, to, data) {
  const r = await evm.runCall({ caller: createAddressFromString(from), to: to ? createAddressFromString(to) : undefined,
    data: hexToBytes(data), gasLimit: 30_000_000n, skipBalance: true });
  return { ok: !r.execResult.exceptionError, ret: bytesToHex(r.execResult.returnValue), created: r.createdAddress?.toString(),
    gas: r.execResult.executionGasUsed };
}
const nft = (await run(OWNER, undefined, ART.bytecode)).created;
check(!!nft, `deploy (${(ART.bytecode.length - 2) / 2} bytes)`);
const view = (sig, args = []) => run(OWNER, nft, callData(sig, args));
const uint = async (sig, args) => decodeUint((await view(sig, args)).ret);
const ownerOf = async (id) => decodeAddress((await view('ownerOf(uint256)', [{ type: 'uint256', value: id }])).ret);
const errorIs = (ret, name) => ret.slice(2, 10) === selector(`${name}()`);
const mint = (from, to, ids, skins = ids.map(() => 7n)) => run(from, nft, callData('mintBatch(address[],uint256[],uint256[])', [
  { type: 'address[]', value: to }, { type: 'uint256[]', value: ids }, { type: 'uint256[]', value: skins }]));
/** A string return value of a view. */
const text = (ret) => {
  const h = ret.slice(2), length = Number(BigInt(`0x${h.slice(64, 128)}`));
  return Buffer.from(h.slice(128, 128 + length * 2), 'hex').toString('utf8');
};

check(await uint('owner()') === BigInt(OWNER), 'owner = deployer');
check(text((await view('name()')).ret) === 'Vibe Strikers Skins' && text((await view('symbol()')).ret) === 'VSKIN', 'name and symbol');
check(await uint('supportsInterface(bytes4)', [{ type: 'uint256', value: BigInt('0x80ac58cd') << 224n }]) === 1n, 'says it is an ERC-721');

// Real ids and words from the game's rules.
const earner = addr(0xabc).toLowerCase();
const ref = nftRef(1, 30, earner), id30 = nftTokenId(1, 30, earner);
const word = nftSkinWord(1, 30, nftReward(30), nftSeed(ref));
check(word >> 64n === 1n && ((word >> 48n) & 0xffffn) === 30n && ((word >> 40n) & 0xffn) === 4n && ((word >> 32n) & 0xffn) === 2n && (word & 0xffffffffn) === BigInt(nftSeed(ref)), 'skin word: season 1, level 30, mythic, rifle, seed');
check(nftTokenId(1, 30, earner) !== nftTokenId(1, 25, earner) && nftTokenId(1, 30, earner) !== nftTokenId(2, 30, earner) && nftTokenId(1, 30, earner) !== nftTokenId(1, 30, addr(0xabd)), 'token ids differ by level, season and earner');

const stranger = await mint(STRANGER, [P1], [1n]);
check(!stranger.ok && errorIs(stranger.ret, 'NotOwner'), 'a stranger cannot mint');
check(await uint('totalSupply()') === 0n, 'nothing minted');
const mismatch = await mint(OWNER, [P1, P2], [1n]);
check(!mismatch.ok && errorIs(mismatch.ret, 'LengthMismatch'), 'lists of different length are refused');

const first = await mint(OWNER, [P1, P2], [id30, 2n], [word, 9n]);
check(first.ok && await uint('totalSupply()') === 2n, 'mint a batch of 2');
check(await ownerOf(id30) === P1 && await ownerOf(2n) === P2, 'each token is in the wallet it was sent to');
check(await uint('skinOf(uint256)', [{ type: 'uint256', value: id30 }]) === word, 'the skin word is stored');

const again = await mint(OWNER, [P2, addr(0), P1], [id30, 5n, 6n]);
check(again.ok && await ownerOf(id30) === P1 && await uint('totalSupply()') === 3n, 'sent again: existing token and zero address skipped, the new one minted');
check(await uint('skinOf(uint256)', [{ type: 'uint256', value: id30 }]) === word, 'a resend does not change a skin');
check(!(await view('ownerOf(uint256)', [{ type: 'uint256', value: 5n }])).ok, 'the zero-address one does not exist');

// A batch of the real size stays affordable.
const ids = Array.from({ length: 50 }, (_, i) => 1000n + BigInt(i)), to = ids.map((_, i) => addr(0x2000 + i));
const big = await mint(OWNER, to, ids, ids.map((i) => i * 3n));
check(big.ok && big.gas < 10_000_000n, `batch of 50: ${big.gas} gas`);

// A contract receiver cannot block a batch: _mint does not call it.
check((await mint(OWNER, [nft], [2000n])).ok, 'minting to a contract address works');

// Metadata location.
check(!(await run(STRANGER, nft, callData('setBaseUri(string)', [{ type: 'string', value: 'https://x/' }]))).ok, 'a stranger cannot set the metadata address');
check((await run(OWNER, nft, callData('setBaseUri(string)', [{ type: 'string', value: 'https://example.test/nft/' }]))).ok, 'the owner sets the metadata address');
check(text((await view('tokenURI(uint256)', [{ type: 'uint256', value: 2n }])).ret) === 'https://example.test/nft/2', 'tokenURI = address + id');

// Standard transfers: the player owns it, the deployer has no special power over it.
const moved = await run(P2, nft, callData('transferFrom(address,address,uint256)', [{ type: 'address', value: P2 }, { type: 'address', value: P1 }, { type: 'uint256', value: 2n }]));
check(moved.ok && await ownerOf(2n) === P1, 'the holder can transfer');
check(!(await run(OWNER, nft, callData('transferFrom(address,address,uint256)', [{ type: 'address', value: P1 }, { type: 'address', value: OWNER }, { type: 'uint256', value: 2n }]))).ok, 'the contract owner cannot take a token');

const handOver = await run(STRANGER, nft, callData('setOwner(address)', [{ type: 'address', value: STRANGER }]));
check(!handOver.ok && errorIs(handOver.ret, 'NotOwner'), 'a stranger cannot take the contract');

console.log(failures ? `NFT CONTRACT TEST FAIL (${failures})` : 'NFT CONTRACT TEST PASS');
process.exit(failures ? 1 : 0);
