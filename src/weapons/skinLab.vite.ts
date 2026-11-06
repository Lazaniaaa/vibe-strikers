import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),cacheDir:fileURLToPath(new URL('../../work/skin-vite-cache',import.meta.url)),
  server:{host:'127.0.0.1',port:5175,strictPort:true,fs:{allow:[fileURLToPath(new URL('../..',import.meta.url))]}},
  build:{outDir:'../../work/skin-lab-dist',emptyOutDir:true,rollupOptions:{input:fileURLToPath(new URL('./skins.html',import.meta.url)),output:{manualChunks(id){
    const path=id.replaceAll('\\','/');if(path.includes('/node_modules/three/'))return 'three';
    if(path.includes('/src/maps/')&&path.endsWith('.json'))return 'review-'+path.split('/').at(-1)!.replace('.json','');
  }}}}});
