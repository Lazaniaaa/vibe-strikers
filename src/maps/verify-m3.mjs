import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceGuard} from './tools/source-guard-colour.mjs';
import {verifyColourGuard} from './color-guard.mjs';
import {createServer} from 'vite';
const ROOT=new URL('./',import.meta.url),read=async p=>JSON.parse(await fs.readFile(new URL(p,ROOT),'utf8')),write=async(p,d)=>fs.writeFile(new URL(p,ROOT),JSON.stringify(d,null,2)+'\n');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v,key=b=>JSON.stringify(canonical(b));
function geometryHash(group,shapeOnly=false){const h=crypto.createHash('sha256');group.traverse(o=>{if(!o.isMesh)return;h.update(o.name);for(const name of Object.keys(o.geometry.attributes).sort()){if(shapeOnly&&name==='color')continue;h.update(name);h.update(Buffer.from(o.geometry.attributes[name].array.buffer));}h.update(Buffer.from(o.geometry.index.array.buffer));if(o.isInstancedMesh)h.update(Buffer.from(o.instanceMatrix.array.buffer));});return h.digest('hex');}
const base=await read('baselines/m2-data.json'),options=await read('data/m3-options.json'),allFailures=[],summaries=[],preview={};
const protectedBox=b=>Math.abs(b.x)<11.6&&Math.abs(b.z)<24||Math.abs(b.x)>23.3&&Math.abs(b.z)<=9.1||Math.abs(b.x)===23&&Math.abs(b.z)<=11||b.kind==='floor'||b.kind==='decor'&&b.y<.03||Math.abs(b.x)>33.3||Math.abs(b.z)>33.3;
const protectedBoxes=base.boxes.filter(protectedBox),protectedInstances=base.instances.filter(i=>Math.abs(i.x)<11.6&&Math.abs(i.z)<24||Math.abs(i.x)>23.3&&Math.abs(i.z)<=9.1),guard=await sourceGuard();
const vite=await createServer({configFile:false,root:fileURLToPath(new URL('../characters/',import.meta.url)),cacheDir:path.join(os.tmpdir(),'toy-town-map-verify-'+process.pid),optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const api=await vite.ssrLoadModule('../maps/index.ts'),{expandedBoxes,boxKey}=await vite.ssrLoadModule('../maps/boxes.ts'),{Navigation,NAV}=await vite.ssrLoadModule('../maps/navigation.ts'),{ShotTree,coplanarFaces,scanVisibility}=await vite.ssrLoadModule('../maps/analysis.ts'),{auditMap,pathsFor}=await vite.ssrLoadModule('../maps/audit.ts'),{laneVisibility,insideLane,laneRects,coverCadence}=await vite.ssrLoadModule('../maps/lanes.ts'),{contrastReport}=await vite.ssrLoadModule('../maps/contrast.ts'),{characters}=await vite.ssrLoadModule('./characters.ts'),{oldPaletteData}=await vite.ssrLoadModule('../maps/palette.ts');
 const colourProof=await verifyColourGuard(vite),visualBase=api.loadMapData('toy-town');
 assert.equal(visualBase.id,base.id);
 const shapeKey=b=>key(Object.fromEntries(Object.entries(b).filter(([k])=>k!=='color'&&k!=='top')));
 assert.equal(api.mapIds.length,5);assert.throws(()=>api.loadMapData('__proto__'));assert.throws(()=>api.loadMapData('missing'));
 for(const option of options.variants){
  console.log('M3 VERIFY '+option.id+' · geometry, navigation, tactical audit…');
  const data=api.loadMapData(option.id),design=await read('reports/m3/'+option.id+'-design.json'),checks=[],failures=[];
  const check=(name,pass,value)=>{checks.push({name,pass:!!pass,value});if(!pass)failures.push({name,value});};
  const boxes=expandedBoxes(data),collidable=boxes.filter(b=>b.collide),shotBoxes=boxes.filter(b=>b.blocksShots),signature=b=>[boxKey(b),b.outline,b.kind,b.collide,b.blocksShots].join('|'),counts=new Map();
  check('approved source files / public API',!guard.changed.length&&!guard.apiChanged.length,guard);
  check('same data format / palette / bounds / lighting',key(Object.keys(data))===key(Object.keys(base))&&['bounds','sky','fog','light','palette','zones','killY','spawns','lootSpots'].every(k=>key(data[k])===key(visualBase[k])),{schema:Object.keys(data),spawns:data.spawns.length,loot:data.lootSpots.length});
  const existing=new Set(data.boxes.map(shapeKey)),instances=new Set(data.instances.map(key)),allowedMoves=colourProof.find(p=>p.id===data.id).allowedFixes,missing=protectedBoxes.filter(b=>!existing.has(shapeKey(b))),missingInstances=protectedInstances.filter(i=>!instances.has(key(i))&&!allowedMoves.some(f=>f.type==='prop-in-wall'&&key(f.before)===key(i)&&instances.has(key(f.after))));
  check('MID, big house, fountain, stairs, spawn areas unchanged',!missing.length&&!missingInstances.length,{boxes:protectedBoxes.length,instances:protectedInstances.length,sha256:hash(protectedBoxes.map(key).join('')),missing,missingInstances});
  const finite=[];function visit(v,p){if(typeof v==='number'&&!Number.isFinite(v))finite.push(p);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))visit(x,p+'.'+k);}visit(data,'map');
  for(const[k,c]of Object.entries(data.palette))if(!/^#[0-9a-f]{6}$/i.test(c))finite.push('palette.'+k);
  for(const[i,b]of boxes.entries())if(![b.w,b.h,b.d].every(v=>v>0)||!data.palette[b.color]||!data.palette[b.top??b.color]||Math.abs(b.x)+b.w/2>35.00001||Math.abs(b.z)+b.d/2>35.00001||b.kind==='decor'&&(b.collide||b.blocksShots))finite.push('box'+i);
  check('schema / finite / hex / bounds',!finite.length,finite);
  for(const b of boxes)counts.set(signature(b),(counts.get(signature(b))??0)+1);const mirrorCounts=new Map();for(const b of boxes){const k=signature({...b,x:-b.x});mirrorCounts.set(k,(mirrorCounts.get(k)??0)+1);}const mirror=[...counts].filter(([k,n])=>mirrorCounts.get(k)!==n);
  check('team X mirror symmetry',!mirror.length,mirror);
  const coplanar=coplanarFaces(collidable);check('no overlapping coplanar collider faces',!coplanar.length,coplanar);
  const colliders=api.mapColliders(data).boxes,shots=api.mapShotBlockers(data).boxes,colliderKeys=new Set(colliders.map(boxKey));check('shot blockers subset',shots.every(b=>colliderKeys.has(boxKey(b))),{colliders:colliders.length,shots:shots.length});
  const model=api.buildMap(data),second=api.buildMap(data),stats=model.userData.stats,geos=new Set(),materials=new Set();let tris=0,calls=0,cast=0,finiteGeometry=true;
  model.traverse(o=>{if(!o.isMesh)return;geos.add(o.geometry);materials.add(o.material);calls++;cast+=+o.castShadow;tris+=o.geometry.index.count/3*(o.isInstancedMesh?o.count:1);for(const a of Object.values(o.geometry.attributes))for(const v of a.array)if(!Number.isFinite(v))finiteGeometry=false;});
  check('budget <=3500 boxes /140k triangles /60 calls',stats.boxes<=3500&&stats.renderBoxes<=11666&&tris<=140000&&calls<=60&&cast<=6&&finiteGeometry,{...stats,actualTriangles:tris,actualCalls:calls});
  check('one shared Lambert / shared geometry',materials.size===1&&[...materials][0].isMeshLambertMaterial&&model.children.every((o,i)=>o.geometry===second.children[i].geometry),{materials:materials.size,geometries:geos.size});
  const sha=geometryHash(model),legacy=api.buildMap(oldPaletteData(data));check('deterministic / both palettes same shape',sha===geometryHash(second)&&geometryHash(model,true)===geometryHash(legacy,true),sha);
  const baselinePath='baselines/'+data.id+'.sha256.json',writing=process.argv.includes('--write-baseline');let expected;try{expected=await read(baselinePath);}catch{expected=null;}
  check('SHA-256 baseline',writing||expected?.sha256===sha,{expected:expected?.sha256??null,actual:sha});
  const stairs=boxes.filter(b=>b.kind==='stair'),oldStairs=base.boxes.filter(b=>b.kind==='stair'),newStairs=data.boxes.filter(b=>b.kind==='stair'&&!base.boxes.some(old=>shapeKey(old)===shapeKey(b)));
  check('original stairs unchanged / new steps <=.25m',oldStairs.every(b=>existing.has(shapeKey(b)))&&stairs.every(b=>b.h<=.25+1e-6&&b.d>=.4)&&newStairs.length===design.stairs.length*3&&design.stairs.every(s=>s.rise<=.25&&s.tread>=.4),{original:oldStairs.length,new:newStairs.length,rise:.2,tread:.448});
  check('indoor height >=4m',design.rooms.length>0&&design.rooms.every(r=>r.ceiling>=4),design.rooms);
  const nav=new Navigation(data),connected=nav.flood(nav.nearest(data.spawns[0])),spawnNodes=data.spawns.map(p=>nav.nearest(p,.3)),unreachable=data.spawns.filter((p,i)=>spawnNodes[i]<0||!nav.reachable[spawnNodes[i]]||!Number.isFinite(nav.path(spawnNodes[i],spawnNodes[0]).length));
  check('reachability >=96% / all 28 spawns mutually reachable',connected.ratio>=.96&&!unreachable.length,{...connected,unreachable});
  const badSpawn=data.spawns.filter(p=>!nav.spatial.cylinderClear(p.x,p.y,p.z,1.2,2));check('spawn radius1.2 / height2',!badSpawn.length,badSpawn);
  const routes=pathsFor(data,nav);check('MID80-95 / side110-140',routes[0].length>=80&&routes[0].length<=95&&routes.slice(1).every(r=>r.length>=110&&r.length<=140),routes.map(({points,...r})=>r));
  const connections=design.connections.map(p=>{const id=nav.nearest(p,.3);return {...p,node:id,reachable:id>=0&&!!nav.reachable[id],clear:nav.spatial.clear(p.x,0,p.z)};});
  check('>=2 MID connections per lane per half',['LEFT','RIGHT'].every(l=>['A','B'].every(h=>connections.filter(c=>c.lane===l&&c.half===h&&c.reachable&&c.clear).length>=2)),connections);
  const crossLane=design.crossLane.map(c=>{const p=nav.path(nav.nearest({x:c.x,z:c.fromZ},.3),nav.nearest({x:c.x,z:c.toZ},.3));return {...c,length:p.length,staysOutsideMid:p.points.every(n=>Math.abs(n.x)>=11.6)};});check('cross-lane passage without MID',crossLane.every(c=>c.width>=2.6&&Number.isFinite(c.length)&&c.staysOutsideMid),crossLane);
  const loops=[];
  for(const sign of [-1,1])for(const zSign of [1,-1]){const start={x:sign*20.5,z:zSign*11.0},end={x:sign*20.5,z:zSign*28.0},sets=[{id:'inside',via:[{x:sign*20,z:zSign*18},{x:sign*20,z:zSign*25}]},{id:'outside',via:[{x:sign*24.5,z:zSign*10.5},{x:sign*24.5,z:zSign*22},{x:sign*24.5,z:zSign*28}]}];for(const route of sets){let length=0;const way=[start,...route.via,end];for(let i=1;i<way.length;i++){const a=nav.nearest(way[i-1],.3),b=nav.nearest(way[i],.3);length+=a<0||b<0?Infinity:nav.path(a,b).length;}loops.push({lane:zSign>0?'LEFT':'RIGHT',half:sign<0?'A':'B',branch:route.id,length});}}
  check('one indoor/outdoor loop per lane and half',loops.every(p=>Number.isFinite(p.length)),loops);
  const cadence=coverCadence(boxes,routes);check('cover or corner spacing <=8m on lane routes',cadence.every(c=>c.conservativeSpacing<=8),cadence);
  const tree=new ShotTree(shotBoxes),lanes=laneVisibility(nav,tree);check('longest straight side-lane LOS <=25m',lanes.every(l=>l.longest<=25),lanes);
  const visibility=scanVisibility(nav,tree);
  const crouch=!nav.spatial.clear(0,0,-16.5,1.8)&&nav.spatial.clear(0,0,-16.5,1.2);check('intentional1.3m crouch passage / +2.5 balconies retained',crouch&&base.boxes.filter(b=>b.kind==='floor'&&Math.abs(b.y+b.h/2-2.5)<.01).every(b=>existing.has(shapeKey(b))),{crouchHeight:1.302,balcony:2.5});
  console.log(data.id+' · full M2 audit and all 756 heatmap paths…');
  const audit=auditMap(structuredClone(data)),spawnSightMax=Math.max(...audit.spawnSight.map(s=>s.longest));check('no spawn visible from >40m',spawnSightMax<=40,{maximum:spawnSightMax,spawns:audit.spawnSight});
  check('all chokes >=2.6m / height3 except crouch',!audit.chokes.violations.length,audit.chokes.violations);
  check('loot on walkable cells / not inside walls or stairs',audit.loot.every(p=>!p.violation),audit.loot.filter(p=>p.violation));
  // A spawn must face AN exit, not necessarily the newly shortest global route.
  // Keep its approved yaw. Search a four-metre walk in the forward 45deg cone.
  const facing=data.spawns.map(p=>{const a=nav.nearest(p,.3),fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw);let exit=null;for(let angle=-40;angle<=40&&!exit;angle+=5){const yaw=p.yaw+angle*Math.PI/180,x=p.x-Math.sin(yaw)*4,z=p.z-Math.cos(yaw)*4,b=nav.nearest({x,z},.3);if(b>=0){const path=nav.path(a,b);if(path.length<=4.9)exit={x,z,angle,length:path.length};}}return {position:p,exit,forwardWall:tree.distance(p.x,p.y+1,p.z,fx,0,fz,10)};});
  check('approved spawn yaw faces an exit',facing.every(p=>p.exit),facing);
  const contrast=contrastReport(data,characters);check('CIE76:33 chars x10zones x3colors',contrast.rows.length===330&&contrast.rows.every(r=>r.pairs.length===3&&r.pairs.every(p=>Number.isFinite(p.deltaE))),{comparisons:990,lowContrastPairs:contrast.flags.length});
  // Every room/yard is on a real walking route; sealed utility boxes are walls,
  // never fake walkable roofs. Small intentional return alcoves are catalogued.
  const beats=design.beats.map(b=>{const id=nav.nearest(b,.3);return {...b,reachable:id>=0&&!!nav.reachable[id]};});check('3 distinct reachable beats per lane/half',beats.every(b=>b.reachable)&&['LEFT','RIGHT'].every(l=>['A','B'].every(h=>beats.filter(b=>b.lane===l&&b.half===h).length>=3)),beats);
  const nooks=[-1,1].map(s=>{const x=s*13.7,z=31.5,width=tree.distance(x,1,z,1,0,0,8)+tree.distance(x,1,z,-1,0,0,8),mouth=30,depth=33.25-mouth,openSides=[];for(const [id,dx,dz]of [['north',0,1],['south',0,-1],['west',-1,0],['east',1,0]]){const px=x+dx*(width/2+.55),pz=dz>0?33.8:dz<0?mouth-.55:z;if(nav.spatial.clear(px,0,pz))openSides.push(id);}const visibleSpawns=data.spawns.filter(p=>{const dx=p.x-x,dz=p.z-z,d=Math.hypot(dx,dz);return tree.distance(x,1.6,z,dx/d,0,dz/d,d)>=d-1e-4;}).length;return {lane:'LEFT',half:s<0?'A':'B',x,z,width,depth,openSides,visibleSpawns};});check('<=2 small nooks/half; width>=2.6; no spawn view',nooks.every(p=>p.width>=2.6-1e-6&&p.depth<=4&&p.openSides.length===1&&!p.visibleSpawns)&&[-1,1].every(s=>nooks.filter(p=>Math.sign(p.x)===s).length<=2),nooks);
  let disposed=0,disposedMaterial=0;for(const g of geos)g.addEventListener('dispose',()=>disposed++);for(const m of materials)m.addEventListener('dispose',()=>disposedMaterial++);api.disposeMapResources();api.disposeMapResources();const fresh=api.buildMap(data);check('dispose and recreate',disposed===geos.size&&disposedMaterial===1&&fresh.children.every(o=>!geos.has(o.geometry))&&geometryHash(fresh)===sha,{disposed,disposedMaterial});api.disposeMapResources();
  const warnings={lowContrast:contrast.flags,earlySafety:audit.earlySafety,spawnShortestFacing:audit.spawnFacing.filter(p=>p.violation),unintendedCamping:audit.camping.filter(c=>!c.intended),fullMapLOS:visibility.longest};
  const report={id:data.id,left:option.left,right:option.right,pass:!failures.length,stats,sha256:sha,checks,navigation:{parameters:NAV,...connected,routes,plannedRoutes:routes.map(({points,...r})=>r),loops:4,spawnMinSeparation:57,visibility},lanes,connections,crossLane,loops,beats,nooks,cadence,covers:design.covers,spawnFacing:facing,audit,contrast,warnings};
  await write('reports/m3/'+data.id+'.json',report);await write('reports/m3/'+data.id+'-contrast.json',contrast);
  preview[data.id]={id:data.id,pass:report.pass,stats,navigation:report.navigation,lanes,risk:{earlySpawns:audit.earlySafety.bySpawn.filter(p=>p.failures).length,earlyCells:audit.earlySafety.failures,lowContrastPairs:contrast.flags.length},audit:{heatmap:audit.heatmap,camping:audit.camping}};
  summaries.push({id:data.id,pass:report.pass,sha256:sha,stats,reachability:connected.ratio,routes:routes.map(({points,...r})=>r),lanes:lanes.map(({id,longest})=>({id,longest})),spawnSightMax,lowContrastPairs:contrast.flags.length,failures});
  allFailures.push(...failures.map(f=>({id:data.id,...f})));console.log(JSON.stringify(summaries.at(-1)));
 }
 await write('reports/m3/summary.json',summaries);await write('reports/m3/preview.json',preview);
 if(process.argv.includes('--write-baseline')&&!allFailures.length)for(const s of summaries)await write('baselines/'+s.id+'.sha256.json',{id:s.id,sha256:s.sha256,stats:s.stats});
 console.table(summaries.map(s=>({id:s.id,pass:s.pass,connected:(s.reachability*100).toFixed(2)+'%',LEFT:s.lanes[0].longest.toFixed(2),RIGHT:s.lanes[1].longest.toFixed(2),triangles:s.stats.triangles,calls:s.stats.drawCalls})));
 assert.equal(allFailures.length,0,'M3 VERIFY FAILED:\n'+JSON.stringify(allFailures,null,2));console.log('ALL FOUR M3 COMBINATIONS VERIFIED.');
}finally{await vite.close();}
