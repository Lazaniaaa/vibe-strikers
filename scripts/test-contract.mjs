// Weekly-rewards contract test on an in-process EVM (@ethereumjs/evm, no chain, no keys): deploy a test token and
// the WeeklyDistributor from contracts/build/ (run scripts/build-contract.mjs first), then pay a week made by
// payoutPlan in batches and check every guard. Usage: node --experimental-strip-types --no-warnings scripts/test-contract.mjs
import { readFileSync } from 'node:fs';
import { createEVM } from '@ethereumjs/evm';
import { createAddressFromString, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { callData, decodeUint, encodeArgs, selector } from '../src/network/evm.ts';
import { payoutPlan, toUnits, weekOf } from '../src/gameplay/rewards.ts';
import { REWARDS } from '../src/config/rewards.ts';

const load = (p) => JSON.parse(readFileSync(new URL(`../contracts/build/${p}.json`, import.meta.url), 'utf8'));
const DIST = load('WeeklyDistributor'), TOKEN = load('test/TestToken');

let failures = 0;
const check = (ok, what) => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };

const evm = await createEVM();
const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const OWNER = addr(0xa11ce), STRANGER = addr(0xbad);
const GAS = 30_000_000n;

async function run(from, to, data) {
  const r = await evm.runCall({ caller: createAddressFromString(from), to: to ? createAddressFromString(to) : undefined,
    data: hexToBytes(data), gasLimit: GAS, skipBalance: true });
  return { ok: !r.execResult.exceptionError, ret: bytesToHex(r.execResult.returnValue), created: r.createdAddress?.toString(),
    gas: r.execResult.executionGasUsed, logs: r.execResult.logs ?? [] };
}
const deploy = async (from, art, args) => (await run(from, undefined, art.bytecode + encodeArgs(args))).created;
const view = async (to, sig, args = []) => decodeUint((await run(OWNER, to, callData(sig, args))).ret);
const balanceOf = (token, who) => view(token, 'balanceOf(address)', [{ type: 'address', value: who }]);
const errorIs = (ret, name) => ret.slice(2, 10) === selector(`${name}()`);

const SUPPLY = toUnits(1_000_000_000);
const token = await deploy(OWNER, TOKEN, [{ type: 'uint256', value: SUPPLY }]);
const dist = await deploy(OWNER, DIST, [{ type: 'address', value: token }]);
check(!!token && !!dist, 'deploy test token and distributor');
check(await view(dist, 'owner()') === BigInt(OWNER), 'owner = deployer');
check(await view(dist, 'token()') === BigInt(token), 'token address stored');

const POOL = toUnits(REWARDS.weekPoolTokens);
await run(OWNER, token, callData('transfer(address,uint256)', [{ type: 'address', value: dist }, { type: 'uint256', value: POOL }]));
check(await view(dist, 'balance()') === POOL, `fund with ${REWARDS.weekPoolTokens} tokens`);

// A week with 400 players (4 batches) plus small and empty ones.
const week = weekOf(Date.UTC(2026, 10, 9));
const rows = [];
for (let i = 0; i < 400; i++) rows.push({ owner: addr(0x1000 + i), matches: 5 + (i % 7), wins: i % 3, kills: i % 11, headshots: i % 2 });
rows.push({ owner: addr(0x9999), matches: 1, wins: 0, kills: 0, headshots: 0 }); // 2 points < minPoints
const plan = payoutPlan(rows, POOL);
const planned = plan.reduce((s, p) => s + p.amount, 0n);
check(plan.length === 400 && !plan.some((p) => p.owner === addr(0x9999)), 'plan: 400 paid, below min points left out');
check(planned <= POOL && plan.every((p) => p.amount <= POOL * BigInt(REWARDS.maxShareBps) / 10_000n), 'plan: within pool and per-wallet cap');

const distribute = (from, w, part) => run(from, dist, callData('distribute(uint256,address[],uint256[])', [
  { type: 'uint256', value: BigInt(w) },
  { type: 'address[]', value: part.map((p) => p.owner) },
  { type: 'uint256[]', value: part.map((p) => p.amount) },
]));

const stranger = await distribute(STRANGER, week, plan.slice(0, 2));
check(!stranger.ok && errorIs(stranger.ret, 'NotOwner'), 'stranger cannot distribute (NotOwner)');
const mismatch = await run(OWNER, dist, callData('distribute(uint256,address[],uint256[])', [
  { type: 'uint256', value: BigInt(week) }, { type: 'address[]', value: [addr(1), addr(2)] }, { type: 'uint256[]', value: [1n] }]));
check(!mismatch.ok && errorIs(mismatch.ret, 'LengthMismatch'), 'length mismatch reverts');

let maxGas = 0n;
for (let i = 0; i < plan.length; i += REWARDS.batchSize) {
  const r = await distribute(OWNER, week, plan.slice(i, i + REWARDS.batchSize));
  if (!r.ok) check(false, `batch ${i / REWARDS.batchSize + 1} failed`);
  if (r.gas > maxGas) maxGas = r.gas;
}
const paidOk = await Promise.all(plan.slice(0, 5).concat(plan.slice(-5)).map(async (p) => await balanceOf(token, p.owner) === p.amount));
check(paidOk.every(Boolean), 'players received their planned amounts');
check(await view(dist, 'weekTotal(uint256)', [{ type: 'uint256', value: BigInt(week) }]) === planned, 'weekTotal = planned sum');
check(await view(dist, 'balance()') === POOL - planned, 'contract keeps the rest');
console.log(`     max gas per batch of ${REWARDS.batchSize}: ${maxGas}`);
check(maxGas < 8_000_000n, 'batch gas below 8M');

const again = await distribute(OWNER, week, plan.slice(0, 3));
check(again.ok && await balanceOf(token, plan[0].owner) === plan[0].amount, 'paying the same week again skips paid players');
check(await view(dist, 'paidOf(uint256,address)', [{ type: 'uint256', value: BigInt(week) }, { type: 'address', value: plan[0].owner }]) === plan[0].amount, 'paidOf records the amount');

const next = await distribute(OWNER, week + 1, [{ owner: plan[0].owner, amount: 5n }]);
check(next.ok && await balanceOf(token, plan[0].owner) === plan[0].amount + 5n, 'next week pays the same player again');

const left = await view(dist, 'balance()');
const tooMuch = await distribute(OWNER, week + 2, [{ owner: addr(0x77), amount: 1n }, { owner: addr(0x78), amount: left }]);
check(!tooMuch.ok && errorIs(tooMuch.ret, 'TransferFailed'), 'overspend reverts');
check(await balanceOf(token, addr(0x77)) === 0n && await view(dist, 'paidOf(uint256,address)', [{ type: 'uint256', value: BigInt(week + 2) }, { type: 'address', value: addr(0x77) }]) === 0n,
  'overspend reverts the whole batch');

const wStranger = await run(STRANGER, dist, callData('withdraw(address,uint256)', [{ type: 'address', value: STRANGER }, { type: 'uint256', value: 1n }]));
check(!wStranger.ok && errorIs(wStranger.ret, 'NotOwner'), 'stranger cannot withdraw');
const before = await balanceOf(token, OWNER);
const w = await run(OWNER, dist, callData('withdraw(address,uint256)', [{ type: 'address', value: OWNER }, { type: 'uint256', value: left }]));
check(w.ok && await balanceOf(token, OWNER) === before + left && await view(dist, 'balance()') === 0n, 'owner withdraws the rest');

const so = await run(OWNER, dist, callData('setOwner(address)', [{ type: 'address', value: STRANGER }]));
check(so.ok && await view(dist, 'owner()') === BigInt(STRANGER), 'owner can hand over ownership');
const old = await run(OWNER, dist, callData('withdraw(address,uint256)', [{ type: 'address', value: OWNER }, { type: 'uint256', value: 0n }]));
check(!old.ok, 'old owner is locked out');

console.log(failures ? `CONTRACT TEST FAIL (${failures})` : 'CONTRACT TEST PASS');
process.exit(failures ? 1 : 0);
