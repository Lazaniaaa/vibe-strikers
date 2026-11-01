import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

// The map used by the game (src/config/game.ts). src/maps/index.ts imports every map JSON (~1.6 MB); the game
// build replaces the maps it does not use with a tiny stub (asset folder untouched; request to the asset owner
// for an async loadMapData in docs/PROGRESS.md).
const MAP_ID = /MAP_ID = '([^']+)'/.exec(readFileSync(resolve(import.meta.dirname, 'src/config/game.ts'), 'utf8'))![1];
function onlyUsedMap(): Plugin {
  return {
    name: 'only-used-map', enforce: 'pre', apply: 'build',
    load(id) {
      const m = /src[\\/]maps[\\/]data[\\/]([\w-]+)\.json$/.exec(id);
      if (!m || m[1] === MAP_ID || !m[1].startsWith('toy-town')) return null;
      return JSON.stringify({ id: m[1], unused: true }); // still JSON: the json plugin turns it into a module
    },
  };
}

/** Separate cached chunks for the big libraries (loaded in parallel, and only once the game starts). */
const chunkGroups = [
  { name: 'rapier', test: /@dimforge[\\/]rapier/ },
  { name: 'three', test: /node_modules[\\/]three[\\/]/ },
  { name: 'r3f', test: /@react-three[\\/]/ },
  { name: 'net', test: /node_modules[\\/]spacetimedb/ },
  { name: 'map', test: /src[\\/]maps[\\/]data[\\/]/ },
];

export default defineConfig({
  plugins: [react(), onlyUsedMap()],
  root: 'client',
  // Relative asset paths: the built folder works from any static host, also in a sub-folder.
  base: './',
  // VITE_STDB_URI / VITE_STDB_DB come from .env.production.local in the project root (see docs/HOSTING.md).
  envDir: import.meta.dirname,
  resolve: { dedupe: ['three', 'react', 'react-dom'] },
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
  build: {
    outDir: '../work/game-dist',
    emptyOutDir: true,
    rollupOptions: { input: {
      index: resolve(import.meta.dirname, 'client/index.html'),
      smoke: resolve(import.meta.dirname, 'client/smoke.html'),
    }, output: { advancedChunks: { groups: chunkGroups } } },
  },
});
