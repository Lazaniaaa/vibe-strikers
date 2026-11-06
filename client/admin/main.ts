// Weekly STRIKE rewards admin page (GAME.md 6.9). Local only: `npm run game:dev`, then
// http://127.0.0.1:5190/admin.html (not part of the production build). Every chain action is a transaction the
// owner confirms in MetaMask; this page never sees a private key. Robinhood Chain testnet only.
import { REWARDS } from '../../src/config/rewards.ts';
import { formatTokens, payoutPlan, toUnits, weekLabel, weekOf, type Payout, type WeekRow } from '../../src/gameplay/rewards.ts';
import { shortAddress } from '../../src/gameplay/walletMessage.ts';
import { callData, decodeAddress, decodeUint, encodeArgs } from '../../src/network/evm.ts';
import { browserWallet } from '../../src/network/walletLogin.ts';
import { loadNftQueue, markNftsSent, nftAdminSession, type QueuedNft } from '../../src/network/nftAdmin.ts';
import { NFT } from '../../src/config/nft.ts';
import { nftName } from '../../src/gameplay/nft.ts';
import DIST from '../../contracts/build/WeeklyDistributor.json';
import SKINS from '../../contracts/build/SeasonSkins.json';

type Eth = NonNullable<ReturnType<typeof browserWallet>>;
const SAVED_DIST = 'vs-admin-distributor';
const SAVED_SKINS = 'vs-admin-skins';
const CHAIN_HEX = `0x${REWARDS.chain.id.toString(16)}`;
const TOKEN = REWARDS.token.address;
const SYM = REWARDS.token.symbol;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

const state = {
  account: '',
  distributor: (REWARDS.distributor as string) || (() => { try { return localStorage.getItem(SAVED_DIST) ?? ''; } catch { return ''; } })(),
  week: weekOf(Date.now()) - 1,
  plan: [] as Payout[],
  skins: (NFT.contract as string) || (() => { try { return localStorage.getItem(SAVED_SKINS) ?? ''; } catch { return ''; } })(),
  queue: [] as QueuedNft[],
  busy: false,
};

const app = document.getElementById('app')!;
app.innerHTML = `
  <h1>Vibe Strikers · weekly ${SYM} rewards</h1>
  <div class="warn"><b>${esc(REWARDS.chain.name)} only</b> (chain id ${REWARDS.chain.id}). Every button below opens MetaMask:
    check the network and the numbers there before you confirm. Never use a wallet that holds real funds.</div>
  <section><h2>1. Wallet</h2>
    <button id="connect">Connect MetaMask</button>
    <div class="kv" id="status"></div></section>
  <section><h2>2. Distributor contract</h2>
    <label>Address <input id="dist" class="wide" placeholder="0x… (empty = not deployed yet)"></label>
    <button id="deploy">Deploy new distributor</button>
    <p><small>After deploying, tell Claude the address: it goes into <code>src/config/rewards.ts</code> (<code>distributor</code>).</small></p></section>
  <section><h2>3. Fund</h2>
    <label>Amount <input id="fundAmount" type="number" min="1" step="1" value="${REWARDS.weekPoolTokens}"> ${SYM}</label>
    <button id="fund">Send to distributor</button></section>
  <section><h2>4. Pay a week</h2>
    <label>Server <input id="server" value="https://maincloud.spacetimedb.com"></label>
    <label>Database <input id="db" value="vibe-strikers"></label><br>
    <label>Week <input id="week" type="number" step="1" value="${state.week}"></label>
    <label>Pool <input id="pool" type="number" min="1" step="1" value="${REWARDS.weekPoolTokens}"> ${SYM}</label>
    <button id="load">Load points</button>
    <button id="pay" disabled>Pay this week</button>
    <div id="planInfo"></div>
    <div id="plan"></div></section>
  <section><h2>5. Withdraw</h2>
    <label>Amount <input id="wAmount" type="number" min="1" step="1"> ${SYM}</label>
    <button id="withdraw">Withdraw to my wallet</button></section>
  <section><h2>6. Season NFTs</h2>
    <label>Contract <input id="skins" class="wide" placeholder="0x… (empty = not deployed yet)"></label>
    <button id="skinsDeploy">Deploy NFT contract</button>
    <p><small>After deploying, tell Claude the address: it goes into <code>src/config/nft.ts</code> (<code>contract</code>) and opens the "To wallet" button in the game.</small></p>
    <button id="nftLoad">Load NFTs to send</button>
    <button id="nftMint" disabled>Mint and send</button>
    <p><small>MetaMask asks for one free signature (login) and then one transaction per ${NFT.batchSize} NFTs. Uses Server and Database from section 4.</small></p>
    <div id="nftInfo"></div></section>
  <section><h2>Log</h2><div id="log"></div></section>`;

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
const distInput = $('dist');
distInput.value = state.distributor;
distInput.addEventListener('change', () => { state.distributor = distInput.value.trim(); save(); void refresh(); });

function log(msg: string, cls = ''): void {
  const line = document.createElement('div');
  line.textContent = `${new Date().toLocaleTimeString()}  ${msg}`;
  if (cls) line.className = cls;
  $('log').prepend(line);
}
function save(): void { try { localStorage.setItem(SAVED_DIST, state.distributor); } catch { /* private window */ } }

function wallet(): Eth {
  const eth = browserWallet();
  if (!eth) throw new Error('No MetaMask found in this browser.');
  return eth;
}

async function ensureChain(eth: Eth): Promise<void> {
  if ((await eth.request({ method: 'eth_chainId' })) === CHAIN_HEX) return;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e;
    await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: REWARDS.chain.name,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [REWARDS.chain.rpc], blockExplorerUrls: [REWARDS.chain.explorer] }] });
  }
  if ((await eth.request({ method: 'eth_chainId' })) !== CHAIN_HEX) throw new Error(`MetaMask is not on ${REWARDS.chain.name}.`);
}

/** Read-only call through the wallet's RPC. */
async function read(to: string, data: string): Promise<string> {
  return (await wallet().request({ method: 'eth_call', params: [{ to, data }, 'latest'] })) as string;
}

/** Send a transaction (MetaMask asks the owner), wait for it, return the receipt. */
async function send(what: string, tx: { to?: string; data: string }): Promise<{ contractAddress?: string; status: string; transactionHash: string }> {
  const eth = wallet();
  await ensureChain(eth);
  log(`${what}: confirm in MetaMask…`);
  const hash = (await eth.request({ method: 'eth_sendTransaction', params: [{ from: state.account, ...tx }] })) as string;
  log(`${what}: sent ${hash}`);
  for (let i = 0; i < 180; i++) {
    const r = (await eth.request({ method: 'eth_getTransactionReceipt', params: [hash] })) as { status: string; contractAddress?: string; transactionHash: string } | null;
    if (r) {
      if (r.status !== '0x1') throw new Error(`${what}: transaction failed (${REWARDS.chain.explorer}/tx/${hash})`);
      log(`${what}: done`, 'ok');
      return r;
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error(`${what}: no receipt after 4.5 min (${REWARDS.chain.explorer}/tx/${hash})`);
}

const balanceOf = async (who: string) => decodeUint(await read(TOKEN, callData('balanceOf(address)', [{ type: 'address', value: who }])));

async function refresh(): Promise<void> {
  const rows: [string, string][] = [['Network', REWARDS.chain.name], ['Token', `${SYM} <code>${TOKEN}</code>`]];
  if (state.account) {
    rows.push(['My wallet', `<code>${state.account}</code>`]);
    try {
      rows.push([`My ${SYM}`, formatTokens(await balanceOf(state.account))]);
      if (isAddr(state.distributor)) {
        const owner = decodeAddress(await read(state.distributor, callData('owner()')));
        rows.push(['Distributor', `<code>${state.distributor}</code>`]);
        rows.push(['Distributor owner', owner === state.account ? 'me ✓' : `<span class="bad">${owner} (not me)</span>`]);
        rows.push([`Distributor ${SYM}`, formatTokens(await balanceOf(state.distributor))]);
      }
    } catch (e) { rows.push(['Read error', `<span class="bad">${esc((e as Error).message)}</span>`]); }
  }
  $('status').innerHTML = rows.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('');
}

/** Week stats from the game server's public SQL endpoint (anonymous identity). */
async function loadWeek(server: string, db: string, week: number): Promise<WeekRow[]> {
  const id = (await (await fetch(`${server}/v1/identity`, { method: 'POST' })).json()) as { token: string };
  const res = await fetch(`${server}/v1/database/${encodeURIComponent(db)}/sql`, {
    method: 'POST', headers: { Authorization: `Bearer ${id.token}` }, body: `SELECT * FROM week_stat WHERE week = ${week}`,
  });
  if (!res.ok) throw new Error(`server answered ${res.status}: ${await res.text()}`);
  const [table] = (await res.json()) as { schema: { elements: { name: { some: string } }[] }; rows: unknown[][] }[];
  const col = (name: string) => table.schema.elements.findIndex((e) => e.name.some === name);
  const c = { owner: col('owner'), matches: col('matches'), wins: col('wins'), kills: col('kills'), headshots: col('headshots') };
  return table.rows.map((r) => ({ owner: String(r[c.owner]), matches: Number(r[c.matches]), wins: Number(r[c.wins]),
    kills: Number(r[c.kills]), headshots: Number(r[c.headshots]) })).filter((r) => isAddr(r.owner));
}

async function guarded(fn: () => Promise<void>): Promise<void> {
  if (state.busy) return;
  state.busy = true;
  document.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try { await fn(); } catch (e) {
    const code = (e as { code?: number }).code;
    log(code === 4001 ? 'Cancelled in MetaMask.' : (e as Error).message, 'bad');
  } finally {
    state.busy = false;
    document.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    $('pay').toggleAttribute('disabled', !state.plan.length);
    $('nftMint').toggleAttribute('disabled', !state.queue.length);
    void refresh();
  }
}

$('connect').addEventListener('click', () => void guarded(async () => {
  const eth = wallet();
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
  state.account = accounts[0].toLowerCase();
  await ensureChain(eth);
  log(`Connected ${state.account}`);
}));

$('deploy').addEventListener('click', () => void guarded(async () => {
  if (!state.account) throw new Error('Connect MetaMask first.');
  if (isAddr(state.distributor) && !confirm('A distributor address is already set. Deploy another one?')) return;
  const r = await send('Deploy distributor', { data: DIST.bytecode + encodeArgs([{ type: 'address', value: TOKEN }]) });
  if (!r.contractAddress) throw new Error('No contract address in the receipt.');
  state.distributor = r.contractAddress.toLowerCase();
  distInput.value = state.distributor;
  save();
  log(`Distributor deployed at ${state.distributor}. Send this address to Claude.`, 'ok');
}));

$('fund').addEventListener('click', () => void guarded(async () => {
  if (!state.account || !isAddr(state.distributor)) throw new Error('Connect MetaMask and set the distributor first.');
  const tokens = BigInt(Math.floor(Number($('fundAmount').value)));
  if (tokens <= 0n) throw new Error('Amount must be positive.');
  await send(`Fund ${tokens} ${SYM}`, { to: TOKEN, data: callData('transfer(address,uint256)',
    [{ type: 'address', value: state.distributor }, { type: 'uint256', value: toUnits(tokens) }]) });
}));

$('load').addEventListener('click', () => void guarded(async () => {
  state.week = Math.floor(Number($('week').value));
  const pool = toUnits(BigInt(Math.floor(Number($('pool').value))));
  const rows = await loadWeek($('server').value.trim(), $('db').value.trim(), state.week);
  state.plan = payoutPlan(rows, pool);
  const sum = state.plan.reduce((s, p) => s + p.amount, 0n);
  let paidAlready = 0n, contractHas = -1n;
  if (state.account && isAddr(state.distributor)) {
    paidAlready = decodeUint(await read(state.distributor, callData('weekTotal(uint256)', [{ type: 'uint256', value: BigInt(state.week) }])));
    contractHas = await balanceOf(state.distributor);
  }
  const ongoing = state.week >= weekOf(Date.now());
  $('planInfo').innerHTML = `<p>Week <b>${state.week}</b> (${weekLabel(state.week)} UTC)${ongoing ? ' <span class="bad">— not finished yet</span>' : ''}:
    ${rows.length} players with stats, <b>${state.plan.length}</b> get tokens, total <b>${formatTokens(sum)} ${SYM}</b>
    in ${Math.ceil(state.plan.length / REWARDS.batchSize)} transaction(s).
    ${paidAlready ? `<br><span class="bad">Already paid for this week: ${formatTokens(paidAlready)} ${SYM} (paid players are skipped).</span>` : ''}
    ${contractHas >= 0n && contractHas < sum ? `<br><span class="bad">The distributor holds only ${formatTokens(contractHas)} ${SYM}.</span>` : ''}</p>`;
  $('plan').innerHTML = state.plan.length ? `<table><thead><tr><th>#</th><th>Wallet</th><th>Points</th><th>${SYM}</th></tr></thead><tbody>
    ${state.plan.map((p, i) => `<tr><td>${i + 1}</td><td title="${p.owner}">${shortAddress(p.owner)}</td><td>${p.points}</td><td>${formatTokens(p.amount)}</td></tr>`).join('')}
    </tbody></table>` : '<p>Nobody reached the minimum points this week.</p>';
  log(`Loaded week ${state.week}: ${state.plan.length} payouts.`);
}));

$('pay').addEventListener('click', () => void guarded(async () => {
  if (!state.account || !isAddr(state.distributor)) throw new Error('Connect MetaMask and set the distributor first.');
  if (state.week >= weekOf(Date.now()) && !confirm('This week is not finished. Pay anyway?')) return;
  const batches = Math.ceil(state.plan.length / REWARDS.batchSize);
  for (let b = 0; b < batches; b++) {
    const part = state.plan.slice(b * REWARDS.batchSize, (b + 1) * REWARDS.batchSize);
    await send(`Pay week ${state.week}, batch ${b + 1}/${batches} (${part.length} players)`, { to: state.distributor,
      data: callData('distribute(uint256,address[],uint256[])', [{ type: 'uint256', value: BigInt(state.week) },
        { type: 'address[]', value: part.map((p) => p.owner) }, { type: 'uint256[]', value: part.map((p) => p.amount) }]) });
  }
  log(`Week ${state.week} paid.`, 'ok');
}));

const skinsInput = $('skins');
skinsInput.value = state.skins;
function saveSkins(): void { try { localStorage.setItem(SAVED_SKINS, state.skins); } catch { /* private window */ } }
skinsInput.addEventListener('change', () => { state.skins = skinsInput.value.trim(); saveSkins(); });

$('skinsDeploy').addEventListener('click', () => void guarded(async () => {
  if (!state.account) throw new Error('Connect MetaMask first.');
  if (isAddr(state.skins) && !confirm('An NFT contract address is already set. Deploy another one?')) return;
  const r = await send('Deploy NFT contract', { data: SKINS.bytecode });
  if (!r.contractAddress) throw new Error('No contract address in the receipt.');
  state.skins = r.contractAddress.toLowerCase();
  skinsInput.value = state.skins;
  saveSkins();
  log(`NFT contract deployed at ${state.skins}. Send this address to Claude.`, 'ok');
}));

$('nftLoad').addEventListener('click', () => void guarded(async () => {
  state.queue = await loadNftQueue($('server').value.trim(), $('db').value.trim());
  $('nftInfo').innerHTML = state.queue.length ? `<p><b>${state.queue.length}</b> NFT(s) to send in ${Math.ceil(state.queue.length / NFT.batchSize)} transaction(s).</p>
    <table><thead><tr><th>#</th><th>NFT</th><th>To wallet</th></tr></thead><tbody>
    ${state.queue.map((n, i) => `<tr><td>${i + 1}</td><td>${esc(nftName(n.ref))}</td><td title="${esc(n.recipient)}">${shortAddress(n.recipient)}</td></tr>`).join('')}
    </tbody></table>` : '<p>Nothing to send.</p>';
  log(`NFT queue: ${state.queue.length}.`);
}));

$('nftMint').addEventListener('click', () => void guarded(async () => {
  if (!state.account || !isAddr(state.skins)) throw new Error('Connect MetaMask and set the NFT contract first.');
  const eth = wallet(), account = state.account;
  const session = await nftAdminSession($('server').value.trim(), $('db').value.trim(), account, async (message) =>
    (await eth.request({ method: 'personal_sign', params: [`0x${[...new TextEncoder().encode(message)].map((b) => b.toString(16).padStart(2, '0')).join('')}`, account] })) as string);
  const batches = Math.ceil(state.queue.length / NFT.batchSize);
  for (let b = 0; b < batches; b++) {
    const part = state.queue.slice(b * NFT.batchSize, (b + 1) * NFT.batchSize);
    const r = await send(`Mint batch ${b + 1}/${batches} (${part.length} NFTs)`, { to: state.skins, data: callData('mintBatch(address[],uint256[],uint256[])', [
      { type: 'address[]', value: part.map((n) => n.recipient) }, { type: 'uint256[]', value: part.map((n) => n.tokenId) }, { type: 'uint256[]', value: part.map((n) => n.skin) }]) });
    // If this fails the tokens exist but stay queued: pressing the button again skips them on chain and marks them.
    await markNftsSent(session, part.map((n) => n.ref), r.transactionHash);
  }
  state.queue = [];
  $('nftInfo').innerHTML = '<p>All sent.</p>';
  log('NFTs minted and marked as sent.', 'ok');
}));

$('withdraw').addEventListener('click', () => void guarded(async () => {
  if (!state.account || !isAddr(state.distributor)) throw new Error('Connect MetaMask and set the distributor first.');
  const tokens = BigInt(Math.floor(Number($('wAmount').value)));
  if (tokens <= 0n) throw new Error('Amount must be positive.');
  await send(`Withdraw ${tokens} ${SYM}`, { to: state.distributor, data: callData('withdraw(address,uint256)',
    [{ type: 'address', value: state.account }, { type: 'uint256', value: toUnits(tokens) }]) });
}));

void refresh();
