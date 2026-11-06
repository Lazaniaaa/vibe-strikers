// Reward card at the end of an online match (GAME.md 6.10): what this match gave, as the difference between the account's
// rows now and at the match start. Plain DOM, updated from the throttled HUD block; redraws only when market rows change.
import { MARKET } from '../config/market.ts';
import { QUESTS, SEASON, type QuestKind } from '../config/season.ts';
import { levelOf, questsNewlyDone, seasonLevel, streakCoins } from '../gameplay/progression.ts';
import { weekPoints } from '../gameplay/rewards.ts';
import type { MarketView } from '../network/client.ts';

const KINDS = Object.keys(QUESTS) as QuestKind[];

interface Snapshot { coins: number; xp: number; seasonXp: number; points: number; streak: number; streakDay: number; done: Record<QuestKind, number> }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const barWidth = (xp: number) => (seasonLevel(xp) >= SEASON.levels ? 100 : ((xp % SEASON.xpPerLevel) / SEASON.xpPerLevel) * 100);

export class MatchSummary {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly bar: HTMLElement;
  private base: Snapshot;
  private showing = false;
  private drawnVersion = -1;

  constructor(parent: HTMLElement, private readonly market: MarketView, private readonly mvp: () => { name: string; kills: number } | null) {
    this.root = document.createElement('div');
    this.root.className = 'hud-summary';
    this.root.hidden = true;
    this.root.innerHTML = '<div class="hud-summary-body"></div><div class="hud-summary-bar"><i></i></div>';
    this.body = this.root.querySelector('.hud-summary-body')!;
    this.bar = this.root.querySelector('.hud-summary-bar i')!;
    parent.append(this.root);
    this.base = this.snapshot();
  }

  /** Call from the throttled HUD update with the room's phase. */
  update(phase: string): void {
    if (phase !== 'matchEnd') {
      if (this.showing) { this.showing = false; this.root.hidden = true; this.base = this.snapshot(); }
      return;
    }
    if (!this.showing) {
      this.showing = true;
      this.drawnVersion = -1;
      this.root.hidden = false;
      this.startBar();
    }
    if (this.market.version !== this.drawnVersion) { this.drawnVersion = this.market.version; this.draw(); }
  }

  dispose(): void { this.root.remove(); }

  private snapshot(): Snapshot {
    const m = this.market, me = m.account, week = m.weekStats.get(me), streak = m.streaks.get(me);
    return {
      streak: streak?.streak ?? 0,
      streakDay: streak?.lastDay ?? 0,
      coins: m.wallet?.coins ?? 0,
      xp: m.progress.get(me)?.xp ?? 0,
      seasonXp: m.seasonProgress.get(me)?.xp ?? 0,
      points: week ? weekPoints(week) : 0,
      done: { day: m.myQuests('day')?.done ?? 0, week: m.myQuests('week')?.done ?? 0, season: m.myQuests('season')?.done ?? 0 },
    };
  }

  /** The bar starts where the match started and slides to the new value (CSS transition). */
  private startBar(): void {
    this.bar.style.transition = 'none';
    this.bar.style.width = `${barWidth(this.base.seasonXp)}%`;
    void this.bar.offsetWidth;
    this.bar.style.transition = '';
  }

  private draw(): void {
    const m = this.market, me = m.account;
    const best = this.mvp();
    const mvp = best ? `<p class="hud-summary-mvp">MVP: <em>${esc(best.name)}</em> · ${best.kills} kill${best.kills > 1 ? 's' : ''}</p>` : '';
    if (!me) {
      this.body.innerHTML = `${mvp}<p class="hud-summary-note">Log in with a wallet in the lobby to earn XP, coins and STRIKE.</p>`;
      this.bar.parentElement!.hidden = true;
      return;
    }
    const now = this.snapshot(), base = this.base;
    const xp = now.xp - base.xp, coins = now.coins - base.coins, points = now.points - base.points;
    const level = levelOf(now.xp).level, levelUp = level > levelOf(base.xp).level;
    const reached = seasonLevel(now.seasonXp), season = m.seasonProgress.get(me);
    const ready = Math.max(0, reached - (season?.claimedLevel ?? 0));
    const seasonUp = reached > seasonLevel(base.seasonXp);
    const done = KINDS.flatMap((kind) => questsNewlyDone(kind, base.done[kind], now.done[kind]).map((q) => `<li>✓ ${QUESTS[kind].label}: ${q.label} <b>+${q.xp} XP</b></li>`));
    const into = reached >= SEASON.levels ? SEASON.xpPerLevel : now.seasonXp % SEASON.xpPerLevel;
    const streakUp = now.streakDay > base.streakDay ? `<p class="hud-summary-line">🔥 Day ${now.streak} streak: ◉ ${streakCoins(now.streak)} included</p>` : '';
    this.body.innerHTML = `${mvp}
      <div class="hud-summary-chips"><strong>+${xp} XP</strong><span>◉ +${coins}</span><span>+${points} STRIKE points</span></div>
      ${xp > 0 ? '' : `<p class="hud-summary-note">No XP or coins: the match must last at least ${MARKET.reward.minMatchSeconds} s.</p>`}
      ${streakUp}
      ${done.length ? `<ul>${done.join('')}</ul>` : ''}
      <p class="hud-summary-line">${levelUp ? `<em>LEVEL UP!</em> ` : ''}Lv ${level} · ${seasonUp ? '<em>Season level up!</em> ' : ''}${SEASON.name}: level ${reached} / ${SEASON.levels} · ${into} / ${SEASON.xpPerLevel} XP</p>
      ${ready > 0 ? `<p class="hud-summary-line"><em>${ready} reward${ready > 1 ? 's' : ''} ready</em> in the SEASON tab</p>` : ''}`;
    this.bar.parentElement!.hidden = false;
    // After a season level up the bar restarts from the left instead of sliding backwards.
    if (seasonUp) { this.bar.style.transition = 'none'; this.bar.style.width = '0%'; void this.bar.offsetWidth; this.bar.style.transition = ''; }
    this.bar.style.width = `${barWidth(now.seasonXp)}%`;
  }
}
