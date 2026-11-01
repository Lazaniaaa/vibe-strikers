import fs from'node:fs/promises';import assert from'node:assert/strict';import{gunzipSync}from'node:zlib';import{sourceGuard}from'./tools/source-guard-colour.mjs';
const root=new URL('./',import.meta.url),read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
/** Authorised art update: regressions are checked independently of geometry hashes. */
export async function verifyColour(vite){
 const api=await vite.ssrLoadModule('../maps/index.ts'),{expandedBoxes}=await vite.ssrLoadModule('../maps/boxes.ts'),{Navigation}=await vite.ssrLoadModule('../maps/navigation.ts'),{contrastReport}=await vite.ssrLoadModule('../maps/contrast.ts'),{characters}=await vite.ssrLoadModule('./characters.ts');
 const original=JSON.parse(gunzipSync(await fs.readFile(new URL('baselines/colour-before.json.gz',root)))),palette=new Set((await read('palettes/endesga32.json')).colours),summary=[];
 const guard=await sourceGuard();assert.deepEqual(guard.changed,[]);assert.deepEqual(guard.apiChanged,[]);assert.equal(characters.length,33);
 const overlap=(a,b)=>Math.min(a.x+a.w/2,b.x+b.w/2)-Math.max(a.x-a.w/2,b.x-b.w/2)>1e-5&&Math.min(a.y+a.h/2,b.y+b.h/2)-Math.max(a.y-a.h/2,b.y-b.h/2)>1e-5&&Math.min(a.z+a.d/2,b.z+b.d/2)-Math.max(a.z-a.d/2,b.z-b.d/2)>1e-5;
 for(const id of api.mapIds){
  const data=api.loadMapData(id),old=original[id],model=api.buildMap(data),stats=model.userData.stats;
  assert.ok(Object.values(data.palette).every(c=>palette.has(c)),id+': colours outside fixed Endesga32');
  assert.ok(data.light.sun.intensity>=2.5&&data.light.sun.intensity<=3&&data.light.ambient.intensity>=.6&&data.light.ambient.intensity<=.9&&data.light.sun.intensity>data.light.ambient.intensity*3,id+': sunlight/ambient');
  assert.equal(data.fog.color,data.sky.horizon);assert.equal(model.children.filter(c=>c.isHemisphereLight).length,1);
  assert.ok(stats.drawCalls<=6&&stats.drawCalls<=old.stats.drawCalls&&stats.triangles<60000,id+': draw/triangle regression');
  const newPrefabs=Object.keys(data.prefabs).filter(k=>!old.data.prefabs[k]);assert.ok(newPrefabs.length>0);
  for(const key of newPrefabs)assert.ok(data.prefabs[key].every(b=>b.kind==='decor'&&!b.collide&&!b.blocksShots),id+'/'+key+': colliding decor');
  assert.equal(model.children.filter(c=>c.isInstancedMesh).length,2);assert.ok(model.children.filter(c=>c.isMesh).every(c=>!c.material.map&&c.material.isMeshLambertMaterial));
  const badProps=[];for(const inst of data.instances.filter(i=>/^(bench|lamp|screen)/.test(i.prefab)||/^crate/.test(i.prefab)&&Math.abs(i.x)<15&&i.z< -15)){
   const parts=expandedBoxes({...data,boxes:[],instances:[inst]}).filter(b=>b.collide),walls=data.boxes.filter(b=>b.kind==='wall'&&b.collide);
   if(parts.some(a=>walls.some(b=>overlap(a,b))))badProps.push(inst);
  }assert.deepEqual(badProps,[],id+': named props still in walls');
  let stairEntry=null;if(id.endsWith('-r1')){const nav=new Navigation(data);nav.flood(nav.nearest(data.spawns[0]));const approaches=[-1,1].map(sign=>{const a=nav.nearest({x:sign*20.6,y:0,z:-28.4},.3),b=nav.nearest({x:sign*20.6,y:.6,z:-30.6},.3),path=nav.path(a,b);return{half:sign<0?'A':'B',length:path.length,start:nav.nodes[a],end:nav.nodes[b]};});assert.ok(approaches.every(p=>Number.isFinite(p.length)&&p.length<4&&p.start.y<.1&&p.end.y>=.59),id+': stair entrance blocked');stairEntry=approaches;}
  const before=contrastReport(old.data,characters),after=contrastReport(data,characters);assert.equal(after.rows.length,33*data.zones.length);assert.ok(after.flags.length<=before.flags.length,id+': more low contrast pairs');
  const bytes=(await fs.stat(new URL('data/'+id+'.json',root))).size;assert.ok(bytes<2_000_000,id+': JSON exceeds2MB');
  const row={id,stats,oldStats:old.stats,jsonBytes:bytes,lowContrastBefore:before.flags.length,lowContrastAfter:after.flags.length,minimumDeltaE:Math.min(...after.rows.flatMap(r=>r.pairs.map(p=>p.deltaE))),newDecorPrefabs:newPrefabs,stairEntry};summary.push(row);
  await fs.writeFile(new URL('reports/colour/'+id+'-contrast.json',root),JSON.stringify({id,before,after},null,2)+'\n');api.disposeMapResources();
 }
 await fs.writeFile(new URL('reports/colour/summary.json',root),JSON.stringify({pass:true,palette:'Endesga32',guard,maps:summary},null,2)+'\n');console.table(summary.map(r=>({id:r.id,calls:r.oldStats.drawCalls+' -> '+r.stats.drawCalls,triangles:r.stats.triangles,lowContrast:r.lowContrastBefore+' -> '+r.lowContrastAfter,jsonKB:(r.jsonBytes/1024).toFixed(1)})));console.log('COLOUR / LIGHT / DECOR / BUDGET / BUG CHECKS PASSED.');
}
