import { createRoot } from 'react-dom/client';
import { GameApp, type GameOptions } from './GameApp';

const params = new URLSearchParams(location.search);
const freeze = params.get('freeze');
const options: GameOptions = {
  // ?debug=1 exposes window.__game for automated tests and hides the click-to-play overlay.
  debug: params.get('debug') === '1',
  freezeTime: freeze !== null && Number.isFinite(Number(freeze)) ? Number(freeze) : undefined,
};

// No StrictMode: its double mount frees the Rapier world that the simulation holds.
createRoot(document.getElementById('root')!).render(<GameApp options={options} />);
