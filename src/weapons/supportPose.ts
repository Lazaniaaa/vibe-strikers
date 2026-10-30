import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { ArmLengthVariant, CharacterRuntime, Extent, PoseState } from '../characters/types';
import type { Group } from 'three';
import { readyProfile } from './hold';
import { unit } from './poseWeapon';

// Scratch only. One immutable HIP length pair per character; no ADS/world-side state.
const palmR=new Vector3(),palmL=new Vector3(),support=new Vector3(),goal=new Vector3(),otherGoal=new Vector3();
const desired=new Vector3(),circleCenter=new Vector3(),axis=new Vector3(),u=new Vector3(),v=new Vector3(),candidate=new Vector3();
const mainShoulder=new Vector3(),otherShoulder=new Vector3(),point=new Vector3(),local=new Vector3(),direction=new Vector3(),localDirection=new Vector3();
const baseQ=new Quaternion(),weaponQ=new Quaternion(),kickQ=new Quaternion(),aimQ=new Quaternion(),twistQ=new Quaternion(),bestQ=new Quaternion();
const euler=new Euler(),kickEuler=new Euler(),armEuler=new Euler();
const parentMatrix=new Matrix4(),mountMatrix=new Matrix4(),targetMatrix=new Matrix4(),headInverse=new Matrix4(),torsoInverse=new Matrix4();
const scale=new Vector3(1,1,1),mountPosition=new Vector3();
const twists=new Float64Array([0,-.35,.35,-.7,.7,-1.05,1.05,-1.57,1.57,-2.1,2.1,Math.PI]);
// All shifts are <=.095m: grip tolerance is never increased beyond the owner's .10m.
const goalShifts=new Float64Array([0,0,0, 0,0,-.025, 0,0,-.05, 0,0,-.075, 0,0,-.095,
 .025,0,0, .05,0,0, .075,0,0, .095,0,0, .04,0,-.04, .06,0,-.06,
 .025,-.05,-.06, 0,-.075,-.05, 0,-.095,0, .06,-.06,-.025]);
const GOAL_COUNT=7*15,goalBank=new Float64Array(GOAL_COUNT*3),goalScores=new Float64Array(GOAL_COUNT);
const baseCandidate=new Vector3();
const finalMainQ=new Quaternion(),finalOtherQ=new Quaternion(),finalGoal=new Vector3();
const gripDirectionQ=new Quaternion(),gripDirectionTarget=new Vector3();
const gripTangentA=new Vector3(),gripTangentB=new Vector3(),gripAxis=new Vector3();
const limit=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
function center(out:Vector3,b:Extent):void {out.set((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);}
function boxDistance(p:Vector3,d:CharacterRuntime,name:'head'|'torso',inverse:Matrix4):number {
  const b=d.bodyExtents.parts[name],r=d.restPose[name],size=d.dimensions.components[name];
  local.copy(p).applyMatrix4(inverse);
  const x=Math.abs(local.x-(b.min[0]+b.max[0])/2+r[0])-size[0]/2+.01;
  const y=Math.abs(local.y-(b.min[1]+b.max[1])/2+r[1])-size[1]/2+.01;
  const z=Math.abs(local.z-(b.min[2]+b.max[2])/2+r[2])-size[2]/2+.01;
  return Math.hypot(Math.max(0,x),Math.max(0,y),Math.max(0,z))+Math.min(0,Math.max(x,y,z));
}
function bodyDistance(p:Vector3,d:CharacterRuntime):number {
  return Math.min(boxDistance(p,d,'head',headInverse),boxDistance(p,d,'torso',torsoInverse));
}
function armClearance(arm:Group,variant:ArmLengthVariant,d:CharacterRuntime):number {
  let min=Infinity;const a=variant.collisionPoints;
  for(let i=0;i<a.length;i+=3){point.set(a[i],a[i+1],a[i+2]).applyQuaternion(arm.quaternion).add(arm.position);min=Math.min(min,bodyDistance(point,d));}
  return min;
}
/** Axial twist changes the box orientation but never its fixed-length endpoint. */
function orientArm(arm:Group,palm:Vector3,target:Vector3,variant:ArmLengthVariant,d:CharacterRuntime,inward:number):number {
  localDirection.copy(palm).normalize();direction.copy(target).sub(arm.position).normalize();
  aimQ.setFromUnitVectors(localDirection,direction);let score=-Infinity,bestClearance=-Infinity,bestTwist=0;
  for(let i=0;i<twists.length;i++){
    twistQ.setFromAxisAngle(localDirection,twists[i]);arm.quaternion.copy(aimQ).multiply(twistQ);
    const clearance=armClearance(arm,variant,d);if(clearance>=.001)return clearance;armEuler.setFromQuaternion(arm.quaternion);
    const value=Math.min(.003,clearance)*100-Math.abs(armEuler.y-inward)*.001;
    if(value>score){score=value;bestQ.copy(arm.quaternion);bestClearance=clearance;bestTwist=twists[i];}
  }
  if(bestClearance<.002){
    let start=bestTwist;
    for(let i=-14;i<=14;i++){
      twistQ.setFromAxisAngle(localDirection,start+i*.025);arm.quaternion.copy(aimQ).multiply(twistQ);
      const clearance=armClearance(arm,variant,d);if(clearance>=.001)return clearance;armEuler.setFromQuaternion(arm.quaternion);
      const value=Math.min(.003,clearance)*100-Math.abs(armEuler.y-inward)*.001;
      if(value>score){score=value;bestQ.copy(arm.quaternion);bestClearance=clearance;bestTwist=start+i*.025;}
    }
    if(bestClearance<.001){
      start=bestTwist;
      for(let i=-20;i<=20;i++){
        twistQ.setFromAxisAngle(localDirection,start+i*.001);arm.quaternion.copy(aimQ).multiply(twistQ);
        const clearance=armClearance(arm,variant,d);if(clearance>=.001)return clearance;armEuler.setFromQuaternion(arm.quaternion);
        const value=Math.min(.003,clearance)*100-Math.abs(armEuler.y-inward)*.001;
        if(value>score){score=value;bestQ.copy(arm.quaternion);bestClearance=clearance;}
      }
    }
  }
  arm.quaternion.copy(bestQ);
  return bestClearance;
}
function pointArm(arm:Group,palm:Vector3,target:Vector3,variant:ArmLengthVariant,d:CharacterRuntime,inward:number):number {
  let clearance=orientArm(arm,palm,target,variant,d,inward),score=Math.min(.003,clearance)*100,bestClearance=clearance;
  if(clearance>=.001)return clearance;
  gripDirectionQ.copy(arm.quaternion);
  // The HIP contract permits 10cm at the grip. Use at most 9.5cm of rotation-only
  // endpoint adjustment to keep an existing cuff clear; arm shape/length stays fixed.
  for(let i=0;i<6;i++){
    gripDirectionTarget.copy(target);const offset=i%2?-.08:.08;
    if(i<2)gripDirectionTarget.x+=offset;else if(i<4)gripDirectionTarget.y+=offset;else gripDirectionTarget.z+=offset;
    clearance=orientArm(arm,palm,gripDirectionTarget,variant,d,inward);
    point.copy(palm).applyQuaternion(arm.quaternion).add(arm.position);
    const error=point.distanceTo(target);if(error>.099)continue;
    if(clearance>=.001)return clearance;
    const value=Math.min(.003,clearance)*100-error*.005;
    if(value>score){score=value;bestClearance=clearance;gripDirectionQ.copy(arm.quaternion);}
  }
  if(bestClearance<.001){
    gripAxis.copy(target).sub(arm.position).normalize();
    gripTangentA.set(0,1,0).cross(gripAxis);
    if(gripTangentA.lengthSq()<1e-9)gripTangentA.set(1,0,0);
    gripTangentA.normalize();gripTangentB.crossVectors(gripAxis,gripTangentA).normalize();
    for(let i=0;i<24;i++){
      const angle=i*Math.PI/12;
      gripDirectionTarget.copy(target).addScaledVector(gripTangentA,.095*Math.cos(angle)).addScaledVector(gripTangentB,.095*Math.sin(angle));
      clearance=orientArm(arm,palm,gripDirectionTarget,variant,d,inward);
      point.copy(palm).applyQuaternion(arm.quaternion).add(arm.position);
      const error=point.distanceTo(target);if(error>.099)continue;
      if(clearance>=.001)return clearance;
      const value=Math.min(.003,clearance)*100-error*.005;
      if(value>score){score=value;bestClearance=clearance;gripDirectionQ.copy(arm.quaternion);}
    }
  }
  arm.quaternion.copy(gripDirectionQ);return bestClearance;
}
export function poseFirearmArms(d:CharacterRuntime,state:PoseState,pitch:number):void {
  const profile=readyProfile(state.weapon)!,config=profile.config,a=d.armVariants;
  const fire=state.fire===undefined?(state.shooting?1:0):unit(state.fire);
  center(palmR,a.active?a.handR:d.dimensions.handR);center(palmL,a.active?a.handL:d.dimensions.handL);
  euler.set(pitch*.22,0,0);baseQ.setFromEuler(euler);
  kickEuler.set(fire*.10,0,-fire*.025);kickQ.setFromEuler(kickEuler);weaponQ.copy(baseQ).multiply(kickQ);
  const at=config.foregrip??config.supportGrip!,mirrored=1;
  support.set(at[0]*mirrored,at[1],at[2]).applyQuaternion(weaponQ);
  const mainArm=d.armR,otherArm=d.armL;
  const mainPalm=palmR,otherPalm=palmL;
  const rm=mainPalm.length(),ro=otherPalm.length();
  mainShoulder.copy(mainArm.position);otherShoulder.copy(otherArm.position).sub(support);
  const depth=Math.max(d.dimensions.components.head[2]/2+.36,d.dimensions.components.torso[2]/2+.40);
  const hipY=Math.min(.58,Math.max(.5,d.restPose.armR[1]-.28));
  desired.set(.33,hipY,-depth);
  d.head.updateMatrix();d.torso.updateMatrix();headInverse.copy(d.head.matrix).invert();torsoInverse.copy(d.torso.matrix).invert();
  axis.copy(otherShoulder).sub(mainShoulder);const distance=Math.max(1e-9,axis.length());axis.divideScalar(distance);
  const along=(rm*rm-ro*ro+distance*distance)/(2*distance);
  circleCenter.copy(mainShoulder).addScaledVector(axis,along);
  const radius=Math.sqrt(Math.max(0,rm*rm-along*along));
  u.copy(desired).sub(circleCenter);u.addScaledVector(axis,-u.dot(axis));
  if(u.lengthSq()<1e-12)u.set(0,0,-1);u.normalize();v.crossVectors(axis,u).normalize();
  const minX=.28,maxX=.38;
  goal.copy(circleCenter).addScaledVector(u,radius);
  // Rank the immutable finite HIP neighbourhood by distance, before any vertex scan.
  for(let i=0;i<GOAL_COUNT;i++)goalScores[i]=Infinity;
  for(let sample=0;sample<7;sample++){
    let angle=0;
    if(sample>0){
      const x=sample<=2?minX:sample<=4?(minX+maxX)/2:maxX;
      const amp=radius*Math.hypot(u.x,v.x),value=amp>1e-10?(x-circleCenter.x)/amp:2;
      if(Math.abs(value)>1)continue;
      angle=Math.atan2(v.x,u.x)+(sample%2?1:-1)*Math.acos(limit(value,-1,1));
    }
    baseCandidate.copy(circleCenter).addScaledVector(u,radius*Math.cos(angle)).addScaledVector(v,radius*Math.sin(angle));
    for(let shift=0;shift<15;shift++){
      const i=sample*15+shift;
      candidate.copy(baseCandidate);candidate.x+=goalShifts[shift*3];candidate.y+=goalShifts[shift*3+1];candidate.z+=goalShifts[shift*3+2];
      if(Math.abs(candidate.distanceTo(mainShoulder)-rm)>.098||Math.abs(candidate.distanceTo(otherShoulder)-ro)>.098)continue;
      goalScores[i]=candidate.distanceToSquared(desired)+Math.max(0,candidate.z+.35)*30+Math.max(0,minX-candidate.x,candidate.x-maxX)*8;
      goalBank[i*3]=candidate.x;goalBank[i*3+1]=candidate.y;goalBank[i*3+2]=candidate.z;
    }
  }
  const mainVariant=a.selectedR,otherVariant=a.selectedL;
  let bestFallback=Infinity,haveFallback=false;
  for(let attempt=0;attempt<GOAL_COUNT;attempt++){
    let next=-1,nearest=Infinity;
    for(let i=0;i<GOAL_COUNT;i++)if(goalScores[i]<nearest){nearest=goalScores[i];next=i;}
    if(next<0)break;
    goalScores[next]=Infinity;candidate.set(goalBank[next*3],goalBank[next*3+1],goalBank[next*3+2]);
    let clearance=Infinity;const corners=profile.corners;
    // Rejected candidates can stop at the first unsafe vertex. Accepted ones scan ALL vertices.
    for(let j=0;j<corners.length;j+=3){
      point.set(corners[j]*mirrored,corners[j+1],corners[j+2]+profile.slideCorners[j/3]*fire*.075).applyQuaternion(weaponQ).add(candidate);
      clearance=Math.min(clearance,bodyDistance(point,d));if(clearance<.001)break;
    }
    if(clearance<.001)continue;
    goal.copy(candidate);otherGoal.copy(goal).add(support);
    const c1=pointArm(mainArm,mainPalm,goal,mainVariant,d,30*Math.PI/180);
    const c2=pointArm(otherArm,otherPalm,otherGoal,otherVariant,d,-30*Math.PI/180);
    const score=nearest+Math.max(0,.001-Math.min(c1,c2))*1e7;
    if(score<bestFallback){haveFallback=true;bestFallback=score;finalGoal.copy(goal);finalMainQ.copy(mainArm.quaternion);finalOtherQ.copy(otherArm.quaternion);}
    if(c1>=.001&&c2>=.001)break;
  }
  if(haveFallback){goal.copy(finalGoal);mainArm.quaternion.copy(finalMainQ);otherArm.quaternion.copy(finalOtherQ);}
  else{
    // Deterministic finite fallback for an infeasible custom config; verify still reports the failure.
    otherGoal.copy(goal).add(support);pointArm(mainArm,mainPalm,goal,mainVariant,d,30*Math.PI/180);pointArm(otherArm,otherPalm,otherGoal,otherVariant,d,-30*Math.PI/180);
  }
  if(state.dead)goal.copy(mainPalm).applyQuaternion(mainArm.quaternion).add(mainArm.position);
  const binding=d.weaponBinding;
  if(binding&&binding.id===state.weapon){
    const socket=binding.mount.parent;
    if(socket===d.weaponSocket||socket===d.weaponSocketL){
      const owner=socket===d.weaponSocket?d.armR:d.armL;
      owner.updateMatrix();socket.updateMatrix();parentMatrix.multiplyMatrices(owner.matrix,socket.matrix).invert();
      mountPosition.set(0,0,fire*.045).applyQuaternion(baseQ).negate().add(goal);
      targetMatrix.compose(mountPosition,baseQ,scale);mountMatrix.multiplyMatrices(parentMatrix,targetMatrix);
      mountMatrix.decompose(binding.mount.position,binding.mount.quaternion,binding.mount.scale);
    }
  }
}
