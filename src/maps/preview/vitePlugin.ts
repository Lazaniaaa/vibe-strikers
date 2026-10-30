import type { Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const html=fileURLToPath(new URL('./index.html',import.meta.url));
const entry=fileURLToPath(new URL('./main.ts',import.meta.url)).replaceAll('\\','/');
/** Own the map entry point without editing the approved character/weapon previews. */
export function mapPreviewPlugin():Plugin{return {
 name:'toy-town-preview',
 config:(_config,{command})=>command==='build'?{root:fileURLToPath(new URL('../../../',import.meta.url)),build:{outDir:'work/dist',rollupOptions:{input:{characters:fileURLToPath(new URL('../../characters/index.html',import.meta.url)),map:html}}}}:{},
 generateBundle:{order:'post',handler(_options,bundle){
  for(const [from,to]of [['src/characters/index.html','index.html'],['src/maps/preview/index.html','map.html']]){const asset=bundle[from];if(asset?.type==='asset'){this.emitFile({type:'asset',fileName:to,source:asset.source});delete bundle[from];}}
 }},
 configurePreviewServer(server){server.middlewares.use((req,_res,next)=>{if(req.url){const url=new URL(req.url,'http://localhost');if(url.pathname==='/'&&url.searchParams.get('map')==='1')req.url='/map.html';}next();});},
 configureServer(server){server.middlewares.use(async(req,res,next)=>{
  if(!req.url)return next();const url=new URL(req.url,'http://localhost');
  if(url.pathname!=='/'||url.searchParams.get('map')!=='1')return next();
  try{const source=(await readFile(html,'utf8')).replace('src="./main.ts"',`src="/@fs/${entry}"`);res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await server.transformIndexHtml(req.url,source));}catch(error){next(error);}
 });}
};}
