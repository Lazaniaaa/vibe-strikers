import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'vite';
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
try{
 const api=await vite.ssrLoadModule('/src/maps/index.ts');
 const lobby=await vite.ssrLoadModule('/src/maps/lobby.ts');
 const {TEAM_COLORS}=await vite.ssrLoadModule('/src/config/game.ts');
 const data=lobby.loadLobbyScene();
 assert.equal(api.mapIds.length,5);assert(!api.mapIds.includes(data.id));assert.throws(()=>api.loadMapData(data.id));
 assert(Object.isFrozen(data)&&Object.isFrozen(data.boxes));
 assert.equal(data.spawns.length+data.lootSpots.length+data.zones.length,0);
 assert(data.boxes.every(b=>!b.collide&&!b.blocksShots&&b.kind==='decor'));
 assert((await fs.stat(new URL('./data/lobby-island.json',import.meta.url))).size<2_000_000);
 const start=performance.now();const model=lobby.buildLobbyScene({teamColors:TEAM_COLORS});const bakeMs=performance.now()-start;
 const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const pedestal=model.getObjectByName('pedestal'),clouds=model.getObjectByName('clouds');
 assert(pedestal.receiveShadow&&!pedestal.castShadow);assert(clouds.isInstancedMesh&&clouds.count===8);
 assert(meshes.every(o=>!o.castShadow&&o.receiveShadow===(o===pedestal)));
 const materials=new Set(meshes.map(o=>o.material));assert.equal(materials.size,1);
 let triangles=0;const geometries=new Set();
 for(const mesh of meshes){const g=mesh.geometry;geometries.add(g);triangles+=g.index.count/3*(mesh.isInstancedMesh?mesh.count:1);
  for(const key of ['position','normal','color'])assert([...g.attributes[key].array].every(Number.isFinite));}
 assert(triangles<20_000);assert(meshes.length<=6);
 let released=0;for(const geometry of geometries)geometry.addEventListener('dispose',()=>released++);
 lobby.disposeLobbySceneResources();assert.equal(released,geometries.size);
 const fresh=lobby.buildLobbyScene();assert(!geometries.has(fresh.getObjectByName('pedestal').geometry));lobby.disposeLobbySceneResources();
 const result={pass:true,staticBoxes:data.boxes.length,clouds:8,drawCalls:meshes.length,triangles,bakeMs:+bakeMs.toFixed(2),playableMaps:api.mapIds};
 await fs.writeFile(new URL('../../client/game/island-review/lobby-contracts.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(result);console.log('LOBBY ISLAND VERIFIED.');
}finally{await vite.close();}
