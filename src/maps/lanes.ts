import type {Navigation} from './navigation';
import type {ShotTree} from './analysis';
import type {MapBox} from './types';
type Rect={x0:number;x1:number;z0:number;z1:number};
/** Side-lane domain excludes the approved plaza/house/stairs and spawn rooms.
 * A sightline ends on entering that domain; the full-map LOS is reported too.
 * No occluders are added to the ray tree for this measurement.
 */
export function laneRects(sign:number):Rect[]{return [
 {x0:-23.3,x1:-11.6,z0:0,z1:33.25},{x0:11.6,x1:23.3,z0:0,z1:33.25},
 {x0:-33.25,x1:-23.3,z0:9.1,z1:33.25},{x0:23.3,x1:33.25,z0:9.1,z1:33.25},
 {x0:-11.6,x1:11.6,z0:sign>0?23.5:18.2,z1:33.25},
 ].map(r=>sign>0?r:{...r,z0:-r.z1,z1:-r.z0});}
export function insideLane(x:number,z:number,rects:Rect[]){return rects.some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1);}
function exitDistance(x:number,z:number,dx:number,dz:number,rects:Rect[]){
 const ranges:number[][]=[];
 for(const r of rects){let lo=0,hi=100;for(const [p,d,a,b]of [[x,dx,r.x0,r.x1],[z,dz,r.z0,r.z1]]){if(Math.abs(d)<1e-9){if(p<a||p>b){hi=-1;break;}}else{const t0=(a-p)/d,t1=(b-p)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}}if(hi>=lo)ranges.push([lo,hi]);}
 ranges.sort((a,b)=>a[0]-b[0]);let end=0;for(const [lo,hi]of ranges){if(lo>end+1e-6)break;end=Math.max(end,hi);}return end;
}
export function laneVisibility(nav:Navigation,tree:ShotTree,spacing=2,angleStep=1){
 return [1,-1].map(sign=>{const rects=laneRects(sign);let longest=0,worst:any=null,rays=0,origins=0;
  for(let id=0;id<nav.nodes.length;id++){const n=nav.nodes[id];if(!nav.reachable[id]||n.ix%spacing||n.iz%spacing||!insideLane(n.x,n.z,rects))continue;origins++;const y=n.y+(n.crouch?1.2:1.6);
   for(let a=0;a<360;a+=angleStep){const dx=Math.cos(a*Math.PI/180),dz=Math.sin(a*Math.PI/180),limit=exitDistance(n.x,n.z,dx,dz,rects),d=tree.distance(n.x,y,n.z,dx,0,dz,limit);rays++;if(d>longest){longest=d;worst={from:{x:n.x,y,z:n.z},to:{x:n.x+dx*d,y,z:n.z+dz*d},angle:a};}}
  }return {id:sign>0?'LEFT':'RIGHT',longest,origins,rays,originSpacing:spacing*.25,angleStep,domain:rects,worst};});
}
/** Offline cover cadence along tested routes. A corner or low cover is useful
 * when it can be reached within 1.5m. Report both the exposed run and the full
 * conservative spacing (run + both 1.5m approach zones).
 */
export function coverCadence(boxes:MapBox[],paths:{points:{x:number;y:number;z:number}[]}[]){
 const low=boxes.filter(b=>b.collide&&b.y-b.h/2<.1&&b.y+b.h/2>=.9&&b.y+b.h/2<=2.5),corners=boxes.filter(b=>b.collide&&b.kind!=='floor'&&b.y-b.h/2<.1&&b.y+b.h/2>=3).flatMap(b=>[-1,1].flatMap(s=>[-1,1].map(t=>({x:b.x+s*b.w/2,z:b.z+t*b.d/2}))));
 return [1,-1].map(sign=>{const rects=laneRects(sign);let longest=0,worst:any=null;
  for(const path of paths){let run=0,from:any=null,last:any=null;for(const p of path.points){if(!insideLane(p.x,p.z,rects)){run=0;last=null;continue;}const close=low.some(b=>Math.hypot(Math.max(Math.abs(p.x-b.x)-b.w/2,0),Math.max(Math.abs(p.z-b.z)-b.d/2,0))<=1.5)||corners.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<=1.5);if(close){run=0;from=p;}else if(last){run+=Math.hypot(p.x-last.x,p.z-last.z);if(run>longest){longest=run;worst={from:from??last,to:p};}}last=p;}}
  return {id:sign>0?'LEFT':'RIGHT',approachRadius:1.5,longestExposedRun:longest,conservativeSpacing:longest+3,worst};});
}
