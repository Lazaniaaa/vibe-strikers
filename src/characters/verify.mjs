import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { Box3, Mesh, MeshBasicMaterial, MeshLambertMaterial, Vector3 } from 'three';

const names=['head','torso','armL','armR','legL','legR'];
const hashes={
 head:'494301ed3b459f1d6070ef3860f01523e6f7a4111850fd90ae2b5d2a2fcd09f7',
 torso:'b133ac3d3898fc12eccdc6317d8dec984d75c876128b40fa06f70d0f16433300',
 armL:'45ce9e9ad5bb4d5fb990c2c57a4ff684cfa6cc91cef3a8fae4133473eb9865ca',
 armR:'45ce9e9ad5bb4d5fb990c2c57a4ff684cfa6cc91cef3a8fae4133473eb9865ca',
 legL:'e3015510b6b0f67fa1b322f9547fd00539036f6ec086672e19f4b66ff5b828bf',
 legR:'e3015510b6b0f67fa1b322f9547fd00539036f6ec086672e19f4b66ff5b828bf',
};
const hashGeometry=(g)=>{
 const h=createHash('sha256');
 for(const key of ['position','normal','uv','color']){
  const a=g.getAttribute(key);h.update(key);h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 }
 h.update('index');const a=g.index;h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 return h.digest('hex');
};
const idle={speed:0,moveDir:{x:0,z:-1},aimPitch:0,shooting:false,crouching:false,grounded:true,dead:false};
const snapshot=(g)=>{const a=[];g.traverse(o=>a.push(o.name,...o.position,...o.quaternion,...o.scale));return a;};
const near=(a,b,message,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${message}: ${a} vs ${b}`);
const finiteConfig=(value)=>{
 if(typeof value==='string'&&value.startsWith('#'))assert.match(value,/^#[0-9A-F]{6}$/i);
 if(typeof value==='number')assert.ok(Number.isFinite(value));
 if(value&&typeof value==='object')for(const v of Object.values(value))finiteConfig(v);
};
const footWorld=(g,side)=>{
 g.updateMatrixWorld(true);const d=g.userData,b=d.dimensions['foot'+side];
 return new Box3(new Vector3(...b.min),new Vector3(...b.max)).applyMatrix4(d['leg'+side].matrixWorld);
};
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {createCharacter,disposeCharacterResources,characterCacheKey}=await server.ssrLoadModule('/createCharacter.ts');
 const {poseCharacter,restoreReferencePose}=await server.ssrLoadModule('/poseCharacter.ts');
 const {characters}=await server.ssrLoadModule('/characters.ts');
 assert.equal(new Set(characters.map(c=>c.id)).size,characters.length,'Unique character ids');
 assert.ok(characters.length>0);
 const poseSource=await readFile(new URL('./poseCharacter.ts',import.meta.url),'utf8');
 assert.ok(!/\bTEMPLATE\b/.test(poseSource),'poseCharacter cannot read global TEMPLATE');
 let sharedLambert,sharedGlow,combinations=0,extremeChecks=0,maxHeadOverlap=0;
 const check=(config)=>{
  finiteConfig(config);
  for(const color of Object.values(config.colors))assert.match(color,/^#[0-9A-F]{6}$/i);
  const g=createCharacter(config),copy=createCharacter({...config,id:config.id+'-copy',name:'copy'}),d=g.userData;
  assert.equal(g.children.length,1);assert.equal(g.children[0].name,'rig');
  assert.equal(d.phase,0);assert.equal(d.weaponSocket.parent,d.armR);
  assert.deepEqual(g.position.toArray(),[0,0,0]);assert.deepEqual(g.scale.toArray(),[1,1,1]);
  const expectedGlow=new Set(config.extras.filter(b=>b.glow).map(b=>b.part));
  let meshes=0,glows=0;const resources=[];
  for(const name of names){
   const part=g.getObjectByName(name);assert.equal(part.parent,d.rig);
   assert.deepEqual(part.position.toArray(),d.restPose[name]);
   const base=part.children.find(c=>c.name===name+'-boxes');
   assert.ok(base instanceof Mesh&&base.material instanceof MeshLambertMaterial);
   sharedLambert??=base.material;assert.equal(base.material,sharedLambert);
   assert.equal(base.geometry,copy.getObjectByName(name+'-boxes').geometry,'Shared geometry across players');
   assert.equal(part.children.filter(c=>c instanceof Mesh&&c.material instanceof MeshBasicMaterial).length,expectedGlow.has(name)?1:0);
  }
  g.traverse(o=>{
   if(!(o instanceof Mesh))return;
   meshes++;
   if(o.material instanceof MeshBasicMaterial){
    glows++;sharedGlow??=o.material;assert.equal(o.material,sharedGlow);
    assert.ok(expectedGlow.has(o.parent.name));assert.ok(['head','torso'].includes(o.parent.name));
   }
   assert.equal(o.material.transparent,false);assert.equal(o.material.map,null);
   const geo=o.geometry;
   for(const attr of Object.values(geo.attributes))for(const value of attr.array)assert.ok(Number.isFinite(value),'No NaN geometry');
   resources.push([geo,geo.getAttribute('position').array,geo.getAttribute('position').version,hashGeometry(geo)]);
  });
  assert.equal(meshes,6+expectedGlow.size);assert.equal(glows,expectedGlow.size);assert.ok(meshes<=8);
  const bare=createCharacter({...config,extras:[]});
  const measured=new Box3().setFromObject(bare);
  const headTop=new Box3().setFromObject(bare.userData.head).max.y;
  const feetBottom=Math.min(footWorld(bare,'L').min.y,footWorld(bare,'R').min.y);
  near(feetBottom,0,'Feet at zero');near(headTop-feetBottom,1.8,'Feet-to-head-box = 1.8');
  for(const axis of ['width','height','depth']){
   const i={width:'x',height:'y',depth:'z'}[axis];
   near(d.bodyExtents.total[axis],measured.max[i]-measured.min[i],'Total body excludes extras');
   assert.ok(d.bodyExtents.total[axis]>0);
  }
  for(const name of names){
   const box=new Box3().setFromObject(bare.getObjectByName(name));
   for(const [axis,i] of [['width','x'],['height','y'],['depth','z']])
    near(d.bodyExtents.parts[name][axis],box.max[i]-box.min[i],'Per-part rest body extent');
  }
  const extents=JSON.stringify(d.bodyExtents);
  g.position.set(8,2,-4);g.rotation.set(.1,1.3,.2);g.scale.set(1.1,1.1,1.1);
  const owned=[...g.position,...g.quaternion,...g.scale];
  for(const dir of [{x:0,z:-1},{x:0,z:1},{x:-1,z:0},{x:1,z:0},{x:1,z:-1},{x:0,z:0}]){
   for(const grounded of [true,false])for(const crouching of [false,true])
    for(const dead of [false,true])for(const shooting of [false,true]){
     const s={...idle,speed:.85,moveDir:dir,grounded,crouching,dead,shooting,aimPitch:1.8};
     d.phase=.75;poseCharacter(g,s,1/60);const first=snapshot(g);
     for(const n of first)if(typeof n==='number')assert.ok(Number.isFinite(n));
     d.phase=.75;poseCharacter(g,s,1/60);assert.deepEqual(snapshot(g),first,'Deterministic state+phase+dt');
     assert.deepEqual([...g.position,...g.quaternion,...g.scale],owned,'Game owns outer transform');
     for(const name of names)if(name!=='head'||dead)assert.deepEqual(d[name].position.toArray(),d.restPose[name],'Per-character pivot survives pose');
     if(!dead){
      assert.ok(Math.abs(d.head.rotation.x)<=35*Math.PI/180+1e-9);
      near(d.head.position.x,d.restPose.head[0],'Head X stays at neck');
      assert.ok(d.head.position.y>=d.restPose.head[1],'Only upward head clearance');
      assert.ok(d.head.position.z>=d.restPose.head[2],'Small backward clearance');
     }
     combinations++;
    }
  }
  assert.equal(JSON.stringify(d.bodyExtents),extents,'Pose must not mutate rest extents');
  // Independent oracle: transform actual bare geometry, not pose's analytic helpers.
  // This AABB criterion is conservative: even the whole vertical overlap is <=8cm.
  for(const aimPitch of [-89*Math.PI/180,89*Math.PI/180]){
   for(const crouching of [false,true])for(const grounded of [false,true])for(const speed of [0,1])for(const shooting of [false,true]){
    const s={...idle,aimPitch,crouching,grounded,speed,shooting,moveDir:{x:1,z:0}};
    bare.userData.phase=.7;
    poseCharacter(bare,s,0);bare.updateMatrixWorld(true);
    const h=new Box3().setFromObject(bare.userData.head),t=new Box3().setFromObject(bare.userData.torso);
    const overlap=Math.max(0,Math.min(t.max.y,h.max.y)-Math.max(t.min.y,h.min.y));
    assert.ok(overlap<=.080001,`${config.id}: head overlap ${overlap} at ${aimPitch}`);
    const expected=Math.max(-35*Math.PI/180,Math.min(35*Math.PI/180,.6*aimPitch));
    near(bare.userData.head.rotation.x,expected,'Visible head = clamped 0.6 x aim');
    assert.deepEqual(bare.position.toArray(),[0,0,0]);assert.deepEqual(bare.quaternion.toArray(),[0,0,0,1]);
    maxHeadOverlap=Math.max(maxHeadOverlap,overlap);extremeChecks++;
   }
  }
  for(const angle of [-.5,0,.5]){poseCharacter(bare,{...idle,aimPitch:angle},0);near(bare.userData.head.rotation.x,angle*.6,'Sub-limit 0.6 head factor');}
  for(const sign of [-1,1]){
   bare.userData.phase=.7;poseCharacter(bare,{...idle,aimPitch:sign*89*Math.PI/180},0);const limited=snapshot(bare);
   bare.userData.phase=.7;poseCharacter(bare,{...idle,aimPitch:sign*1000},0);assert.deepEqual(snapshot(bare),limited,'Input clamped internally at 89deg');
  }
  g.position.set(0,0,0);g.rotation.set(0,0,0);g.scale.set(1,1,1);
  poseCharacter(g,{...idle,dead:true},.016);const corpse=snapshot(g);
  near(new Box3().setFromObject(g).min.y,0,'Corpse rests on actual right side');
  poseCharacter(g,{...idle,dead:true},30);assert.deepEqual(snapshot(g),corpse,'No death drift');
  poseCharacter(g,idle,0);assert.equal(d.rig.rotation.z,0);
  poseCharacter(g,{...idle,crouching:true},0);
  near(Math.min(footWorld(g,'L').min.y,footWorld(g,'R').min.y),0,'Crouch supports real feet');
  d.phase=Math.PI/2;poseCharacter(g,{...idle,speed:1},0);const forward=d.legL.rotation.x;
  poseCharacter(g,{...idle,speed:1,moveDir:{x:0,z:1}},0);near(d.legL.rotation.x,-forward,'Backward cycle');
  poseCharacter(g,{...idle,speed:1,moveDir:{x:1,z:0}},0);near(d.legL.rotation.x,0,'Strafe travel plane');
  assert.ok(Math.abs(d.legL.rotation.z)>.5);
  poseCharacter(g,{...idle,aimPitch:NaN,speed:Infinity,moveDir:{x:NaN,z:Infinity}},NaN);
  for(const n of snapshot(g))if(typeof n==='number')assert.ok(Number.isFinite(n));
  const phase=d.phase;poseCharacter(copy,idle,.1);assert.equal(d.phase,phase,'Independent player clocks');
  restoreReferencePose(g);
  for(const [geo,array,version,hash]of resources){
   assert.equal(geo.getAttribute('position').array,array);assert.equal(geo.getAttribute('position').version,version);
   assert.equal(hashGeometry(geo),hash,'Pose cannot rewrite any base/glow vertex');
  }
  if(config.id==='reference-01'){
   for(const name of names)assert.equal(hashGeometry(d[name].children[0].geometry),hashes[name],`01 ${name} baseline`);
   assert.equal(d.dimensions.normalization,1);assert.deepEqual(d.weaponSocket.position.toArray(),[0,-.45,-.16]);
   assert.deepEqual(d.restPose,{head:[0,.89,0],torso:[0,.89,0],armL:[-.58,.84,0],armR:[.58,.84,0],legL:[-.195,.41,0],legR:[.195,.41,0]});
  }
  console.log(`PASS ${config.id}: ${meshes} meshes, glow [${[...expectedGlow]}], head top 1.800m, body ${d.bodyExtents.total.width.toFixed(4)} x ${d.bodyExtents.total.depth.toFixed(4)}m`);
 };
 for(const config of characters)check(config);
 const probe={...characters[0],id:'non-default-proportion-contract',name:'contract',extras:[],
  proportions:{head:[.83,1.13,.62],torso:[.80,.53,.50],arm:[.15,.46,.19],hand:[.23,.18,.25],leg:[.18,.31,.23],foot:[.30,.16,.44]},
  layout:{pivots:{armL:[-.63,.77,.06],armR:[.63,.77,.06]}}};
 check(probe);
 const probeG=createCharacter(probe);poseCharacter(probeG,idle,0);
 near(probeG.userData.armR.position.y,.77*probeG.userData.dimensions.normalization,'Non-default shoulders remain');
 assert.notEqual(probeG.userData.armR.position.y,.84);
 const c=characters[0],key=characterCacheKey(c);
 assert.equal(key,characterCacheKey({...c,id:'different',name:'different'}));
 assert.notEqual(key,characterCacheKey({...c,futureFeature:{foo:1}}),'New fields cannot be omitted from cache key');
 const reversed=Object.fromEntries(Object.entries(c).reverse());assert.equal(key,characterCacheKey(reversed));
 assert.throws(()=>createCharacter({...c,colors:{...c.colors,body:'#BAD'}}),/Invalid hex/);
 assert.throws(()=>createCharacter({...c,proportions:{head:[NaN,1,1]}}),/Non-finite/);
 disposeCharacterResources();
 console.log(`PASS ALL: ${characters.length} characters + proportion probe, ${combinations} pose combinations; ${extremeChecks} extreme-aim checks, maximum overlap ${maxHeadOverlap.toFixed(6)}m. 01 hashes unchanged; no per-frame geometry writes; shared Lambert/Basic; <=8 meshes; normalized body extents.`);
}finally{await server.close();}
const {verifyWeapons}=await import('../weapons/verify.mjs');
await verifyWeapons();
