import type { Group } from 'three';
import type { Vec3 } from '../characters/types';
import type { WeaponRuntime, WeaponState } from './types';

export const bounded=(n:number,lo:number,hi:number,fallback=0):number=>Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback;
export const unit=(n:number|null|undefined,fallback=0):number=>typeof n==='number'?bounded(n,0,1,fallback):fallback;
function reset(part:Group|null,rest:Vec3|undefined):void{
  if(!part||!rest)return;
  part.position.set(rest[0],rest[1],rest[2]);part.rotation.set(0,0,0);part.scale.set(1,1,1);
}
/** Stateless visuals. dt intentionally ignored: progress belongs to the game. No allocations. */
export function poseWeapon(weapon:Group,state:WeaponState,_dt?:number):void{
  const d=weapon.userData as WeaponRuntime;
  const fire=unit(state.fire),reload=unit(state.reload),cycle=unit(state.cycle),equip=unit(state.equip,1);
  const out=Math.sin(reload*Math.PI), action=Math.sin(cycle*Math.PI), holster=1-equip;
  weapon.position.set(0,-holster*.28,fire*.045+holster*.10);
  weapon.rotation.set(fire*.10-holster*.65,0,-fire*.025);
  weapon.scale.set(d.holdMirror?-1:1,1,1);
  reset(d.mag,d.rest.mag);reset(d.slide,d.rest.slide);reset(d.bolt,d.rest.bolt);reset(d.pump,d.rest.pump);
  if(d.mag){d.mag.position.y-=out*.34;d.mag.position.x+=out*.18;d.mag.position.z+=out*.10;d.mag.rotation.z=-out*.40;}
  if(d.slide)d.slide.position.z+=fire*.075;
  if(d.bolt){d.bolt.position.z+=action*.18;d.bolt.rotation.z=-Math.sin(cycle*Math.PI*2)*.6;}
  if(d.pump)d.pump.position.z+=Math.max(action,out)*.18;
}
