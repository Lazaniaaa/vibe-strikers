import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Weekly STRIKE rewards admin page (client/admin.html, GAME.md 6.9) as its own static site: `npm run admin:build`
// writes work/admin-dist (deployed to the Cloudflare Pages project `vibe-strikers-admin`, docs/REWARDS.md).
// It holds no secrets: every action is a MetaMask transaction, and the contract lets only its owner pay or withdraw.
export default defineConfig({
  root: 'client',
  base: './',
  build: {
    outDir: '../work/admin-dist',
    emptyOutDir: true,
    rollupOptions: { input: { index: resolve(import.meta.dirname, 'client/admin.html') } },
  },
});
