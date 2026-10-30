import { defineConfig } from 'vite';
import { mapPreviewPlugin } from './src/maps/preview/vitePlugin.ts';

export default defineConfig({
  plugins: [mapPreviewPlugin()],
  root: 'src/characters',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: '../../work/dist', emptyOutDir: true },
});

