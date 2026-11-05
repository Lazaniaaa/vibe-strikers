// Lobby LEADERS tab (GAME.md 6.8): all-time leaderboard of logged-in players (wins, kills, coins). Plain DOM over
// a market-subscribed GameNet; redraws are throttled like the market panel.
import { shortAddress } from '../gameplay/walletMessage.ts';
import type { GameNet } from '../network/client.ts';

type Sort = 'wins' | 'kills' | 'coins';

/** Rows drawn (my own row is added below when I am further down). */
const TOP_ROWS = 50;
const REDRAW_MS = 500;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

interface Line { owner: string; name: string; matches: number; wins: number; kills: number; deaths: number; headshots: number; coins: number }

export class LeaderPanel {
  readonly root: HTMLElement;
  private net: GameNet | null = null;
  private sort: Sort = 'wins';
  private drawQueued = false;
  private lastDraw = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('section');
    this.root.className = 'menu-market menu-leaders menu-toy';
    this.root.setAttribute('aria-label', 'Leaderboard');
    this.root.hidden = true;
    parent.append(this.root);
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-sort]');
      if (!b) return;
      e.stopPropagation();
      this.sort = b.dataset.sort as Sort;
      this.draw();
    });
    this.draw();
  }

  attach(net: GameNet | null): void { this.net = net; this.refresh(); }
  show(): void { this.root.hidden = false; this.draw(); }
  hide(): void { this.root.hidden = true; }

  refresh(): void {
    if (this.drawQueued || this.root.hidden) return;
    this.drawQueued = true;
    const wait = Math.max(0, this.lastDraw + REDRAW_MS - performance.now());
    setTimeout(() => requestAnimationFrame(() => { this.drawQueued = false; if (!this.root.hidden) this.draw(); }), wait);
  }

  private lines(): Line[] {
    const m = this.net?.market;
    if (!m) return [];
    const out = new Map<string, Line>();
    for (const s of m.stats.values()) out.set(s.owner, { ...s, coins: m.wallets.get(s.owner)?.coins ?? 0 });
    for (const w of m.wallets.values()) {
      if (!out.has(w.owner)) out.set(w.owner, { owner: w.owner, name: '', matches: 0, wins: 0, kills: 0, deaths: 0, headshots: 0, coins: w.coins });
    }
    const key = this.sort;
    return [...out.values()].sort((a, b) => b[key] - a[key] || b.wins - a.wins || b.kills - a.kills || a.owner.localeCompare(b.owner));
  }

  private row(l: Line, rank: number, me: string): string {
    const kd = l.deaths ? (l.kills / l.deaths).toFixed(2) : l.kills ? String(l.kills) : '–';
    const who = l.name ? `<strong>${esc(l.name)}</strong><small>${esc(shortAddress(l.owner))}</small>` : `<strong>${esc(shortAddress(l.owner))}</strong>`;
    return `<tr class="${l.owner === me ? 'is-me' : ''}"><td>${rank}</td><td>${who}</td>
      <td>${l.wins}</td><td>${l.kills}</td><td>${kd}</td><td>${l.matches}</td><td>◉ ${l.coins}</td></tr>`;
  }

  private draw(): void {
    this.lastDraw = performance.now();
    const m = this.net?.market, me = m?.account ?? '';
    const all = this.lines();
    const top = all.slice(0, TOP_ROWS);
    const myRank = me ? all.findIndex((l) => l.owner === me) : -1;
    let body = top.map((l, i) => this.row(l, i + 1, me)).join('');
    if (myRank >= TOP_ROWS) body += `<tr class="gap"><td colspan="7">…</td></tr>${this.row(all[myRank], myRank + 1, me)}`;
    const sorts = (['wins', 'kills', 'coins'] as const).map((s) =>
      `<button data-sort="${s}" aria-pressed="${this.sort === s}">${s === 'wins' ? 'Wins' : s === 'kills' ? 'Kills' : 'Coins'}</button>`).join('');
    const empty = !m ? 'Connecting…' : all.length ? '' : 'No players yet. Log in with a wallet and play an online match.';
    this.root.innerHTML = `
      <header><div><span class="menu-eyebrow">ALL TIME</span><h2>Leaders</h2></div>
        <div class="market-coins" title="Your place">${myRank >= 0 ? `#${myRank + 1}` : me ? '–' : 'Guest'}</div></header>
      <div class="menu-segment market-views" role="group" aria-label="Sort by">${sorts}</div>
      <div class="market-list">${empty ? `<p class="market-empty">${empty}</p>` : `<table class="leaders-table">
        <thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Kills</th><th>K/D</th><th>Matches</th><th>Coins</th></tr></thead>
        <tbody>${body}</tbody></table>`}</div>
      <footer><small>Every online match counts for logged-in players. ${me ? '' : 'Log in with a wallet on the player card to be listed.'}</small></footer>`;
  }
}
