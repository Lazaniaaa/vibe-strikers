import { Euler, Quaternion, Vector3 } from 'three';
import type { CharacterRuntime, FirearmHoldCache, PoseState, Vec3 } from '../characters/types';

const palm=new Vector3(),point=new Vector3(),direction=new Vector3(),delta=new Vector3(),goal=new Vector3(),support=new Vector3(),mountPosition=new Vector3(),parentOrigin=new Vector3();
const inverseTorso=new Quaternion(),aim=new Quaternion(),twist=new Quaternion(),baseQ=new Quaternion(),kickQ=new Quaternion(),weaponQ=new Quaternion();
const euler=new Euler(),kickEuler=new Euler();
const inverseParent=new Quaternion();
/** Whole offset from the original shoulder, including torso following. */
export const MAX_SHOULDER_OFFSET=.03;
function center(out:Vector3,b:{min:Vec3;max:Vec3}):void{out.x=(b.min[0]+b.max[0])/2;out.y=(b.min[1]+b.max[1])/2;out.z=(b.min[2]+b.max[2])/2;}
function shoulder(d:CharacterRuntime,side:'L'|'R',offset:Vec3):void{
  const rest=d.restPose[side==='R'?'armR':'armL'],tr=d.restPose.torso,arm=side==='R'?d.armR:d.armL;
  point.x=rest[0]-tr[0]+offset[0];point.y=rest[1]-tr[1]+offset[1];point.z=rest[2]-tr[2]+offset[2];point.applyQuaternion(d.torso.quaternion).add(d.torso.position);
  delta.x=point.x-rest[0];delta.y=point.y-rest[1];delta.z=point.z-rest[2];
  if(delta.lengthSq()>MAX_SHOULDER_OFFSET*MAX_SHOULDER_OFFSET)delta.setLength(MAX_SHOULDER_OFFSET);
  arm.position.x=rest[0]+delta.x;arm.position.y=rest[1]+delta.y;arm.position.z=rest[2]+delta.z;
}
function aimArm(d:CharacterRuntime,side:'L'|'R',target:Vector3,cache:FirearmHoldCache):void{
  const arm=side==='R'?d.armR:d.armL;
  center(palm,side==='R'?d.armVariants.handR:d.armVariants.handL);palm.normalize();
  direction.copy(target).sub(arm.position).applyQuaternion(inverseTorso).normalize();
  aim.setFromUnitVectors(palm,direction);twist.setFromAxisAngle(palm,side==='R'?cache.twistR:cache.twistL);
  arm.quaternion.copy(aim).multiply(twist).premultiply(d.torso.quaternion);
}
/** Constant-work analytic update. No iteration, vertex access, allocation, or
 * previous-pose dependence. Length and axial roll are fixed for this hold. */
export function applyCachedHold(d:CharacterRuntime,state:PoseState,cache:FirearmHoldCache):void{
  const pitch=state.dead?0:(Number.isFinite(state.aimPitch)?Math.max(-89*Math.PI/180,Math.min(89*Math.PI/180,state.aimPitch)):0);
  const fire=state.fire===undefined?(state.shooting?1:0):(Number.isFinite(state.fire)?Math.max(0,Math.min(1,state.fire)):0),tr=d.restPose.torso;
  inverseTorso.copy(d.torso.quaternion).invert();
  goal.x=cache.goal[0]-tr[0];goal.y=cache.goal[1]-tr[1];goal.z=cache.goal[2]-tr[2];goal.applyQuaternion(d.torso.quaternion).add(d.torso.position);
  shoulder(d,'R',cache.offsetR);shoulder(d,'L',cache.offsetL);
  euler.x=pitch*cache.aimScale;euler.y=cache.yaw;euler.z=0;baseQ.setFromEuler(euler).premultiply(d.torso.quaternion);
  kickEuler.x=fire*.10;kickEuler.y=0;kickEuler.z=-fire*.025;kickQ.setFromEuler(kickEuler);weaponQ.copy(baseQ).multiply(kickQ);
  const at=cache.support;
  support.set(at[0],at[1],at[2]).applyQuaternion(weaponQ).add(goal);
  aimArm(d,'R',goal,cache);aimArm(d,'L',support,cache);
  const binding=d.weaponBinding;
  if(binding&&binding.id===state.weapon){
    const socket=d.weaponSocket;
    inverseParent.copy(d.armR.quaternion).multiply(socket.quaternion).invert();
    parentOrigin.copy(socket.position).applyQuaternion(d.armR.quaternion).add(d.armR.position);
    mountPosition.x=0;mountPosition.y=0;mountPosition.z=fire*.045;mountPosition.applyQuaternion(baseQ).negate().add(goal);
    binding.mount.position.copy(mountPosition).sub(parentOrigin).applyQuaternion(inverseParent);
    binding.mount.quaternion.copy(inverseParent).multiply(baseQ);binding.mount.scale.set(1,1,1);
  }
}
