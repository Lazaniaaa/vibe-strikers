import type { MapBox,MapData } from './types';
import { expandedBoxes } from './boxes';
/** Validation/preview analysis only. The game owns its controller and Rapier world. */
export const NAV={cell:.25,radius:.5,height:1.8,crouchHeight:1.2,step:.30,jump:1.2,speed:4.8};
export interface BoundsBox extends MapBox {minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}
export interface NavNode {x:number;y:number;z:number;ix:number;iz:number;crouch:boolean}
export class SpatialBoxes {
 boxes:BoundsBox[];bins=new Map<string,BoundsBox[]>();
 constructor(boxes:readonly MapBox[]){
  this.boxes=boxes.map(b=>({...b,minX:b.x-b.w/2,maxX:b.x+b.w/2,minY:b.y-b.h/2,maxY:b.y+b.h/2,minZ:b.z-b.d/2,maxZ:b.z+b.d/2}));
  for(const b of this.boxes)for(let x=Math.floor((b.minX-1.25)/4);x<=Math.floor((b.maxX+1.25)/4);x++)for(let z=Math.floor((b.minZ-1.25)/4);z<=Math.floor((b.maxZ+1.25)/4);z++){
   const key=x+','+z;let bin=this.bins.get(key);if(!bin)this.bins.set(key,bin=[]);bin.push(b);
  }
 }
 near(x:number,z:number):readonly BoundsBox[]{return this.bins.get(Math.floor(x/4)+','+Math.floor(z/4))??[];}
 clear(x:number,y:number,z:number,height=NAV.height,radius=NAV.radius,stairs=true):boolean{
  for(const b of this.near(x,z)){
   if(b.maxY<=y+.012)continue;
   if(stairs&&b.kind==='stair'&&b.maxY<=y+NAV.step+1e-6)continue;
   const dx=Math.max(b.minX-x,0,x-b.maxX),dz=Math.max(b.minZ-z,0,z-b.maxZ);
   const dy=Math.max(b.minY-(y+height-radius),0,y+radius-b.maxY);
   if(dx*dx+dy*dy+dz*dz<radius*radius-1e-7)return false;
  }return true;
 }
 cylinderClear(x:number,y:number,z:number,radius:number,height:number):boolean{
  return !this.near(x,z).some(b=>b.maxY>y+.012&&b.minY<y+height&&Math.hypot(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minZ-z,0,z-b.maxZ))<radius-1e-7);
 }
}
class Heap {
 a:{id:number;cost:number}[]=[];
 push(id:number,cost:number){const a=this.a;let i=a.length;a.push({id,cost});while(i){const parent=(i-1)>>1;if(a[parent].cost<=cost)break;a[i]=a[parent];i=parent;}a[i]={id,cost};}
 pop(){const a=this.a,first=a[0],last=a.pop()!;if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&a[child+1].cost<a[child].cost)child++;if(a[child].cost>=last.cost)break;a[i]=a[child];i=child;}a[i]=last;}return first;}
}
export class Navigation {
 spatial:SpatialBoxes;nodes:NavNode[]=[];cells:number[][];width:number;depth:number;edges:(number[]|undefined)[]=[];reachable:Uint8Array;
 constructor(public data:MapData){
  const colliders=expandedBoxes(data).filter(b=>b.collide);this.spatial=new SpatialBoxes(colliders);
  this.width=Math.round(data.bounds.x*2/NAV.cell);this.depth=Math.round(data.bounds.z*2/NAV.cell);this.cells=Array.from({length:this.width*this.depth},()=>[]);
  for(let iz=0;iz<this.depth;iz++)for(let ix=0;ix<this.width;ix++){
   const x=-data.bounds.x+(ix+.5)*NAV.cell,z=-data.bounds.z+(iz+.5)*NAV.cell,tops=new Set<number>();
   for(const b of this.spatial.near(x,z))if((b.kind==='floor'||b.kind==='stair'||b.kind==='prop')&&x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ)tops.add(Math.round(b.maxY*1e5)/1e5);
   for(const y of [...tops].sort((a,b)=>a-b)){
    const stand=this.spatial.clear(x,y,z);if(!stand&&!this.spatial.clear(x,y,z,NAV.crouchHeight))continue;
    const id=this.nodes.length;this.nodes.push({x,y,z,ix,iz,crouch:!stand});this.cells[iz*this.width+ix].push(id);
   }
  }
  this.reachable=new Uint8Array(this.nodes.length);
 }
 at(ix:number,iz:number):readonly number[]{return ix>=0&&iz>=0&&ix<this.width&&iz<this.depth?this.cells[iz*this.width+ix]:[];}
 nearest(p:{x:number;y?:number;z:number},radius=3):number{
  const ix=Math.floor((p.x+this.data.bounds.x)/NAV.cell),iz=Math.floor((p.z+this.data.bounds.z)/NAV.cell),range=Math.ceil(radius/NAV.cell);let best=-1,score=Infinity;
  for(let dz=-range;dz<=range;dz++)for(let dx=-range;dx<=range;dx++)for(const id of this.at(ix+dx,iz+dz)){
   const n=this.nodes[id],d=(n.x-p.x)**2+(n.z-p.z)**2+2*(n.y-(p.y??0))**2;if(d<score){score=d;best=id;}
  }return score<=radius*radius*2?best:-1;
 }
 adjacent(id:number):number[]{
  let hit=this.edges[id];if(hit)return hit;const a=this.nodes[id],list:number[]=[],dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  let count=0;
  for(const [dx,dz]of dirs)for(const next of this.at(a.ix+dx,a.iz+dz)){
   const b=this.nodes[next],dy=b.y-a.y;if(Math.abs(dy)>NAV.step+1e-5)continue;
   if(this.spatial.clear((a.x+b.x)/2,Math.max(a.y,b.y),(a.z+b.z)/2,a.crouch||b.crouch?NAV.crouchHeight:NAV.height)){list.push(next);count++;}
  }
  if(count<8){
   for(const [dx,dz]of dirs)for(let k=2;k<=8;k++)for(const next of this.at(a.ix+dx*k,a.iz+dz*k)){
    const b=this.nodes[next],dy=b.y-a.y;if(dy>NAV.jump+1e-5||dy< -3)continue;
    if(Math.abs(dy)<=NAV.step&&k>3)continue;
    const apex=Math.max(a.y,b.y)+Math.min(.55,NAV.jump-Math.max(0,dy)),height=a.crouch||b.crouch?NAV.crouchHeight:NAV.height;
    let clear=true;for(let sample=1;sample<8;sample++){const t=sample/8,y=t<.5?a.y+(apex-a.y)*t*2:apex+(b.y-apex)*(t-.5)*2;
     if(!this.spatial.clear(a.x+(b.x-a.x)*t,y,a.z+(b.z-a.z)*t,height)){clear=false;break;}
    }if(clear)list.push(next);
   }
  }
  this.edges[id]=list;return list;
 }
 flood(start:number):{connected:number;total:number;ratio:number}{
  if(start<0)throw new Error('No navigable spawn cell');const queue=new Uint32Array(this.nodes.length);let head=0,tail=1;queue[0]=start;this.reachable.fill(0);this.reachable[start]=1;
  while(head<tail){const id=queue[head++];for(const next of this.adjacent(id))if(!this.reachable[next]){this.reachable[next]=1;queue[tail++]=next;}}
  return {connected:tail,total:this.nodes.length,ratio:tail/this.nodes.length};
 }
 /** Offline all-pairs audit: one Dijkstra tree per spawn, rather than one search per pair. */
 shortestTree(start:number){
  const distance=new Float64Array(this.nodes.length);distance.fill(Infinity);const previous=new Int32Array(this.nodes.length);previous.fill(-1);const heap=new Heap();distance[start]=0;heap.push(start,0);
  while(heap.a.length){const {id,cost}=heap.pop();if(cost>distance[id]+1e-8)continue;const a=this.nodes[id];for(const next of this.adjacent(id)){const b=this.nodes[next],d=cost+Math.hypot(b.x-a.x,b.z-a.z);if(d+1e-8<distance[next]){distance[next]=d;previous[next]=id;heap.push(next,d);}}}
  return {distance,previous};
 }
 path(start:number,end:number):{length:number;points:NavNode[]}{
  if(start<0||end<0)return {length:Infinity,points:[]};const distance=new Float64Array(this.nodes.length);distance.fill(Infinity);const previous=new Int32Array(this.nodes.length);previous.fill(-1);const heap=new Heap();distance[start]=0;
  const target=this.nodes[end];heap.push(start,Math.hypot(target.x-this.nodes[start].x,target.z-this.nodes[start].z));
  while(heap.a.length){const {id,cost}=heap.pop();const a=this.nodes[id];if(cost>distance[id]+Math.hypot(target.x-a.x,target.z-a.z)+1e-8)continue;if(id===end)break;
   for(const next of this.adjacent(id)){const b=this.nodes[next],d=distance[id]+Math.hypot(b.x-a.x,b.z-a.z);if(d+1e-8<distance[next]){distance[next]=d;previous[next]=id;heap.push(next,d+Math.hypot(target.x-b.x,target.z-b.z));}}
  }
  if(!Number.isFinite(distance[end]))return {length:Infinity,points:[]};const points:NavNode[]=[];for(let i=end;i>=0;i=previous[i]){points.push(this.nodes[i]);if(i===start)break;}points.reverse();return {length:distance[end],points};
 }
}
