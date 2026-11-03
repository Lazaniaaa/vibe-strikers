import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import os from 'node:os';
import {verifyColourGuard} from './color-guard.mjs';
import {verifyColour} from './verify-colour.mjs';
import {verifyBakedAo} from './verify-baked-ao.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),failures=[],checks=[];
function check(name,condition,value){checks.push({name,pass:!!condition,value});if(!condition)failures.push({name,value});}
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function geometryHash(group){const h=crypto.createHash('sha256');group.traverse(o=>{if(!o.isMesh)return;h.update(o.name);for(const name of Object.keys(o.geometry.attributes).sort()){h.update(name);h.update(Buffer.from(o.geometry.attributes[name].array.buffer));}h.update(Buffer.from(o.geometry.index.array.buffer));if(o.isInstancedMesh)h.update(Buffer.from(o.instanceMatrix.array.buffer));});return h.digest('hex');}
const vite=await createServer({configFile:false,root:path.resolve(here,'../characters'),cacheDir:path.join(os.tmpdir(),'toy-town-map-verify-'+process.pid),optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const api=await vite.ssrLoadModule('../maps/index.ts'),{expandedBoxes,boxKey}=await vite.ssrLoadModule('../maps/boxes.ts'),{Navigation,NAV}=await vite.ssrLoadModule('../maps/navigation.ts'),{ShotTree,coplanarFaces,scanVisibility}=await vite.ssrLoadModule('../maps/analysis.ts'),{pathsFor,auditMap}=await vite.ssrLoadModule('../maps/audit.ts'),{contrastReport}=await vite.ssrLoadModule('../maps/contrast.ts'),{characters}=await vite.ssrLoadModule('./characters.ts'),{oldPaletteData}=await vite.ssrLoadModule('../maps/palette.ts');
 await verifyColourGuard(vite);
 await verifyColour(vite);
 await verifyBakedAo(vite);
 const data=api.loadMapData('toy-town'),boxes=expandedBoxes(data),collidable=boxes.filter(b=>b.collide),colliders=api.mapColliders(data).boxes,shot=api.mapShotBlockers(data).boxes,report={id:data.id};
 const bad=[];const number=n=>typeof n==='number'&&Number.isFinite(n),color=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
 function finiteTree(v,loc){if(typeof v==='number'&&!Number.isFinite(v))bad.push(loc);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))finiteTree(x,loc+'.'+k);}
 finiteTree(data,'data');
 for(const[c,hex]of Object.entries(data.palette))if(!color(hex))bad.push('palette.'+c);
 const kinds=['floor','wall','prop','stair','glass','decor'];
 for(const [i,b]of boxes.entries()){
  if(!['x','y','z','w','h','d'].every(k=>number(b[k]))||b.w<=0||b.h<=0||b.d<=0||!data.palette[b.color]||(b.top&&!data.palette[b.top])||!kinds.includes(b.kind)||typeof b.collide!=='boolean'||typeof b.blocksShots!=='boolean')bad.push('box '+i);
  if(Math.abs(b.x)+b.w/2>data.bounds.x+1e-6||Math.abs(b.z)+b.d/2>data.bounds.z+1e-6)bad.push('bounds '+i);
  if(b.kind==='decor'&&(b.collide||b.blocksShots))bad.push('decor '+i);if(b.kind==='glass'&&(!b.collide||!b.blocksShots))bad.push('glass '+i);
 }
 for(const i of data.instances)if(!data.prefabs[i.prefab]||Math.abs(i.yaw/(Math.PI/2)-Math.round(i.yaw/(Math.PI/2)))>1e-6)bad.push('instance '+i.prefab);
 for(const p of [...data.spawns,...data.lootSpots])if(![p.x,p.y,p.z].every(number)||Math.abs(p.x)>data.bounds.x||Math.abs(p.z)>data.bounds.z)bad.push('point');
 check('schema / bounds / finite',bad.length===0,bad);
 check('spawn / loot counts',data.spawns.filter(p=>p.team==='A').length>=6&&data.spawns.filter(p=>p.team==='B').length>=6&&data.spawns.filter(p=>p.team==='ffa').length>=16&&data.lootSpots.length>=12,{A:api.spawnPoints(data,'A').length,B:api.spawnPoints(data,'B').length,ffa:api.spawnPoints(data,'ffa').length,loot:data.lootSpots.length});
 const signature=b=>[boxKey(b),b.outline,b.kind,b.collide,b.blocksShots].join('|'),set=new Map();for(const b of boxes){const key=signature(b);set.set(key,(set.get(key)||0)+1);}const mirrored=new Map();for(const b of boxes){const key=signature({...b,x:-b.x});mirrored.set(key,(mirrored.get(key)||0)+1);}const mirrorFailures=[...set].filter(([k,n])=>mirrored.get(k)!==n);
 check('mirror symmetry',mirrorFailures.length===0,mirrorFailures);
 const coplanar=coplanarFaces(collidable);check('no overlapping coplanar collider faces',coplanar.length===0,coplanar);
 const collKeys=new Set(colliders.map(boxKey));check('shot blockers subset',shot.every(b=>collKeys.has(boxKey(b))),{colliders:colliders.length,shotBlockers:shot.length,unmerged:collidable.length});
 const stairs=boxes.filter(b=>b.kind==='stair'),flights=new Map();for(const b of stairs){const key=b.x+','+(b.z < -5 ? -1 : 1);let list=flights.get(key);if(!list)flights.set(key,list=[]);list.push(b);}
 check('stairs <= .25 m / depth >= .40 m',stairs.length===40&&stairs.every(b=>b.h<=.25+1e-7&&b.d>=.4)&&[...flights.values()].every(f=>{const ys=f.map(b=>b.y+b.h/2).sort((a,b)=>a-b);return ys.every((y,i)=>Math.abs(y-(i+1)*.25)<1e-6);}),{flights:flights.size,treads:stairs.length,treadHeight:Math.max(...stairs.map(b=>b.h)),rise:.25,depth:Math.min(...stairs.map(b=>b.d)),deck:2.5});
 const frontDoor=data.boxes.find(b=>Math.abs(b.x-4.5)<1e-6&&b.z===12&&b.y>3),houseRoof=data.boxes.find(b=>b.z===17.5&&b.w===16.8);
 report.architecture={minDoorWidth:frontDoor.w,minDoorHeight:frontDoor.y-frontDoor.h/2,houseCeiling:houseRoof.y-houseRoof.h/2,mainCorridors:{spawnOuterTip:33.25-30.25,returnAlley:15.7-12.4,marketSide:11.6-8.6,fountainToStair:5.9-2.4,houseToBalcony:11.81-8.002},nooksPerHalf:1,nookDepth:11.6-8};
 check('doors / indoor height / primary corridors',frontDoor.w>=2.6&&report.architecture.minDoorHeight>=3&&report.architecture.houseCeiling>=4&&Object.values(report.architecture.mainCorridors).every(w=>w>=3-1e-7),report.architecture);
 const model=api.buildMap(data),second=api.buildMap(data),stats=model.userData.stats;report.stats={...stats,colliders:colliders.length,shotBlockers:shot.length};
 const materials=new Set(),geometries=new Set();let finite=true,triangles=0,drawCalls=0,castShadows=0;model.traverse(o=>{if(!o.isMesh)return;materials.add(o.material);geometries.add(o.geometry);drawCalls++;if(o.castShadow)castShadows++;triangles+=o.geometry.index.count/3*(o.isInstancedMesh?o.count:1);for(const a of Object.values(o.geometry.attributes))for(const v of a.array)if(!Number.isFinite(v))finite=false;});
 check('render budget',stats.boxes<=2500&&stats.renderBoxes<=10000&&triangles<=120000&&drawCalls<=60&&castShadows<=6&&finite,{...stats,measuredTriangles:triangles,measuredCalls:drawCalls});
 check('one shared Lambert material',materials.size===1&&[...materials][0].isMeshLambertMaterial&&[...materials][0].vertexColors,materials.size);
 check('geometry shared',model.children.every((o,i)=>o.geometry===second.children[i].geometry),geometries.size);
 const sha=geometryHash(model),secondSha=geometryHash(second),baselineFile=path.join(here,'baselines/toy-town.sha256.json');report.sha256=sha;check('deterministic geometry',sha===secondSha,sha);
 const writingBaseline=process.argv.includes('--write-baseline');
 const baseline=writingBaseline?{sha256:sha}:JSON.parse(await fs.readFile(baselineFile,'utf8'));check('SHA-256 baseline',baseline.sha256===sha,{expected:baseline.sha256,actual:sha});
 console.log('Geometry checked. Building 0.25 m navigation grid…');
 const nav=new Navigation(data),spawnNodes=data.spawns.map(p=>nav.nearest(p)),connected=nav.flood(spawnNodes[0]);
 const unreachableSpawns=data.spawns.filter((p,i)=>spawnNodes[i]<0||!nav.reachable[spawnNodes[i]]),unreachableLoot=data.lootSpots.filter(p=>{const n=nav.nearest(p,.6);return n<0||!nav.reachable[n];}),unreachableZones=data.zones.filter(p=>{const n=nav.nearest(p);return n<0||!nav.reachable[n];});
 const cannotReturn=data.spawns.filter((p,i)=>!Number.isFinite(nav.path(spawnNodes[i],spawnNodes[0]).length));
 check('reachability >= 90%; all spawns connected',connected.ratio>=.9&&unreachableSpawns.length===0&&cannotReturn.length===0,{...connected,unreachableSpawns,cannotReturn});check('zones / loot reachable',!unreachableLoot.length&&!unreachableZones.length,{unreachableLoot,unreachableZones});
 const spawnClearFailures=data.spawns.filter(p=>!nav.spatial.cylinderClear(p.x,p.y,p.z,1.2,2));let minimumFreeRadius=Infinity,worstSpawn=null;
 for(const p of data.spawns)for(const b of nav.spatial.boxes){if(b.maxY<=p.y+.012||b.minY>=p.y+2)continue;const r=Math.hypot(Math.max(b.minX-p.x,0,p.x-b.maxX),Math.max(b.minZ-p.z,0,p.z-b.maxZ));if(r<minimumFreeRadius){minimumFreeRadius=r;worstSpawn=p;}}
 report.spawnClearance={minimumFreeRadius,height:2,worstSpawn};check('spawn cylinder 1.2 m radius / 2 m high',spawnClearFailures.length===0,{failures:spawnClearFailures,minimumFreeRadius,worstSpawn});
 const tree=new ShotTree(boxes.filter(b=>b.blocksShots)),aSpawns=api.spawnPoints(data,'A'),bSpawns=api.spawnPoints(data,'B');let minSeparation=Infinity,visiblePairs=0,visibleWithin40=0;const pairs=[];
 for(const a of aSpawns)for(const b of bSpawns){const dx=b.x-a.x,dz=b.z-a.z,distance=Math.hypot(dx,dz);minSeparation=Math.min(minSeparation,distance);const hit=tree.distance(a.x,a.y+1.6,a.z,dx/distance,0,dz/distance,distance);if(hit>=distance-1e-5){visiblePairs++;if(distance<=40)visibleWithin40++;}
  const p=nav.path(nav.nearest(a),nav.nearest(b));pairs.push({a:[a.x,a.z],b:[b.x,b.z],length:p.length,seconds:p.length/4.8});
 }
 check('spawn separation / line of sight',minSeparation>=55&&minSeparation<=60&&visibleWithin40===0&&visiblePairs===0,{minSeparation,visiblePairs,visibleWithin40,pairs:36});
 const min=Math.min(...pairs.map(p=>p.length)),max=Math.max(...pairs.map(p=>p.length));
 const routes=pathsFor(data,nav);
 check('three tactical routes',routes.length===3&&routes.every(r=>r.points.length&&Number.isFinite(r.length))&&routes[1].points.some(p=>Math.abs(p.x)<1&&p.z>14)&&routes[2].points.some(p=>Math.abs(p.x)<1&&p.z< -18),routes.map(({points,...r})=>r));
 check('M2 lane distances MID80-95 / flanks110-140',routes[0].length>=80&&routes[0].length<=95&&routes.slice(1).every(r=>r.length>=110&&r.length<=140),routes.map(({points,...r})=>r));
 // Macrograph: two exits around each spawn shield (one loop/half), three branches
 // between the two mid hubs (two loops). All seven branches are validated paths.
 const macroNodes=['A','west','east','B'],macroEdges=[['A','west','north'],['A','west','south'],['west','east','MID'],['west','east','LEFT'],['west','east','RIGHT'],['east','B','north'],['east','B','south']];
 const branchPaths=[];for(const sign of [-1,1])for(const z of [-26,26]){const points=[{x:sign*28.5,z:0},{x:sign*26,z},{x:sign*20,z},{x:sign*10,z:0}];let valid=true;for(let i=1;i<points.length;i++)valid&&=Number.isFinite(nav.path(nav.nearest(points[i-1]),nav.nearest(points[i])).length);branchPaths.push({side:sign,exit:z,valid});}
 const loops=macroEdges.length-macroNodes.length+1;check('at least four flank loops',loops>=4&&branchPaths.every(p=>p.valid),{loops,branchPaths,macroNodes,macroEdges});
 check('M2 shortest80-95m / all pair ratios<=1.7',min>=80&&min<=95&&max/57<=1.7,{minLength:min,maxLength:max,minSeconds:min/4.8,maxSeconds:max/4.8});
 console.log('Scanning eye-level lines of sight…');const visibility=scanVisibility(nav,tree);check('longest sampled straight LOS <= 45 m',visibility.longest<=45,visibility);
 report.navigation={parameters:NAV,...connected,unreachableSpawns,unreachableLoot,unreachableZones,shortest:{length:min,seconds:min/4.8},longestShortest:{length:max,seconds:max/4.8},plannedRoutes:routes.map(({points,...r})=>r),routes,loops,spawnMinSeparation:minSeparation,spawnVisiblePairs:visiblePairs,spawnClearanceFailures:spawnClearFailures,visibility};
 // Crouch passage really needs the short capsule and is traversable through its length.
 check('crouch passage 1.3 m',!nav.spatial.clear(0,0,-16.5,1.8)&&nav.spatial.clear(0,0,-16.5,1.2)&&Number.isFinite(nav.path(nav.nearest({x:0,y:0,z:-14}),nav.nearest({x:0,y:0,z:-19})).length),{clearHeight:1.302});

 const audit=auditMap(JSON.parse(JSON.stringify(data)));report.auditM2={earlySafety:audit.earlySafety,chokes:audit.chokes,spawnFacing:audit.spawnFacing,loot:audit.loot};
 await fs.writeFile(path.join(here,'reports/m2/after.json'),JSON.stringify(audit,null,2)+'\n');
 await fs.writeFile(path.join(here,'reports/m2/preview.json'),JSON.stringify({heatmap:audit.heatmap,camping:audit.camping},null,2)+'\n');
 check('M2 first3 seconds protected',audit.earlySafety.failures===0,audit.earlySafety);
 check('M2 choke widths and height',audit.chokes.violations.length===0,audit.chokes.violations);
 check('M2 loot exact placement',audit.loot.every(p=>!p.violation),audit.loot.filter(p=>p.violation));
 check('M2 spawn facing exits',audit.spawnFacing.every(p=>!p.violation),audit.spawnFacing.filter(p=>p.violation));
 check('M2 pillar visible top <=1.4 m',Math.max(...data.boxes.filter(b=>b.x===0&&b.z===0&&b.w<=1.5&&b.y>.5).map(b=>b.y+b.h/2))<=1.400001,1.4);
 const contrast=contrastReport(data,characters);await fs.writeFile(path.join(here,'reports/m2/contrast.json'),JSON.stringify(contrast,null,2)+'\n');
 check('M2 CIE76 33 characters x10zones x3colours',contrast.rows.length===330&&contrast.rows.every(r=>r.pairs.length===3&&r.pairs.every(p=>Number.isFinite(p.deltaE))),{comparisons:990,lowContrastPairs:contrast.flags.length,flags:contrast.flags});
 const colorGuard=JSON.parse(await fs.readFile(path.join(here,'reports/m2/color-geometry-guard.json'),'utf8'));check('M2 colour-only collider/nav guard',colorGuard.geometrySame&&colorGuard.navSame&&colorGuard.spawnsSame&&colorGuard.lootSame,colorGuard);
 const legacyModel=api.buildMap(oldPaletteData(data));
 const shapeHash=group=>{const h=crypto.createHash('sha256');group.traverse(o=>{if(!o.isMesh)return;for(const name of ['position','normal'])h.update(Buffer.from(o.geometry.attributes[name].array.buffer));h.update(Buffer.from(o.geometry.index.array.buffer));if(o.isInstancedMesh)h.update(Buffer.from(o.instanceMatrix.array.buffer));});return h.digest('hex');};
 check('M2 old/new palette identical shape and material',shapeHash(legacyModel)===shapeHash(model)&&legacyModel.children.filter(o=>o.isMesh).every(o=>materials.has(o.material)),shapeHash(model));

 let disposedGeometry=0,disposedMaterial=0,disposedInstanceMeshes=0;for(const g of geometries)g.addEventListener('dispose',()=>disposedGeometry++);for(const m of materials)m.addEventListener('dispose',()=>disposedMaterial++);for(const rendered of [model,second])rendered.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>disposedInstanceMeshes++);});api.disposeMapResources();api.disposeMapResources();
 const fresh=api.buildMap(data);check('dispose / fresh resources',disposedGeometry===geometries.size&&disposedMaterial===1&&disposedInstanceMeshes===stats.instancedPrefabs*2&&fresh.children.every(o=>!geometries.has(o.geometry))&&geometryHash(fresh)===sha,{disposedGeometry,disposedMaterial,disposedInstanceMeshes});api.disposeMapResources();
 report.checks=checks;report.pass=failures.length===0;
 await fs.writeFile(path.join(here,'reports/toy-town.json'),JSON.stringify(report,null,2)+'\n');
 console.table(checks.map(c=>({check:c.name,result:c.pass?'PASS':'FAIL'})));console.log(JSON.stringify({stats,connected,paths:{min,max,minSeconds:min/4.8,maxSeconds:max/4.8},routes:routes.map(({points,...r})=>r),visibility,sha},null,2));
 assert.equal(failures.length,0,'MAP VERIFY FAILED:\n'+JSON.stringify(failures,null,2));if(writingBaseline)await fs.writeFile(baselineFile,JSON.stringify({id:data.id,sha256:sha,stats},null,2)+'\n');console.log('TOY TOWN VERIFIED.');
}finally{await vite.close();}

// M2 remains the immutable regression map. The four M3 combinations use the
// owner's current limits and each get the same full contract and tactical audit.
if(!process.argv.includes('--m2-only'))await import('./verify-m3.mjs');





