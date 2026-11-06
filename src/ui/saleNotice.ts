// "Your item was sold" notice in the lobby (GAME.md 6.7). Sales made during a match or while away wait until the lobby
// is visible again; the last sale seen is remembered per account in this browser.
import { MARKET } from '../config/market.ts';
import { newSales, type SaleRow } from '../gameplay/marketRules.ts';

const KEY = 'vs-sale-seen:';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function readSeen(account: string): bigint | null {
  try {
    const value = localStorage.getItem(KEY + account);
    return value === null ? null : BigInt(value);
  } catch { return null; }
}
function writeSeen(account: string, id: bigint): void {
  try { localStorage.setItem(KEY + account, id.toString()); } catch { /* storage blocked: only this page remembers */ }
}

export class SaleNotice {
  private readonly el: HTMLElement;
  /** Per account: the last sale already shown. */
  private readonly seen = new Map<string, bigint>();
  private timer = 0;
  private count = 0;
  private coins = 0;

  constructor(private readonly parent: HTMLElement, private readonly nameOf: (ref: string) => string) {
    this.el = document.createElement('button');
    this.el.setAttribute('type', 'button');
    this.el.className = 'market-sale-notice';
    this.el.hidden = true;
    this.el.setAttribute('role', 'status');
    this.el.addEventListener('click', () => this.close());
    parent.append(this.el);
  }

  /** Call on market changes and when the lobby comes back. Does nothing while the lobby is hidden. */
  update(account: string, trades: Iterable<SaleRow>): void {
    if (!account || this.parent.style.display === 'none') return;
    const seen = this.seen.get(account) ?? readSeen(account);
    if (seen === null) {
      // First time on this browser: older sales are in History, only later ones are news.
      const start = newSales(trades, account, -1n).lastId;
      this.seen.set(account, start);
      writeSeen(account, start);
      return;
    }
    const sales = newSales(trades, account, seen);
    this.seen.set(account, sales.lastId);
    if (sales.count === 0) return;
    writeSeen(account, sales.lastId);
    this.count += sales.count;
    this.coins += sales.coins;
    const what = this.count === 1 ? `${esc(this.nameOf(sales.ref))} sold` : `${this.count} items sold`;
    this.el.innerHTML = `<b>${what}</b><span>◉ +${this.coins}</span>`;
    this.el.hidden = false;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.close(), MARKET.saleNoticeMs);
  }

  private close(): void {
    clearTimeout(this.timer);
    this.el.hidden = true;
    this.count = 0;
    this.coins = 0;
  }
}
