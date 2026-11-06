import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import {Matrix4,Vector3,PerspectiveCamera,Raycaster,Vector2,Scene} from 'three';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export async function verifyToyWeapons(api,characters,createCharacter){
 const baseline=JSON.parse(await readFile(new URL('./toy-legacy-baseline.json',import.meta.url),'utf8'));
 const digest=value=>createHash('sha256').update(value).digest('hex');
 for(const cfg of api.weapons.filter(w=>Object.hasOwn(baseline.configs,w.id))){
  assert.equal(digest(JSON.stringify(cfg)),baseline.configs[cfg.id],'Frozen legacy config '+cfg.id);
  const w=api.createWeapon(cfg.id),h=createHash('sha256');w.traverse(o=>{if(o.isMesh){h.update(o.name);for(const a of Object.values(o.geometry.attributes))h.update(Buffer.from(a.array.buffer));h.update(Buffer.from(o.geometry.index.array.buffer));}});assert.equal(h.digest('hex'),baseline.geometry[cfg.id],'Frozen legacy geometry');
  for(const c of characters){const g=createCharacter(c);api.attachWeapon(g,api.createWeapon(cfg.id));const hash=createHash('sha256');for(const angle of[-89,-45,0,45,89])for(const fire of[0,1]){g.userData.phase=0;api.poseArmedCharacter(g,{weapon:cfg.id,speed:0,moveDir:{x:0,z:-1},aimPitch:angle*Math.PI/180,shooting:!!fire,fire,grounded:true,crouching:false,dead:false},0);g.traverse(o=>hash.update(JSON.stringify([o.name,...o.position,...o.quaternion,...o.scale])));}assert.equal(hash.digest('hex'),baseline.poses[c.id+'/'+cfg.id],'Frozen legacy poses '+c.id+'/'+cfg.id);}
 }
 const ids=api.NEW_WEAPON_IDS,point=new Vector3(),target=new Vector3(),relative=new Matrix4(),inverse=new Matrix4();
 const poses=[['idle',0,0,-1,false,true],['run',1,0,-1,false,true],['strafe',1,1,0,false,true],['back',1,0,1,false,true],['crouch',0,0,-1,true,true],['jump',0,0,-1,false,false]];
 const vertices=new WeakMap();const unique=g=>{let list=vertices.get(g);if(list)return list;const a=g.attributes.position,seen=new Set();list=[];for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),key=x+','+y+','+z;if(!seen.has(key)){seen.add(key);list.push(x,y,z);}}vertices.set(g,list);return list;};
 const report={pass:false,combinations:0,rows:[],failures:[],viewmodelCases:0,pool:{}};
 for(const id of ids){const row={id,cases:0,maxFistError:0,minClearance:Infinity,meshes:0,maxMs:0,worst:null};
  for(const c of characters){const g=createCharacter(c),d=g.userData,w=api.createWeapon(id);api.attachWeapon(g,w);const meshes=[];w.traverse(o=>{if(o.isMesh)meshes.push(o);});row.meshes=meshes.length;assert(meshes.length<=8);
   const copy=api.createWeapon(id);const cm=[];copy.traverse(o=>{if(o.isMesh)cm.push(o)});assert(meshes.every((m,i)=>m.geometry===cm[i].geometry),'Shared toy geometry');
   const state={weapon:id,speed:0,moveDir:{x:0,z:-1},aimPitch:0,shooting:false,fire:0,crouching:false,grounded:true,dead:false};
   api.poseArmedCharacter(g,state,0);const outer=[...g.position,...g.quaternion,...g.scale];
   for(const[pose,speed,x,z,crouching,grounded]of poses)for(const aim of[-89,-45,0,45,89])for(const fire of[0,1])for(const progress of[0,1])for(const phase of[0,Math.PI/2,Math.PI,Math.PI*1.5]){
    state.speed=speed;state.moveDir.x=x;state.moveDir.z=z;state.crouching=crouching;state.grounded=grounded;state.aimPitch=aim*Math.PI/180;state.fire=fire;state.shooting=!!fire;
    d.phase=phase;const start=performance.now();api.poseArmedCharacter(g,state,0);row.maxMs=Math.max(row.maxMs,performance.now()-start);
    api.poseWeapon(w,{fire,reload:null,cycle:null,equip:1,heat:progress,charge:progress,paintLevel:progress,time:.1});g.updateMatrixWorld(true);
    let clearance=Infinity,error=0,where=null;
    for(const body of ['head','torso']){inverse.copy(d[body].matrixWorld).invert();const extent=d.bodyExtents.parts[body],rest=d.restPose[body],size=d.dimensions.components[body];
     for(const mesh of [...meshes,d.armVariants.meshL,d.armVariants.meshR]){relative.multiplyMatrices(inverse,mesh.matrixWorld);const a=unique(mesh.geometry);
      for(let i=0;i<a.length;i+=3){point.set(a[i],a[i+1],a[i+2]).applyMatrix4(relative);
       const dx=Math.abs(point.x-(extent.min[0]+extent.max[0])/2+rest[0])-size[0]/2+.01,dy=Math.abs(point.y-(extent.min[1]+extent.max[1])/2+rest[1])-size[1]/2+.01,dz=Math.abs(point.z-(extent.min[2]+extent.max[2])/2+rest[2])-size[2]/2+.01;
       const dist=Math.sqrt(Math.max(0,dx)**2+Math.max(0,dy)**2+Math.max(0,dz)**2)+Math.min(0,Math.max(dx,dy,dz));if(dist<clearance){clearance=dist;where={mesh:mesh.name,body};}
      }
     }
    }
    for(const side of ['R','L']){if(side==='L'&&!w.userData.supportGrip)continue;const b=d.armVariants.active?d.armVariants['hand'+side]:d.dimensions['hand'+side];point.set((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2).applyMatrix4(d['arm'+side].matrixWorld);(side==='R'?w.getObjectByName('mainGrip'):w.userData.supportGrip).getWorldPosition(target);error=Math.max(error,point.distanceTo(target));}
    const combination={character:c.id,weapon:id,pose,aim,fire,progress,phase,clearance,error,where};
    if(clearance<row.minClearance){row.minClearance=clearance;row.worst=combination;}row.maxFistError=Math.max(row.maxFistError,error);row.cases++;report.combinations++;
    if(clearance< -1e-7||error>.100000001)report.failures.push(combination);
    assert.deepEqual([...g.position,...g.quaternion,...g.scale],outer);
   }
   state.dead=true;api.poseArmedCharacter(g,state,0);g.traverse(o=>{for(const v of [...o.position,...o.quaternion,...o.scale])assert(Number.isFinite(v));});
   for(const side of ['right','left']){const vm=api.createViewmodel(id,c,{holdSide:side}),camera=new PerspectiveCamera(70,16/9,.05,20),ray=new Raycaster(),center=new Vector2();
    for(const progress of[0,.5,1])for(const fire of[0,1])for(const moveSpeed of[0,1]){const s={fire,reload:progress,cycle:progress,equip:1,heat:progress,charge:progress,paintLevel:progress,throw:0,time:.7,moveSpeed,strafe:moveSpeed*(side==='left'?-1:1),grounded:progress!==1,crouching:progress===.5,aimPitch:0,holdSide:side,ads:0};api.poseViewmodel(vm,s);vm.updateMatrixWorld(true);const opaque=[];vm.traverseVisible(o=>{if(o.isMesh)opaque.push(o)});ray.setFromCamera(center,camera);assert.equal(ray.intersectObjects(opaque,false).length,0,id+'/'+c.id+'/'+side+' clear HIP centre');report.viewmodelCases++;
     const v=vm.userData;for(const hand of ['R','L']){const main=side==='right'?hand==='R':hand==='L',joint=hand==='R'?v.rightHand:v.leftHand,palm=hand==='R'?v.palmR:v.palmL;point.set(...palm).applyMatrix4(joint.matrixWorld);const socket=main?v.weapon.getObjectByName('mainGrip'):v.weapon.userData.supportGrip;if(!socket)continue;socket.getWorldPosition(target);assert(point.distanceTo(target)<1e-7,'Viewmodel fist');}
    }
   }
  }
  report.rows.push(row);console.log('TOY',id,row.cases,'fist',row.maxFistError,'clearance',row.minClearance,'mesh',row.meshes);
 }
 // Explicit visual controls must be absolute, finite and independent of call order.
 for(const id of ids){const w=api.createWeapon(id);for(const value of[0,.5,1,NaN,Infinity]){
  const s={fire:0,reload:null,cycle:null,equip:1,heat:value,charge:value,paintLevel:value,time:.1};api.poseWeapon(w,s);
  const snap=[];w.traverse(o=>{snap.push(o.visible,...o.position,...o.quaternion,...o.scale);for(const n of[...o.position,...o.quaternion,...o.scale])assert(Number.isFinite(n));});
  api.poseWeapon(w,{...s,charge:1,heat:0,paintLevel:0});api.poseWeapon(w,s);const again=[];w.traverse(o=>again.push(o.visible,...o.position,...o.quaternion,...o.scale));assert.deepEqual(again,snap,'Deterministic visual inputs');
 }}
 const beam=api.createWeapon('beam');api.poseWeapon(beam,{fire:0,reload:null,cycle:null,equip:1,heat:1,time:0});assert(beam.userData.visualParts.alarm.visible);
 api.poseWeapon(beam,{fire:0,reload:null,cycle:null,equip:1,heat:1,time:3/28});assert(!beam.userData.visualParts.alarm.visible,'Overheat flash');
 const sling=api.createWeapon('slingshot');const endpoints=[];for(const charge of[0,.5,1]){api.poseWeapon(sling,{fire:0,reload:null,cycle:null,equip:1,charge});sling.updateMatrixWorld(true);const p=sling.userData.visualParts;
  endpoints.push(p.pouch.position.z);for(const band of[p.bandL,p.bandR]){point.set(0,0,.5).applyMatrix4(band.matrix);assert(point.distanceTo(p.pouch.position)<1e-8,'Band remains attached to moving pouch');}}
 assert(endpoints[2]-endpoints[0]>.30,'Visible 31cm pull');
 const grenade=api.createViewmodel('paintGrenade',characters[0]);for(const value of[0,.25,.5,.75,1]){api.poseViewmodel(grenade,{fire:0,reload:null,cycle:null,equip:1,throw:value,time:0,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0});assert.equal(grenade.userData.weapon.visible,value<.72,'Throw release visibility');}
 for(const file of['./toyAnimation.ts','./effects.ts','./characterPose.ts']){const source=ts.createSourceFile(file,await readFile(new URL(file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
  const check=node=>{if(ts.isConstructorDeclaration(node))return;if(ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node)){const scan=n=>{assert(!ts.isNewExpression(n)&&!ts.isArrayLiteralExpression(n)&&!ts.isObjectLiteralExpression(n)&&!ts.isArrowFunction(n),'Allocating syntax in '+file);ts.forEachChild(n,scan);};if(node.body)scan(node.body);return;}ts.forEachChild(node,check);};
  // Factory / construction helpers intentionally allocate, never called by an update.
  for(const node of source.statements)if(ts.isClassDeclaration(node))check(node);else if(ts.isFunctionDeclaration(node)&&!node.name?.text.startsWith('create'))check(node);
 }
 const stage=new Scene(),fx=api.createWeaponEffects(stage,{surfaceBoxes:[{min:{x:-3,y:-.2,z:-3},max:{x:3,y:0,z:3}},{min:{x:-3,y:0,z:-2},max:{x:3,y:3,z:-1.8}}]});
 const a={x:0,y:1,z:0},b={x:0,y:.1,z:-1},bounce={x:1,y:.5,z:-1};
 for(let i=0;i<300;i++){fx.beam(a,b,'#55FFFF',.03,i%4);fx.bouncer([a,bounce,b],'#FFCC44');fx.rail(a,b);fx.splat(a,b,'#FF66AA');fx.grenadeArc(a,b,.4,'#44DD99');}
 for(let i=0;i<90;i++)fx.update(1/60);fx.paintBurst(b,2,'#FF66AA');const count=fx.decals.count;assert(count>0&&count<=128);for(let i=0;i<120;i++)fx.update(1/60);assert.equal(fx.decals.count,count,'Decals persist');
 for(const mesh of[fx.trails,fx.particles,fx.decals])for(const v of mesh.instanceMatrix.array)assert(Number.isFinite(v));
 report.pool={drawCalls:stage.children[0].children.length,decals:count,caps:fx.caps};fx.clear();assert.equal(fx.decals.count,0);let disposed=0;fx.trails.geometry.addEventListener('dispose',()=>disposed++);fx.dispose();fx.dispose();assert.equal(disposed,1);assert.equal(stage.children.length,0);
 report.pass=report.failures.length===0;await writeFile(new URL('./toy-results.json',import.meta.url),JSON.stringify(report,null,2));assert.equal(report.failures.length,0,'Toy hold failures; see toy-results.json');
 console.log(execFileSync(process.execPath,['--expose-gc',fileURLToPath(new URL('./verifyToyPerf.mjs',import.meta.url))],{encoding:'utf8'}));return report;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const server=await createServer({configFile:false,root:new URL('../..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),server:{middlewareMode:true,hmr:false,ws:false}});try{const api=await server.ssrLoadModule('/src/weapons/index.ts'),ca=await server.ssrLoadModule('/src/characters/index.ts');await verifyToyWeapons(api,ca.characters,ca.createCharacter);}finally{await server.close();}}
