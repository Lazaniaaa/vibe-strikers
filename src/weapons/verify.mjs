import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { Box3, Mesh, MeshBasicMaterial, MeshLambertMaterial, Vector3 } from 'three';
import { verifyHolds } from './verifyHolds.mjs';
import { verifySniper } from './verifySniper.mjs';
import { verifyScope } from './verifyScope.mjs';
import { verifyHoldPerf } from './verifyHoldPerf.mjs';
import { verifyHoldSweep } from './verifyHoldSweep.mjs';
import { verifyToyWeapons } from './verifyToyWeapons.mjs';

const hashGeometry=g=>{
 const h=createHash('sha256');
 for(const key of ['position','normal','uv','color']){const a=g.getAttribute(key);h.update(key);h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
 h.update('index');const a=g.index;h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 // Attribute.count includes item size one for the index.
 return h.digest('hex');
};
const snapshot=g=>{const a=[];g.traverse(o=>a.push(o.name,o.visible,...o.position,...o.quaternion,...o.scale));return a;};
const finite=g=>{for(const n of snapshot(g))if(typeof n==='number')assert.ok(Number.isFinite(n),'Finite transforms');};
const meshes=g=>{const a=[];g.traverse(o=>{if(o instanceof Mesh)a.push(o);});return a;};
const idle={fire:0,reload:null,cycle:null,equip:1};

export async function verifyWeapons(){
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
 try{
  const fullApi=await server.ssrLoadModule('../weapons/index.ts');
  // Frozen legacy contracts retain their exact five-weapon matrix. The new kit has its own full matrix below.
  const legacyIds=['knife','pistol','rifle','sniper','shotgun'];
  const api={...fullApi,weapons:fullApi.weapons.filter(w=>legacyIds.includes(w.id)),weaponIds:legacyIds};
  const {characters}=await server.ssrLoadModule('/characters.ts');
  await verifyScope(api,await server.ssrLoadModule('../weapons/scopeOverlay.ts'),characters);
  const {createCharacter,disposeCharacterResources}=await server.ssrLoadModule('/createCharacter.ts');
  const {poseCharacter}=await server.ssrLoadModule('/poseCharacter.ts');
  const performanceFailures=[];
  try{await verifyHoldPerf(api,characters,createCharacter,poseCharacter);}catch(e){performanceFailures.push(e);console.error('FAILED HOLD PERFORMANCE:',e.message);}
  try{await verifyHoldSweep(api,characters,createCharacter,poseCharacter);}catch(e){performanceFailures.push(e);console.error('FAILED FINE HOLD SWEEP:',e.message);}
  const baseline=JSON.parse(await readFile(new URL('./character-baselines.json',import.meta.url),'utf8'));
  const longBaseline=JSON.parse(await readFile(new URL('./arm-long-baselines.json',import.meta.url),'utf8'));
  const bankBaseline=JSON.parse(await readFile(new URL('./arm-length-baselines.json',import.meta.url),'utf8'));
  const {ARM_LONG_EXTRA,ARM_SHORTEN_RATIO,ARM_LENGTH_STEP}=await server.ssrLoadModule('/armVariants.ts');
  const previousLengths=JSON.parse(await readFile(new URL('./round4-arm-lengths.json',import.meta.url),'utf8'));
  assert.equal(longBaseline.extraLength,ARM_LONG_EXTRA,'Changing arm length requires an explicitly reviewed new baseline');
  assert.equal(characters.length,33);assert.equal(Object.keys(baseline.characters).length,33);
  // The original source hash remains archived. Optional ready holds are authorized;
  // exact old-state output and all original geometry hashes below remain immutable.
  for(const c of characters){
   const actual={};createCharacter(c).traverse(o=>{if(o instanceof Mesh)actual[o.name]=hashGeometry(o.geometry);});
   assert.deepEqual(actual,baseline.characters[c.id],`All geometry stays byte-identical: ${c.id}`);
   const g=createCharacter(c),d=g.userData;
   const a=d.armVariants;
   const previous=previousLengths.find(r=>r.character===c.id&&r.side==='right');
   for(const [side,name] of [['L','left'],['R','right']]){
    const variant=a['variants'+side][a.holdLengths[side]],target=previous[name+'Upper']*ARM_SHORTEN_RATIO;
    assert.ok(Math.abs(variant.upper.height-target)<=ARM_LENGTH_STEP/2+1e-6,'Round-4 right upper block x5/6, nearest .04m');
   }
   assert.deepEqual({armL:hashGeometry(a.longL),armR:hashGeometry(a.longR)},longBaseline.characters[c.id],`Long-arm SHA-256: ${c.id}`);
   const copy=createCharacter(c).userData.armVariants;
   assert.deepEqual({L:a.variantsL.map(v=>hashGeometry(v.geometry)),R:a.variantsR.map(v=>hashGeometry(v.geometry))},bankBaseline.characters[c.id],'Frozen approved length bank');
   for(const side of ['L','R'])for(let i=0;i<a['variants'+side].length;i++){
    const v=a['variants'+side][i],normal=d.dimensions['hand'+side];
    assert.equal(v.geometry,copy['variants'+side][i].geometry);
    assert.ok(v.gap<=.001);assert.ok(Math.abs(v.upper.height-d.dimensions.components['arm'+side][1]-v.extra)<1e-6);
    for(const key of ['width','height','depth'])assert.ok(Math.abs(v.hand[key]-normal[key])<1e-6);
    assert.ok(v.geometry.boundingSphere.radius>0);
    for(const attr of Object.values(v.geometry.attributes))for(const n of attr.array)assert.ok(Number.isFinite(n));
   }
   assert.equal(a.longL,copy.longL);assert.equal(a.longR,copy.longR);
   if(hashGeometry(a.longL)===hashGeometry(a.longR))assert.equal(a.longL,a.longR,'Identical L/R long arms share geometry');
   for(const geometry of [a.longL,a.longR]){
    assert.equal(geometry.name,'armLong');assert.ok(geometry.boundingBox&&!geometry.boundingBox.isEmpty());
    assert.ok(Number.isFinite(geometry.boundingSphere.radius));
    for(const attribute of Object.values(geometry.attributes))for(const n of attribute.array)assert.ok(Number.isFinite(n),'Finite long-arm buffers');
   }
   for(const side of ['L','R']){
    const normal=d.dimensions['hand'+side],long=a['hand'+side],upper=a['upper'+side];
    for(const axis of ['width','height','depth'])assert.ok(Math.abs(normal[axis]-long[axis])<1e-6,'Glove size unchanged');
    assert.ok(Math.abs(upper.height-d.dimensions.components['arm'+side][1]-ARM_LONG_EXTRA)<1e-6,'Upper arm adds exact metric constant');
    assert.ok(Math.max(0,upper.min[1]-long.max[1])<=.001,'Actual outlined arm/glove bounds meet');
   }
   for(const p of baseline.oldPoseCases){
    d.phase=p.phase;poseCharacter(g,p.state,p.dt);const values=[d.phase];
    for(const part of [g,d.rig,d.head,d.torso,d.armL,d.armR,d.legL,d.legR,d.weaponSocket])values.push(part.name,...part.position,...part.quaternion,...part.scale);
    assert.equal(createHash('sha256').update(JSON.stringify(values)).digest('hex'),baseline.poses[c.id][p.name],`Approved old-state pose: ${c.id}/${p.name}`);
    d.phase=p.phase;poseCharacter(g,{...p.state,weapon:null,fire:1,reload:.5,cycle:.5},p.dt);const optional=[d.phase];
    for(const part of [g,d.rig,d.head,d.torso,d.armL,d.armR,d.legL,d.legR,d.weaponSocket])optional.push(part.name,...part.position,...part.quaternion,...part.scale);
    assert.equal(createHash('sha256').update(JSON.stringify(optional)).digest('hex'),baseline.poses[c.id][p.name],'Optional action fields without weapon keep old pose');
   }
  }
  console.log('PASS: 33 default geometry baselines, 66 long-arm hashes, 396 approved old poses, continuous joints, unchanged glove sizes.');
  for(const file of ['../characters/poseCharacter.ts','../characters/armVariants.ts','./supportPose.ts','./holdSolve.ts','./viewmodel.ts']){
   const source=await readFile(new URL(file,import.meta.url),'utf8');
   const marker=file.includes('supportPose')?'function poseFirearmArms':file.includes('holdSolve')?'function center':file.includes('armVariants')?'function selectArmGeometry':file.includes('viewmodel')?'function poseViewmodel':'function ';
   const functions=source.slice(source.indexOf(marker));
   assert.doesNotMatch(functions,/\bnew\s+|\.clone\s*\(|\.map\s*\(|\.filter\s*\(|\.toArray\s*\(/,'No frame constructors, cloned objects or array factories');
  }
  console.log('PASS: pose/hold function allocation source audit (scratch objects are module-level).');
  const characterType=await readFile(new URL('../characters/types.ts',import.meta.url),'utf8');
  assert.doesNotMatch(characterType.split('export interface PoseState {')[1].split('export interface Extent')[0],/\bads\??\s*:/,'Character API has no ADS');
  for(const file of ['../characters/poseCharacter.ts','./supportPose.ts'])assert.doesNotMatch(await readFile(new URL(file,import.meta.url),'utf8'),/state\.ads|state\.holdSide/,'World hold has no ADS or side state');
  assert.deepEqual(api.weaponIds,['knife','pistol','rifle','sniper','shotgun']);
  let lambert,basic,glass,poses=0,viewPoses=0,nearMax=-Infinity;
  const report=[];
  const sourceNames=['knife','pistol','rifle','sniper','shotgun'];
  for(const config of api.weapons){
   assert.ok(sourceNames.includes(config.kind));assert.ok(config.displayName);
   assert.equal(config.id,config.kind);
   for(const color of Object.values(config.palette))assert.match(color,/^#[0-9a-f]{6}$/i);
   const w=api.createWeapon(config.id),copy=api.createWeapon(config.id),d=w.userData;
   assert.equal(d.weaponId,config.id);assert.equal(d.kind,config.kind);
   const list=meshes(w),second=meshes(copy),originalGeometries=list.map(m=>hashGeometry(m.geometry));
   const opaque=list.filter(m=>!m.name.startsWith('lens-')),lenses=list.filter(m=>m.name.startsWith('lens-'));
   assert.ok(opaque.length<=3&&opaque.length>=1);assert.ok(lenses.length<=2);assert.equal(lenses.length,config.lenses?.length??0);
   assert.ok(opaque.filter(m=>m.material instanceof MeshBasicMaterial).length<=1);
   for(let i=0;i<list.length;i++){
    const m=list[i];assert.equal(m.geometry,second[i].geometry,'Geometry shared between instances');
    const lens=m.name.startsWith('lens-');
    assert.equal(m.geometry.userData.source,lens?'BoxGeometry/lens panes':'BoxGeometry/Boxes.outlined');
    assert.equal(m.geometry.attributes.position.count,m.geometry.userData.boxes*(lens?24:144));
    assert.equal(m.geometry.index.count,m.geometry.userData.boxes*(lens?36:216));
    for(const attr of Object.values(m.geometry.attributes))for(const value of attr.array)assert.ok(Number.isFinite(value));
    if(lens){glass??=m.material;assert.equal(m.material,glass);assert.ok(glass instanceof MeshBasicMaterial);assert.equal(glass.transparent,true);assert.equal(glass.opacity,.35);assert.equal(glass.depthWrite,false);assert.equal(glass.toneMapped,false);}
    else if(m.material instanceof MeshLambertMaterial){lambert??=m.material;assert.equal(m.material,lambert);}
    else {assert.ok(m.material instanceof MeshBasicMaterial);basic??=m.material;assert.equal(m.material,basic);}
    assert.equal(m.material.map,null);if(!lens)assert.equal(m.material.transparent,false);assert.equal(m.material.vertexColors,true);
   }
   const required=['muzzle',...(!['knife','pistol'].includes(config.kind)?['foregrip']:[]),...(config.kind!=='knife'?['ejectPort','sightAxis']:[]),...Object.keys(config.parts)];
   for(const name of required){assert.equal(d[name],w.getObjectByName(name));assert.ok(d[name],`${config.id}/${name}`);}
   for(const name of ['foregrip','ejectPort','mag','slide','bolt','pump'])if(!required.includes(name))assert.equal(d[name],null);
   if(config.kind==='knife')assert.equal(d.supportGrip,null);
   else{assert.equal(d.supportGrip,w.getObjectByName('supportGrip'));assert.ok(d.supportGrip);if(d.foregrip){w.updateMatrixWorld(true);assert.ok(d.supportGrip.getWorldPosition(new Vector3()).distanceTo(d.foregrip.getWorldPosition(new Vector3()))<1e-12);}}
   const bounds=new Box3().setFromObject(w),size=bounds.getSize(new Vector3());
   const tip=-d.muzzle.position.z;
   assert.ok(Math.abs(config.stockBack-bounds.max.z)<.003,'stockBack describes actual geometry');
   assert.ok(Math.abs(d.muzzle.position.z-bounds.min.z)<=.02,'Muzzle at barrel/tip end');
   assert.ok(tip>=config.tipDistance*.75&&tip<=config.tipDistance*1.25,'Origin-to-tip target');
   assert.ok(size.z>=config.tipDistance*.75&&size.z<=config.tipDistance*1.25,'Full depth target ±25%');
   assert.deepEqual(d.muzzle.rotation.toArray().slice(0,3),[0,0,0],'-Z muzzle axis');
   for(const fire of [0,.5,1,NaN,Infinity])for(const reload of [null,0,.25,.5,.75,1,NaN])for(const cycle of [null,.5,1])for(const equip of [0,.5,1]){
    const s={fire,reload,cycle,equip};api.poseWeapon(w,s,NaN);finite(w);const a=snapshot(w);
    api.poseWeapon(w,{fire:1,reload:.3,cycle:.25,equip:.2},1);
    api.poseWeapon(w,s,Infinity);assert.deepEqual(snapshot(w),a,'No hidden clock or previous-pose dependence');poses++;
   }
   api.poseWeapon(w,idle);assert.ok(w.position.toArray().every(n=>Math.abs(n)<1e-12));assert.ok(w.rotation.toArray().slice(0,3).every(n=>Math.abs(n)<1e-12));
   assert.deepEqual(list.map(m=>hashGeometry(m.geometry)),originalGeometries,'No per-frame vertex writes');
   const custom=api.createWeapon(config.id,{palette:{accent:'#FF33AA'}});
   assert.notEqual(meshes(custom)[0].geometry,list[0].geometry,'Palette override affects cache');
   assert.equal(custom.userData.palette.accent,'#FF33AA');
   report.push({id:config.id,opaque:opaque.length,lenses:lenses.length,tip:Number(tip.toFixed(3)),width:Number(size.x.toFixed(3)),height:Number(size.y.toFixed(3)),depth:Number(size.z.toFixed(3))});
   for(const c of characters){
    const vm=api.createViewmodel(config.id,c),v=vm.userData;
    const vmResources=meshes(vm).map(m=>[m.geometry,hashGeometry(m.geometry),m.geometry.attributes.position.version]);
    const vmCopy=api.createViewmodel(config.id,c);
    if(config.id==='sniper')assert.equal(meshes(v.weapon)[0].geometry,meshes(vmCopy.userData.weapon)[0].geometry,'Sniper viewmodels share cached geometry');
    else assert.equal(meshes(v.weapon)[0].geometry,list[0].geometry,'Viewmodel reuses world geometry');
    assert.equal(v.handGeometry[0],vmCopy.userData.handGeometry[0],'Hands cached');
    for(const m of meshes(vm)){assert.equal(m.castShadow,false);assert.ok(m.material===lambert||m.material===basic||m.material===glass);}
    if(config.kind==='sniper'){assert.equal(v.weapon.getObjectByName('lens-eyepiece').visible,false);assert.equal(w.getObjectByName('lens-eyepiece').visible,true);}
    const states=[];
    for(const equip of [0,.5,1])for(const crouching of [false,true])for(const aimPitch of [-89*Math.PI/180,89*Math.PI/180]){
     for(const t of [0,.25,.5,.75,1])states.push({...idle,moveSpeed:1,strafe:1,grounded:true,crouching,aimPitch,time:t,fire:t,reload:t,cycle:t,equip});
    }
    for(const equip of [0,1])for(const fire of [0,1])for(const action of ['reload','cycle'])states.push({...idle,moveSpeed:1,strafe:-1,grounded:false,crouching:true,aimPitch:-1.55,time:123.35,equip,fire,[action]:.5});
    states.push({fire:NaN,reload:Infinity,cycle:NaN,equip:Infinity,moveSpeed:NaN,strafe:Infinity,grounded:false,crouching:false,aimPitch:Infinity,time:NaN});
    for(const state of states){
     api.poseViewmodel(vm,state,NaN);finite(vm);const first=snapshot(vm);
     const b=new Box3().setFromObject(vm);nearMax=Math.max(nearMax,b.max.z);assert.ok(b.max.z<-.05,`${config.id}/${c.id}: near-plane clearance ${b.max.z}; ${JSON.stringify(state)}`);
     if(v.weapon.userData.supportGrip){
      const palm=new Vector3(...v.palmL).applyMatrix4(v.leftHand.matrixWorld),support=v.weapon.userData.supportGrip.getWorldPosition(new Vector3());
      assert.ok(palm.distanceTo(support)<1e-8,'Viewmodel left palm reaches actual supportGrip too');
     }
     api.poseViewmodel(vm,states[0],5);api.poseViewmodel(vm,state,Infinity);assert.deepEqual(snapshot(vm),first,'Deterministic viewmodel');viewPoses++;
    }
    for(const [geometry,hash,version]of vmResources){assert.equal(hashGeometry(geometry),hash,'Viewmodel cannot rewrite shared buffers');assert.equal(geometry.attributes.position.version,version);}
   }
  }
  assert.ok(lambert&&basic&&glass,'Only the three permitted shared material types');
  let holdFailure;
  try{await verifyHolds(api,characters,createCharacter,poseCharacter);}catch(error){holdFailure=error;}
  const sniperScope=await server.ssrLoadModule('../weapons/sniperScope.ts'),sniperResources=await server.ssrLoadModule('../weapons/resources.ts');
  const sniperViewScope=await server.ssrLoadModule('../weapons/sniperViewScope.ts');
  const sniperChecks=await verifySniper(api,characters,sniperScope,sniperResources,sniperViewScope);
  for(const c of characters){const a=createCharacter(c).userData.armVariants;assert.deepEqual({armL:hashGeometry(a.longL),armR:hashGeometry(a.longR)},longBaseline.characters[c.id],'No pose may rewrite long geometry buffers');}
  assert.throws(()=>api.createWeapon('unknown'),/Unknown weapon/);
  assert.throws(()=>api.createWeapon('pistol',{palette:{accent:'#NOPE'}}),/Invalid weapon palette/);
  await verifyToyWeapons(fullApi,characters,createCharacter);
  const old=api.createWeapon('rifle'),oldGeo=meshes(old)[0].geometry;
  let disposed=0,materialDisposals=0;oldGeo.addEventListener('dispose',()=>disposed++);
  let lensDisposed=0;const oldLens=old.getObjectByName('lens-sight').geometry;oldLens.addEventListener('dispose',()=>lensDisposed++);
  lambert.addEventListener('dispose',()=>materialDisposals++);basic.addEventListener('dispose',()=>materialDisposals++);glass.addEventListener('dispose',()=>materialDisposals++);
  api.disposeWeaponResources();assert.equal(disposed,1);assert.equal(lensDisposed,1);assert.equal(materialDisposals,3);
  sniperChecks.assertDisposed();
  const fresh=api.createWeapon('rifle');assert.notEqual(meshes(fresh)[0].geometry,oldGeo);assert.notEqual(meshes(fresh)[0].material,lambert);
  api.disposeWeaponResources();api.disposeWeaponResources();disposeCharacterResources();
  if(process.argv.includes('--report'))await writeFile(new URL('./measurements.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.table(report);
  console.log(`PASS INDEPENDENT WEAPON CHECKS: 5 weapons, ${poses} weapon poses, ${viewPoses} viewmodel poses, closest near-plane Z ${nearMax.toFixed(4)}m; dispose/cache/materials pass.`);
  if(holdFailure)throw holdFailure;
  if(performanceFailures.length)throw new AggregateError(performanceFailures,'HOLD TIMING ACCEPTANCE FAILED; raw numbers retained in outputs/hold-performance');
  return report;
 }finally{await server.close();}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await verifyWeapons();
