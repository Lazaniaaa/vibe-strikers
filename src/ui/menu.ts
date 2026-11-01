import type { BotDifficulty } from '../config/bots.ts';
import type { GameMode } from '../gameplay/mode.ts';
import { MUTATOR_IDS, MUTATORS } from '../config/mutators.ts';
// Start menu (plain DOM): nickname, character, Quick Play, private room, join by code, offline practice.

/** What the menu needs to list a character (name + a colour swatch). */
export interface MenuCharacter { name: string; body: string; accent: string }

export type MenuChoice =
  | { kind: 'quick'; name: string }
  | { kind: 'create'; name: string; bots: boolean; difficulty: BotDifficulty; mode: GameMode; teams: boolean; mutator: string }
  | { kind: 'join'; name: string; code: string }
  | { kind: 'offline'; name: string; difficulty: BotDifficulty; mode: GameMode; teams: boolean; mutator: string };

export class Menu {
  readonly root: HTMLElement;
  private status: HTMLElement;
  private nameInput: HTMLInputElement;
  private codeInput: HTMLInputElement;
  private resolve: ((c: MenuChoice) => void) | null = null;
  /** Index of the selected character. */
  character: number;
  private savedMode: GameMode;
  private onMode: (m: GameMode) => void;

  constructor(parent: HTMLElement, defaultName: string, list: readonly MenuCharacter[], selected: number, onCharacter: (i: number) => void,
    difficulty: BotDifficulty = 'normal', onDifficulty: (d: BotDifficulty) => void = () => undefined,
    mode: GameMode = 'elimination', onMode: (m: GameMode) => void = () => undefined) {
    this.character = selected;
    this.savedMode = mode; this.onMode = onMode;
    this.root = document.createElement('div');
    this.root.className = 'menu';
    this.root.innerHTML = `
      <div class="menu-card">
        <div class="menu-title">Voxel Arena</div>
        <label class="menu-label">Nickname <input class="menu-name" maxlength="16" /></label>
        <div class="menu-label">Character <span class="menu-char-name"></span></div>
        <div class="menu-chars"></div>
        <button class="menu-btn menu-quick">Quick Play</button>
        <button class="menu-btn menu-create">Create private room</button>
        <label class="menu-check"><input type="checkbox" class="menu-bots" checked /> fill the private room with bots</label>
        <label class="menu-check">Bot difficulty (practice and private rooms)
          <select class="menu-difficulty"><option value="easy">easy</option><option value="normal">normal</option><option value="hard">hard</option></select></label>
        <label class="menu-check">Mode (private rooms and practice)
          <select class="menu-mode"><option value="elimination">Elimination</option><option value="cornucopia">Cornucopia (Hunger Games)</option></select></label>
        <label class="menu-check"><input type="checkbox" class="menu-teams" checked /> Cornucopia in teams (off = free-for-all)</label>
        <label class="menu-check">Mutator (private rooms and practice; Quick Play: mutator of the day)
          <select class="menu-mutator"><option value="">none</option>${MUTATOR_IDS.map((m) => `<option value="${m}">${MUTATORS[m].label}</option>`).join('')}</select></label>
        <div class="menu-row"><input class="menu-code" maxlength="5" placeholder="CODE" /><button class="menu-btn menu-join">Join</button></div>
        <button class="menu-btn menu-offline">Practice offline (bots)</button>
        <div class="menu-settings-slot"></div>
        <div class="menu-status"></div>
      </div>`;
    parent.appendChild(this.root);
    this.status = this.root.querySelector('.menu-status')!;
    this.nameInput = this.root.querySelector('.menu-name')!;
    this.codeInput = this.root.querySelector('.menu-code')!;
    this.nameInput.value = defaultName;
    const grid = this.root.querySelector<HTMLElement>('.menu-chars')!, label = this.root.querySelector<HTMLElement>('.menu-char-name')!;
    const buttons = list.map((c, i) => {
      const b = document.createElement('button');
      b.className = 'menu-char'; b.title = c.name;
      b.style.background = `linear-gradient(135deg, ${c.body} 60%, ${c.accent} 60%)`;
      b.addEventListener('click', () => select(i));
      grid.appendChild(b);
      return b;
    });
    const select = (i: number) => {
      this.character = i;
      buttons.forEach((b, j) => b.classList.toggle('selected', j === i));
      label.textContent = list[i].name;
      onCharacter(i);
    };
    select(Math.min(Math.max(0, selected), list.length - 1));
    const pick = (c: MenuChoice) => { const r = this.resolve; this.resolve = null; r?.(c); };
    const name = () => this.nameInput.value.trim();
    this.root.querySelector('.menu-quick')!.addEventListener('click', () => pick({ kind: 'quick', name: name() }));
    const bots = this.root.querySelector<HTMLInputElement>('.menu-bots')!;
    const level = this.root.querySelector<HTMLSelectElement>('.menu-difficulty')!;
    level.value = difficulty;
    level.addEventListener('change', () => onDifficulty(level.value as BotDifficulty));
    const diff = () => level.value as BotDifficulty;
    const modeSel = this.root.querySelector<HTMLSelectElement>('.menu-mode')!;
    const teamsBox = this.root.querySelector<HTMLInputElement>('.menu-teams')!;
    const mutatorSel = this.root.querySelector<HTMLSelectElement>('.menu-mutator')!;
    modeSel.value = this.savedMode;
    const modeNow = (): GameMode => (modeSel.value === 'cornucopia' ? 'cornucopia' : 'elimination');
    modeSel.addEventListener('change', () => { this.savedMode = modeNow(); this.onMode(modeNow()); });
    this.root.querySelector('.menu-create')!.addEventListener('click', () => pick({ kind: 'create', name: name(), bots: bots.checked, difficulty: diff(),
      mode: modeNow(), teams: teamsBox.checked, mutator: mutatorSel.value }));
    this.root.querySelector('.menu-join')!.addEventListener('click', () => pick({ kind: 'join', name: name(), code: this.codeInput.value.trim().toUpperCase() }));
    this.root.querySelector('.menu-offline')!.addEventListener('click', () => pick({ kind: 'offline', name: name(), difficulty: diff(),
      mode: modeNow(), teams: teamsBox.checked, mutator: mutatorSel.value }));
  }

  /** Where the Settings button goes. */
  get settingsSlot(): HTMLElement { return this.root.querySelector('.menu-settings-slot')!; }

  /** Wait for the next button press. */
  choose(): Promise<MenuChoice> { return new Promise((r) => { this.resolve = r; }); }

  setStatus(text: string): void { this.status.textContent = text; }

  hide(): void { this.root.style.display = 'none'; }

  show(): void { this.root.style.display = ''; this.setStatus(''); }
}
