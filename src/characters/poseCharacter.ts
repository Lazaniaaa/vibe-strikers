import type { Group } from 'three';
import type { CharacterRuntime, Extent, PoseState, Vec3 } from './types';
import { READY_PITCH, READY_ROLL, readyProfile } from '../weapons/hold';
import { poseFirearmArms } from '../weapons/supportPose';
import { selectArmGeometry } from './armVariants';

const TAU = Math.PI * 2;
const AIM_LIMIT = 89 * Math.PI / 180;
const HEAD_LIMIT = 35 * Math.PI / 180;
const MAX_HEAD_OVERLAP = 0.08;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function resetJoint(joint: Group, rest: Vec3): void {
  joint.position.set(rest[0], rest[1], rest[2]);
  joint.rotation.set(0, 0, 0);
  joint.scale.set(1, 1, 1);
}
/** Bind/reference pose. Uses per-instance rest data, never the game-owned outer. */
export function restoreReferencePose(group: Group): void {
  const d = group.userData as CharacterRuntime;
  selectArmGeometry(d);
  d.rig.position.set(0, 0, 0); d.rig.rotation.set(0, 0, 0); d.rig.scale.set(1, 1, 1);
  resetJoint(d.head, d.restPose.head); resetJoint(d.torso, d.restPose.torso);
  resetJoint(d.armL, d.restPose.armL); resetJoint(d.armR, d.restPose.armR);
  resetJoint(d.legL, d.restPose.legL); resetJoint(d.legR, d.restPose.legR);
}
/** Conservative rig-space AABB top after Rx*Rz, using cached BASE-body extents. */
function torsoTop(data: CharacterRuntime): number {
  const t = data.torso;
  const b = data.bodyExtents.parts.torso;
  const rest = data.restPose.torso;
  const cx = Math.cos(t.rotation.x);
  const a = cx * Math.sin(t.rotation.z), y = cx * Math.cos(t.rotation.z), z = -Math.sin(t.rotation.x);
  return t.position.y + a * ((a >= 0 ? b.max[0] : b.min[0]) - rest[0]) +
    y * ((y >= 0 ? b.max[1] : b.min[1]) - rest[1]) +
    z * ((z >= 0 ? b.max[2] : b.min[2]) - rest[2]);
}
/** Raise the existing neck pivot just enough; no geometry edits or temporary objects. */
function clearHead(data: CharacterRuntime): void {
  const angle = data.head.rotation.x;
  const b = data.bodyExtents.parts.head;
  const rest = data.restPose.head;
  const sin = Math.sin(angle);
  const bottom = data.head.position.y + Math.cos(angle) * (b.min[1] - rest[1]) -
    sin * ((sin >= 0 ? b.max[2] : b.min[2]) - rest[2]);
  data.head.position.y += Math.max(0, torsoTop(data) - MAX_HEAD_OVERLAP - bottom);
  data.head.position.z += Math.abs(sin) * 0.025;
}
/**
 * Pure pose from current state + public phase + dt. No global template reads,
 * smoothing, hidden clocks, geometry edits, or per-frame object allocations.
 */
export function poseCharacter(group: Group, state: PoseState, dt: number): void {
  const data = group.userData as CharacterRuntime;
  const { rig, head, torso, armL, armR, legL, legR } = data;
  const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  data.phase = ((Number.isFinite(data.phase) ? data.phase : 0) + elapsed * TAU * 1.7) % TAU;
  const phase = data.phase;
  const speed = Number.isFinite(state.speed) ? clamp(state.speed, 0, 1) : 0;
  const pitch = Number.isFinite(state.aimPitch) ? clamp(state.aimPitch, -AIM_LIMIT, AIM_LIMIT) : 0;
  const headPitch = clamp(pitch * 0.6, -HEAD_LIMIT, HEAD_LIMIT);
  const aimLean = clamp((pitch - headPitch) * 0.12, -7 * Math.PI / 180, 7 * Math.PI / 180);
  const armAim = headPitch + (pitch - headPitch) * 0.72 + aimLean;
  let dx = Number.isFinite(state.moveDir.x) ? state.moveDir.x : 0;
  let dz = Number.isFinite(state.moveDir.z) ? state.moveDir.z : 0;
  // Math.hypot's native argument packing allocates in this V8. Keep the
  // archived unarmed arithmetic exact; the firearm path uses scalar sqrt.
  const length = state.weapon && state.weapon !== 'knife' ? Math.sqrt(dx * dx + dz * dz) : Math.hypot(dx, dz);
  if (length > 0.0001) { dx /= length; dz /= length; } else { dx = 0; dz = -1; }
  const crouch = state.crouching ? 1 : 0;
  const airborne = state.grounded ? 0 : 1;
  const stride = Math.sin(phase) * speed * (crouch ? 0.24 : 0.62) * (1 - airborne);
  const bob = Math.sin(phase * 2) * speed * 0.014 * (1 - airborne);
  const shotPhase = (phase * 5) % TAU;
  const recoil = state.shooting ? Math.max(0, 1 - shotPhase / 1.15) : 0;
  restoreReferencePose(group);
  selectArmGeometry(data, state);
  rig.position.x = 0; rig.position.y = bob; rig.position.z = recoil * 0.012;
  head.rotation.x = headPitch;
  torso.rotation.set(crouch * 0.07 + aimLean, 0, -dx * speed * 0.025);
  clearHead(data);
  if (!state.weapon || state.weapon === 'knife') {
  armL.rotation.set(1.43 + armAim * 0.92 + stride * dz * 0.16 + airborne * 0.16 + recoil * 0.08,
    0, 0.94 + stride * dx * 0.10);
  armR.rotation.set(Math.PI / 2 + armAim - stride * dz * 0.16 + airborne * 0.12 + recoil * 0.15,
    0, -0.47 - stride * dx * 0.10);
  }
  legL.rotation.set(-stride * dz + crouch - airborne * 0.28, 0, -stride * dx + airborne * 0.15);
  legR.rotation.set(stride * dz + crouch + airborne * 0.24, 0, stride * dx - airborne * 0.15);
  legL.scale.y = crouch ? 0.72 : 1;
  legR.scale.y = crouch ? 0.72 : 1;
  if (state.crouching && state.grounded) {
    // This responds to actual short/tall/asymmetric feet and hip pivots.
    const fl=data.dimensions.footL, fr=data.dimensions.footR;
    const la=Math.cos(legL.rotation.x)*Math.sin(legL.rotation.z), lc=-Math.sin(legL.rotation.x), ly=Math.cos(legL.rotation.x)*Math.cos(legL.rotation.z)*legL.scale.y;
    const ra=Math.cos(legR.rotation.x)*Math.sin(legR.rotation.z), rc=-Math.sin(legR.rotation.x), ry=Math.cos(legR.rotation.x)*Math.cos(legR.rotation.z)*legR.scale.y;
    const bottomL=legL.position.y+(la*(la>=0?fl.min[0]:fl.max[0])+ly*(ly>=0?fl.min[1]:fl.max[1])+lc*(lc>=0?fl.min[2]:fl.max[2]));
    const bottomR=legR.position.y+(ra*(ra>=0?fr.min[0]:fr.max[0])+ry*(ry>=0?fr.min[1]:fr.max[1])+rc*(rc>=0?fr.min[2]:fr.max[2]));
    rig.position.y = -Math.min(bottomL, bottomR) + bob;
  }
  const ready=readyProfile(state.weapon);
  if(ready&&!state.dead&&ready.config.kind!=='knife')poseFirearmArms(data,state);
  if(ready&&!state.dead&&ready.config.kind==='knife'){
    // Temporary Stage A ready: the fixed outward roll is cancelled by hold.rotation.
    armR.rotation.set(clamp(READY_PITCH+pitch*.10-stride*dz*.025+recoil*.012,
      40*Math.PI/180,55*Math.PI/180),0,READY_ROLL);
    armL.rotation.set(.35+stride*dz*.04,0,-.22);
    const c=Math.cos(READY_ROLL),s=Math.sin(READY_ROLL),hand=data.dimensions.handR;
    const h=data.bodyExtents.parts.head,t=data.bodyExtents.parts.torso,tr=data.restPose.torso;
    const tz=torso.rotation.z,tc=Math.cos(tz),ts=-Math.sin(tz);
    const torsoRight=torso.position.x+tc*(t.max[0]-tr[0])+
      ts*((ts>=0?t.max[1]:t.min[1])-tr[1]);
    const bodyRight=Math.max(head.position.x+h.max[0]-data.restPose.head[0],torsoRight);
    const fistLeft=c*hand.min[0]-s*hand.max[1];
    const hold=ready.config.hold.position,socket=data.weaponSocket.position;
    const gripX=c*(socket.x+hold[0])-s*(socket.y+hold[2]);
    // Only the arm moves: the existing socket, fist, and weapon stay connected.
    armR.position.x=Math.max(data.restPose.armR[0],bodyRight+.025-fistLeft,
      bodyRight+.035-gripX+ready.leftReach);
    {
      // The knife's support arm is free, but its fist must also stay outside the body.
      const lc=Math.cos(armL.rotation.z),ls=-Math.sin(armL.rotation.z),lh=data.dimensions.handL;
      const torsoLeft=torso.position.x+tc*(t.min[0]-tr[0])+ts*((ts>=0?t.min[1]:t.max[1])-tr[1]);
      const bodyLeft=Math.min(head.position.x+h.min[0]-data.restPose.head[0],torsoLeft);
      const maxFist=lc*lh.max[0]+ls*(ls>=0?lh.max[1]:lh.min[1]);
      armL.position.x=Math.min(data.restPose.armL[0],bodyLeft-.03-maxFist);
    }
  }
  if (state.dead) {
    const rest = data.restPose.head;
    head.position.set(rest[0], rest[1], rest[2]);
    head.rotation.set(0.12, 0, 0); torso.rotation.set(0, 0, 0);
    armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0);
    legL.rotation.set(0, 0, 0); legR.rotation.set(0, 0, 0);
    legL.scale.set(1, 1, 1); legR.scale.set(1, 1, 1);
    rig.rotation.set(0, 0, -Math.PI / 2);
    rig.position.x=0;rig.position.y=data.dimensions.deathSupport;rig.position.z=0;
    if (ready && ready.config.kind !== 'knife') poseFirearmArms(data,state);
  }
}
