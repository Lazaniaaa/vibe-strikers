import type { CharacterRuntime, PoseState } from './types';

/** Archived Round-3 hash variant, metres after normalization. */
export const ARM_LONG_EXTRA = 0.40;
/** Construction-time length bank, metres added after normalization. */
export const ARM_MIN_EXTRA = 0;
export const ARM_MAX_EXTRA = 1.60;
export const ARM_LENGTH_STEP = 0.04;
/** Construction-only fallback reach reserve for custom character configs. */
export const ARM_LENGTH_RESERVE = 0.08;
/** Shoulder pads stay at the shoulder; cuffs farther down follow the shaft. */
export const ARM_SHOULDER_ZONE = 0.15;

export const ARM_SHORTEN_RATIO = 5 / 6;

/** Construction only: a single immutable HIP pair, shared by every firearm. */
export function chooseHoldLengths(d: Pick<CharacterRuntime,'restPose'|'dimensions'>,
  fixed?: {leftExtra:number;rightExtra:number}): {L:number;R:number} {
  const result={L:0,R:0};
  const depth=Math.max(d.dimensions.components.head[2]/2+.36,d.dimensions.components.torso[2]/2+.40);
  const y=Math.min(.58,Math.max(.5,d.restPose.armR[1]-.28));
  for(const side of ['L','R'] as const){
    const hand=d.dimensions[('hand'+side) as 'handL'|'handR'],shoulder=d.restPose[('arm'+side) as 'armL'|'armR'];
    const cx=(hand.min[0]+hand.max[0])/2,cy=(hand.min[1]+hand.max[1])/2,cz=(hand.min[2]+hand.max[2])/2;
    const x=side==='L'?.225:.33,gy=side==='L'?y-.035:y,z=side==='L'?-depth-.17:-depth;
    const radius=Math.hypot(x-shoulder[0],gy-shoulder[1],z-shoulder[2]);
    const base=d.dimensions.components[('arm'+side) as 'armL'|'armR'][1];
    const estimated=Math.sqrt(Math.max(0,radius*radius-cx*cx-cz*cz))+cy+ARM_LENGTH_RESERVE;
    const extra=fixed?(side==='L'?fixed.leftExtra:fixed.rightExtra):(base+estimated)*ARM_SHORTEN_RATIO-base;
    result[side]=Math.round(Math.max(ARM_MIN_EXTRA,Math.min(ARM_MAX_EXTRA,extra))/ARM_LENGTH_STEP);
  }
  return result;
}

export function selectArmGeometry(d: CharacterRuntime, state?: PoseState): void {
  const firearm = !!state?.weapon && state.weapon !== 'knife';
  const active = firearm;
  const a = d.armVariants;
  a.active = active;
  const lengths=(firearm&&d.firearmHolds?.[state!.weapon!]?.lengths)||a.holdLengths;
  a.selectedL=a.variantsL[lengths.L];a.selectedR=a.variantsR[lengths.R];
  a.handL=a.selectedL.hand;a.handR=a.selectedR.hand;
  a.meshL.geometry = active ? a.selectedL.geometry : a.normalL;
  a.meshR.geometry = active ? a.selectedR.geometry : a.normalR;
  const r=d.weaponSocketRest.R,l=d.weaponSocketRest.L;
  const shiftR=active?(a.handR.min[1]+a.handR.max[1]-d.dimensions.handR.min[1]-d.dimensions.handR.max[1])/2:0;
  const shiftL=active?(a.handL.min[1]+a.handL.max[1]-d.dimensions.handL.min[1]-d.dimensions.handL.max[1])/2:0;
  d.weaponSocket.position.set(r[0],r[1]+shiftR,r[2]);
  d.weaponSocketL.position.set(l[0],l[1]+shiftL,l[2]);
}
