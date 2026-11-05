// Lobby MARKET tab (GAME.md 6.7): browse listings, buy with a confirm step, list / cancel my items, recent trades.
// Plain DOM over a GameNet (the server decides everything; this panel only shows rows and sends intents).
import { MARKET } from '../config/market.ts';
import { priceError, saleFee } from '../gameplay/marketRules.ts';
import { shortAddress } from '../gameplay/walletMessage.ts';
import { AUTH } from '../config/auth.ts';
import type { GameNet, ListingRow, OwnedItemRow } from '../network/client.ts';
import '../../client/game/market.css';

/** How the lobby shows a catalog item. */
export interface MarketItemView { name: string; kind: string; portrait?: string }

type View = 'browse' | 'mine' | 'history';
type Filter = 'all' | 'character' | 'emote';
type Sort = 'cheap' | 'expensive' | 'new';

const CONFIRM_MS = 3000;
const HISTORY_ROWS = 20;
/** Listings drawn at once (after filter and sort); the rest are counted, not drawn. */
const MAX_ROWS = 60;
/** At most one redraw per this many ms (a busy market changes many times per second). */
const REDRAW_MS = 250;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class MarketPanel {
  readonly root: HTMLElement;
  private net: GameNet | null = null;
  private view: View = 'browse';
  private filter: Filter = 'all';
  private sort: Sort = 'cheap';
  /** Listing id waiting for the second (confirm) click, and until when. */
  private confirm: { id: bigint; until: number } | null = null;
  private busy = false;
  private drawQueued = false;
  private lastDraw = 0;
  private message = '';
  private messageIsError = false;
  /** Starts the wallet login (set by the lobby). */
  onLogin: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly describe: (ref: string) => MarketItemView) {
    this.root = document.createElement('section');
    this.root.className = 'menu-market menu-toy';
    this.root.setAttribute('aria-label', 'Market');
    this.root.hidden = true;
    parent.append(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
    this.root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target as HTMLElement).matches('.market-price')) (e.target as HTMLElement).closest('.market-row')?.querySelector<HTMLButtonElement>('[data-sell]')?.click(); });
    this.draw();
  }

  /** Connect the panel to a market-subscribed GameNet (null = offline). Call refresh() on market changes. */
  attach(net: GameNet | null): void { this.net = net; this.queueDraw(); }

  /** Redraw on the next frame (after a market change). */
  refresh(): void { this.queueDraw(); }

  setStatus(text: string, error = false): void { this.message = text; this.messageIsError = error; this.queueDraw(); }

  private queueDraw(): void {
    if (this.drawQueued) return;
    this.drawQueued = true;
    const wait = Math.max(0, this.lastDraw + REDRAW_MS - performance.now());
    setTimeout(() => requestAnimationFrame(() => { this.drawQueued = false; if (!this.root.hidden) this.draw(); }), wait);
  }

  show(): void { this.root.hidden = false; this.draw(); }
  hide(): void { this.root.hidden = true; this.confirm = null; }

  private itemCell(ref: string): string {
    const d = this.describe(ref);
    const img = d.portrait ? `<img src="${d.portrait}" alt="">` : `<span class="market-icon">${d.kind === 'emote' ? '✦' : '?'}</span>`;
    return `<div class="market-thumb">${img}</div><div class="market-what"><strong>${esc(d.name)}</strong><small>${esc(d.kind)}</small></div>`;
  }

  private draw(): void {
    this.lastDraw = performance.now();
    // Keep what the player is doing across a redraw (other players' trades redraw the list): typed prices, the
    // focused field and the scroll position.
    const typed = new Map<string, string>();
    for (const input of this.root.querySelectorAll<HTMLInputElement>('.market-price')) if (input.value) typed.set(input.dataset.item ?? '', input.value);
    const active = document.activeElement as HTMLInputElement | null;
    const focusItem = active?.matches?.('.market-price') && this.root.contains(active) ? active.dataset.item ?? null : null;
    const caret = focusItem !== null ? active!.selectionStart : null;
    const scroll = this.root.querySelector<HTMLElement>('.market-list')?.scrollTop ?? 0;
    const m = this.net?.market, me = m?.account ?? '';
    const coins = m?.wallet?.coins;
    const tabs = (['browse', 'mine', 'history'] as const).map((v) =>
      `<button data-view="${v}" aria-pressed="${this.view === v}">${v === 'browse' ? 'Browse' : v === 'mine' ? 'My items' : 'History'}</button>`).join('');
    let body = '';
    if (!m) body = '<p class="market-empty">Connecting to the market…</p>';
    else if (!me && this.view !== 'browse') body = this.loginPrompt();
    else if (this.view === 'browse') body = this.browse(m.listings, me, coins ?? 0);
    else if (this.view === 'mine') body = this.mine(m.items, m.listings, me);
    else body = this.history(me);
    this.root.innerHTML = `
      <header><div><span class="menu-eyebrow">TRADE WITH PLAYERS</span><h2>Market</h2></div>
        <div class="market-coins" title="Your coins"><b>◉</b> ${coins === undefined ? '…' : coins}</div></header>
      <div class="menu-segment market-views" role="group" aria-label="Market view">${tabs}</div>
      ${this.view === 'browse' ? `<div class="market-tools">
        <select class="market-filter" aria-label="Filter"><option value="all">All items</option><option value="character">Characters</option><option value="emote">Emotes</option></select>
        <select class="market-sort" aria-label="Sort"><option value="cheap">Cheapest first</option><option value="expensive">Most expensive</option><option value="new">Newest</option></select></div>` : ''}
      <div class="market-list">${body}</div>
      <footer><small class="market-testnet">${esc(AUTH.network)} only. Never use a wallet that holds real funds.</small>
        <small>Every sale burns a ${Math.round(MARKET.feeRate * 100)}% fee (at least 1 coin). Coins come from matches.</small>
        <div class="market-status${this.messageIsError ? ' has-error' : ''}" role="status" aria-live="polite">${esc(this.message)}</div></footer>`;
    const f = this.root.querySelector<HTMLSelectElement>('.market-filter'), s = this.root.querySelector<HTMLSelectElement>('.market-sort');
    if (f) f.value = this.filter;
    if (s) s.value = this.sort;
    for (const input of this.root.querySelectorAll<HTMLInputElement>('.market-price')) {
      const value = typed.get(input.dataset.item ?? '');
      if (value !== undefined) input.value = value;
      if (focusItem !== null && input.dataset.item === focusItem) { input.focus(); try { input.setSelectionRange(caret, caret); } catch { /* number inputs */ } }
    }
    const list = this.root.querySelector<HTMLElement>('.market-list');
    if (list) list.scrollTop = scroll;
  }

  private browse(listings: ReadonlyMap<bigint, ListingRow>, me: string, coins: number): string {
    let rows = [...listings.values()].filter((l) => this.filter === 'all' || l.ref.startsWith(`${this.filter}:`));
    rows.sort((a, b) => this.sort === 'cheap' ? a.price - b.price || Number(a.id - b.id)
      : this.sort === 'expensive' ? b.price - a.price || Number(a.id - b.id)
      : Number(b.id - a.id));
    const guest = me === '' ? this.loginPrompt() : '';
    if (!rows.length) return `${guest}<p class="market-empty">Nothing for sale yet. List one of your items in "My items".</p>`;
    const now = performance.now(), total = rows.length;
    rows = rows.slice(0, MAX_ROWS);
    const more = total > rows.length ? `<p class="market-empty">Showing ${rows.length} of ${total}. Use the filter and sort to find more.</p>` : '';
    return guest + rows.map((l) => {
      const own = me !== '' && l.seller === me;
      const confirming = this.confirm && this.confirm.id === l.id && this.confirm.until > now;
      const action = own ? `<button data-cancel="${l.id}" class="menu-small-action">Cancel</button>`
        : `<button data-buy="${l.id}" data-price="${l.price}" class="menu-small-action market-buy${confirming ? ' confirm' : ''}" ${coins < l.price || this.busy || !me ? 'disabled' : ''}>${confirming ? `Confirm ${l.price}?` : `Buy ◉ ${l.price}`}</button>`;
      return `<div class="market-row">${this.itemCell(l.ref)}<div class="market-meta">${own ? 'Your listing' : `Seller ${esc(shortAddress(l.seller))}`}</div>${action}</div>`;
    }).join('') + more;
  }

  private loginPrompt(): string {
    return `<div class="market-login"><p>Log in with a wallet to buy, sell and keep your items.</p>
      <button data-login class="menu-small-action">Log in with wallet</button>
      <small>Signing is free: it is not a transaction. ${esc(AUTH.network)} only, mainnet is never used.</small></div>`;
  }

  private mine(items: ReadonlyMap<bigint, OwnedItemRow>, listings: ReadonlyMap<bigint, ListingRow>, me: string): string {
    const listed = new Map<bigint, ListingRow>();
    for (const l of listings.values()) if (l.seller === me) listed.set(l.itemId, l);
    const own = [...items.values()].filter((i) => i.owner === me).sort((a, b) => a.ref.localeCompare(b.ref) || Number(a.id - b.id));
    if (!own.length) return '<p class="market-empty">You have no items yet.</p>';
    return own.map((i) => {
      const l = listed.get(i.id);
      const action = l
        ? `<div class="market-meta">Listed at ◉ ${l.price}</div><button data-cancel="${l.id}" class="menu-small-action">Cancel</button>`
        : `<input class="market-price" type="number" inputmode="numeric" min="${MARKET.price.min}" max="${MARKET.price.max}" step="1" placeholder="Price" aria-label="Price in coins" data-item="${i.id}">
           <button data-sell="${i.id}" class="menu-small-action" ${this.busy ? 'disabled' : ''}>Sell</button>`;
      return `<div class="market-row">${this.itemCell(i.ref)}${action}</div>`;
    }).join('');
  }

  private history(me: string): string {
    const trades = [...(this.net?.market.trades.values() ?? [])].sort((a, b) => Number(b.id - a.id)).slice(0, HISTORY_ROWS);
    if (!trades.length) return '<p class="market-empty">No trades yet.</p>';
    return trades.map((t) => {
      const mine = me && t.buyer === me ? 'You bought' : me && t.seller === me ? `You sold (+${t.price - t.fee})` : 'Sold';
      return `<div class="market-row">${this.itemCell(t.ref)}<div class="market-meta">${mine}</div><div class="market-price-tag">◉ ${t.price}</div></div>`;
    }).join('');
  }

  private onChange(e: Event): void {
    const t = e.target as HTMLElement;
    if (t.matches('.market-filter')) { this.filter = (t as HTMLSelectElement).value as Filter; this.draw(); }
    if (t.matches('.market-sort')) { this.sort = (t as HTMLSelectElement).value as Sort; this.draw(); }
  }

  private run(action: () => Promise<void>, done: string): void {
    this.busy = true; this.setStatus('…');
    action().then(() => this.setStatus(done), (err: unknown) => this.setStatus(err instanceof Error ? err.message : String(err), true))
      .finally(() => { this.busy = false; this.queueDraw(); });
  }

  private onClick(e: Event): void {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    e.stopPropagation();
    if (b.dataset.view) { this.view = b.dataset.view as View; this.confirm = null; this.message = ''; this.draw(); return; }
    if (b.hasAttribute('data-login')) { this.onLogin?.(); return; }
    const net = this.net;
    if (!net) return;
    if (b.dataset.buy) {
      const id = BigInt(b.dataset.buy), price = Number(b.dataset.price), now = performance.now();
      if (!this.confirm || this.confirm.id !== id || this.confirm.until < now) {
        this.confirm = { id, until: now + CONFIRM_MS };
        this.draw();
        setTimeout(() => this.queueDraw(), CONFIRM_MS + 50);
        return;
      }
      this.confirm = null;
      this.run(() => net.buyListing(id, price), `Bought for ${price} coins.`);
    } else if (b.dataset.cancel) {
      this.run(() => net.cancelListing(BigInt(b.dataset.cancel!)), 'Listing cancelled.');
    } else if (b.dataset.sell) {
      const input = this.root.querySelector<HTMLInputElement>(`.market-price[data-item="${b.dataset.sell}"]`);
      const price = Number(input?.value);
      // Check before sending: a negative or huge number would not even fit the server's u32 argument.
      const error = input?.value ? priceError(price) : 'enter a price';
      if (error) { this.setStatus(`${error[0].toUpperCase()}${error.slice(1)}.`, true); return; }
      const fee = saleFee(price);
      this.run(() => net.listItem(BigInt(b.dataset.sell!), price), `Listed for ${price} coins (you get ${price - fee} after the fee).`);
    }
  }
}
