/** Visual eye relief in metres; the game owns camera FOV/zoom. */
export const ADS_DISTANCE = 0.14;
/** Sniper-only eye relief for the restored Stage-A scope. */
export const SNIPER_ADS_DISTANCE = 0.10;
import { weapons } from './weapons';
import type { WeaponId } from './types';

export const HIP_FOV=70;
const fovs=new Map(weapons.map(w=>[w.id,w.adsFov??HIP_FOV]));
/** Pure visual data interpolation; the caller owns its camera and mouse settings. */
export function fovForAds(weaponId:WeaponId,ads:number):number{
 const t=Number.isFinite(ads)?Math.max(0,Math.min(1,ads)):0,s=t*t*(3-2*t);
 return HIP_FOV+((fovs.get(weaponId)??HIP_FOV)-HIP_FOV)*s;
}
export function adsSensitivityScale(weaponId:WeaponId,ads:number):number{
 return Math.tan(fovForAds(weaponId,ads)*Math.PI/360)/Math.tan(HIP_FOV*Math.PI/360);
}
