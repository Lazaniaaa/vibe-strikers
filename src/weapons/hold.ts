import { Euler, Group, Mesh, Quaternion, Vector3 } from 'three';
import type { CharacterRuntime } from '../characters/types';
import type { WeaponBox, WeaponId, WeaponRuntime } from './types';
import { weapons } from './weapons';
import { createWeapon } from './createWeapon';

export const READY_ROLL=.55;
export const READY_PITCH=47*Math.PI/180;
/** Construction-only corner scan of box DATA; no geometry/vertices touched in any frame. */
const profiles=new Map(weapons.map(config=>{
  let minX=Infinity,maxY=-Infinity,minY=Infinity;
  const corners:number[]=[],slideCorners:number[]=[];
  const include=(b:WeaponBox,px=0,py=0,pz=0,slide=0)=>{
    for(const ix of [-1,1])for(const iy of [-1,1])for(const iz of [-1,1]){
      let x=ix*(b.size[0]/2+.002),y=iy*(b.size[1]/2+.002),z=iz*(b.size[2]/2+.002);
      if(b.rotate){const[a,t]=b.rotate,c=Math.cos(t),s=Math.sin(t);if(a==='x'){const v=y;y=c*y-s*z;z=s*v+c*z;}else if(a==='y'){const v=x;x=c*x+s*z;z=-s*v+c*z;}else{const v=x;x=c*x-s*y;y=s*v+c*y;}}
      x+=b.position[0]+px;y+=b.position[1]+py;z+=b.position[2]+pz;
      corners.push(x,y,z);slideCorners.push(slide);
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
  };
  for(const b of config.body)include(b);
  for(const [name,part] of Object.entries(config.parts))for(const b of part.boxes)include(b,part.position[0],part.position[1],part.position[2],name==='slide'?1:0);
  for(const lens of config.lenses??[]){const part=lens.part?config.parts[lens.part]:undefined;for(const b of lens.boxes)include(b,part?.position[0]??0,part?.position[1]??0,part?.position[2]??0,lens.part==='slide'?1:0);}
  const rotation=new Quaternion().setFromEuler(new Euler(...config.hold.rotation));
  // Read the actual merged boxes once, including outline plates and moving slide membership.
  const sample=createWeapon(config.id),p=new Vector3(),seen=new Set<string>();
  sample.updateMatrixWorld(true);corners.length=0;slideCorners.length=0;
  sample.traverse(o=>{
    if(!(o instanceof Mesh))return;
    const moving=o.parent===sample.userData.slide?1:0,a=o.geometry.attributes.position;
    for(let i=0;i<a.count;i++){
      p.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);
      const key=[p.x,p.y,p.z,moving].join(',');
      if(!seen.has(key)){seen.add(key);corners.push(p.x,p.y,p.z);slideCorners.push(moving);}
    }
  });
  return [config.id,{config,rotation,corners:new Float32Array(corners),slideCorners:new Uint8Array(slideCorners),leftReach:-minX+Math.max(Math.abs(minY),Math.abs(maxY))*.027+.018}] as const;
}));
export function readyProfile(id:WeaponId|null|undefined){return id?profiles.get(id):undefined;}
/** Persistent mount between the existing socket and animation-owned weapon root. */
export function attachWeapon(character:Group,weapon:Group):Group{
  const profile=readyProfile((weapon.userData as WeaponRuntime).weaponId);
  if(!profile)throw new Error('Unknown ready hold');
  const d=character.userData as CharacterRuntime;
  const previous=d.weaponBinding;
  const mount=previous?.weapon===weapon?previous.mount:new Group();mount.name='weaponHold';
  const h=profile.config.hold;mount.position.set(...h.position);mount.rotation.set(...h.rotation);
  const socket=d.weaponSocket;
  if(profile.config.kind!=='knife'){
    const b=d.dimensions.handR;
    const palm=new Vector3((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);
    palm.sub(socket.position).applyQuaternion(socket.quaternion.clone().invert());mount.position.add(palm);
  }
  if(mount.parent!==socket)socket.add(mount);
  if(weapon.parent!==mount)mount.add(weapon);
  const mirrored=false;
  weapon.userData.holdMirror=mirrored;weapon.scale.x=mirrored?-1:1;
  d.weaponBinding={mount,weapon,id:profile.config.id,side:'right',mirrored};
  if(profile.config.id==='paintGrenade'&&!weapon.userData.characterPose)weapon.userData.characterPose={weapon:'knife',speed:0,moveDir:{x:0,z:-1},aimPitch:0,shooting:false,crouching:false,grounded:true,dead:false};
  return mount;
}
