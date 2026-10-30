import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Box3,Matrix4,Mesh,PerspectiveCamera,Raycaster,Vector2,Vector3} from 'three';

export async function verifyHolds(api,characters,createCharacter,poseCharacter){
 const shard=process.argv.find(a=>a.startsWith('--hold-weapon='))?.slice('--hold-weapon='.length);
 if(process.argv.includes('--parallel-holds')&&!shard){const {verifyHoldsParallel}=await import('./verifyParallel.mjs');return verifyHoldsParallel(characters.length);}
 const configs=api.weapons.filter(w=>w.kind!=='knife'&&(!shard||w.id===shard));assert.ok(configs.length,'Invalid weapon shard');
 const url=shard?new URL(`../../work/round5-shard-${shard}.json`,import.meta.url):new URL('./round5-check-results.json',import.meta.url);
 const poses=[['idle',0,0,-1,false,true],['run',1,0,-1,false,true],['strafe',1,1,0,false,true],['back',1,0,1,false,true],['crouch',0,0,-1,true,true],['jump',0,0,-1,false,false]];
 const phases=[0,Math.PI/2,Math.PI,3*Math.PI/2],angles=[-89,-45,0,45,89];
 const result={complete:false,checked:0,requiredCombinations:characters.length*configs.length*6*5*2,phaseSamples:4,viewChecks:0,rayChecks:0,rows:[],thirdPerson:[],firstPerson:[],lengths:[],failures:[],limits:{fistError:.10,bodyShrink:.01,clearAngle:25,sniperClearAngle:20,axisError:.01}};
 const world=new Vector3(),local=new Vector3(),palm=new Vector3(),target=new Vector3(),inverse=[new Matrix4(),new Matrix4()];
 const distance=(p,b,r,size)=>{const x=Math.abs(p.x-(b.min[0]+b.max[0])/2+r[0])-size[0]/2+.01,y=Math.abs(p.y-(b.min[1]+b.max[1])/2+r[1])-size[1]/2+.01,z=Math.abs(p.z-(b.min[2]+b.max[2])/2+r[2])-size[2]/2+.01;return Math.hypot(Math.max(0,x),Math.max(0,y),Math.max(0,z))+Math.min(0,Math.max(x,y,z));};
 const ray=new Raycaster(),camera=new PerspectiveCamera(70,1,.05,20),ndc=new Vector2(),handBounds=new Box3(),fans=new Map();
 for(const cfg of configs){
  const row={weapon:cfg.id,cases:0,maxRightError:0,maxLeftError:0,minClearance:Infinity,failedCases:0,worstReach:null,worstClearance:null};
  for(const c of characters){
   const g=createCharacter(c),d=g.userData,a=d.armVariants,w=api.createWeapon(cfg.id),mount=api.attachWeapon(g,w),bodyMeshes=[];
   w.traverse(o=>{if(o instanceof Mesh)bodyMeshes.push(o)});bodyMeshes.push(a.meshL,a.meshR);
   assert.equal(mount.parent,d.weaponSocket);assert.equal(api.attachWeapon(g,w),mount);
   const parent=mount.parent,chosen={...a.holdLengths},phaseCache=new Map(),extents=JSON.stringify(d.bodyExtents);
   g.position.set(1.2,.3,-2);g.rotation.y=.71;const outer=[...g.position,...g.quaternion,...g.scale];
   const cRow={character:c.id,weapon:cfg.id,cases:0,maxRightError:0,maxLeftError:0,minClearance:Infinity,failedCases:0,worstReach:null,worstClearance:null};
   if(cfg.id==='pistol')result.lengths.push({character:c.id,leftExtra:a.variantsL[chosen.L].extra,rightExtra:a.variantsR[chosen.R].extra,leftUpper:a.variantsL[chosen.L].upper.height,rightUpper:a.variantsR[chosen.R].upper.height});
   for(const [pose,speed,x,z,crouching,grounded] of poses)for(const aim of angles)for(const shooting of [false,true])for(const phase of phases){
    const state={weapon:cfg.id,speed,moveDir:{x,z},crouching,grounded,shooting,dead:false,aimPitch:aim*Math.PI/180,fire:shooting?1:0,reload:null,cycle:null};
    d.phase=phase;poseCharacter(g,state,0);api.poseWeapon(w,{fire:state.fire,reload:null,cycle:null,equip:1});g.updateMatrixWorld(true);
    const caseId={character:c.id,weapon:cfg.id,pose,aim,shooting,phase};
    assert.equal(mount.parent,parent,'No pose reparent');assert.equal(a.meshL.geometry,a.variantsL[chosen.L].geometry);assert.equal(a.meshR.geometry,a.variantsR[chosen.R].geometry);
    for(const s of ['L','R']){assert.deepEqual(d['arm'+s].position.toArray(),[...d.restPose['arm'+s]],'Fixed shoulder');assert.deepEqual(d['arm'+s].scale.toArray(),[1,1,1]);assert.ok(a['selected'+s].gap<=.001);}
    let meshes=0;d.rig.traverse(o=>{if(o instanceof Mesh&&(!bodyMeshes.includes(o)||o===a.meshL||o===a.meshR))meshes++});assert.ok(meshes<=8);
    const key=[pose,aim,shooting].join('|'),relative=[];
    for(const part of [d.head,d.torso,d.armL,d.armR,mount,w,...w.children])relative.push(part.name,...part.position,...part.quaternion,...part.scale);
    const cached=phaseCache.get(key);if(cached)assert.deepEqual(relative,cached.relative,'Only common rig and legs change with phase');
    let clearance=cached?.clearance??Infinity,inside=cached?.inside??0,where=cached?.where??null;
    if(!cached){
     inverse[0].copy(d.head.matrixWorld).invert();inverse[1].copy(d.torso.matrixWorld).invert();
     for(const mesh of bodyMeshes){const attr=mesh.geometry.attributes.position;for(let i=0;i<attr.count;i++){
      world.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);
      for(let bi=0;bi<2;bi++){const name=bi===0?'head':'torso';local.copy(world).applyMatrix4(inverse[bi]);const ds=distance(local,d.bodyExtents.parts[name],d.restPose[name],d.dimensions.components[name]);if(ds<clearance){clearance=ds;where={mesh:mesh.name,vertex:i,body:name}}if(ds< -1e-9)inside++;}
     }}
    }
    const errors=cached?.errors??[];
    if(!cached)for(const s of ['R','L']){const b=a['hand'+s];palm.set((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2).applyMatrix4(d['arm'+s].matrixWorld);(s==='R'?w.getObjectByName('mainGrip'):w.userData.supportGrip).getWorldPosition(target);errors.push(palm.distanceTo(target));}
    if(!cached)phaseCache.set(key,{relative,clearance,inside,where,errors});
    const [rightError,leftError]=errors,failed=inside||Math.max(...errors)>.100000001;
    for(const r of [row,cRow]){
     if(Math.max(...errors)>Math.max(r.maxRightError,r.maxLeftError))r.worstReach=caseId;
     r.maxRightError=Math.max(r.maxRightError,rightError);r.maxLeftError=Math.max(r.maxLeftError,leftError);
     if(clearance<r.minClearance){r.minClearance=clearance;r.worstClearance={...caseId,...where}}
     r.cases++;if(failed)r.failedCases++;
    }
    result.checked++;if(failed)result.failures.push({...caseId,rightError,leftError,clearance,inside,...where});
    assert.deepEqual([...g.position,...g.quaternion,...g.scale],outer);assert.ok(Math.abs(d.head.rotation.x-Math.max(-35,Math.min(35,aim*.6))*Math.PI/180)<1e-10);
   }
   assert.equal(JSON.stringify(d.bodyExtents),extents);assert.deepEqual(a.holdLengths,chosen);
   for(const dead of [false,true])for(const progress of [0,.5,1,NaN]){
    const s={weapon:cfg.id,speed:NaN,moveDir:{x:NaN,z:Infinity},aimPitch:Infinity,shooting:true,crouching:true,grounded:false,dead,fire:progress,reload:progress,cycle:progress};
    d.phase=NaN;poseCharacter(g,s,NaN);api.poseWeapon(w,{fire:progress,reload:progress,cycle:progress,equip:1});
    for(const part of [g,d.rig,d.head,d.torso,d.armL,d.armR,mount,w])for(const n of [...part.position,...part.quaternion,...part.scale])assert.ok(Number.isFinite(n));
    const before=[...d.armL.quaternion,...d.armR.quaternion,...mount.position,...mount.quaternion];poseCharacter(g,s,0);assert.deepEqual([...d.armL.quaternion,...d.armR.quaternion,...mount.position,...mount.quaternion],before);
   }
   mount.removeFromParent();result.thirdPerson.push(cRow);
  }
  result.rows.push(row);console.log('ROUND5 HIP',cfg.id,row.cases,'R',row.maxRightError,'L',row.maxLeftError,'clearance',row.minClearance,'FAIL',row.failedCases);
  for(const side of ['right','left'])for(const ads of [0,.5,1]){
   const vr={weapon:cfg.id,side,ads,cases:0,clearAngle:70,maxSightAxisError:0,centreHits:0,failedCases:0};
   for(const c of characters){
    const vm=api.createViewmodel(cfg.id,c,{holdSide:side}),v=vm.userData,opaque=[];
    if(side==='right'){const omitted=api.createViewmodel(cfg.id,c);assert.equal(omitted.userData.holdSide,'right');}
    for(const fire of [0,1])for(const reload of [null,1])for(const cycle of [null,1]){
     const s={holdSide:side,ads,fire,reload,cycle,equip:1,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,time:0};
     api.poseViewmodel(vm,s);vm.updateMatrixWorld(true);opaque.length=0;vm.traverseVisible(o=>{if(o instanceof Mesh&&!o.name.startsWith('lens-'))opaque.push(o)});
     ray.setFromCamera(ndc,camera);ray.near=.05;ray.far=20;const hits=ray.intersectObjects(opaque,false);vr.centreHits+=hits.length>0?1:0;result.rayChecks++;vr.cases++;result.viewChecks++;
     let failed=false;
     if(ads!==.5&&hits.length){failed=true;result.failures.push({character:c.id,weapon:cfg.id,side,ads,check:'screen-centre',fire,reload,cycle,mesh:hits[0].object.name});}
     const axis=v.weapon.userData.sightAxis;axis.getWorldPosition(target);const error=Math.hypot(target.x,target.y,target.z+(cfg.id==='sniper'?api.SNIPER_ADS_DISTANCE:api.ADS_DISTANCE));vr.maxSightAxisError=Math.max(vr.maxSightAxisError,error);
     if(ads===1){if(error>.01){failed=true;result.failures.push({character:c.id,weapon:cfg.id,side,check:'sight-axis',error,fire,reload,cycle});}target.set(0,0,-1).transformDirection(axis.matrixWorld);assert.ok(target.distanceTo(new Vector3(0,0,-1))<1e-8);}
     const fanKey=[cfg.id,side,ads,fire,reload,cycle].join('|');let frameAngle=fans.get(fanKey);
     if(frameAngle===undefined){const visible=v.hands.visible;v.hands.visible=false;frameAngle=api.measureViewmodelClearAngle(vm);v.hands.visible=visible;fans.set(fanKey,frameAngle);}
     handBounds.setFromObject(v.hands,true);const dx=Math.max(0,handBounds.min.x,-handBounds.max.x),dy=Math.max(0,handBounds.min.y,-handBounds.max.y);
     const handAngle=2*Math.atan2(Math.hypot(dx,dy),Math.max(.05,-handBounds.min.z))*180/Math.PI;
     const angle=handAngle>=frameAngle?frameAngle:api.measureViewmodelClearAngle(vm);vr.clearAngle=Math.min(vr.clearAngle,angle);
     const minimum=cfg.id==='sniper'?20:25;
     if(ads===1&&angle<minimum){failed=true;result.failures.push({character:c.id,weapon:cfg.id,side,ads,check:'ads-clear-angle',angle,minimum,fire,reload,cycle});}
     if(failed)vr.failedCases++;
     for(const hand of ['R','L']){const b=hand==='R'?v.palmR:v.palmL,joint=hand==='R'?v.rightHand:v.leftHand,main=side==='left'?hand==='L':hand==='R';palm.set(...b).applyMatrix4(joint.matrixWorld);(main?v.weapon.getObjectByName('mainGrip'):v.weapon.userData.supportGrip).getWorldPosition(target);assert.ok(palm.distanceTo(target)<1e-8);}
     const snapshot=[...vm.position,...vm.quaternion,...v.rightHand.position,...v.leftHand.position];api.poseViewmodel(vm,{...s,ads:1-ads});api.poseViewmodel(vm,s);assert.deepEqual([...vm.position,...vm.quaternion,...v.rightHand.position,...v.leftHand.position],snapshot,'Pure viewmodel ADS');
    }
   }
   result.firstPerson.push(vr);
  }
  await writeFile(url,JSON.stringify(result,null,2)+'\n');
 }
 result.complete=true;result.failedCombinations=result.failures.length;
 const grouped={};for(const c of result.thirdPerson){const r=grouped[c.character]??={character:c.character,maxFistError:0,minClearance:Infinity,failedCases:0};r.maxFistError=Math.max(r.maxFistError,c.maxRightError,c.maxLeftError);r.minClearance=Math.min(r.minClearance,c.minClearance);r.failedCases+=c.failedCases;}
 result.worst=Object.values(grouped).sort((a,b)=>a.minClearance-b.minClearance).slice(0,5);
 await writeFile(url,JSON.stringify(result,null,2)+'\n');
 if(!shard){await writeFile(new URL('./round5-summary.json',import.meta.url),JSON.stringify({checked:result.checked,failedCombinations:result.failedCombinations,rows:result.rows,firstPerson:result.firstPerson,worst:result.worst},null,2)+'\n');await writeFile(new URL('./round5-arm-lengths.json',import.meta.url),JSON.stringify(result.lengths,null,2)+'\n');}
 if(result.failures.length)throw new Error('ROUND 5 ACCEPTANCE FAILED: '+result.failures.length+' cases; full list in '+url.pathname);
 return result;
}
