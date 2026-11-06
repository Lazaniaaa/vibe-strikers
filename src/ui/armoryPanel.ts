// Lobby panel on the left (GAME.md 6.11): try a standard weapon or one of your NFT skins on the character, and send an NFT to
// your wallet. Plain DOM over a market-subscribed GameNet; the server decides everything, this panel only shows rows and sends intents.
import { GAME_WEAPONS } from '../config/weapons.ts';
import { REWARDS } from '../config/rewards.ts';
import { itemRarity } from '../gameplay/marketRules.ts';
import { nftName } from '../gameplay/nft.ts';
import type { GameNet } from '../network/client.ts';
import '../../client/game/market.css';

type View = 'weapons' | 'nfts';
export interface ArmoryArt { nft(ref: string): string | undefined; weapon(id: string): string | undefined }

const CONFIRM_MS = 3000;
const REDRAW_MS = 250;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

export class ArmoryPanel {
  readonly root: HTMLElement;
  private net: GameNet | null = null;
  private view: View = 'weapons';
  private previewRef: string | null = null;
  private sendConfirm: { ref: string; until: number } | null = null;
  private busy = false;
  private message = '';
  private drawQueued = false;
  private lastDraw = 0;
  /** Shows a weapon (`weapon:<id>`) or an NFT skin on the lobby character (null = none). */
  onPreview: ((ref: string | null) => void) | null = null;

  constructor(parent: HTMLElement, private readonly art: ArmoryArt) {
    this.root = document.createElement('section');
    this.root.className = 'menu-armory menu-toy';
    this.root.setAttribute('aria-label', 'Try on weapons');
    parent.append(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.draw();
  }

  attach(net: GameNet | null): void { this.net = net; this.refresh(); }

  /** The preview changed elsewhere (season track, leaving the lobby). */
  setPreview(ref: string | null): void { if (this.previewRef !== ref) { this.previewRef = ref; this.refresh(); } }

  refresh(): void {
    if (this.drawQueued) return;
    this.drawQueued = true;
    const wait = Math.max(0, this.lastDraw + REDRAW_MS - performance.now());
    setTimeout(() => requestAnimationFrame(() => { this.drawQueued = false; this.draw(); }), wait);
  }

  private row(ref: string, name: string, picture: string | undefined, sub: string, rarity: string, extra = ''): string {
    const on = this.previewRef === ref;
    const img = picture ? `<img src="${esc(picture)}" alt="">` : '<span class="market-icon">◆</span>';
    return `<div class="armory-row${on ? ' is-on' : ''}"${rarity ? ` data-rarity="${rarity}"` : ''}>
      <button class="armory-try" data-try="${esc(ref)}" aria-pressed="${on}" title="${on ? 'Take off' : 'Try on your character'}">
        <span class="market-thumb">${img}</span><span class="market-what"><strong>${esc(name)}</strong><small>${sub}</small></span></button>${extra}</div>`;
  }

  private weapons(): string {
    return GAME_WEAPONS.map((id) => this.row(`weapon:${id}`, cap(id), this.art.weapon(id), 'Standard', '')).join('');
  }

  private nfts(): string {
    const m = this.net?.market;
    if (!m) return '<p class="market-empty">Connecting…</p>';
    if (!m.account) return '<p class="market-empty">Log in with a wallet to see your NFTs.</p>';
    const own = [...m.items.values()].filter((i) => i.ref.startsWith('nft:'));
    if (!own.length) return '<p class="market-empty">No NFTs yet. The first one comes at season level 5.</p>';
    const now = performance.now();
    return own.map((i) => {
      const row = m.nfts.get(i.ref), rarity = itemRarity(i.ref);
      const pill = `<i class="market-tier">${rarity}</i>`;
      let extra = '';
      if (row?.status === 'queued') extra = '<div class="market-meta armory-state">Waiting to be sent</div>';
      else if (row?.status === 'sent') extra = `<div class="market-meta armory-state">In your wallet${row.tx ? ` · <a href="${REWARDS.chain.explorer}/tx/${esc(row.tx)}" target="_blank" rel="noreferrer">tx</a>` : ''}</div>`;
      else {
        const confirming = this.sendConfirm?.ref === i.ref && this.sendConfirm.until > now;
        extra = `<button data-towallet="${i.id}" data-ref="${esc(i.ref)}" class="menu-small-action market-buy armory-send${confirming ? ' confirm' : ''}" ${this.busy ? 'disabled' : ''} title="Free. The owner mints it to your wallet.">${confirming ? 'Sure? Send it' : 'To wallet'}</button>`;
      }
      return this.row(i.ref, nftName(i.ref), this.art.nft(i.ref), pill, rarity, extra);
    }).join('');
  }

  private draw(): void {
    this.lastDraw = performance.now();
    const list = this.root.querySelector<HTMLElement>('.armory-list');
    const scroll = list?.scrollTop ?? 0;
    const tabs = (['weapons', 'nfts'] as const).map((v) => `<button data-view="${v}" aria-pressed="${this.view === v}">${v === 'weapons' ? 'Weapons' : 'My NFTs'}</button>`).join('');
    this.root.innerHTML = `<div class="menu-segment">${tabs}</div>
      <div class="armory-list">${this.view === 'weapons' ? this.weapons() : this.nfts()}</div>
      <small class="armory-note${this.message ? ' has-message' : ''}">${esc(this.message || 'Click to try it on. Drag the character to turn it.')}</small>`;
    const next = this.root.querySelector<HTMLElement>('.armory-list');
    if (next) next.scrollTop = scroll;
  }

  private onClick(e: Event): void {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    e.stopPropagation();
    if (b.dataset.view) { this.view = b.dataset.view as View; this.message = ''; this.draw(); return; }
    if (b.dataset.try) {
      this.previewRef = this.previewRef === b.dataset.try ? null : b.dataset.try;
      this.onPreview?.(this.previewRef);
      this.draw();
      return;
    }
    if (b.dataset.towallet && b.dataset.ref && this.net) {
      const ref = b.dataset.ref, now = performance.now();
      if (!this.sendConfirm || this.sendConfirm.ref !== ref || this.sendConfirm.until < now) {
        this.sendConfirm = { ref, until: now + CONFIRM_MS };
        this.draw();
        setTimeout(() => this.refresh(), CONFIRM_MS + 50);
        return;
      }
      this.sendConfirm = null;
      this.busy = true;
      this.net.requestNftSend(BigInt(b.dataset.towallet))
        .then(() => { this.message = 'Asked to send it. It reaches your wallet with the next mint.'; }, (err: unknown) => { this.message = err instanceof Error ? err.message : String(err); })
        .finally(() => { this.busy = false; this.refresh(); });
      this.draw();
    }
  }
}
