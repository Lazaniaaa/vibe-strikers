import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Game app config. The root vite.config.js belongs to the Voxel Lab preview; do not merge them.
export default defineConfig({
  plugins: [react()],
  root: 'client',
  resolve: { dedupe: ['three', 'react', 'react-dom'] },
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
  build: {
    outDir: '../work/game-dist',
    emptyOutDir: true,
    rollupOptions: { input: { smoke: resolve(import.meta.dirname, 'client/smoke.html') } },
  },
});
