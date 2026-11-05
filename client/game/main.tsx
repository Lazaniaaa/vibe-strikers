import { LOCAL_PLAYER, MENU } from '../../src/config/game';
import { BOT_SKILLS, DEFAULT_DIFFICULTY, type BotDifficulty } from '../../src/config/bots';
import type { GameNet } from '../../src/network/client';
import type { GameMode } from '../../src/gameplay/mode';
import { Menu, type MenuChoice } from '../../src/ui/menu';
import { getSettingsPanel, settingsButton } from '../../src/ui/settingsPanel';
import { getSfx } from '../../src/ui/sfx';
import { getMusic } from '../../src/ui/music';
import type { GameOptions } from './GameApp';
import { Loading } from './loading';
import type { MenuScene } from './menuScene';

// The game (three.js, Rapier, map, characters, weapons) and the network SDK are separate chunks, loaded when a
// match starts (and prefetched while the menu is open), so the menu shows quickly on a public link.
const loadGame = () => import('./GameApp');
const loadOnline = () => import('./OnlineApp');
const loadNet = () => import('../../src/network/client');
const loadMount = () => import('./gameMount');

const params = new URLSearchParams(location.search);
const freeze = params.get('freeze');
const debug = params.get('debug') === '1';
const options: GameOptions = {
  // ?debug=1 exposes window.__game / window.__online for automated tests and hides the click-to-play overlay.
  debug,
  freezeTime: freeze !== null && Number.isFinite(Number(freeze)) ? Number(freeze) : undefined,
};

function storage(kind: 'local' | 'session'): Storage | null {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
}

// UI click sound for every button (the first click also starts the audio context).
document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('button')) getSfx().play('ui'); });

async function joinWith(net: GameNet, choice: MenuChoice, character: number): Promise<void> {
  if (choice.kind === 'quick') await net.joinQuick(choice.name, character);
  else if (choice.kind === 'create') await net.createPrivateRoom(choice.name, character, choice.bots, choice.difficulty, choice.mode, choice.teams, choice.mutator);
  else if (choice.kind === 'join') await net.joinByCode(choice.code, choice.name, character);
  // Wait until my row AND my room's row have arrived (after artificial lag too): the game reads the
  // room's mutator (gravity, run speed, head size) once when it starts.
  const end = performance.now() + 10000;
  while (!(net.me && net.room) && performance.now() < end) { net.update(); await new Promise((r) => setTimeout(r, 30)); }
  if (!net.me || !net.room) throw new Error('no answer from the server');
}

/** Bot difficulty: ?difficulty= (tests), else the last menu choice, else normal. */
function savedDifficulty(): BotDifficulty {
  const d = params.get('difficulty') ?? storage('local')?.getItem('voxel-difficulty') ?? DEFAULT_DIFFICULTY;
  return d in BOT_SKILLS ? (d as BotDifficulty) : DEFAULT_DIFFICULTY;
}

/** Game mode: ?mode= (tests), else the last menu choice. ?teams=0 = free-for-all (tests). */
function savedMode(): GameMode {
  const m = params.get('mode') ?? storage('local')?.getItem('voxel-mode');
  return m === 'cornucopia' ? 'cornucopia' : 'elimination';
}
const savedTeams = params.get('teams') !== '0';
/** ?mutator= (tests). */
const urlMutator = params.get('mutator') ?? '';

const savedName = storage('local')?.getItem('voxel-name') ?? '';
const savedCharacter = Number(params.get('character') ?? storage('local')?.getItem('voxel-character') ?? LOCAL_PLAYER.characterIndex);
const menu = new Menu(document.body, params.get('name') ?? savedName, [],
  Number.isFinite(savedCharacter) ? savedCharacter : LOCAL_PLAYER.characterIndex,
  (i) => storage('local')?.setItem('voxel-character', String(i)),
  savedDifficulty(), (d) => storage('local')?.setItem('voxel-difficulty', d),
  savedMode(), (m) => storage('local')?.setItem('voxel-mode', m));
const settingsTab = settingsButton(menu.settingsSlot, getSettingsPanel(), 'menu-tab menu-settings');
settingsTab.innerHTML = '<kbd>5</kbd> SETTINGS';
settingsTab.setAttribute('aria-label', 'Settings');
// Paint the plain DOM first. A generation token cancels a lazy import when a match starts meanwhile.
let menuScene: MenuScene | null = null;
let menuSceneGeneration = 0;
menu.onCharacterView = index => menuScene?.select(index);
menu.onVisibility = visible => {
  const generation = ++menuSceneGeneration;
  menuScene?.dispose(); menuScene = null;
  if (!visible) return;
  menu.setSceneStatus('Getting the arena ready…');
  window.setTimeout(() => {
    if (generation !== menuSceneGeneration || !menu.visible) return;
    void import('./menuScene').then(({ createMenuScene, menuCharacters }) => {
      if (generation !== menuSceneGeneration || !menu.visible) return;
      if (!menu.characterCount) menu.setCharacters(menuCharacters());
      menuScene = createMenuScene({ host: menu.sceneHost, selected: menu.character, debug,
        onPortrait: (index, url, pixels) => menu.setPortrait(index, url, pixels), onStatus: text => menu.setSceneStatus(text) });
    }).catch(() => {
      if (generation === menuSceneGeneration && menu.visible) menu.setSceneStatus('3D preview unavailable. You can still play.');
    });
  }, MENU.lazyDelayMs);
};
// One connection for the whole page: leaving a match and joining another works without reloading.
let net: GameNet | null = null;
let connecting: Promise<GameNet> | null = null;

/**
 * Which storage keeps the identity token: the first tab of this browser holds a Web Lock and uses the persistent
 * token (localStorage: wallet and items survive a restart); a second tab gets its own per-tab identity
 * (sessionStorage), so two tabs are still two players.
 */
const identityStore: Promise<'local' | 'session'> = new Promise((resolve) => {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) { resolve('local'); return; }
  locks.request('voxel-arena-identity', { ifAvailable: true }, (lock) => {
    resolve(lock ? 'local' : 'session');
    return lock ? new Promise<void>(() => undefined) : undefined; // keep the lock while the page lives
  }).catch(() => resolve('session'));
});

/** Connect once (menu market, coins, matches) and subscribe to the marketplace. */
function ensureNet(): Promise<GameNet> {
  if (net) return Promise.resolve(net);
  connecting ??= (async () => {
    const { GameNet } = await loadNet();
    const store = storage(await identityStore);
    const key = 'stdb-token';
    const n = new GameNet({
      // Server: ?server= (tests) > build-time VITE_STDB_URI (hosting) > local default in src/config/net.ts.
      uri: params.get('server') ?? (import.meta.env.VITE_STDB_URI || undefined),
      databaseName: params.get('db') ?? (import.meta.env.VITE_STDB_DB || undefined),
      token: store?.getItem(key) ?? undefined,
      onToken: (t) => store?.setItem(key, t),
      lagMs: Number(params.get('lag') ?? 0) || 0,
    });
    await n.connect();
    n.onMarketChange = () => { showAccount(n); marketPanel?.refresh(); leaderPanel?.refresh(); };
    await n.subscribeMarket().catch(() => undefined); // the game works without the market
    showAccount(n);
    net = n;
    return n;
  })();
  connecting.catch(() => { connecting = null; });
  return connecting;
}

// Wallet login (GAME.md 6.8): sign a text in the browser wallet; testnet only, no transactions.
let loginBusy = false;
function showAccount(n: GameNet | null): void {
  menu.setAccount({ online: !!n, address: n?.market.account ?? '', coins: n?.market.wallet?.coins ?? null, busy: loginBusy });
}
async function walletLogin(): Promise<void> {
  if (loginBusy) return;
  loginBusy = true; showAccount(net);
  try {
    const n = await ensureNet();
    const { loginWithBrowserWallet } = await import('../../src/network/walletLogin');
    await loginWithBrowserWallet(n);
    menu.setStatus('');
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    menu.setStatus(`Could not log in: ${text}`);
    marketPanel?.setStatus(`Could not log in: ${text}`, true);
  } finally {
    loginBusy = false; showAccount(net);
  }
}
menu.onLogin = () => { void walletLogin(); };
menu.onLogout = () => { void net?.logout().catch(() => undefined); };

// LEADERS tab: loads on first open.
let leaderPanel: import('../../src/ui/leaderPanel').LeaderPanel | null = null;
function openLeaders(): void {
  void (async () => {
    if (!leaderPanel) { const { LeaderPanel } = await import('../../src/ui/leaderPanel'); leaderPanel ??= new LeaderPanel(menu.root); }
    leaderPanel.show();
    try { leaderPanel.attach(await ensureNet()); } catch { leaderPanel.attach(null); }
  })();
}

// MARKET tab: the panel and the catalog load on first open.
let marketPanel: import('../../src/ui/marketPanel').MarketPanel | null = null;
menu.onTab = (tab) => {
  if (tab === 'leaders') openLeaders(); else leaderPanel?.hide();
  if (tab !== 'market') { marketPanel?.hide(); return; }
  void (async () => {
    if (!marketPanel) {
      const [{ MarketPanel }, { catalogItem }] = await Promise.all([import('../../src/ui/marketPanel'), import('../../src/gameplay/market')]);
      marketPanel ??= new MarketPanel(menu.root, (ref) => {
        const item = catalogItem(ref);
        if (!item) return { name: ref, kind: 'unknown item' };
        if (item.kind === 'character') return { name: menu.characterName(item.index) ?? item.name, kind: 'character', portrait: menu.portraitOf(item.index) };
        return { name: item.name, kind: 'emote' };
      });
      marketPanel.onLogin = () => { void walletLogin(); };
    }
    marketPanel.show();
    try { marketPanel.attach(await ensureNet()); } catch (e) { marketPanel.setStatus(`Market offline: ${e instanceof Error ? e.message : String(e)}`, true); }
  })();
};
// Test shortcut, first round only: ?auto=quick | create (&bots=0) | join&code=XXXXX
let auto = params.get('auto');

/** Leave the current match (online or offline) and show the menu again. */
function backToMenu(): void {
  try { document.exitPointerLock?.(); } catch { /* not locked */ }
  const leaving = net?.me ? net.leave() : Promise.resolve();
  // R3F has a separate root; await its renderer teardown before allocating the next menu renderer.
  void leaving.then(async () => { await (await loadMount()).unmountGame(); void menuLoop(); });
}

async function startOffline(character?: number, difficulty: BotDifficulty = savedDifficulty(), mode: GameMode = savedMode(), teams = savedTeams,
  mutator = urlMutator): Promise<void> {
  menu.hide();
  const loading = new Loading();
  try {
    loading.step('Loading game (3D engine, physics, map)', 0.05, 0.75);
    const { GameApp } = await loadGame();
    loading.step('Starting physics and building the map', 0.75, 1);
    const { mountOffline } = await loadMount();
    mountOffline(GameApp, { ...options, character, difficulty, mode, teams, mutator, onLeave: backToMenu, onReady: () => loading.done() });
  } catch (e) {
    loading.error(`Could not load the game: ${e instanceof Error ? e.message : String(e)}. Reload the page.`);
  }
}

async function menuLoop(): Promise<void> {
  menu.show();
  getMusic().setMood('menu');
  if (debug) (window as unknown as { __music?: unknown }).__music = getMusic();
  for (;;) {
    const autoName = params.get('name') ?? 'Tester';
    const choice: MenuChoice = auto === 'quick' ? { kind: 'quick', name: autoName }
      : auto === 'create' ? { kind: 'create', name: autoName, bots: params.get('bots') !== '0', difficulty: savedDifficulty(), mode: savedMode(), teams: savedTeams, mutator: urlMutator }
      : auto === 'join' ? { kind: 'join', name: autoName, code: (params.get('code') ?? '').toUpperCase() }
      : await menu.choose();
    const wasAuto = auto !== null;
    auto = null;
    storage('local')?.setItem('voxel-name', choice.name);
    if (choice.kind === 'offline') { void startOffline(menu.character, choice.difficulty, choice.mode, choice.teams, choice.mutator); return; }
    try {
      menu.setStatus('Connecting...');
      // Also validates URL character indices if auto-join beats the deferred menu import.
      if (!menu.characterCount) {
        const { menuCharacters } = await import('./menuScene');
        menu.setCharacters(menuCharacters());
      }
      const app = loadOnline(); // download the game while connecting
      app.catch(() => undefined);
      const net = await ensureNet();
      await joinWith(net, choice, menu.character);
      // Saved primary choice (applies at once during the freeze phase, otherwise next round).
      const savedPrimary = params.get('primary') ?? storage('local')?.getItem('voxel-primary');
      if (savedPrimary) await net.setPrimary(savedPrimary).catch(() => undefined);
      menu.hide();
      const loading = new Loading();
      loading.step('Loading game (3D engine, physics, map)', 0.3, 0.8);
      const { OnlineApp } = await app.catch((e: unknown) => { loading.error(`Could not load the game: ${String(e)}. Reload the page.`); throw e; });
      loading.step('Starting physics and building the map', 0.8, 1);
      const { mountOnline } = await loadMount();
      mountOnline(OnlineApp, { net, debug, onLeave: backToMenu, onReady: () => loading.done() });
      return;
    } catch (e) {
      menu.setStatus(`Could not join: ${e instanceof Error ? e.message : String(e)}`);
      if (wasAuto) return;
    }
  }
}

// ?offline=1 skips the menu (M1 single player); leaving it shows the menu.
if (params.get('offline') === '1') void startOffline();
// ?soundlab=1: blind A/B comparison of the code-made sound sets (no menu, no game).
else if (params.get('soundlab') === '1') { menu.hide(); void import('./soundLab').then(({ startSoundLab }) => startSoundLab()); }
else {
  void menuLoop();
  // Prefetch the game chunks while the player looks at the menu.
  // Connect early too: the player card shows the coin balance.
  window.setTimeout(() => { loadGame().catch(() => undefined); ensureNet().catch(() => undefined); }, MENU.prefetchDelayMs);
}
