// TAB scoreboard (plain DOM): one table per team with name, character, kills, deaths, ping.

export interface ScoreRow { id: string; name: string; character: string; kills: number; deaths: number; ping: number; isBot: boolean; alive: boolean; team: string }

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

  /** Throttled by the caller (~10 Hz while visible). */
  update(rows: readonly ScoreRow[], meId: string, scoreA: number, scoreB: number): void {
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    const table = (team: string, score: number) => {
      const list = rows.filter((r) => r.team === team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      const body = list.map((r) => `<tr class="${r.id === meId ? 'me' : ''} ${r.alive ? '' : 'dead'}"><td>${esc(r.name)}</td>` +
        `<td>${esc(r.character)}</td><td class="num">${r.kills}</td><td class="num">${r.deaths}</td>` +
        `<td class="num">${r.isBot ? 'BOT' : r.ping}</td></tr>`).join('');
      return `<table><tr><th class="team-${team.toLowerCase()}">TEAM ${team} · ${score}</th><th>Character</th><th>K</th><th>D</th><th>Ping</th></tr>${body}</table>`;
    };
    const html = table('A', scoreA) + table('B', scoreB);
    if (html !== this.lastHtml) { this.lastHtml = html; this.root.innerHTML = html; }
  }
}
