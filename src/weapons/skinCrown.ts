import { BufferAttribute, Color, Matrix4, type BufferGeometry } from 'three';
import { Boxes } from '../characters/boxGeometry';
import { RARITY_STYLES } from './skinRarity';
import type { SkinTraits } from './skinTraits';
export interface CrownAnchor {w:number;h:number;d:number;x:number;y:number;z:number;local:readonly number[]}
const CAP_FACE=[-1,5,4,1,0,2];
/** Remove only the buried faces of the five colour plates; keep the outline shell. */
export function simplifyFarBoxes(geometry:BufferGeometry):void{
 const old=geometry.index!,indices:number[]=[];for(let q=0;q<old.count;q+=6){const cube=Math.floor(q/36),face=Math.floor(q/6)%6;if(cube%6!==0&&face!==CAP_FACE[cube%6])continue;for(let k=0;k<6;k++)indices.push(old.getX(q+k));}geometry.setIndex(indices);
}
/** Construction only. Crowns bind to the stable chassis, never a socket or heat/coil mechanism. */
export function crownGeometry(t:SkinTraits,a:CrownAnchor,far:boolean):{solid?:BufferGeometry;glow?:BufferGeometry}{
 const parts=RARITY_STYLES[t.rarity].crown,out:{solid?:BufferGeometry;glow?:BufferGeometry}={},matrix=new Matrix4().fromArray(a.local);
 for(const lit of[false,true]){const selected=parts.filter(p=>(p.role==='glow'&&t.glow!=='None')===lit);if(!selected.length)continue;const b=new Boxes();
  for(const p of selected){const color=p.role==='glow'?t.colourSet.glow:p.role==='accent'?t.accent.color:p.role==='top'?t.body.top:t.body.color,top=p.role==='accent'?t.accent.top:color;
   const size:[number,number,number]=[p.w*a.w,p.h*a.h,p.d*a.d],at:[number,number,number]=[a.x+p.x*a.w,a.y+p.y*a.h,a.z+p.z*a.d];
   b.outlined(size,at,color,t.colourSet.ink,top,Math.min(.006,Math.min(...size)*.18));
  }
  const geometry=b.finish('skin-'+t.silhouette.id);if(far)simplifyFarBoxes(geometry);geometry.applyMatrix4(matrix);
  if(far){const emission=new Float32Array(geometry.attributes.position.count),c=geometry.attributes.color,ink=new Color(t.colourSet.ink);if(lit)for(let i=0;i<c.count;i++)if(Math.abs(c.getX(i)-ink.r)+Math.abs(c.getY(i)-ink.g)+Math.abs(c.getZ(i)-ink.b)>1e-5)emission[i]=1;geometry.setAttribute('skinEmission',new BufferAttribute(emission,1));}
  out[lit?'glow':'solid']=geometry;
 }return out;
}
