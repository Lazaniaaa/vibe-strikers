import type {MapData} from './types';
import {expandedBoxes} from './boxes';
import {Navigation,NAV,type NavNode} from './navigation';
import {ShotTree} from './analysis';
import {insideLane,laneRects} from './lanes';
export const laneSpecs=[
 {id:'MID',color:'#9A8051',via:[{x:-10,y:0,z:0},{x:0,y:0,z:-3.25},{x:10,y:0,z:0}]},
 {id:'LEFT',color:'#B66045',via:[{x:-10,y:0,z:0},{x:-4.5,y:0,z:14.25},{x:0,y:0,z:14.25},{x:4.5,y:0,z:14.25},{x:10,y:0,z:0}]},
 {id:'RIGHT',color:'#47899D',via:[{x:-10,y:0,z:0},{x:0,y:0,z:-18.5},{x:10,y:0,z:0}]},
];
const position=(n:NavNode)=>({x:n.x,y:n.y,z:n.z});
const zoneAt=(x:number,z:number)=>Math.abs(x)<11&&Math.abs(z)<9?'MID':Math.abs(x)<8&&z>12&&z<23?'LEFT':Math.abs(x)<11&&z< -14&&z> -32?'RIGHT':null;
function rayClear(tree:ShotTree,a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz);return d<.02||tree.distance(a.x,a.y,a.z,dx/d,dy/d,dz/d,d)>=d-1e-4;}
export function pathsFor(data:MapData,nav:Navigation){
 const start={x:-28.5,y:0,z:-1},end={x:28.5,y:0,z:-1};return laneSpecs.map(spec=>{const sign=spec.id==='LEFT'?1:-1,via=data.id==='toy-town'?spec.via:[{x:-20,y:0,z:25*sign},{x:0,y:0,z:sign>0?14.25:-18.5},{x:20,y:0,z:25*sign}];const way=spec.id==='MID'?[start,end]:[start,...via,end],points:ReturnType<typeof position>[]= [];let length=0;for(let i=1;i<way.length;i++){const a=nav.nearest(way[i-1],.3),b=nav.nearest(way[i],.3);if(a<0||b<0){length=Infinity;break;}const p=nav.path(a,b);length+=p.length;points.push(...p.points.map(position));}return {id:spec.id,color:spec.color,length,ratio:length/57,seconds:length/4.8,points};});
}
/** Offline tactical audit. Sampling definitions are emitted with the result. */
export function auditMap(data:MapData){
 const nav=new Navigation(data),connected=nav.flood(nav.nearest(data.spawns[0])),boxes=expandedBoxes(data),colliders=boxes.filter(b=>b.collide),tree=new ShotTree(boxes.filter(b=>b.blocksShots));
 const routes=pathsFor(data,nav),samples=nav.nodes.filter((n,i)=>nav.reachable[i]&&n.ix%8===0&&n.iz%8===0),enemyTargets=samples.map(n=>({...position(n),y:n.y+(n.crouch?1.2:1.6)}));
 const north=laneRects(1),south=laneRects(-1),classify=(x:number,z:number)=>data.id==='toy-town'?zoneAt(x,z):Math.abs(x)<11&&Math.abs(z)<9?'MID':insideLane(x,z,north)?'LEFT':insideLane(x,z,south)?'RIGHT':null;
 const heat=new Uint32Array(nav.width*nav.depth),laneUse={MID:0,LEFT:0,RIGHT:0},crossHalfUse={MID:0,LEFT:0,RIGHT:0},sideAreaUse={MID:0,LEFT:0,RIGHT:0},crossHalfSideAreaUse={MID:0,LEFT:0,RIGHT:0};let pairCount=0,crossHalfPairs=0,min=Infinity,max=0;const teamPaths:any[]=[],prefixes=new Map<number,{x:number;y:number;z:number;distance:number}[]>();
 for(let source=0;source<data.spawns.length;source++){
  const start=nav.nearest(data.spawns[source]),search=nav.shortestTree(start);let bestExitPath:NavNode[]=[];let bestExit=Infinity;
  for(let target=0;target<data.spawns.length;target++){if(source===target)continue;pairCount++;const end=nav.nearest(data.spawns[target]),ids:number[]=[];if(!Number.isFinite(search.distance[end]))continue;for(let id=end;id>=0;id=search.previous[id]){ids.push(id);if(id===start)break;}ids.reverse();
   const cells=new Set<number>(),used=new Set<string>(),touched=new Set<string>();for(let k=0;k<ids.length;k++){const n=nav.nodes[ids[k]],zone=zoneAt(n.x,n.z),area=classify(n.x,n.z);if(zone)used.add(zone);if(area)touched.add(area);if(!k){cells.add(n.iz*nav.width+n.ix);continue;}const a=nav.nodes[ids[k-1]],steps=Math.ceil(Math.hypot(n.x-a.x,n.z-a.z)/NAV.cell);for(let step=0;step<=steps;step++){const t=step/steps,ix=Math.floor((a.x+(n.x-a.x)*t+35)/NAV.cell),iz=Math.floor((a.z+(n.z-a.z)*t+35)/NAV.cell);cells.add(iz*nav.width+ix);}}
   for(const cell of cells)heat[cell]++;for(const zone of used)laneUse[zone as keyof typeof laneUse]++;for(const zone of touched)sideAreaUse[zone as keyof typeof sideAreaUse]++;
   const a=data.spawns[source],b=data.spawns[target],cross=a.x*b.x<0;if(cross){crossHalfPairs++;for(const zone of used)crossHalfUse[zone as keyof typeof laneUse]++;for(const zone of touched)crossHalfSideAreaUse[zone as keyof typeof crossHalfSideAreaUse]++;}
   if(a.team==='A'&&b.team==='B'){const length=search.distance[end];teamPaths.push({source,target,length,ratio:length/57});min=Math.min(min,length);max=Math.max(max,length);}
   if(a.team!=='ffa'&&b.team!=='ffa'&&a.team!==b.team){
    const points: {x:number;y:number;z:number;distance:number}[]=[];let distance=0;for(let k=0;k<ids.length;k++){const p=nav.nodes[ids[k]];if(k){const old=nav.nodes[ids[k-1]];distance+=Math.hypot(p.x-old.x,p.z-old.z);}if(distance>14.4)break;points.push({...position(p),distance});}let all=prefixes.get(source);if(!all)prefixes.set(source,all=[]);all.push(...points);
    if(search.distance[end]<bestExit){bestExit=search.distance[end];bestExitPath=ids.map(i=>nav.nodes[i]);}
   }
  }
  {
   const region=[];for(let id=0;id<nav.nodes.length;id++)if(search.distance[id]<=14.4)region.push({...position(nav.nodes[id]),distance:search.distance[id]});prefixes.set(source,region);
  }
  if(data.spawns[source].team==='ffa')bestExitPath=nav.path(start,nav.nearest({x:Math.sign(data.spawns[source].x)*10,y:0,z:0})).points;
  const point=bestExitPath.find((p,i)=>i&&Math.hypot(p.x-data.spawns[source].x,p.z-data.spawns[source].z)>=4);if(point)(data.spawns[source] as any).__auditExit=position(point);
 }
 // Work only with the supplied copy: callers pass mutable audit snapshots.
 const spawnFacing=data.spawns.map((p,i)=>{const target=(p as any).__auditExit;delete(p as any).__auditExit;const forward={x:-Math.sin(p.yaw),z:-Math.cos(p.yaw)},wallDistance=tree.distance(p.x,p.y+1.0,p.z,forward.x,0,forward.z,20);let angle=180;if(target){const dx=target.x-p.x,dz=target.z-p.z;angle=Math.acos(Math.min(1,Math.max(-1,(forward.x*dx+forward.z*dz)/Math.hypot(dx,dz))))*180/Math.PI;}return {index:i,team:p.team,position:{x:p.x,y:p.y,z:p.z},yaw:p.yaw,firstExitLeg:target,angleDegrees:angle,forwardWallDistance:wallDistance,violation:angle>45||wallDistance<3};});
 const spawnTargets=nav.nodes.filter((n,id)=>nav.reachable[id]).map(n=>({x:n.x,y:n.y+(n.crouch?1.2:1.6),z:n.z}));
 const spawnSight=data.spawns.map((p,index)=>{let longest=0,to:any=null,visible=0;const from={x:p.x,y:p.y+1.6,z:p.z};for(const target of spawnTargets){if(target.x*p.x>=0)continue;const d=Math.hypot(target.x-p.x,target.y-from.y,target.z-p.z);if(rayClear(tree,from,target)){visible++;if(d>longest){longest=d;to=target;}}}return {index,team:p.team,from,longest,to,visibleEnemyCells:visible};});
 const midTargets=nav.nodes.filter((n,i)=>nav.reachable[i]&&n.y===0&&Math.abs(n.x)<11&&Math.abs(n.z)<9&&n.ix%4===0&&n.iz%4===0).map(n=>({x:n.x,y:1.6,z:n.z}));
 const plaza=(testTree:ShotTree)=>{let a=0,b=0,both=0,either=0;for(const p of midTargets){const left=rayClear(testTree,{x:-10.5,y:1.6,z:0},p),right=rayClear(testTree,{x:10.5,y:1.6,z:0},p);a+=+left;b+=+right;both+=+(left&&right);either+=+(left||right);}return {samples:midTargets.length,leftPercent:a/midTargets.length*100,rightPercent:b/midTargets.length*100,bothPercent:both/midTargets.length*100,eitherPercent:either/midTargets.length*100};};
 const lowered=boxes.filter(b=>b.blocksShots).map(b=>{if(b.x===0&&b.z===0&&Math.abs(b.w-1.2)<1e-6&&b.h>1.2){const bottom=b.y-b.h/2;return {...b,h:1.4-bottom,y:(1.4+bottom)/2};}return b;});const centre={current:plaza(tree),pillarAt1_4:plaza(new ShotTree(lowered))};
 const candidateIds:number[]=[];for(let id=0;id<nav.nodes.length;id++){const n=nav.nodes[id];if(!nav.reachable[id])continue;const special=n.crouch||(n.y>2.4&&n.y<2.6);if((special&&n.ix%4===0&&n.iz%4===0)||(!special&&n.ix%12===0&&n.iz%12===0))candidateIds.push(id);}
 const campingRanks=candidateIds.map(id=>{const n=nav.nodes[id],eye={x:n.x,y:n.y+(n.crouch?1.2:1.6),z:n.z},body={x:n.x,y:n.y+(n.crouch?.75:1.0),z:n.z};let power=0,exposure=0;for(const target of enemyTargets){if(Math.hypot(n.x-target.x,n.z-target.z)<3)continue;power+=+rayClear(tree,eye,target);exposure+=+rayClear(tree,target,body);}const intended=(n.y>=2.49&&n.y<=2.51)||n.crouch;return {position:position(n),crouch:n.crouch,power,exposure,powerPercent:power/enemyTargets.length*100,exposurePercent:exposure/enemyTargets.length*100,score:power/Math.max(1,exposure),intended,reason:n.crouch?'intentional crouch passage':n.y>=2.49&&n.y<=2.51?'intended raised platform':'ground / cover edge'};});
 const camping=campingRanks.filter(c=>c.power>=12).sort((a,b)=>b.score-a.score||b.power-a.power).slice(0,10),crouchCamping=campingRanks.filter(c=>c.crouch);
 const longLane=enemyTargets.filter(n=>{for(let angle=0;angle<180;angle+=5){const a=angle*Math.PI/180,dx=Math.cos(a),dz=Math.sin(a);if(tree.distance(n.x,n.y,n.z,dx,0,dz,65)>=40)return true;}return false;});
 const balcony=nav.nodes.filter((n,id)=>nav.reachable[id]&&n.y>2.49&&n.y<2.51&&Math.abs(n.z-6)<2&&n.ix%4===0&&n.iz%4===0).map(n=>({x:n.x,y:n.y+1.6,z:n.z})),threats=[...balcony.map(p=>({...p,type:'balcony'})),...longLane.map(p=>({...p,type:'long lane'}))];const earlyThreats:any[]=[];
 for(const [spawn,points]of prefixes){const unique=new Map(points.map(p=>[p.x+','+p.y+','+p.z,p]));for(const p of unique.values())for(const threat of threats){const target={x:p.x,y:p.y+1.6,z:p.z};if(rayClear(tree,threat,target)){earlyThreats.push({spawn,team:data.spawns[spawn].team,time:p.distance/4.8,pathDistance:p.distance,player:position(p),from:threat});break;}}}
 earlyThreats.sort((a,b)=>a.time-b.time);
 const loot=data.lootSpots.map((p,index)=>{const inside=colliders.find(b=>p.x>b.x-b.w/2+1e-5&&p.x<b.x+b.w/2-1e-5&&p.y>b.y-b.h/2+1e-5&&p.y<b.y+b.h/2-1e-5&&p.z>b.z-b.d/2+1e-5&&p.z<b.z+b.d/2-1e-5),id=nav.nearest(p,.3),n=nav.nodes[id],onWalkable=!!n&&nav.reachable[id]&&Math.hypot(n.x-p.x,n.z-p.z)<=.3&&p.y-n.y>=-.02&&p.y-n.y<=.12;return {index,position:p,inside:inside?{kind:inside.kind,x:inside.x,y:inside.y,z:inside.z}:null,onWalkable,violation:!!inside||!onWalkable};});
 const passages:any[]=[];let sealedCrevices=0;const bounds=nav.spatial.boxes.filter(b=>b.maxY>=.5&&b.minY<1.8&&b.kind!=='floor'&&b.kind!=='stair');
 for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++)for(const axis of ['x','z'] as const){const a=bounds[i],b=bounds[j],other=axis==='x'?'z':'x',min=axis==='x'?'minX':'minZ',max=axis==='x'?'maxX':'maxZ',omin=other==='x'?'minX':'minZ',omax=other==='x'?'maxX':'maxZ';let left=a,right=b;if(left[min]>right[min])[left,right]=[right,left];const width=right[min]-left[max],lo=Math.max(a[omin],b[omin]),hi=Math.min(a[omax],b[omax]);if(width<=.05||width>=3-1e-6||hi-lo<.8)continue;const x=axis==='x'?(left[max]+right[min])/2:(lo+hi)/2,z=axis==='z'?(left[max]+right[min])/2:(lo+hi)/2,id=nav.nearest({x,y:0,z},.3),n=nav.nodes[id];if(!n||Math.abs(n.y)>.05||Math.hypot(n.x-x,n.z-z)>.35||!nav.reachable[id]){sealedCrevices++;continue;}let height=Infinity;for(const roof of colliders)if(Math.abs(x-roof.x)<=roof.w/2&&Math.abs(z-roof.z)<=roof.d/2&&roof.y-roof.h/2>.1)height=Math.min(height,roof.y-roof.h/2);passages.push({axis,width,height:Number.isFinite(height)?height:null,position:{x,z},length:hi-lo,kindA:a.kind,kindB:b.kind,boxA:{x:a.x,y:a.y,z:a.z,w:a.w,h:a.h,d:a.d},boxB:{x:b.x,y:b.y,z:b.z,w:b.w,h:b.h,d:b.d},intentionalCrouch:Math.abs(x)<1.5&&Math.abs(z+16.5)<1.6,violation:width<2.6-1e-6||(height<3&&!(Math.abs(x)<1.5&&Math.abs(z+16.5)<1.6))});}
 const doors=[];
 for(const lintel of colliders){const height=lintel.y-lintel.h/2;if(lintel.kind!=='wall'||height<3||Math.min(lintel.w,lintel.d)>.81||Math.max(lintel.w,lintel.d)<2.6||Math.max(lintel.w,lintel.d)>4)continue;
  if(!nav.spatial.clear(lintel.x,0,lintel.z))continue;
  const axis=lintel.w>lintel.d?'x':'z',other=axis==='x'?'z':'x',size=axis==='x'?'w':'d',otherSize=other==='x'?'w':'d';let left=-Infinity,right=Infinity;
  for(const b of colliders){if(b.y-b.h/2>.05||b.y+b.h/2<2||Math.abs(b[other]-lintel[other])>b[otherSize]/2)continue;const lo=b[axis]-b[size]/2,hi=b[axis]+b[size]/2;if(hi<=lintel[axis])left=Math.max(left,hi);if(lo>=lintel[axis])right=Math.min(right,lo);}
  const width=right-left;if(!Number.isFinite(width)||width>Math.max(lintel.w,lintel.d)+.6)continue;const door={axis,width,height,position:{x:lintel.x,z:lintel.z},length:Math.min(lintel.w,lintel.d),kindA:'door frame',kindB:'door frame',intentionalCrouch:false,violation:width<2.6-1e-6||height<3};doors.push(door);if(width<3)passages.push(door);
 }
 passages.push({axis:'x',width:3,height:1.302,position:{x:0,z:-16.5},length:3,kindA:'crouch passage',kindB:'crouch passage',intentionalCrouch:true,violation:false});
 const dedup=new Map<string,any>();for(const p of passages.sort((a,b)=>a.width-b.width)){const key=p.axis+','+Math.round(p.position.x)+','+Math.round(p.position.z);if(!dedup.has(key))dedup.set(key,p);}
 const heatCells=[];for(let i=0;i<heat.length;i++)if(heat[i])heatCells.push({ix:i%nav.width,iz:Math.floor(i/nav.width),count:heat[i]});
 const walkable=new Uint8Array(nav.width*nav.depth);for(let id=0;id<nav.nodes.length;id++)if(nav.reachable[id]){const n=nav.nodes[id];walkable[n.iz*nav.width+n.ix]=1;}
 const walkableRows=[];for(let iz=0;iz<nav.depth;iz++){const runs=[];let start=-1;for(let ix=0;ix<=nav.width;ix++){const open=ix<nav.width&&walkable[iz*nav.width+ix];if(open&&start<0)start=ix;if(!open&&start>=0){runs.push(start,ix);start=-1;}}if(runs.length)walkableRows.push({iz,runs});}
 return {id:data.id,method:{navCell:.25,visibilityTargets:enemyTargets.length,targetSpacing:2,spawnTargetSpacing:.25,campingCandidateSpacing:3,campingPower:'eye → enemy eye',campingExposure:'enemy eye → torso',earlyWalkSpeed:4.8,earlyWalkDistance:14.4,earlyRegion:'ALL nav nodes at Dijkstra distance <=14.4m, not just chosen paths; balcony sources1m, long-lane sources2m',heatPairs:'ordered pairs of all 28 team + FFA spawns'},connected,routes,teamPaths,shortest:{length:min,ratio:min/57,seconds:min/4.8},longestShortest:{length:max,ratio:max/57,seconds:max/4.8},centre,spawnSight,earlySafety:{threatCells:threats.length,balconySources:balcony.length,longLaneSources:longLane.length,failures:earlyThreats.length,worst:earlyThreats[0]??null,bySpawn:[...prefixes.keys()].map(spawn=>({spawn,regionCells:prefixes.get(spawn)!.length,failures:earlyThreats.filter(t=>t.spawn===spawn).length,first:earlyThreats.find(t=>t.spawn===spawn)??null}))},camping,crouchCamping,chokes:{doors,passages:[...dedup.values()],sealedCrevices,violations:[...dedup.values()].filter(p=>p.violation)},loot,spawnFacing,heatmap:{width:nav.width,depth:nav.depth,cell:.25,pairCount,crossHalfPairs,laneUse,crossHalfUse,sideAreaUse,crossHalfSideAreaUse,max:Math.max(...heat),walkableRows,cells:heatCells}};
}



