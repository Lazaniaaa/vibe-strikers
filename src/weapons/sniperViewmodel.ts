import { Bone, Group, Mesh, Object3D, Skeleton, SkinnedMesh } from 'three';
import { materials, mergedBoxes, mergedPanes, mergedRigidBoxes, lensMaterial } from './resources';
import { sniperScopeBoxes } from './sniperScope';
import { sniperViewRearFrame, sniperViewTube } from './sniperViewScope';
import type { WeaponBox, WeaponConfig, WeaponPalette, WeaponRuntime } from './types';
import type { Vec3 } from '../characters/types';

const skeletons=new Set<Skeleton>();
/** Sniper VM only: one rigid-skinned draw for the gun/tube, one for the rear frame. */
export function createSniperViewWeapon(config:WeaponConfig,palette:WeaponPalette):Group{
 const group=new Group();group.name='weapon-sniper';
 const socket=(name:string,position:readonly [number,number,number],parent:Object3D=group)=>{const o=new Object3D();o.name=name;o.position.set(...position);parent.add(o);return o;};
 socket('mainGrip',[0,0,0]);
 const data:WeaponRuntime={weaponId:'sniper',kind:'sniper',palette,muzzle:socket('muzzle',config.muzzle),
  foregrip:socket('foregrip',config.foregrip!),supportGrip:null,sightAxis:socket('sightAxis',config.sight!.position),adsFovHint:config.adsFovHint??null,
  ejectPort:socket('ejectPort',config.ejectPort!),mag:null,slide:null,bolt:null,pump:null,rest:{},isSniperViewmodel:true};
 data.supportGrip=socket('supportGrip',[0,0,0],data.foregrip!);
 const fixed=new Bone();fixed.name='fixed-skin';group.add(fixed);const bones=[fixed];
 const pieces:{boxes:readonly WeaponBox[];position:Vec3;bone:number}[]=[{boxes:[...config.body.filter(box=>!sniperScopeBoxes.includes(box)),...sniperViewTube],position:[0,0,0],bone:0}];
 for(const name of ['mag','bolt'] as const){
  const spec=config.parts[name]!;const pivot=new Group();pivot.name=name;pivot.position.set(...spec.position);group.add(pivot);
  const bone=new Bone();bone.name=`${name}-skin`;pivot.add(bone);bones.push(bone);data[name]=pivot;data.rest[name]=spec.position;
  pieces.push({boxes:[...spec.boxes],position:spec.position,bone:bones.length-1});
 }
 const solid=materials()[0],body=new SkinnedMesh(mergedRigidBoxes(pieces,palette),solid);body.name='scopeBody';group.add(body);
 const frame=new Mesh(mergedBoxes(sniperViewRearFrame,palette,'sniper-viewmodel-rear-frame'),solid);frame.name='scopeRear';group.add(frame);
 group.updateMatrixWorld(true);const skeleton=new Skeleton(bones);body.bind(skeleton);skeleton.computeBoneTexture();skeletons.add(skeleton);
 body.computeBoundingBox();body.computeBoundingSphere();body.frustumCulled=false;
 data.scopeBody=body;data.scopeRear=frame;
 for(const spec of config.lenses!){
  const lens=new Mesh(mergedPanes(spec.boxes,palette,`sniper-lens-${spec.id}`),lensMaterial());lens.name=`lens-${spec.id}`;lens.renderOrder=2;
  lens.userData.viewmodelHidden=spec.viewmodelHidden??false;group.add(lens);
  if(spec.id==='objective')data.scopeLensFront=lens;else data.scopeLensRear=lens;
 }
 group.userData=data;return group;
}
export function disposeSniperViewSkeletons():void{for(const skeleton of skeletons)skeleton.dispose();skeletons.clear();}
