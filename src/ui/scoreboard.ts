// TAB scoreboard (plain DOM): one table per team with name, character, kills, deaths, ping.

import { TEAM_COLORS } from '../config/game.ts';

/** ally = same team as the local player (coloured like name tags and the kill feed). */
export interface ScoreRow { id: string; name: string; character: string; kills: number; deaths: number; ping: number; isBot: boolean; alive: boolean; team: string; ally: boolean }

export class Scoreboard {
  private root: HTMLElement;
  private visible = false;
  private lastHtml = '';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'scoreboard';
    parent.appendChild(this.root);
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.style.display = v ? 'flex' : 'none';
  }

  get isVisible(): boolean { return this.visible; }

  dispose(): void { this.root.remove(); }

  /** Throttled by the caller (~10 Hz while visible). */
  update(rows: readonly ScoreRow[], meId: string, scoreA: number, scoreB: number): void {
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    const table = (team: string, score: number) => {
      const list = rows.filter((r) => r.team === team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      const color = (ally: boolean) => (ally ? TEAM_COLORS.ally : TEAM_COLORS.enemy);
      const body = list.map((r) => `<tr class="${r.id === meId ? 'me' : ''} ${r.alive ? '' : 'dead'}"><td style="color:${color(r.ally)}">${esc(r.name)}</td>` +
        `<td>${esc(r.character)}</td><td class="num">${r.kills}</td><td class="num">${r.deaths}</td>` +
        `<td class="num">${r.isBot ? 'BOT' : r.ping}</td></tr>`).join('');
      const ally = list[0]?.ally ?? false;
      return `<table><tr><th style="color:${color(ally)}">TEAM ${team}${list.length ? (ally ? ' (yours)' : ' (enemy)') : ''} · ${score}</th><th>Character</th><th>K</th><th>D</th><th>Ping</th></tr>${body}</table>`;
    };
    const html = table('A', scoreA) + table('B', scoreB);
    if (html !== this.lastHtml) { this.lastHtml = html; this.root.innerHTML = html; }
  }
}
