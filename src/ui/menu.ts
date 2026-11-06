import type { BotDifficulty } from '../config/bots.ts';
import type { GameMode } from '../gameplay/mode.ts';
import { MUTATOR_IDS, MUTATORS } from '../config/mutators.ts';
import { MENU } from '../config/game.ts';
import { LOBBY_EMOTES, type LobbyEmoteId } from '../characters/lobbyEmotes';
import '../../client/game/menuEmotes.css';

/** Lightweight metadata; all current characters are unlocked. No Three dependency. */
export interface MenuCharacter { name: string; body: string; accent: string; unlock?: boolean }
export type MenuChoice =
  | { kind: 'quick'; name: string }
  | { kind: 'create'; name: string; bots: boolean; difficulty: BotDifficulty; mode: GameMode; teams: boolean; mutator: string }
  | { kind: 'join'; name: string; code: string }
  | { kind: 'offline'; name: string; difficulty: BotDifficulty; mode: GameMode; teams: boolean; mutator: string };

export type MenuTab = 'play' | 'characters' | 'market' | 'leaders' | 'season';

/** Login state shown on the player card (GAME.md 6.8). */
export interface MenuAccount { online: boolean; address: string; coins: number | null; busy?: boolean; level?: number }

export class Menu {
  readonly root: HTMLElement;
  character: number;
  onCharacterView: ((index: number) => void) | null = null;
  onVisibility: ((visible: boolean) => void) | null = null;
  /** Called when a tab opens (the MARKET panel lives in main.tsx). */
  onTab: ((tab: MenuTab) => void) | null = null;
  /** Wallet login / logout clicked on the player card (main.tsx does the work). */
  onLogin: (() => void) | null = null;
  onLogout: (() => void) | null = null;
  private resolve: ((choice: MenuChoice) => void) | null = null;
  private readonly status: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly codeInput: HTMLInputElement;
  private readonly selectCharacter: (index: number) => void;
  private list: readonly MenuCharacter[] = [];
  private buttons: HTMLButtonElement[] = [];
  private images: HTMLImageElement[] = [];
  private portraits = new Map<number, { url: string; pixels: number }>();
  private tab: MenuTab = 'play';
  private destination: 'online' | 'practice' = 'online';
  private difficulty: BotDifficulty;
  private mode: GameMode;
  private emoteKeys = false;

  constructor(parent: HTMLElement, defaultName: string, list: readonly MenuCharacter[], selected: number, onCharacter: (index: number) => void,
    difficulty: BotDifficulty = 'normal', onDifficulty: (level: BotDifficulty) => void = () => undefined,
    mode: GameMode = 'elimination', onMode: (mode: GameMode) => void = () => undefined) {
    this.character = selected; this.difficulty = difficulty; this.mode = mode;
    this.root = document.createElement('main'); this.root.className = 'menu'; this.root.dataset.tab = 'play';
    this.root.setAttribute('aria-label', 'Vibe Strikers lobby');
    for (const [key, color] of Object.entries(MENU.palette)) this.root.style.setProperty(`--menu-${key}`, color);
    this.root.style.setProperty('--menu-display', MENU.displayFont);
    this.root.innerHTML = `
      <div class="menu-scene-host"></div><div class="menu-vignette"></div><div class="menu-dimmer"></div>
      <header class="menu-header">
        <div class="menu-logo" aria-label="Vibe Strikers beta"><svg class="menu-block" viewBox="0 0 56 60" aria-hidden="true"><path class="block-top" d="M28 3 52 16 28 29 4 16Z"/><path class="block-left" d="M4 16 28 29 28 56 4 43Z"/><path class="block-right" d="M28 29 52 16 52 43 28 56Z"/><path class="block-notch" d="M16 24 16 36 28 43 40 36 40 24"/></svg><span>VIBE<br>STRIKERS</span><b class="menu-beta">BETA</b></div>
        <nav class="menu-tabs menu-toy" aria-label="Lobby tabs"><button class="menu-tab active" data-tab="play" aria-pressed="true"><kbd>1</kbd> PLAY</button><button class="menu-tab" data-tab="characters" aria-pressed="false"><kbd>2</kbd> CHARACTERS</button><button class="menu-tab" data-tab="market" aria-pressed="false"><kbd>3</kbd> MARKET</button><button class="menu-tab" data-tab="leaders" aria-pressed="false"><kbd>4</kbd> LEADERS</button><button class="menu-tab" data-tab="season" aria-pressed="false"><kbd>5</kbd> SEASON</button><div class="menu-settings-slot"></div></nav>
      </header>
      <section class="menu-player menu-toy" aria-label="Player card"><div class="menu-mini"><img alt="Selected character portrait" hidden /></div><label><span class="menu-eyebrow">YOUR NICKNAME <b aria-hidden="true">✎</b></span><input class="menu-name" aria-label="Nickname" maxlength="${MENU.nameMaxLength}" placeholder="Your name" autocomplete="nickname" /></label><div class="menu-account" aria-live="polite" hidden></div></section>
      <section class="menu-identity" aria-label="Selected character"><span class="menu-identity-tag">READY FOR THE ARENA</span><h1 class="menu-hero-name">YOUR CHARACTER</h1><div class="menu-change menu-toy"><button class="menu-prev" aria-label="Previous character">‹</button><button class="menu-open-characters">Change character <kbd>← →</kbd></button><button class="menu-next" aria-label="Next character">›</button></div></section>
      <aside class="menu-card menu-toy" aria-label="Match setup">
        <div class="menu-card-heading"><div><span class="menu-eyebrow">ONE LIFE. MAKE IT COUNT.</span><h2>Let's play.</h2></div><span class="menu-card-icon" aria-hidden="true">✦</span></div>
        <div class="menu-segment menu-destinations" role="group" aria-label="Play destination"><button data-destination="online" aria-pressed="true">Online</button><button data-destination="practice" aria-pressed="false">Practice <small>vs bots</small></button></div>
        <div class="menu-difficulty-row" hidden><span class="menu-eyebrow">BOT DIFFICULTY</span><div class="menu-segment menu-levels" role="group" aria-label="Bot difficulty"><button data-level="easy">Easy</button><button data-level="normal">Normal</button><button data-level="hard">Hard</button></div></div>
        <span class="menu-eyebrow menu-rules-label">ROOM & PRACTICE RULES</span>
        <div class="menu-segment menu-modes" role="group" aria-label="Game mode"><button data-mode="elimination">Elimination</button><button data-mode="cornucopia">Cornucopia</button></div>
        <label class="menu-check menu-teams-row" hidden><span>Play Cornucopia in teams</span><input class="menu-teams" type="checkbox" checked /></label>
        <label class="menu-select-row"><span class="menu-eyebrow">MUTATOR</span><select class="menu-mutator" aria-label="Mutator"><option value="">None</option>${MUTATOR_IDS.map(id => `<option value="${id}">${MUTATORS[id].label}</option>`).join('')}</select></label>
        <p class="menu-public-note">Online PLAY uses public match rules.</p>
        <div class="menu-friends-section"><button class="menu-friends-toggle" aria-expanded="false">Play with friends <span aria-hidden="true">+</span></button>
          <div class="menu-friends-options" hidden><label class="menu-check"><span>Fill empty slots with bots</span><input class="menu-bots" type="checkbox" checked /></label><button class="menu-create menu-small-action">Create room <span>+</span></button><div class="menu-join-row"><input class="menu-code" aria-label="Room code" placeholder="CODE" maxlength="${MENU.codeMaxLength}" autocomplete="off" /><button class="menu-join menu-small-action">Join <span>→</span></button></div></div>
        </div>
        <div class="menu-status" role="status" aria-live="polite"></div>
        <button class="menu-launch"><span><strong>PLAY</strong><small class="menu-launch-caption">FIND AN ONLINE MATCH</small></span><kbd>Enter</kbd><b aria-hidden="true">➜</b></button>
      </aside>
      <section class="menu-roster menu-toy" aria-label="Character selection" hidden><header><div><span class="menu-eyebrow">PICK YOUR LOOK</span><h2>Characters</h2></div><button class="menu-close-characters" aria-label="Close character selection">×</button></header><div class="menu-chars" role="group" aria-label="Character portraits"></div><footer><div><strong class="menu-char-name" aria-live="polite">Loading characters…</strong><small class="menu-char-count"></small></div><button class="menu-random menu-small-action">↝ Random</button></footer></section>
      <span class="menu-scene-status">Getting the arena ready…</span><output class="menu-perf" hidden></output>
      <div class="menu-bottom-hint"><kbd>1</kbd> Play <kbd>2</kbd> Characters <kbd>3</kbd> Market <kbd>4</kbd> Leaders <kbd>5</kbd> Season <kbd>6</kbd> Settings</div>`;
    parent.append(this.root);
    const emoteWrap=document.createElement('div');emoteWrap.className='menu-emote-wrap';
    emoteWrap.innerHTML='<span class="menu-emote-hint">Emotes · E then 1–5</span><div class="menu-emotes menu-toy" role="group" aria-label="Lobby emotes"></div>';
    const emoteBar=emoteWrap.querySelector('.menu-emotes')!;
    for(let i=0;i<LOBBY_EMOTES.length;i++){
      const clip=LOBBY_EMOTES[i],button=document.createElement('button');button.type='button';button.setAttribute('aria-label',clip.name+' emote');
      button.innerHTML=`<kbd>${i+1}</kbd>${clip.name}`;button.addEventListener('click',()=>this.emote(clip.id));emoteBar.append(button);
    }
    this.root.querySelector('.menu-identity')!.append(emoteWrap);
    this.status = this.root.querySelector('.menu-status')!; this.nameInput = this.root.querySelector('.menu-name')!; this.codeInput = this.root.querySelector('.menu-code')!;
    this.nameInput.value = defaultName;
    this.selectCharacter = index => {
      if (!this.list.length) return;
      const i = (index + this.list.length) % this.list.length;
      if (this.list[i].unlock === false) return;
      this.character = i;
      this.buttons.forEach((button, j) => { button.classList.toggle('selected', i === j); button.setAttribute('aria-pressed', String(i === j)); });
      const image = this.root.querySelector<HTMLImageElement>('.menu-mini img')!, portrait = this.portraits.get(i);
      image.hidden = !portrait; if (portrait) image.src = portrait.url;
      onCharacter(i); this.previewCharacter(i);
      this.root.dispatchEvent(new CustomEvent('lobby-character-selected',{detail:i}));
    };
    this.setCharacters(list);
    const step = (direction: number) => {
      for (let n = 1; n <= this.list.length; n++) { const i = (this.character + direction * n + this.list.length) % this.list.length; if (this.list[i].unlock !== false) { this.selectCharacter(i); break; } }
    };
    this.root.querySelector('.menu-prev')!.addEventListener('click', () => step(-1));
    this.root.querySelector('.menu-next')!.addEventListener('click', () => step(1));
    this.root.querySelector('.menu-random')!.addEventListener('click', () => step(1 + Math.floor(Math.random() * Math.max(1, this.list.length - 1))));
    for (const button of this.root.querySelectorAll<HTMLElement>('[data-tab]')) button.addEventListener('click', () => this.showTab(button.dataset.tab as MenuTab));
    this.root.querySelector('.menu-open-characters')!.addEventListener('click', () => this.showTab('characters'));
    this.root.querySelector('.menu-close-characters')!.addEventListener('click', () => this.showTab('play'));
    this.root.querySelector('.menu-chars')!.addEventListener('pointerleave', () => this.previewCharacter(this.character));
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-level]')) button.addEventListener('click', () => { this.difficulty = button.dataset.level as BotDifficulty; onDifficulty(this.difficulty); this.syncRules(); });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-mode]')) button.addEventListener('click', () => { this.mode = button.dataset.mode as GameMode; onMode(this.mode); this.syncRules(); });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-destination]')) button.addEventListener('click', () => { this.destination = button.dataset.destination as 'online' | 'practice'; this.syncRules(); });
    this.syncRules();
    // Take the mouse in the PLAY click itself (browsers allow it only right after a user action; loading can take longer),
    // so the match starts with no extra click. If the browser refuses, the game's pause overlay is the fallback.
    const takeMouse = () => { try { const p = document.documentElement.requestPointerLock() as unknown; if (p instanceof Promise) p.catch(() => undefined); } catch { /* not allowed here */ } };
    const pick = (choice: MenuChoice) => { takeMouse(); const resolve = this.resolve; this.resolve = null; resolve?.(choice); };
    const name = () => this.nameInput.value.trim();
    const teams = this.root.querySelector<HTMLInputElement>('.menu-teams')!, mutator = this.root.querySelector<HTMLSelectElement>('.menu-mutator')!, bots = this.root.querySelector<HTMLInputElement>('.menu-bots')!;
    bots.addEventListener('change', () => this.syncRules());
    const launch = () => pick(this.destination === 'online' ? { kind: 'quick', name: name() } : { kind: 'offline', name: name(), difficulty: this.difficulty, mode: this.mode, teams: teams.checked, mutator: mutator.value });
    this.root.querySelector('.menu-launch')!.addEventListener('click', launch);
    this.root.querySelector('.menu-create')!.addEventListener('click', () => pick({ kind: 'create', name: name(), bots: bots.checked, difficulty: this.difficulty, mode: this.mode, teams: teams.checked, mutator: mutator.value }));
    const join = () => pick({ kind: 'join', name: name(), code: this.codeInput.value.trim().toUpperCase() });
    this.root.querySelector('.menu-join')!.addEventListener('click', join);
    this.codeInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); join(); } });
    this.root.querySelector('.menu-friends-toggle')!.addEventListener('click', () => {
      const content = this.root.querySelector<HTMLElement>('.menu-friends-options')!, toggle = this.root.querySelector('.menu-friends-toggle')!;
      content.hidden = !content.hidden; toggle.setAttribute('aria-expanded', String(!content.hidden));
      toggle.querySelector('span')!.textContent = content.hidden ? '+' : '−';
      this.syncRules();
    });
    document.addEventListener('keydown', event => {
      const target = event.target as HTMLElement;
      if (!this.visible || target.closest('.settings, input, select, textarea') || document.querySelector<HTMLElement>('.settings')?.style.display === 'flex' || event.repeat) return;
      if (event.key.toLowerCase() === 'e') { event.preventDefault(); this.emoteKeys=!this.emoteKeys;this.root.dataset.emoteKeys=String(this.emoteKeys);return; }
      if(this.emoteKeys){const index=Number(event.key)-1;this.emoteKeys=false;this.root.dataset.emoteKeys='false';if(Number.isInteger(index)&&index>=0&&index<LOBBY_EMOTES.length){event.preventDefault();this.emote(LOBBY_EMOTES[index].id);return;}}
      if (event.key === '1') this.showTab('play');
      else if (event.key === '2') this.showTab('characters');
      else if (event.key === '3') this.showTab('market');
      else if (event.key === '4') this.showTab('leaders');
      else if (event.key === '5') this.showTab('season');
      else if (event.key === '6') this.settingsSlot.querySelector<HTMLButtonElement>('button')?.click();
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); }
      else if (event.key === 'Escape') this.showTab('play');
      else if (event.key === 'Enter' && this.tab === 'play') {
        const button = target.closest('button');
        if (!button || button.matches('.menu-launch, [data-tab=play]')) { event.preventDefault(); launch(); }
      }
    });
  }
  private emote(id:LobbyEmoteId):void {
    this.emoteKeys=false;this.root.dataset.emoteKeys='false';
    this.root.dispatchEvent(new CustomEvent('lobby-emote',{detail:id}));
  }
  private previewCharacter(index: number): void {
    const character = this.list[index]; if (!character) return;
    this.root.querySelector('.menu-hero-name')!.textContent = character.name;
    this.root.querySelector('.menu-char-name')!.textContent = character.name;
    this.root.querySelector('.menu-char-count')!.textContent = `${index + 1} / ${this.list.length} · all unlocked`;
    this.onCharacterView?.(index);
  }
  setCharacters(list: readonly MenuCharacter[]): void {
    this.list = list; const grid = this.root.querySelector('.menu-chars')!;
    grid.replaceChildren(); this.images.length = 0;
    this.buttons = list.map((character, index) => {
      const button = document.createElement('button'); button.className = 'menu-char'; button.title = character.name; button.setAttribute('aria-label', character.name); button.disabled = character.unlock === false;
      const image = document.createElement('img'); image.alt = ''; image.hidden = true; image.draggable = false;
      const number = document.createElement('span'); number.className = 'menu-char-number'; number.textContent = String(index + 1).padStart(2, '0');
      const label = document.createElement('small'); label.textContent = character.name;
      button.append(image, number, label); this.images.push(image); grid.append(button);
      button.addEventListener('click', () => this.selectCharacter(index));
      button.addEventListener('pointerenter', () => { if (this.tab === 'characters' && character.unlock !== false) this.previewCharacter(index); });
      button.addEventListener('focus', () => { if (this.tab === 'characters' && character.unlock !== false) this.previewCharacter(index); });
      return button;
    });
    if (list.length) this.selectCharacter(Math.min(Math.max(0, Math.floor(this.character)), list.length - 1));
    for (const [index, portrait] of this.portraits) if (list[index]) this.setPortrait(index, portrait.url, portrait.pixels);
  }
  private syncRules(): void {
    const practice = this.destination === 'practice';
    for (const button of this.root.querySelectorAll<HTMLElement>('[data-destination]')) button.setAttribute('aria-pressed', String(button.dataset.destination === this.destination));
    for (const button of this.root.querySelectorAll<HTMLElement>('[data-level]')) button.setAttribute('aria-pressed', String(button.dataset.level === this.difficulty));
    for (const button of this.root.querySelectorAll<HTMLElement>('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === this.mode));
    const privateBots = !this.root.querySelector<HTMLElement>('.menu-friends-options')!.hidden && this.root.querySelector<HTMLInputElement>('.menu-bots')!.checked;
    this.root.querySelector<HTMLElement>('.menu-difficulty-row')!.hidden = !(practice || privateBots);
    this.root.querySelector<HTMLElement>('.menu-teams-row')!.hidden = this.mode !== 'cornucopia';
    this.root.querySelector<HTMLElement>('.menu-friends-section')!.hidden = practice;
    this.root.querySelector<HTMLElement>('.menu-public-note')!.hidden = practice;
    this.root.querySelector('.menu-launch-caption')!.textContent = practice ? 'OFFLINE · WITH BOTS' : 'FIND AN ONLINE MATCH';
    this.root.querySelector('.menu-rules-label')!.textContent = practice ? 'PRACTICE RULES' : 'ROOM & PRACTICE RULES';
  }
  private showTab(tab: MenuTab): void {
    this.tab = tab; this.root.dataset.tab = tab;
    this.root.querySelector<HTMLElement>('.menu-roster')!.hidden = tab !== 'characters';
    this.root.querySelector<HTMLElement>('.menu-card')!.hidden = tab !== 'play';
    for (const button of this.root.querySelectorAll<HTMLElement>('[data-tab]')) { button.classList.toggle('active', button.dataset.tab === tab); button.setAttribute('aria-pressed', String(button.dataset.tab === tab)); }
    this.previewCharacter(this.character);
    this.onTab?.(tab);
  }
  /** Wallet login state on the player card: a login button for a guest, address + coins when logged in. */
  setAccount(a: MenuAccount): void {
    const el = this.root.querySelector<HTMLElement>('.menu-account')!;
    el.hidden = !a.online;
    if (!a.online) return;
    const key = `${a.address}|${a.coins}|${a.busy}|${a.level}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    if (!a.address) {
      el.innerHTML = `<button class="menu-login" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Check your wallet…' : 'Log in with wallet'}</button><small>Testnet only · free, no transaction</small>`;
      el.querySelector('button')!.addEventListener('click', (e) => { e.stopPropagation(); this.onLogin?.(); });
    } else {
      const short = a.address.length > 12 ? `${a.address.slice(0, 6)}…${a.address.slice(-4)}` : a.address;
      el.innerHTML = `<span class="menu-level" title="Your player level">Lv ${a.level ?? 1}</span><span class="menu-coins" title="Your coins">◉ ${a.coins ?? '…'}</span><span class="menu-address" title="${a.address}">${short}</span><button class="menu-logout" title="Log out">Log out</button>`;
      el.querySelector('button')!.addEventListener('click', (e) => { e.stopPropagation(); this.onLogout?.(); });
    }
  }
  /** Display name of a character, if the list is loaded. */
  characterName(index: number): string | undefined { return this.list[index]?.name; }
  /** Rendered portrait of a character (data URL), if ready. */
  portraitOf(index: number): string | undefined { return this.portraits.get(index)?.url; }
  get settingsSlot(): HTMLElement { return this.root.querySelector('.menu-settings-slot')!; }
  get sceneHost(): HTMLElement { return this.root.querySelector('.menu-scene-host')!; }
  get characterCount(): number { return this.list.length; }
  get visible(): boolean { return this.root.style.display !== 'none'; }
  setPortrait(index: number, url: string, pixels = 0): void {
    this.portraits.set(index, { url, pixels }); const image = this.images[index];
    if (image) { image.src = url; image.hidden = false; image.dataset.contentPixels = String(pixels); }
    if (index === this.character) { const mini = this.root.querySelector<HTMLImageElement>('.menu-mini img')!; mini.src = url; mini.hidden = false; }
  }
  setSceneStatus(message: string): void { this.root.querySelector('.menu-scene-status')!.textContent = message; }
  choose(): Promise<MenuChoice> { return new Promise(resolve => { this.resolve = resolve; }); }
  setStatus(message: string): void { this.status.textContent = message; this.status.classList.toggle('has-error', message.startsWith('Could not')); }
  hide(): void { this.root.style.display = 'none'; this.onVisibility?.(false); }
  show(): void { this.root.style.display = ''; this.showTab('play'); this.setStatus(''); this.onVisibility?.(true); }
}
