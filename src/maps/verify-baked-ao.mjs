import fs from'node:fs/promises';import assert from'node:assert/strict';import crypto from'node:crypto';
const root=new URL('./',import.meta.url),read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8')),hash=group=>{const h=crypto.createHash('sha256');group.traverse(o=>{if(!o.isMesh)return;h.update(o.name);for(const name of Object.keys(o.geometry.attributes).sort()){h.update(name);h.update(Buffer.from(o.geometry.attributes[name].array.buffer));}h.update(Buffer.from(o.geometry.index.array.buffer));if(o.isInstancedMesh)h.update(Buffer.from(o.instanceMatrix.array.buffer));});return h.digest('hex');};
export async function verifyBakedAo(vite){
 const api=await vite.ssrLoadModule('../maps/index.ts'),{AO_DIAGNOSTICS,AoField,BAKED_AO}=await vite.ssrLoadModule('../maps/bakedAo.ts'),old=await read('baselines/baked-ao-off.json'),dataGuard=await read('baselines/baked-ao-data-guard.json'),rows=[];
 assert.equal(AO_DIAGNOSTICS.fields,0,'Import/server metadata calls must not construct AO fields');
 for(const[file,expected]of Object.entries(dataGuard)){const bytes=await fs.readFile(new URL('data/'+file,root));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected,'Map data changed: '+file);}
 for(const id of api.mapIds){api.disposeMapResources();const d=api.loadMapData(id),off=api.buildMap(d,{bakedAo:false});assert.equal(hash(off),old[id].sha256,id+': AO-off geometry/colours must match the approved original');
  const t=performance.now(),on=api.buildMap(d),coldMs=performance.now()-t,tw=performance.now(),warm=api.buildMap(d),warmMs=performance.now()-tw;
  assert.ok(coldMs<300,id+': cold map build >300ms');assert.equal(AO_DIAGNOSTICS.fields,0,id+': stale/missing offline AO; runtime sampling is forbidden for shipped maps');
  assert.equal(on.userData.stats.drawCalls,off.userData.stats.drawCalls);assert.ok(on.userData.stats.triangles-off.userData.stats.triangles<=6000);assert.ok(on.children.every((o,i)=>o.geometry===warm.children[i].geometry));assert.notEqual(on.children[0].geometry,off.children[0].geometry);
  let min=1,max=0,shaded=0;on.traverse(o=>{if(!o.isMesh)return;const c=o.geometry.attributes.color;for(const n of c.array){assert.ok(Number.isFinite(n)&&n>=0&&n<=1);min=Math.min(min,n);max=Math.max(max,n);}shaded+=c.count;});
  rows.push({id,coldMs,warmMs,offTriangles:off.userData.stats.triangles,onTriangles:on.userData.stats.triangles,extraTriangles:on.userData.stats.triangles-off.userData.stats.triangles,drawCalls:on.userData.stats.drawCalls,vertices:shaded,minColour:min,maxColour:max});
 }
 // Isolated floor remains untinted; a nearby wall produces bounded, fading contact AO.
 const floor={x:0,y:-.1,z:0,w:6,h:.2,d:6,color:'sand',kind:'floor',collide:true,blocksShots:true},wall={x:-.2,y:1,z:0,w:.4,h:2,d:6,color:'stone',kind:'wall',collide:true,blocksShots:true};
 const clear=new AoField([floor]),joint=new AoField([floor,wall]),near=joint.neighbors(0,0,0,2,2,2),contact=joint.factor([.02,0,0],1,1,near,true),far=joint.factor([2,0,0],1,1,near,true);
 assert.equal(clear.factor([0,0,0],1,1,clear.neighbors(0,0,0,1,1,1),true),1);assert.equal(far,1);assert.ok(contact<1&&contact>=BAKED_AO.floorMinLight);
 for(const id of api.mapIds)assert.ok((await fs.stat(new URL('ao-data/'+id+'.ts',root))).size<2_000_000);
 api.disposeMapResources();await fs.writeFile(new URL('reports/baked-ao/contracts.json',root),JSON.stringify({pass:true,rows,contact,far,serverImport:'No AO field/query constructed until explicit fixture sampling; shipped maps use precomputed data.'},null,2)+'\n');console.table(rows.map(r=>({id:r.id,coldMs:r.coldMs.toFixed(1),warmMs:r.warmMs.toFixed(1),extra:r.extraTriangles,calls:r.drawCalls})));console.log('BAKED AO CONTRACTS PASS.');
 // Fixture fields are local tests, not map builds; restore diagnostic counts for further suites.
 AO_DIAGNOSTICS.fields=0;AO_DIAGNOSTICS.queries=0;
}
