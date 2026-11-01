import { createRoot } from 'react-dom/client';
import { characters } from '../../src/characters/characters';
import { LOCAL_PLAYER } from '../../src/config/game';
import { BOT_SKILLS, DEFAULT_DIFFICULTY, type BotDifficulty } from '../../src/config/bots';
import type { GameNet } from '../../src/network/client';
import type { GameMode } from '../../src/gameplay/mode';
import { Menu, type MenuChoice } from '../../src/ui/menu';
import { getSettingsPanel, settingsButton } from '../../src/ui/settingsPanel';
import { getSfx } from '../../src/ui/sfx';
import type { GameOptions } from './GameApp';
import { characterLabel } from './characterLabel';
import { Loading } from './loading';

// The game (three.js, Rapier, map, characters, weapons) and the network SDK are separate chunks, loaded when a
// match starts (and prefetched while the menu is open), so the menu shows quickly on a public link.
const loadGame = () => import('./GameApp');
const loadOnline = () => import('./OnlineApp');
const loadNet = () => import('../../src/network/client');

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

// No StrictMode: its double mount frees the Rapier world that the simulation holds.
const root = createRoot(document.getElementById('root')!);

async function joinWith(net: GameNet, choice: MenuChoice, character: number): Promise<void> {
  if (choice.kind === 'quick') await net.joinQuick(choice.name, character);
  else if (choice.kind === 'create') await net.createPrivateRoom(choice.name, character, choice.bots, choice.difficulty, choice.mode, choice.teams, choice.mutator);
  else if (choice.kind === 'join') await net.joinByCode(choice.code, choice.name, character);
  // Wait until my row has arrived (after artificial lag too).
  const end = performance.now() + 10000;
  while (!net.me && performance.now() < end) { net.update(); await new Promise((r) => setTimeout(r, 30)); }
  if (!net.me) throw new Error('no answer from the server');
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
const list = characters.map((c, i) => ({ name: characterLabel(i), body: c.colors.body, accent: c.colors.glove ?? c.colors.outline }));
const menu = new Menu(document.body, params.get('name') ?? savedName, list,
  Number.isFinite(savedCharacter) ? savedCharacter : LOCAL_PLAYER.characterIndex,
  (i) => storage('local')?.setItem('voxel-character', String(i)),
  savedDifficulty(), (d) => storage('local')?.setItem('voxel-difficulty', d),
  savedMode(), (m) => storage('local')?.setItem('voxel-mode', m));
settingsButton(menu.settingsSlot, getSettingsPanel(), 'menu-btn menu-settings');
// One connection for the whole page: leaving a match and joining another works without reloading.
let net: GameNet | null = null;
// Test shortcut, first round only: ?auto=quick | create (&bots=0) | join&code=XXXXX
let auto = params.get('auto');

/** Leave the current match (online or offline) and show the menu again. */
function backToMenu(): void {
  try { document.exitPointerLock?.(); } catch { /* not locked */ }
  const leaving = net?.me ? net.leave() : Promise.resolve();
  void leaving.then(() => { root.render(<></>); void menuLoop(); });
}

async function startOffline(character?: number, difficulty: BotDifficulty = savedDifficulty(), mode: GameMode = savedMode(), teams = savedTeams,
  mutator = urlMutator): Promise<void> {
  menu.hide();
  const loading = new Loading();
  try {
    loading.step('Loading game (3D engine, physics, map)', 0.05, 0.75);
    const { GameApp } = await loadGame();
    loading.step('Starting physics and building the map', 0.75, 1);
    root.render(<GameApp options={{ ...options, character, difficulty, mode, teams, mutator, onLeave: backToMenu, onReady: () => loading.done() }} />);
  } catch (e) {
    loading.error(`Could not load the game: ${e instanceof Error ? e.message : String(e)}. Reload the page.`);
  }
}

async function menuLoop(): Promise<void> {
  menu.show();
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
      const app = loadOnline(); // download the game while connecting
      app.catch(() => undefined);
      if (!net) {
        const { GameNet } = await loadNet();
        net = new GameNet({
          // Server: ?server= (tests) > build-time VITE_STDB_URI (hosting) > local default in src/config/net.ts.
          uri: params.get('server') ?? (import.meta.env.VITE_STDB_URI || undefined),
          databaseName: params.get('db') ?? (import.meta.env.VITE_STDB_DB || undefined),
          // One identity per browser tab, so two tabs are two players.
          token: storage('session')?.getItem('stdb-token') ?? undefined,
          onToken: (t) => storage('session')?.setItem('stdb-token', t),
          lagMs: Number(params.get('lag') ?? 0) || 0,
        });
        await net.connect();
      }
      await joinWith(net, choice, menu.character);
      // Saved primary choice (applies at once during the freeze phase, otherwise next round).
      const savedPrimary = params.get('primary') ?? storage('local')?.getItem('voxel-primary');
      if (savedPrimary) await net.setPrimary(savedPrimary).catch(() => undefined);
      menu.hide();
      const loading = new Loading();
      loading.step('Loading game (3D engine, physics, map)', 0.3, 0.8);
      const { OnlineApp } = await app.catch((e: unknown) => { loading.error(`Could not load the game: ${String(e)}. Reload the page.`); throw e; });
      loading.step('Starting physics and building the map', 0.8, 1);
      root.render(<OnlineApp net={net} debug={debug} onLeave={backToMenu} onReady={() => loading.done()} />);
      return;
    } catch (e) {
      menu.setStatus(`Could not join: ${e instanceof Error ? e.message : String(e)}`);
      if (wasAuto) return;
    }
  }
}

// ?offline=1 skips the menu (M1 single player); leaving it shows the menu.
if (params.get('offline') === '1') void startOffline();
else {
  void menuLoop();
  // Prefetch the game chunks while the player looks at the menu.
  window.setTimeout(() => { loadGame().catch(() => undefined); loadNet().catch(() => undefined); }, 800);
}
