import { createRoot } from 'react-dom/client';
import { characters } from '../../src/characters';
import { LOCAL_PLAYER } from '../../src/config/game';
import { BOT_SKILLS, DEFAULT_DIFFICULTY, type BotDifficulty } from '../../src/config/bots';
import { GameNet } from '../../src/network/client';
import { Menu, type MenuChoice } from '../../src/ui/menu';
import { getSettingsPanel, settingsButton } from '../../src/ui/settingsPanel';
import { getSfx } from '../../src/ui/sfx';
import { GameApp, type GameOptions } from './GameApp';
import { OnlineApp } from './OnlineApp';
import { characterLabel } from './characterLabel';

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
  else if (choice.kind === 'create') await net.createPrivateRoom(choice.name, character, choice.bots, choice.difficulty);
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

const savedName = storage('local')?.getItem('voxel-name') ?? '';
const savedCharacter = Number(params.get('character') ?? storage('local')?.getItem('voxel-character') ?? LOCAL_PLAYER.characterIndex);
const list = characters.map((c, i) => ({ name: characterLabel(i), body: c.colors.body, accent: c.colors.glove ?? c.colors.outline }));
const menu = new Menu(document.body, params.get('name') ?? savedName, list,
  Number.isFinite(savedCharacter) ? savedCharacter : LOCAL_PLAYER.characterIndex,
  (i) => storage('local')?.setItem('voxel-character', String(i)),
  savedDifficulty(), (d) => storage('local')?.setItem('voxel-difficulty', d));
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

function startOffline(character?: number, difficulty: BotDifficulty = savedDifficulty()): void {
  menu.hide();
  root.render(<GameApp options={{ ...options, character, difficulty, onLeave: backToMenu }} />);
}

async function menuLoop(): Promise<void> {
  menu.show();
  for (;;) {
    const autoName = params.get('name') ?? 'Tester';
    const choice: MenuChoice = auto === 'quick' ? { kind: 'quick', name: autoName }
      : auto === 'create' ? { kind: 'create', name: autoName, bots: params.get('bots') !== '0', difficulty: savedDifficulty() }
      : auto === 'join' ? { kind: 'join', name: autoName, code: (params.get('code') ?? '').toUpperCase() }
      : await menu.choose();
    const wasAuto = auto !== null;
    auto = null;
    storage('local')?.setItem('voxel-name', choice.name);
    if (choice.kind === 'offline') { startOffline(menu.character, choice.difficulty); return; }
    try {
      menu.setStatus('Connecting...');
      if (!net) {
        net = new GameNet({
          uri: params.get('server') ?? undefined,
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
      root.render(<OnlineApp net={net} debug={debug} onLeave={backToMenu} />);
      return;
    } catch (e) {
      menu.setStatus(`Could not join: ${e instanceof Error ? e.message : String(e)}`);
      if (wasAuto) return;
    }
  }
}

// ?offline=1 skips the menu (M1 single player); leaving it shows the menu.
if (params.get('offline') === '1') startOffline();
else void menuLoop();
