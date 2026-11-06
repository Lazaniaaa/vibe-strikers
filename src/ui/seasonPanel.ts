// Lobby SEASON tab (GAME.md 6.10): player level, the season reward track, this week's missions, one claim button.
// Plain DOM over a market-subscribed GameNet; redraws are throttled like the market panel.
import { PROGRESSION, QUESTS, SEASON, type QuestKind } from '../config/season.ts';
import { levelOf, questEndMs, questLine, seasonActive, seasonLevel, seasonReward } from '../gameplay/progression.ts';
import { nftRef, nftReward, nftRewardName } from '../gameplay/nft.ts';
import { NFT } from '../config/nft.ts';
import type { GameNet } from '../network/client.ts';
import type { MarketItemView } from './marketPanel.ts';
import '../../client/game/market.css';

const REDRAW_MS = 500;
const HOUR_MS = 3_600_000;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 100);

function timeLeft(ms: number): string {
  const hours = Math.max(0, Math.ceil(ms / HOUR_MS));
  return hours >= 48 ? `${Math.floor(hours / 24)} days` : `${hours} h`;
}

export class SeasonPanel {
  readonly root: HTMLElement;
  /** Set by the lobby: open the wallet login. */
  onLogin: (() => void) | null = null;
  private net: GameNet | null = null;
  private drawQueued = false;
  private lastDraw = 0;
  private status = '';
  private statusBad = false;
  private busy = false;
  private questKind: QuestKind = 'day';
  /** Shows an NFT skin on the lobby character (null = none). */
  onPreview: ((ref: string | null) => void) | null = null;
  private previewRef: string | null = null;

  constructor(parent: HTMLElement, private readonly describe: (ref: string) => MarketItemView) {
    this.root = document.createElement('section');
    this.root.className = 'menu-market menu-season menu-toy';
    this.root.setAttribute('aria-label', SEASON.name);
    this.root.hidden = true;
    parent.append(this.root);
    this.root.addEventListener('click', (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-tryon]');
      if (cell) {
        this.previewRef = this.previewRef === cell.dataset.tryon ? null : cell.dataset.tryon ?? null;
        this.onPreview?.(this.previewRef);
        this.draw();
        return;
      }
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || b.disabled) return;
      e.stopPropagation();
      if (b.dataset.login !== undefined) this.onLogin?.();
      else if (b.dataset.claim !== undefined) void this.claim();
      else if (b.dataset.quests) { this.questKind = b.dataset.quests as QuestKind; this.draw(); }
    });
    this.draw();
  }

  attach(net: GameNet | null): void { this.net = net; this.refresh(); }
  show(): void { this.root.hidden = false; this.draw(); }
  hide(): void {
    this.root.hidden = true;
    if (this.previewRef) { this.previewRef = null; this.onPreview?.(null); }
  }

  refresh(): void {
    if (this.drawQueued || this.root.hidden) return;
    this.drawQueued = true;
    const wait = Math.max(0, this.lastDraw + REDRAW_MS - performance.now());
    setTimeout(() => requestAnimationFrame(() => { this.drawQueued = false; if (!this.root.hidden) this.draw(); }), wait);
  }

  private async claim(): Promise<void> {
    if (!this.net || this.busy) return;
    this.busy = true; this.status = ''; this.draw();
    try {
      await this.net.claimSeasonRewards();
      this.status = 'Rewards claimed. Skins are in the My skins panel on the left.'; this.statusBad = false;
    } catch (e) {
      this.status = e instanceof Error ? e.message : String(e); this.statusBad = true;
    }
    this.busy = false;
    this.draw();
  }

  private rewardCell(level: number, reached: number, claimed: number): string {
    const r = seasonReward(level);
    const item = r.item ? this.describe(r.item) : null;
    const state = level <= claimed ? 'is-claimed' : level <= reached ? 'is-ready' : '';
    const nft = nftReward(level), me = this.net?.market.account;
    const skinRef = nft && me ? nftRef(SEASON.id, level, me) : '';
    const skin = skinRef ? this.describe(skinRef).portrait : undefined; // this wallet's own skin
    const art = skin ? `<img src="${esc(skin)}" alt="" />` : item
      ? (item.portrait ? `<img src="${esc(item.portrait)}" alt="" />` : `<span class="season-emote">${esc(item.kind === 'emote' ? '♪' : '★')}</span>`)
      : `<span class="season-coins">◉ ${r.coins}</span>`;
    const title = `${item ? `${item.name} (${item.kind})${r.coins ? ` + ${r.coins} coins` : ''}` : `${r.coins} coins`}${nft ? ` + ${nftRewardName(nft)}${NFT.claimOpen ? ' (NFT)' : ''}` : ''}`;
    return `<li class="${state}${r.item ? ' has-item' : ''}${level === SEASON.levels ? ' is-final' : ''}${skinRef && skinRef === this.previewRef ? ' is-preview' : ''}"${skinRef ? ` data-tryon="${esc(skinRef)}"` : ''} title="${esc(title)}"><b>${level}</b>${art}${nft ? `<em class="season-nft" data-rarity="${nft.rarity}">${NFT.claimOpen ? 'NFT' : 'SKIN'}</em>` : ''}${level <= claimed ? '<i aria-label="claimed">✓</i>' : ''}</li>`;
  }

  private draw(): void {
    this.lastDraw = performance.now();
    const m = this.net?.market, me = m?.account ?? '', now = Date.now();
    const active = seasonActive(now);
    const row = me ? m?.seasonProgress.get(me) : undefined;
    const xp = row?.xp ?? 0, claimed = row?.claimedLevel ?? 0, reached = seasonLevel(xp);
    const into = reached >= SEASON.levels ? SEASON.xpPerLevel : xp % SEASON.xpPerLevel;
    const total = me ? m?.progress.get(me)?.xp ?? 0 : 0, player = levelOf(total);
    const toClaim = Math.max(0, reached - claimed);
    this.net?.syncQuests(); // a new day or week may have started while the lobby stayed open
    const kind = this.questKind, questRow = me ? m?.myQuests(kind) : undefined;
    const missions = QUESTS[kind].tracks.map((_, track) => {
      const q = questLine(kind, track, questRow, questRow?.done ?? 0);
      const pips = Array.from({ length: q.tiers }, (_x, i) => `<i class="${i < q.tier ? 'is-on' : ''}"></i>`).join('');
      return `<li class="${q.complete ? 'is-done' : ''}"><span>${esc(q.label)}</span><em class="season-pips" title="Tier ${Math.min(q.tier + 1, q.tiers)} of ${q.tiers}">${pips}</em><div class="season-bar"><i style="width:${pct(q.value, q.target)}%"></i></div><small>${q.value} / ${q.target}</small><b>${q.complete ? '✓' : `+${q.xp} XP`}</b></li>`;
    }).join('');
    const questTabs = (Object.keys(QUESTS) as QuestKind[]).map((k) => `<button data-quests="${k}" aria-pressed="${k === kind}">${QUESTS[k].label}</button>`).join('');
    const cells = Array.from({ length: SEASON.levels }, (_, i) => this.rewardCell(i + 1, reached, claimed)).join('');
    const when = now < SEASON.startMs ? 'STARTS SOON' : active ? `${timeLeft(SEASON.endMs - now).toUpperCase()} LEFT` : 'ENDED';
    const x = PROGRESSION.xp;
    const streak = me ? m?.streaks.get(me) : undefined;
    const action = !m ? '<p class="market-empty">Connecting…</p>'
      : !me ? '<button class="season-claim" data-login>Log in with wallet to earn XP</button>'
      : `<button class="season-claim" data-claim ${toClaim && !this.busy ? '' : 'disabled'}>${this.busy ? 'Claiming…' : toClaim ? `Claim ${toClaim} reward${toClaim > 1 ? 's' : ''}` : 'Nothing to claim yet'}</button>`;
    this.root.innerHTML = `
      <header><div><span class="menu-eyebrow">${when}${streak ? ` · 🔥 ${streak.streak} DAY STREAK (BEST ${streak.best})` : ''}</span><h2>${esc(SEASON.name)}</h2></div>
        <div class="market-coins" title="Your player level">${me ? `Lv ${player.level}` : 'Guest'}</div></header>
      <div class="season-progress"><div class="season-progress-text"><strong>Level ${reached} / ${SEASON.levels}</strong>
        <small>${reached >= SEASON.levels ? 'Track complete' : `${into} / ${SEASON.xpPerLevel} XP`}</small></div>
        <div class="season-bar"><i style="width:${pct(into, SEASON.xpPerLevel)}%"></i></div></div>
      ${action}
      ${this.status ? `<p class="market-status ${this.statusBad ? 'has-error' : ''}">${esc(this.status)}</p>` : ''}
      <div class="market-list season-scroll">
        <ol class="season-track">${cells}</ol>
        <h3><span>Missions</span><div class="menu-segment season-quest-tabs" role="group" aria-label="Mission period">${questTabs}</div>
          <small>${kind === 'season' ? 'all season' : `new in ${timeLeft(questEndMs(kind, now) - now)}`}</small></h3>
        <ul class="season-missions">${missions}</ul>
      </div>
      <footer><small>Match +${x.match} · win +${x.win} · kill +${x.kill} · headshot +${x.headshot} · first win of the day +${x.firstWinOfDay} XP.
        Real online matches only. Free for everyone, fixed rewards, all characters stay playable. Click a skin level to see it on your character.</small></footer>`;
  }
}
