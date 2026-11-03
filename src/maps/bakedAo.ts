import type {MapBox} from './types';
/** Linear-light AO tint: short local contacts only; never black, especially on floors. */
export const BAKED_AO={layoutVersion:1,voxelSampleStep:.5,radius:.65,strength:.58,minLight:.64,floorMinLight:.76,originBias:.012,cell:3,
  /** Eight deterministic hemisphere rays; no randomness or temporal noise. */
  normalWeight:.55,tangentWeight:.8351646544,rays:8,
  /** Adaptive contact bands, not a global grid. <=6000 added triangles across four chunks. */
  minFaceArea:1.5,minFaceSpan:2,maxCuts:2,maxExtraPerChunk:1500,cutEpsilon:.04,minOccluderThickness:.025,
} as const;
export const AO_DIAGNOSTICS:{fields:number;queries:number;mode:'rays'|'voxel'}={fields:0,queries:0,mode:'rays'};
type Bounds={lo:number[];hi:number[];source:MapBox};
export class AoField {
 private bins=new Map<string,Bounds[]>();
 constructor(boxes:readonly MapBox[]){AO_DIAGNOSTICS.fields++;
  for(const b of boxes){if(Math.min(b.w,b.h,b.d)<BAKED_AO.minOccluderThickness&&!b.collide)continue;
   const a={lo:[b.x-b.w/2,b.y-b.h/2,b.z-b.d/2],hi:[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2],source:b};
   for(let x=Math.floor(a.lo[0]/BAKED_AO.cell);x<=Math.floor(a.hi[0]/BAKED_AO.cell);x++)for(let y=Math.floor(a.lo[1]/BAKED_AO.cell);y<=Math.floor(a.hi[1]/BAKED_AO.cell);y++)for(let z=Math.floor(a.lo[2]/BAKED_AO.cell);z<=Math.floor(a.hi[2]/BAKED_AO.cell);z++){const k=x+','+y+','+z;let bin=this.bins.get(k);if(!bin)this.bins.set(k,bin=[]);bin.push(a);}
  }
 }
 neighbors(x:number,y:number,z:number,w:number,h:number,d:number):Bounds[]{
  const r=BAKED_AO.radius,lo=[x-w/2-r,y-h/2-r,z-d/2-r],hi=[x+w/2+r,y+h/2+r,z+d/2+r],found=new Set<Bounds>();
  for(let a=Math.floor(lo[0]/BAKED_AO.cell);a<=Math.floor(hi[0]/BAKED_AO.cell);a++)for(let b=Math.floor(lo[1]/BAKED_AO.cell);b<=Math.floor(hi[1]/BAKED_AO.cell);b++)for(let c=Math.floor(lo[2]/BAKED_AO.cell);c<=Math.floor(hi[2]/BAKED_AO.cell);c++)for(const o of this.bins.get(a+','+b+','+c)??[])if(o.lo.every((v,i)=>v<=hi[i]&&o.hi[i]>=lo[i]))found.add(o);
  return [...found];
 }
 factor(p:readonly number[],axis:number,sign:number,near:readonly Bounds[],floor:boolean,center:readonly number[]=p):number{
  AO_DIAGNOSTICS.queries++;
  const u=(axis+1)%3,v=(axis+2)%3,q=[...p];q[axis]+=sign*BAKED_AO.originBias;let shade=0;
  if(AO_DIAGNOSTICS.mode==='voxel'){
   const step=BAKED_AO.radius*BAKED_AO.voxelSampleStep,a=[...q],b=[...q],c=[...q],su=p[u]<center[u]?-step:step,sv=p[v]<center[v]?-step:step;
   a[u]+=su;b[v]+=sv;c[u]+=su;c[v]+=sv;const occupied=(point:number[])=>near.some(b=>point.every((v,i)=>v>=b.lo[i]&&v<=b.hi[i])),side1=occupied(a),side2=occupied(b),corner=occupied(c),blocked=side1&&side2?3:+side1 + +side2 + +corner;
   return Math.max(floor?BAKED_AO.floorMinLight:BAKED_AO.minLight,1-BAKED_AO.strength*blocked/3);
  }
  for(let ray=0;ray<BAKED_AO.rays;ray++){
   const angle=ray*Math.PI*2/BAKED_AO.rays,dir=[0,0,0];dir[axis]=sign*BAKED_AO.normalWeight;dir[u]=Math.cos(angle)*BAKED_AO.tangentWeight;dir[v]=Math.sin(angle)*BAKED_AO.tangentWeight;
   let nearest:number=BAKED_AO.radius;
   for(const b of near){let lo=0,hi=nearest;for(let a=0;a<3;a++){if(Math.abs(dir[a])<1e-9){if(q[a]<b.lo[a]||q[a]>b.hi[a]){hi=-1;break;}}else{const t0=(b.lo[a]-q[a])/dir[a],t1=(b.hi[a]-q[a])/dir[a];lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}}if(hi>=lo&&lo<nearest)nearest=lo;}
   shade+=(1-nearest/BAKED_AO.radius)**2;
  }
  return Math.max(floor?BAKED_AO.floorMinLight:BAKED_AO.minLight,1-BAKED_AO.strength*shade/BAKED_AO.rays);
 }
 /** Coordinates only at projected contact boundaries / their falloff bands. */
 cuts(lo:number,hi:number,axis:number,normalAxis:number,plane:number,near:readonly Bounds[],source:MapBox):number[]{
  const candidates:number[]=[];
  for(const b of near){if(b.source===source||plane<b.lo[normalAxis]-BAKED_AO.radius||plane>b.hi[normalAxis]+BAKED_AO.radius)continue;
   for(const edge of [b.lo[axis],b.hi[axis]])for(const offset of [-BAKED_AO.radius,0,BAKED_AO.radius]){const p=edge+offset;if(p>lo+BAKED_AO.cutEpsilon&&p<hi-BAKED_AO.cutEpsilon)candidates.push(p);}
  }
  candidates.sort((a,b)=>Math.min(a-lo,hi-a)-Math.min(b-lo,hi-b)||a-b);const chosen:number[]=[];
  for(const c of candidates)if(chosen.every(v=>Math.abs(v-c)>BAKED_AO.cutEpsilon)){chosen.push(c);if(chosen.length===BAKED_AO.maxCuts)break;}
  return [lo,...chosen.sort((a,b)=>a-b),hi];
 }
}
