// Separate process: geometric assertions intentionally allocate Box3/OBB/Vector3 objects.
// Their GC must not be charged to the allocation-free animation call under measurement.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true}});
try{
 const api=await server.ssrLoadModule('/src/characters/index.ts');
 const models=api.characters.map(c=>{const g=api.createCharacter(c);api.prepareLobbyAnimation(g);return g;});
 for(const g of models){for(const clip of api.LOBBY_EMOTES){api.playEmote(g,clip.id);for(let i=0;i<400;i++)api.updateAnimation(g,1/120);}for(let i=0;i<2000;i++)api.updateAnimation(g,1/120);}
 const rows=[];let calls=0;
 for(let index=0;index<models.length;index++){
  const g=models[index];let maxMs=0,total=0,count=0;
  for(const clip of api.LOBBY_EMOTES){
   api.playEmote(g,clip.id);global.gc?.();
   for(let i=0;i<Math.ceil((clip.duration+.3)*120);i++){
    const start=performance.now();api.updateAnimation(g,1/120);const ms=performance.now()-start;
    maxMs=Math.max(maxMs,ms);total+=ms;count++;
   }
  }
  assert(maxMs<1,`${api.characters[index].id}: pose ${maxMs.toFixed(4)}ms exceeds 1ms`);
  rows.push({id:api.characters[index].id,maxMs,meanMs:total/count,calls:count});calls+=count;
 }
 await fs.writeFile(new URL('../../client/game/animation-review/performance.json',import.meta.url),JSON.stringify({pass:true,calls,budgetMs:1,results:rows},null,2));
 console.log('LOBBY PERFORMANCE PASS:',{calls,maxMs:Math.max(...rows.map(r=>r.maxMs))});
 api.disposeCharacterResources();
}finally{await server.close();}
