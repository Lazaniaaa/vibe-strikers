import type { Group } from 'three';
import type { WeaponRuntime, WeaponState } from './types';
import { TOY_VISUALS as V } from './toyWeapons';

const unit=(x:number|undefined,fallback=0)=>Number.isFinite(x)?Math.max(0,Math.min(1,x!)):fallback;
/** Fixed-work visual deformation of existing pivots; no vertices/materials or shared state change. */
export function poseToyWeapon(d:WeaponRuntime,state:WeaponState):void {
  const p=d.visualParts;if(!p)return;
  const heat=unit(state.heat),charge=unit(state.charge),level=unit(state.paintLevel,1);
  const time=Number.isFinite(state.time)?state.time!:0;
  if(p.heat){p.heat.scale.z=Math.max(.001,heat);p.heat.visible=heat>.001;}
  if(p.alarm)p.alarm.visible=heat>=.95&&Math.sin(time*Math.PI*2*V.flashHz)>=0;
  if(p.paint){p.paint.scale.y=Math.max(.001,level);p.paint.position.y=V.paintBottom+V.paintHeight*level/2;p.paint.visible=level>0;}
  if(p.pouch){
    const z=V.pouchZ+charge*V.pull;p.pouch.position.z=z;
    band(p.bandL!,-V.bandX,V.bandY,V.bandZ,0,V.pouchY,z);
    band(p.bandR!,V.bandX,V.bandY,V.bandZ,0,V.pouchY,z);
  }
  coil(p.coil0,charge*4);coil(p.coil1,charge*4-1);coil(p.coil2,charge*4-2);coil(p.coil3,charge*4-3);
}
function band(part:Group,x:number,y:number,z:number,px:number,py:number,pz:number):void {
  const dx=px-x,dy=py-y,dz=pz-z,length=Math.sqrt(dx*dx+dy*dy+dz*dz);
  part.position.set((x+px)/2,(y+py)/2,(z+pz)/2);
  part.rotation.set(-Math.asin(dy/length),Math.atan2(dx,dz),0,'YXZ');part.scale.set(1,1,length);
}
function coil(part:Group|undefined,progress:number):void {
  if(!part)return;const fill=unit(progress);part.visible=fill>0;part.scale.set(1,1,1+.3*fill);
}
