import { Euler, Group, Mesh, Quaternion, Vector3 } from 'three';
import type { CharacterConfig, CharacterRuntime, PhysicalComponent, Surface, Vec3 } from '../characters/types';
import { createCharacter } from '../characters/createCharacter';
import { createWeapon } from './createWeapon';
import { materials, mergedBoxes } from './resources';
import { bounded, poseWeapon, unit } from './poseWeapon';
import type { ViewmodelOptions, ViewmodelRuntime, ViewmodelState, WeaponBox, WeaponId, WeaponPalette, WeaponRuntime } from './types';
import { ADS_DISTANCE, SNIPER_ADS_DISTANCE } from './ads';
import { readyProfile } from './hold';
import { TOY_VISUALS } from './toyWeapons';

const hipPosition=new Vector3(),eyePosition=new Vector3(),sightPosition=new Vector3();
const hipRotation=new Quaternion(),eyeRotation=new Quaternion(),sightRotation=new Quaternion();
const hipEuler=new Euler();

function surface(config:CharacterConfig,part:PhysicalComponent):Surface{
  const family=part.startsWith('hand')?'hand':'arm';
  const direct=config.surfaces?.[part]??config.surfaces?.[family];
  if(direct)return direct;
  if(family==='hand')return {color:config.colors.glove??config.colors.body,topColor:config.colors.gloveTop??config.colors.glove??config.colors.top??config.colors.body};
  return {color:config.colors.body,topColor:config.colors.top??config.colors.body};
}
/** Camera-local, metre scale. All hand/arm colors and normalized sizes belong to this NFT. */
export function createViewmodel(weaponId:WeaponId,characterConfig:CharacterConfig,options:ViewmodelOptions={}):Group{
  const group=new Group();group.name=`viewmodel-${weaponId}`;
  const weapon=createWeapon(weaponId,{viewmodel:true,skin:options.skin});group.add(weapon);
  // Construction-time lookup only; no character transforms/geometries are edited.
  const character=createCharacter(characterConfig).userData as CharacterRuntime;
  const hands=new Group();hands.name='hands';group.add(hands);
  const rightHand=new Group(),leftHand=new Group();rightHand.name='rightHand';leftHand.name='leftHand';hands.add(rightHand,leftHand);
  const handGeometry=[];
  let palmL:Vec3=[0,0,0],palmR:Vec3=[0,0,0];
  for(const [side,pivot] of [['R',rightHand],['L',leftHand]] as const){
    const hand=surface(characterConfig,`hand${side}`),arm=surface(characterConfig,`arm${side}`);
    const palette:WeaponPalette={steel:hand.color,top:hand.topColor??hand.color,shadow:arm.color,
      grip:arm.topColor??arm.color,outline:characterConfig.colors.outline,accent:hand.sideColor??hand.color,accentTop:arm.sideColor??arm.color,glass:'#67D9F2',glassTop:'#D3F7FF'};
    const size=character.dimensions.components[`hand${side}`],armSize=character.dimensions.components[`arm${side}`];
    // First person shows the forearm segment, not the entire shoulder-to-wrist limb.
    const forearmLength=Math.min(armSize[1],.28);
    const palmY=-size[1]*.30;
    if(side==='L')palmL=[0,palmY,.025];else palmR=[0,palmY,.025];
    const boxes:WeaponBox[]=[{size,position:[0,palmY,.025],color:'steel',top:'top',side:'accent'},
      {size:[armSize[0],armSize[2],forearmLength],position:[0,palmY-.10,size[2]/2+forearmLength/2-.035],color:'shadow',top:'grip',side:'accentTop',rotate:['x',-.18]}];
    const geometry=mergedBoxes(boxes,palette,`view-hand-${side}`);
    const mesh=new Mesh(geometry,materials()[0]);mesh.name=`view-arm${side}`;pivot.add(mesh);handGeometry.push(geometry);
  }
  group.userData={weapon,hands,rightHand,leftHand,characterId:characterConfig.id,handGeometry,palmL,palmR,holdSide:options.holdSide??'right'} satisfies ViewmodelRuntime;
  group.traverse(o=>{o.castShadow=false;o.receiveShadow=false;});
  weapon.traverse(o=>{if(o.userData.viewmodelHidden)o.visible=false;});
  poseViewmodel(group,{fire:0,reload:null,cycle:null,equip:1,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,time:0});
  return group;
}
/** Root belongs to the viewmodel. Attach it to a separate camera/scene with identity placement. */
export function poseViewmodel(viewmodel:Group,state:ViewmodelState,_dt?:number):void{
  const d=viewmodel.userData as ViewmodelRuntime,w=d.weapon.userData as WeaponRuntime;
  const t=bounded(state.time,-1e6,1e6),speed=unit(state.moveSpeed),strafe=bounded(state.strafe,-1,1);
  const grounded=state.grounded!==false, crouch=state.crouching?1:0,equip=unit(state.equip,1);
  const pitch=bounded(state.aimPitch,-89*Math.PI/180,89*Math.PI/180);
  const gait=grounded?Math.sin(t*8)*speed:0;
  const side=state.holdSide??d.holdSide;
  const sign=side==='left'?-1:1;
  const ads=w.kind==='knife'||w.kind==='paintGrenade'?0:unit(state.ads),blend=ads*ads*(3-2*ads);
  viewmodel.visible=w.kind!=='sniper'||ads<.9;
  if(w.scopeBody){
    const hip=ads<.5;w.scopeBody.visible=hip;w.scopeRear!.visible=true;
    w.scopeLensFront!.visible=hip;w.scopeLensRear!.visible=false;d.hands.visible=hip;
  }
  const hipY=w.kind==='sniper'?-.68:w.kind==='shotgun'?-.60:-.55;
  hipPosition.set(sign*.60-strafe*.018,hipY+Math.sin(t*1.7)*.005+Math.abs(gait)*.018-crouch*.025-(1-equip)*.18,-1.05);
  hipEuler.set(.12+pitch*.025+gait*.012,sign*.34+strafe*.025,-strafe*.045+gait*.015);
  hipRotation.setFromEuler(hipEuler);
  viewmodel.position.copy(hipPosition);viewmodel.quaternion.copy(hipRotation);
  if(w.weaponId==='paintGrenade'){
    const progress=unit(state.throw),wind=Math.sin(Math.min(1,progress/.45)*Math.PI/2);
    viewmodel.position.y+=progress<.45?wind*.08:Math.sin((progress-.45)/.55*Math.PI)*.18;
    viewmodel.position.z+=progress<.45?wind*.12:-(progress-.45)/.55*TOY_VISUALS.throwReach;
    viewmodel.rotation.x+=progress<.45?-wind*.4:Math.sin((progress-.45)/.55*Math.PI)*.6;
    d.weapon.visible=progress<TOY_VISUALS.throwRelease;
  }
  viewmodel.scale.set(1,1,1);
  poseWeapon(d.weapon,state);
  const mirror=side==='left'&&readyProfile(w.weaponId)!.config.mirrorSafe?-1:1;
  d.weapon.scale.x=mirror;
  d.hands.position.copy(d.weapon.position);d.hands.quaternion.copy(d.weapon.quaternion);d.hands.scale.set(1,1,1);
  const main=side==='left'?d.leftHand:d.rightHand,other=side==='left'?d.rightHand:d.leftHand;
  const mainPalm=side==='left'?d.palmL:d.palmR,otherPalm=side==='left'?d.palmR:d.palmL;
  main.visible=true;main.position.set(-mainPalm[0],-mainPalm[1],-mainPalm[2]);main.rotation.set(0,0,0);
  const foregrip=w.supportGrip;
  other.visible=foregrip!==null;
  if(foregrip){
    if(w.foregrip)other.position.copy(w.foregrip.position);else other.position.copy(foregrip.position);
    other.position.x*=mirror;other.rotation.set(0,0,0);
    const reload=unit(state.reload),cycle=unit(state.cycle);
    other.rotation.z=Math.sin(reload*Math.PI)*.08+Math.sin(cycle*Math.PI)*.04;
    const angle=other.rotation.z,c=Math.cos(angle),s=Math.sin(angle),p=otherPalm;
    other.position.x-=c*p[0]-s*p[1];other.position.y-=s*p[0]+c*p[1];other.position.z-=p[2];
  }
  if(w.sightAxis&&blend>0){
    // Solve in viewmodel-local space, including moving slide and full recoil.
    const axis=w.sightAxis;d.weapon.updateMatrix();
    sightPosition.copy(axis.position);sightRotation.copy(d.weapon.quaternion);
    if(axis.parent!==d.weapon){axis.parent!.updateMatrix();sightPosition.applyMatrix4(axis.parent!.matrix);sightRotation.multiply(axis.parent!.quaternion);}
    sightPosition.applyMatrix4(d.weapon.matrix);sightRotation.multiply(axis.quaternion);
    eyeRotation.copy(sightRotation).invert();
    eyePosition.set(0,0,-(w.kind==='sniper'?SNIPER_ADS_DISTANCE:ADS_DISTANCE)).sub(sightPosition.applyQuaternion(eyeRotation));
    viewmodel.position.lerp(eyePosition,blend);viewmodel.quaternion.slerp(eyeRotation,blend);
  }
}
