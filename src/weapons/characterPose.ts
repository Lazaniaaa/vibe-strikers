import type { Group } from 'three';
import type { CharacterRuntime, PoseState } from '../characters/types';
import { poseCharacter } from '../characters/poseCharacter';
import type { WeaponId, WeaponRuntime } from './types';

export interface WeaponCharacterState extends Omit<PoseState,'weapon'> { weapon?:WeaponId|null }
const missingBinding=new Error('Attach Paint Bomb before posing it');
/** Extended visual kit entry point. The original character API and all old holds remain unchanged. */
export function poseArmedCharacter(group:Group,state:WeaponCharacterState,dt:number):void {
  if(state.weapon!=='paintGrenade'){poseCharacter(group,state as PoseState,dt);return;}
  const d=group.userData as CharacterRuntime,binding=d.weaponBinding;
  if(!binding||binding.id!=='paintGrenade')throw missingBinding;
  const runtime=binding.weapon.userData as WeaponRuntime,s=runtime.characterPose!;
  // The approved low ready pose clears every head shape. Only the right fist holds the bomb;
  // the off-hand stays in its existing ready/guard pose rather than grasping a fictitious support.
  s.weapon='rifle';
  s.speed=state.speed;s.moveDir.x=state.moveDir.x;s.moveDir.z=state.moveDir.z;s.aimPitch=state.aimPitch;
  s.shooting=state.shooting;s.crouching=state.crouching;s.grounded=state.grounded;s.dead=state.dead;
  s.fire=state.fire;s.reload=state.reload;s.cycle=state.cycle;
  binding.id='rifle';poseCharacter(group,s,dt);binding.id='paintGrenade';
}
