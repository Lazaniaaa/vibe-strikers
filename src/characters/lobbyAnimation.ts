import type { Group } from 'three';
import type { CharacterRuntime, Extent } from './types';
import { restoreReferencePose } from './poseCharacter';
import { LOBBY_ANIMATION as C, LOBBY_EMOTES, type LobbyEmoteId } from './lobbyEmotes';

interface Bounds { minX:number;minY:number;minZ:number;maxX:number;maxY:number;maxZ:number }
interface LobbyAnimation {
  time:number;phase:number;emote:LobbyEmoteId|null;emoteTime:number;duration:number;transition:number;
  rollL:number;rollR:number;maxShoulderOffset:number;
  previous:Float64Array;joints:readonly Group[];
  head:Bounds;torso:Bounds;upper:Bounds;hand:Bounds;foot:Bounds;
  satMatrix:readonly number[];dx:number;dy:number;dz:number;hx:number;hy:number;hz:number;
  bx:number;by:number;bz:number;satGap:number;satShift:number;satSide:number;
}
type LobbyRuntime=CharacterRuntime & { lobbyAnimation?:LobbyAnimation };
const bounds=():Bounds=>({minX:0,minY:0,minZ:0,maxX:0,maxY:0,maxZ:0});
const smooth=(v:number)=>{const x=Math.max(0,Math.min(1,v));return x*x*(3-2*x);};

/** Transform a cached local AABB through an existing part matrix, using scalar scratch only. */
function transformed(out:Bounds,b:Extent,part:Group,rx=0,ry=0,rz=0):void {
  part.updateMatrix();const m=part.matrix.elements;
  const x=(b.min[0]+b.max[0])/2-rx,y=(b.min[1]+b.max[1])/2-ry,z=(b.min[2]+b.max[2])/2-rz;
  const hx=(b.max[0]-b.min[0])/2,hy=(b.max[1]-b.min[1])/2,hz=(b.max[2]-b.min[2])/2;
  const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cz=m[2]*x+m[6]*y+m[10]*z+m[14];
  const ex=Math.abs(m[0])*hx+Math.abs(m[4])*hy+Math.abs(m[8])*hz;
  const ey=Math.abs(m[1])*hx+Math.abs(m[5])*hy+Math.abs(m[9])*hz;
  const ez=Math.abs(m[2])*hx+Math.abs(m[6])*hy+Math.abs(m[10])*hz;
  out.minX=cx-ex;out.maxX=cx+ex;out.minY=cy-ey;out.maxY=cy+ey;out.minZ=cz-ez;out.maxZ=cz+ez;
}
function satAxis(s:LobbyAnimation,x:number,y:number,z:number):void {
  const length=Math.sqrt(x*x+y*y+z*z);if(length<C.axisEpsilon)return;
  const m=s.satMatrix,d=s.dx*x+s.dy*y+s.dz*z;
  const radius=s.bx*Math.abs(x)+s.by*Math.abs(y)+s.bz*Math.abs(z)+
    s.hx*Math.abs(m[0]*x+m[1]*y+m[2]*z)+s.hy*Math.abs(m[4]*x+m[5]*y+m[6]*z)+s.hz*Math.abs(m[8]*x+m[9]*y+m[10]*z);
  s.satGap=Math.max(s.satGap,(Math.abs(d)-radius)/length);
  if(Math.abs(x)>C.axisEpsilon){
    const direction=s.satSide*x;
    s.satShift=Math.min(s.satShift,Math.max(0,(radius-(direction>0?d:-d))/Math.abs(x)));
  }
}
/** OBB versus body AABB: 15 fixed separating axes, not an orientation search. */
function outward(s:LobbyAnimation,box:Extent,part:Group,body:Bounds,side:number):number {
  const m=part.matrix.elements,x=(box.min[0]+box.max[0])/2,y=(box.min[1]+box.max[1])/2,z=(box.min[2]+box.max[2])/2;
  s.satMatrix=m;s.dx=m[0]*x+m[4]*y+m[8]*z+m[12]-(body.minX+body.maxX)/2;
  s.dy=m[1]*x+m[5]*y+m[9]*z+m[13]-(body.minY+body.maxY)/2;
  s.dz=m[2]*x+m[6]*y+m[10]*z+m[14]-(body.minZ+body.maxZ)/2;
  s.hx=(box.max[0]-box.min[0])/2;s.hy=(box.max[1]-box.min[1])/2;s.hz=(box.max[2]-box.min[2])/2;
  s.bx=(body.maxX-body.minX)/2+C.clearance;s.by=(body.maxY-body.minY)/2+C.clearance;s.bz=(body.maxZ-body.minZ)/2+C.clearance;
  s.satGap=-Infinity;s.satShift=Infinity;s.satSide=side;
  satAxis(s,1,0,0);satAxis(s,0,1,0);satAxis(s,0,0,1);
  if(s.satGap>0)return 0;
  for(let i=0;i<3;i++){const a=i*4,ax=m[a],ay=m[a+1],az=m[a+2];
    satAxis(s,ax,ay,az);satAxis(s,0,-az,ay);satAxis(s,az,0,-ax);satAxis(s,-ay,ax,0);
  }
  return s.satGap>0?0:s.satShift;
}
function clearArm(d:LobbyRuntime,s:LobbyAnimation,left:boolean):void {
  const part=left?d.armL:d.armR,side=left?-1:1;
  const upper=left?d.armVariants.variantsL[0].upper:d.armVariants.variantsR[0].upper;
  const hand=left?d.dimensions.handL:d.dimensions.handR;
  transformed(s.upper,upper,part);transformed(s.hand,hand,part);
  const rise=Math.max(0,C.floorMargin-s.hand.minY);part.position.y+=rise;
  s.upper.minY+=rise;s.upper.maxY+=rise;s.hand.minY+=rise;s.hand.maxY+=rise;
  part.updateMatrix();
  const offset=Math.max(outward(s,upper,part,s.head,side),outward(s,hand,part,s.head,side),outward(s,upper,part,s.torso,side),outward(s,hand,part,s.torso,side));
  // A direct separating translation, never an orientation search. Keeps the original fused hand/arm intact.
  part.position.x+=side*offset;
  s.maxShoulderOffset=Math.max(s.maxShoulderOffset,offset);
}
function plant(d:LobbyRuntime,s:LobbyAnimation,left:boolean,lift:number):void {
  const part=left?d.legL:d.legR,foot=left?d.dimensions.footL:d.dimensions.footR;
  transformed(s.foot,foot,part);part.position.y+=lift-s.foot.minY;
}
function capture(s:LobbyAnimation):void {
  let k=0;for(let i=0;i<s.joints.length;i++){const p=s.joints[i];s.previous[k++]=p.position.x;s.previous[k++]=p.position.y;s.previous[k++]=p.position.z;
    s.previous[k++]=p.rotation.x;s.previous[k++]=p.rotation.y;s.previous[k++]=p.rotation.z;s.previous[k++]=p.scale.x;s.previous[k++]=p.scale.y;s.previous[k++]=p.scale.z;}
}
function crossfade(s:LobbyAnimation,weight:number):void {
  let k=0;for(let i=0;i<s.joints.length;i++){const p=s.joints[i],a=s.previous;
    p.position.set(a[k]+(p.position.x-a[k])*weight,a[k+1]+(p.position.y-a[k+1])*weight,a[k+2]+(p.position.z-a[k+2])*weight);k+=3;
    p.rotation.set(a[k]+(p.rotation.x-a[k])*weight,a[k+1]+(p.rotation.y-a[k+1])*weight,a[k+2]+(p.rotation.z-a[k+2])*weight);k+=3;
    p.scale.set(a[k]+(p.scale.x-a[k])*weight,a[k+1]+(p.scale.y-a[k+1])*weight,a[k+2]+(p.scale.z-a[k+2])*weight);k+=3;}
}

/** Call at construction/selection time. Only this setup allocates; clocks and scratch belong to the character. */
export function prepareLobbyAnimation(group:Group):void {
  const d=group.userData as LobbyRuntime;if(d.lobbyAnimation)return;
  restoreReferencePose(group);
  let seed=C.seedOffset as number;for(let i=0;i<d.characterId.length;i++)seed=Math.imul(seed^d.characterId.charCodeAt(i),C.seedPrime);
  const s:LobbyAnimation={time:0,phase:(seed>>>0)/C.seedRange*C.tau,emote:null,emoteTime:0,duration:0,transition:C.blend,
    rollL:C.relaxedRoll,rollR:C.relaxedRoll,maxShoulderOffset:0,previous:new Float64Array(63),
    joints:[d.rig,d.head,d.torso,d.armL,d.armR,d.legL,d.legR],head:bounds(),torso:bounds(),upper:bounds(),hand:bounds(),foot:bounds(),
    satMatrix:d.armL.matrix.elements,dx:0,dy:0,dz:0,hx:0,hy:0,hz:0,bx:0,by:0,bz:0,satGap:0,satShift:0,satSide:1};
  d.lobbyAnimation=s;
  // Only the three lowest-hanging silhouettes need a wider relaxed opening. Solve this once, not per frame.
  for(let side=0;side<2;side++){
    const part=side?d.armR:d.armL,hand=side?d.dimensions.handR:d.dimensions.handL;let angle=C.relaxedRoll as number;
    while(angle<C.maximumRelaxedRoll){part.rotation.set(C.relaxedPitch-C.armSway,0,(side?1:-1)*(angle-C.armSway));transformed(s.hand,hand,part);if(s.hand.minY>=C.floorMargin)break;angle+=C.minimumRollStep;}
    if(side)s.rollR=angle;else s.rollL=angle;
  }
  updateAnimation(group,0);
}

/** A clip request only. It creates no geometry and does not start a timer or render loop. */
export function playEmote(group:Group,id:LobbyEmoteId):void {
  const d=group.userData as LobbyRuntime;prepareLobbyAnimation(group);const s=d.lobbyAnimation!;
  const clip=LOBBY_EMOTES.find(e=>e.id===id);if(!clip)throw new Error('Unknown lobby emote: '+id);
  capture(s);s.emote=id;s.emoteTime=0;s.duration=clip.duration;s.transition=0;
}

/** Lobby-only update. No firearm solver, hidden timer, outer transform change, vertex writes or frame allocations. */
export function updateAnimation(group:Group,dt:number):void {
  const d=group.userData as LobbyRuntime,s=d.lobbyAnimation;if(!s)return;
  const delta=Number.isFinite(dt)?Math.max(0,Math.min(C.maxDelta,dt)):0;s.time+=delta;s.emoteTime+=delta;s.transition+=delta;
  const p=s.time*C.tau/C.idlePeriod+s.phase,breath=Math.sin(p),weight=Math.sin(p/2)*C.weightShift;
  const gate=Math.max(0,Math.sin(s.time*C.tau/C.glanceGatePeriod+s.phase));
  const glance=Math.sin(s.time*C.tau/C.glancePeriod+s.phase)*gate*gate*gate*gate;
  const e=s.emote&&s.emoteTime<s.duration?smooth(s.emoteTime/C.blend)*smooth((s.duration-s.emoteTime)/C.blend):0;
  const t=s.duration?s.emoteTime/s.duration:0;
  restoreReferencePose(group);
  d.torso.position.x+=weight;d.head.position.x+=weight;d.armL.position.x+=weight;d.armR.position.x+=weight;
  const bob=breath*C.breathing;
  d.head.position.y+=bob;d.torso.position.y+=bob;d.armL.position.y+=bob;d.armR.position.y+=bob;
  d.torso.scale.y=1+breath*C.breathingScale;d.torso.rotation.x=breath*C.torsoPitch;
  d.head.rotation.set(breath*C.headPitch,glance*C.headYaw,0);
  let l=s.rollL+Math.sin(p)*C.armSway,r=s.rollR-Math.sin(p)*C.armSway;
  let lx=C.relaxedPitch+Math.sin(p)*C.armSway,rx=C.relaxedPitch-Math.sin(p)*C.armSway,footL=0,footR=0;
  if(s.emote==='wave'){
    r+=(C.waveRoll+Math.sin(t*C.tau*C.waveCycles)*C.waveSway-r)*e;
    rx+=Math.sin(t*C.tau*C.waveCycles)*C.wavePitch*e;d.head.rotation.z=-e*C.headPitch;
  }else if(s.emote==='cheer'){
    const raised=C.cheerRoll+Math.sin(t*C.tau*C.cheerCycles)*C.cheerSway;
    l+=(raised-l)*e;r+=(raised-r)*e;d.rig.position.y=Math.abs(Math.sin(t*C.tau))*C.cheerBounce*e;
  }else if(s.emote==='dance'){
    const step=Math.sin(t*C.tau*C.danceCycles);
    l+=C.danceRoll*e;r+=C.danceRoll*e;lx+=step*C.dancePitch*e;rx-=step*C.dancePitch*e;
    d.rig.rotation.y=step*C.danceYaw*e;d.torso.position.x+=step*C.danceShift*e;d.head.position.x+=step*C.danceShift*e;
    d.armL.position.x+=step*C.danceShift*e;d.armR.position.x+=step*C.danceShift*e;
    d.legL.rotation.set(step*C.danceLegPitch*e,0,-step*C.danceLegRoll*e);d.legR.rotation.set(-step*C.danceLegPitch*e,0,-step*C.danceLegRoll*e);
    footL=Math.max(0,step)*C.danceFootLift*e;footR=Math.max(0,-step)*C.danceFootLift*e;
  }else if(s.emote==='shrug'){
    l+=C.shrugRoll*e;r+=C.shrugRoll*e;d.armL.position.y+=C.shrugLift*e;d.armR.position.y+=C.shrugLift*e;d.head.rotation.z=C.shrugHead*e;
  }else if(s.emote==='hop'){
    d.rig.position.y=Math.max(0,Math.sin(t*Math.PI))*C.hopHeight*e;
    l+=(C.hopRoll-l)*e;r+=(C.hopRoll-r)*e;d.legL.rotation.x=d.legR.rotation.x=-C.hopLegPitch*e;
  }
  d.armL.rotation.set(lx,0,-l);d.armR.rotation.set(rx,0,r);
  if(s.transition<C.blend)crossfade(s,smooth(s.transition/C.blend));
  const h=d.restPose.head,b=d.restPose.torso;
  transformed(s.head,d.bodyExtents.parts.head,d.head,h[0],h[1],h[2]);transformed(s.torso,d.bodyExtents.parts.torso,d.torso,b[0],b[1],b[2]);
  const neckLift=Math.max(0,s.torso.maxY-s.head.minY);d.head.position.y+=neckLift;s.head.minY+=neckLift;s.head.maxY+=neckLift;
  clearArm(d,s,true);clearArm(d,s,false);plant(d,s,true,footL);plant(d,s,false,footR);
  if(s.emoteTime>=s.duration)s.emote=null;
}
