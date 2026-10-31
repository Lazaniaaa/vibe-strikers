import { createRoot } from 'react-dom/client';
import { LOCAL_PLAYER } from '../../src/config/game';
import { GameNet } from '../../src/network/client';
import { Menu, type MenuChoice } from '../../src/ui/menu';
import { GameApp, type GameOptions } from './GameApp';
import { OnlineApp } from './OnlineApp';

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

// No StrictMode: its double mount frees the Rapier world that the simulation holds.
const root = createRoot(document.getElementById('root')!);

function startOffline(): void { root.render(<GameApp options={options} />); }

async function joinWith(net: GameNet, choice: MenuChoice): Promise<void> {
  const character = LOCAL_PLAYER.characterIndex;
  if (choice.kind === 'quick') await net.joinQuick(choice.name, character);
  else if (choice.kind === 'create') await net.createPrivateRoom(choice.name, character, choice.bots);
  else if (choice.kind === 'join') await net.joinByCode(choice.code, choice.name, character);
  // Wait until my row has arrived (after artificial lag too).
  const end = performance.now() + 10000;
  while (!net.me && performance.now() < end) { net.update(); await new Promise((r) => setTimeout(r, 30)); }
  if (!net.me) throw new Error('no answer from the server');
}

async function main(): Promise<void> {
  // ?offline=1 skips the menu (M1 single player).
  if (params.get('offline') === '1') { startOffline(); return; }
  const savedName = storage('local')?.getItem('voxel-name') ?? '';
  const menu = new Menu(document.body, params.get('name') ?? savedName);
  // Test shortcut: ?auto=quick | create (&bots=0) | join&code=XXXXX
  const auto = params.get('auto');
  const autoName = params.get('name') ?? 'Tester';
  let net: GameNet | null = null;
  for (;;) {
    const choice: MenuChoice = auto === 'quick' ? { kind: 'quick', name: autoName }
      : auto === 'create' ? { kind: 'create', name: autoName, bots: params.get('bots') !== '0' }
      : auto === 'join' ? { kind: 'join', name: autoName, code: (params.get('code') ?? '').toUpperCase() }
      : await menu.choose();
    storage('local')?.setItem('voxel-name', choice.name);
    if (choice.kind === 'offline') { menu.hide(); startOffline(); return; }
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
      await joinWith(net, choice);
      menu.hide();
      root.render(<OnlineApp net={net} debug={debug} />);
      return;
    } catch (e) {
      menu.setStatus(`Could not join: ${e instanceof Error ? e.message : String(e)}`);
      if (auto) return;
    }
  }
}

void main();
