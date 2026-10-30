import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Box3,Mesh,PerspectiveCamera,Raycaster,Vector2,Vector3} from 'three';

/** Scope-specific additions. All world-model Round 6 checks remain in force. */
export async function verifySniper(api,characters,scope,resources,viewScope){
 const w=api.createWeapon('sniper'),copy=api.createWeapon('sniper'),cfg=api.weapons.find(w=>w.id==='sniper');
 const meshes=[];w.traverse(o=>{if(o instanceof Mesh)meshes.push(o)});
 const opaque=meshes.filter(m=>!m.name.startsWith('lens-')),lenses=meshes.filter(m=>m.name.startsWith('lens-'));
 assert.ok(opaque.length<=3&&lenses.length<=2);assert.equal(lenses.length,2);
 assert.deepEqual(lenses.map(m=>m.name).sort(),['lens-eyepiece','lens-objective']);
 for(const mesh of meshes)assert.equal(mesh.geometry,copy.getObjectByName(mesh.name).geometry,'Sniper geometry/lenses shared');
 const tip=w.userData.muzzle.position.distanceTo(w.getObjectByName('mainGrip').position);assert.ok(tip>=1.4*.75&&tip<=1.4*1.25);
 const housing=api.sniperScopeSize(w),assembly=api.sniperScopeSize(w,true);
 // Stage-A box envelope .34/.3575/.755, with the original outlined face treatment.
 for(const [axis,original] of [['width',.342],['height',.3575],['depth',.757]])assert.ok(Math.abs(housing[axis]-original)<.003,`Original scope ${axis}`);
 assert.ok(housing.width<1.08);
 const ray=new Raycaster(),point=new Vector3(),camera=new PerspectiveCamera(70,16/9,.05,20),ndc=new Vector2();
 const hole=(boxes,highX,highY)=>{
  const mesh=new Mesh(resources.mergedBoxes(boxes,cfg.palette,'sniper-opening-measure'),opaque[0].material);mesh.updateMatrixWorld(true);
  const side=(axis,high)=>{let low=0;for(let i=0;i<28;i++){const mid=(low+high)/2;point.set(axis==='x'?mid:0,scope.SNIPER_SCOPE_AXIS_Y+(axis==='y'?mid:0),.5);ray.set(point,new Vector3(0,0,-1));ray.near=0;ray.far=3;if(ray.intersectObject(mesh,false).length)high=mid;else low=mid;}return low*2;};
  return {width:side('x',highX),height:side('y',highY)};
 };
 const rearOpening=hole(scope.sniperScopeHousing.slice(4,8),.12,.14),frontOpening=hole(scope.sniperScopeHousing.slice(8,12),.1575,.14);
 assert.ok(rearOpening.width>=.06&&rearOpening.width<=.071);assert.ok(rearOpening.height>=.06&&rearOpening.height<=.071);
 const viewRearOpening=hole(viewScope.sniperViewRearFrame,.14,.13),frameBox=resources.mergedBoxes(viewScope.sniperViewRearFrame,cfg.palette,'frame-measure').boundingBox;
 const frameSize=frameBox.getSize(new Vector3());
 const border={horizontal:(frameSize.x-viewRearOpening.width)/2,vertical:(frameSize.y-viewRearOpening.height)/2};
 assert.ok(border.horizontal>=.012&&border.horizontal<=.020001&&border.vertical>=.012&&border.vertical<=.020001);
 const bezelSize=resources.mergedBoxes(viewScope.sniperViewRearBezel,cfg.palette,'rear-face-measure').boundingBox.getSize(new Vector3());
 const rearFace={width:bezelSize.x,height:bezelSize.y},openingRatio={width:viewRearOpening.width/rearFace.width,height:viewRearOpening.height/rearFace.height};
 for(const value of Object.values(openingRatio))assert.ok(value>=.70&&value<=.75,'Rear opening is 70–75% of the rear face');
 const result={housing,assembly,rearOpening,frontOpening,viewRearOpening,frameSize,border,rearFace,openingRatio,adsDistance:api.SNIPER_ADS_DISTANCE,opaque:opaque.length,lenses:lenses.length,viewmodelOpaque:0,tipDistance:tip,centreChecks:0,centreHits:0,minClearAngle:70,maxAxisError:0,ads:[],coverage:[],visibilityChecks:0};
 const viewResources=[];
 for(const side of ['right','left']){
  const vm=api.createViewmodel('sniper',characters[0],{holdSide:side}),v=vm.userData;
  const vmCopy=api.createViewmodel('sniper',characters[0],{holdSide:side}),vmMeshes=[];
  v.weapon.traverse(o=>{if(o instanceof Mesh)vmMeshes.push(o)});
  result.viewmodelOpaque=vmMeshes.filter(m=>!m.name.startsWith('lens-')).length;assert.ok(result.viewmodelOpaque<=3);
  assert.equal(vmMeshes.filter(m=>m.name.startsWith('lens-')).length,2);
  for(const mesh of vmMeshes)assert.equal(mesh.geometry,vmCopy.userData.weapon.getObjectByName(mesh.name).geometry,'VM geometry including lenses is shared');
  assert.equal(v.weapon.userData.scopeBody.name,'scopeBody');assert.equal(v.weapon.userData.scopeBody.isSkinnedMesh,true);
  // Merging must preserve the gun and the original rigid mag/bolt animations.
  const skin=v.weapon.userData.scopeBody,skinIndices=skin.geometry.attributes.skinIndex,skinWeights=skin.geometry.attributes.skinWeight;
  assert.equal(skinIndices,vmCopy.userData.weapon.userData.scopeBody.geometry.attributes.skinIndex);
  const fixedBoxes=[...cfg.body.filter(b=>!scope.sniperScopeBoxes.includes(b)),...viewScope.sniperViewTube];
  const offsets=[0,resources.mergedBoxes(fixedBoxes,cfg.palette,'fixed-measure').attributes.position.count];
  offsets.push(offsets[1]+w.getObjectByName('mag-boxes').geometry.attributes.position.count);
  const staticCount=resources.mergedBoxes(cfg.body.filter(b=>!scope.sniperScopeBoxes.includes(b)),cfg.palette,'gun-measure').attributes.position.count;
  const before=Buffer.from(skin.geometry.attributes.position.array.buffer).toString('base64'),weightsBefore=Buffer.from(skinWeights.array.buffer).toString('base64');
  const skinnedPoint=new Vector3(),originalPoint=new Vector3();
  for(const progress of [0,.25,.5,.75,1]){
   const state={fire:progress,reload:progress,cycle:progress,equip:1};api.poseWeapon(w,state);api.poseWeapon(v.weapon,state);w.updateMatrixWorld(true);vm.updateMatrixWorld(true);
   // Compare in each weapon's local space; viewmodel camera placement is irrelevant.
   const local=new (w.matrixWorld.constructor)().copy(v.weapon.matrixWorld).invert();
   const worldLocal=new (w.matrixWorld.constructor)().copy(w.matrixWorld).invert();
   for(const [index,name,count] of [[0,'body',staticCount],[1,'mag-boxes',Infinity],[2,'bolt-boxes',Infinity]]){
    const original=w.getObjectByName(name),n=Math.min(count,original.geometry.attributes.position.count);
    for(let i=0;i<n;i++){
     const vertex=offsets[index]+i;assert.equal(skinIndices.getX(vertex),index);assert.equal(skinWeights.getX(vertex),1);
     skin.getVertexPosition(vertex,skinnedPoint).applyMatrix4(skin.matrixWorld).applyMatrix4(local);
     original.getVertexPosition(i,originalPoint).applyMatrix4(original.matrixWorld).applyMatrix4(worldLocal);
     assert.ok(skinnedPoint.distanceTo(originalPoint)<1e-6,'Rigid merged geometry retains animated mag/bolt positions');
    }
   }
  }
  assert.equal(Buffer.from(skin.geometry.attributes.position.array.buffer).toString('base64'),before);
  assert.equal(Buffer.from(skinWeights.array.buffer).toString('base64'),weightsBefore);
  if(side==='right')viewResources.push(v.weapon.userData.scopeBody.geometry,v.weapon.userData.scopeRear.geometry,v.weapon.userData.scopeBody.skeleton.boneTexture);
  for(const ads of [.5,.75,1,.499,0]){
   api.poseViewmodel(vm,{ads,fire:0,reload:null,cycle:null,equip:1,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,time:0});
   assert.equal(v.weapon.userData.scopeBody.visible,ads<.5);assert.equal(v.weapon.userData.scopeLensFront.visible,ads<.5);assert.equal(v.weapon.userData.scopeLensRear.visible,false);assert.equal(v.hands.visible,ads<.5);
   const visible=[];v.weapon.traverseVisible(o=>{if(o instanceof Mesh&&!o.name.startsWith('lens-'))visible.push(o.name)});
   if(ads>=.5)assert.deepEqual(visible,['scopeRear'],'Only thin rear ring remains, no front/body/tube');
   result.visibilityChecks++;
  }
  for(const fire of [0,1])for(const reload of [null,1])for(const cycle of [null,1]){
   const state={holdSide:side,ads:1,fire,reload,cycle,equip:1,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,time:0};
   api.poseViewmodel(vm,state);vm.updateMatrixWorld(true);
   const axis=v.weapon.userData.sightAxis.getWorldPosition(new Vector3()),error=Math.hypot(axis.x,axis.y,axis.z+api.SNIPER_ADS_DISTANCE);
   result.maxAxisError=Math.max(result.maxAxisError,error);assert.ok(error<=.01);
   const list=[];vm.traverseVisible(o=>{if(o instanceof Mesh&&!o.name.startsWith('lens-'))list.push(o)});
   ray.setFromCamera(ndc,camera);ray.near=.05;ray.far=20;const hits=ray.intersectObjects(list,false);result.centreChecks++;result.centreHits+=hits.length?1:0;assert.equal(hits.length,0);
   const angle=api.measureViewmodelClearAngle(vm);result.minClearAngle=Math.min(result.minClearAngle,angle);assert.ok(angle>=20,`Sniper ADS cone ${angle}`);
   assert.equal(v.weapon.getObjectByName('lens-eyepiece').visible,false);assert.equal(w.getObjectByName('lens-eyepiece').visible,true);
   const measured=api.measureSniperAdsView(vm,16/9,720);
   assert.ok(measured.clearWidthFraction>=.60&&measured.clearHeightFraction>=.60,`ADS clear viewport ${JSON.stringify(measured)}`);
   assert.equal(measured.blockedPixels,0,'No opaque walls inside the clear rectangle');
   result.ads.push({side,fire,reload,cycle,...measured});
  }
  api.poseViewmodel(vm,{holdSide:side,ads:0,fire:0,reload:null,cycle:null,equip:1,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,time:0});
  for(const aspect of [16/9,1]){
   const measured=api.measureSniperScopeCoverage(vm,aspect,720);assert.ok(measured.percentage<=12,`Sniper HIP coverage ${measured.percentage}%`);
   result.coverage.push({side,aspect,...measured});
  }
 }
 // Every character's viewmodel must retain this result, including large NFT fists.
 for(const c of characters)for(const side of ['right','left']){
  const vm=api.createViewmodel('sniper',c,{holdSide:side});api.poseViewmodel(vm,{holdSide:side,ads:1,fire:1,reload:1,cycle:1,equip:1,moveSpeed:1,strafe:1,grounded:false,crouching:true,aimPitch:1.55,time:123});
  const measured=api.measureSniperAdsView(vm,16/9,180);assert.ok(measured.clearWidthFraction>=.6&&measured.clearHeightFraction>=.6);assert.equal(measured.blockedPixels,0);
  assert.equal(vm.userData.weapon.userData.scopeBody.visible,false);assert.equal(vm.userData.hands.visible,false);result.visibilityChecks++;
 }
 const resourcesToDispose=[w.getObjectByName('body').geometry,...lenses.map(m=>m.geometry),...viewResources],disposed=resourcesToDispose.map(()=>0);
 resourcesToDispose.forEach((g,i)=>g.addEventListener('dispose',()=>disposed[i]++));
 await writeFile(new URL('../../work/round9-sniper-checks.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log('PASS ROUND7 SNIPER',JSON.stringify(result));
 return {assertDisposed(){assert.deepEqual(disposed,resourcesToDispose.map(()=>1),'World/VM geometry, lenses and skeleton texture disposed exactly once');const fresh=api.createWeapon('sniper');assert.notEqual(fresh.getObjectByName('body').geometry,resourcesToDispose[0]);assert.notEqual(fresh.getObjectByName('lens-objective').geometry,resourcesToDispose[1]);const vm=api.createViewmodel('sniper',characters[0]);assert.notEqual(vm.userData.weapon.userData.scopeBody.geometry,viewResources[0]);}};
}
