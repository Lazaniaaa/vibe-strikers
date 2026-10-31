// Start menu (plain DOM): nickname, Quick Play, private room, join by code, offline practice.

export type MenuChoice =
  | { kind: 'quick'; name: string }
  | { kind: 'create'; name: string; bots: boolean }
  | { kind: 'join'; name: string; code: string }
  | { kind: 'offline'; name: string };

export class Menu {
  readonly root: HTMLElement;
  private status: HTMLElement;
  private nameInput: HTMLInputElement;
  private codeInput: HTMLInputElement;
  private resolve: ((c: MenuChoice) => void) | null = null;

  constructor(parent: HTMLElement, defaultName: string) {
    this.root = document.createElement('div');
    this.root.className = 'menu';
    this.root.innerHTML = `
      <div class="menu-card">
        <div class="menu-title">Voxel Arena</div>
        <label class="menu-label">Nickname <input class="menu-name" maxlength="16" /></label>
        <button class="menu-btn menu-quick">Quick Play</button>
        <button class="menu-btn menu-create">Create private room</button>
        <label class="menu-check"><input type="checkbox" class="menu-bots" checked /> fill the private room with bots</label>
        <div class="menu-row"><input class="menu-code" maxlength="5" placeholder="CODE" /><button class="menu-btn menu-join">Join</button></div>
        <button class="menu-btn menu-offline">Practice offline (bots)</button>
        <div class="menu-status"></div>
      </div>`;
    parent.appendChild(this.root);
    this.status = this.root.querySelector('.menu-status')!;
    this.nameInput = this.root.querySelector('.menu-name')!;
    this.codeInput = this.root.querySelector('.menu-code')!;
    this.nameInput.value = defaultName;
    const pick = (c: MenuChoice) => { const r = this.resolve; this.resolve = null; r?.(c); };
    const name = () => this.nameInput.value.trim();
    this.root.querySelector('.menu-quick')!.addEventListener('click', () => pick({ kind: 'quick', name: name() }));
    const bots = this.root.querySelector<HTMLInputElement>('.menu-bots')!;
    this.root.querySelector('.menu-create')!.addEventListener('click', () => pick({ kind: 'create', name: name(), bots: bots.checked }));
    this.root.querySelector('.menu-join')!.addEventListener('click', () => pick({ kind: 'join', name: name(), code: this.codeInput.value.trim().toUpperCase() }));
    this.root.querySelector('.menu-offline')!.addEventListener('click', () => pick({ kind: 'offline', name: name() }));
  }

  /** Wait for the next button press. */
  choose(): Promise<MenuChoice> { return new Promise((r) => { this.resolve = r; }); }

  setStatus(text: string): void { this.status.textContent = text; }

  hide(): void { this.root.style.display = 'none'; }
}
