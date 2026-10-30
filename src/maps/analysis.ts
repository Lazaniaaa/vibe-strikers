import type { MapBox } from './types';
import type { Navigation } from './navigation';
type AABB={lo:number[];hi:number[];items?:AABB[];left?:AABB;right?:AABB;id?:number};
const bounds=(b:MapBox,id:number):AABB=>({lo:[b.x-b.w/2,b.y-b.h/2,b.z-b.d/2],hi:[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2],id});
/** Precise slab intersections against a static bounds hierarchy; used only during validation. */
export class ShotTree {
 root:AABB;
 constructor(boxes:readonly MapBox[]){
  const build=(items:AABB[]):AABB=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const b of items)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],b.lo[a]);hi[a]=Math.max(hi[a],b.hi[a]);}const n:AABB={lo,hi};
   if(items.length<=6)n.items=items;else{let a=0;for(let j=1;j<3;j++)if(hi[j]-lo[j]>hi[a]-lo[a])a=j;items.sort((x,y)=>x.lo[a]+x.hi[a]-y.lo[a]-y.hi[a]);const mid=items.length>>1;n.left=build(items.slice(0,mid));n.right=build(items.slice(mid));}return n;};
  this.root=build(boxes.map(bounds));
 }
 distance(x:number,y:number,z:number,dx:number,dy:number,dz:number,limit=100):number{
  const origin=[x,y,z],dir=[dx,dy,dz];let best=limit;
  const entry=(b:AABB)=>{let near=0,far=best;for(let a=0;a<3;a++){if(Math.abs(dir[a])<1e-10){if(origin[a]<b.lo[a]||origin[a]>b.hi[a])return Infinity;}else{let t0=(b.lo[a]-origin[a])/dir[a],t1=(b.hi[a]-origin[a])/dir[a];if(t0>t1)[t0,t1]=[t1,t0];near=Math.max(near,t0);far=Math.min(far,t1);if(near>far)return Infinity;}}return near;};
  const visit=(b:AABB)=>{if(entry(b)>=best)return;if(b.items){for(const c of b.items)best=Math.min(best,entry(c));}else{visit(b.left!);visit(b.right!);}};visit(this.root);return best;
 }
}
export function coplanarFaces(boxes:readonly MapBox[]){
 const list=boxes.map(bounds),fail:{a:number;b:number;axis:number;plane:number;area:number}[]=[];
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)for(let axis=0;axis<3;axis++){
  const a=list[i],b=list[j],u=(axis+1)%3,v=(axis+2)%3,overU=Math.min(a.hi[u],b.hi[u])-Math.max(a.lo[u],b.lo[u]),overV=Math.min(a.hi[v],b.hi[v])-Math.max(a.lo[v],b.lo[v]);if(overU<=1e-7||overV<=1e-7)continue;
  for(const p of [a.lo[axis],a.hi[axis]])if(Math.abs(p-b.lo[axis])<1e-7||Math.abs(p-b.hi[axis])<1e-7)fail.push({a:i,b:j,axis,plane:p,area:overU*overV});
 }return fail;
}
export function scanVisibility(nav:Navigation,tree:ShotTree){
 let longest=0,worst:any=null,rays=0,origins=0;const directions=Array.from({length:360},(_,i)=>[Math.cos(i*Math.PI/180),Math.sin(i*Math.PI/180)]);
 for(let id=0;id<nav.nodes.length;id++){const n=nav.nodes[id];if(!nav.reachable[id]||n.ix%2!==0||n.iz%2!==0)continue;origins++;const y=n.y+(n.crouch?1.2:1.6);
  for(const [dx,dz]of directions){const distance=tree.distance(n.x,y,n.z,dx,0,dz,100);rays++;if(distance>longest){longest=distance;worst={from:{x:n.x,y,z:n.z},to:{x:n.x+dx*distance,y,z:n.z+dz*distance},angleDegrees:Math.atan2(dz,dx)*180/Math.PI};}}
 }return {longest,rays,origins,originSpacing:.5,angleStepDegrees:1,worst};
}
