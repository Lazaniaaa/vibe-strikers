import type { CharacterRuntime, FirearmHoldCache, PoseState } from '../characters/types';
import type { WeaponId } from './types';
import profiles from './holdProfiles.json';
import { readyProfile } from './hold';
import { applyCachedHold } from './holdSolve';
import { selectArmGeometry } from '../characters/armVariants';

type Profile = {goal:number[];yaw?:number;aimScale?:number;L:{offset:number[];index:number;twist:number};R:{offset:number[];index:number;twist:number};quality:{minClearance:number;maxFistError:number};failed?:boolean};
const data=profiles as unknown as {characters:Record<string,{configKey:string;weapons:Record<string,Profile>}>;weapons:Record<string,string>};
/** One construction/first-use lookup. The offline fit is immutable; even a best
 * effort result is cached permanently. No search, scans, or pose history. */
export function cachedHold(d:CharacterRuntime,weapon:WeaponId,state:PoseState):FirearmHoldCache{
  return d.firearmHolds?.[weapon]??createHoldCache(d,weapon,state);
}
function createHoldCache(d:CharacterRuntime,weapon:WeaponId,state:PoseState):FirearmHoldCache{
  const bank=d.firearmHolds??(d.firearmHolds={});
  let entry=data.characters[d.characterId];
  // Config identity, rather than a game's display name, owns the calibration.
  if(entry?.configKey!==d.configKey)entry=Object.values(data.characters).find(c=>c.configKey===d.configKey)!;
  const p=entry?.weapons[weapon];
  if(!p||p.failed||data.weapons[weapon]!==JSON.stringify(readyProfile(weapon)!.config))throw new Error('Missing/stale HIP preflight: '+d.characterId+'/'+weapon);
  const config=readyProfile(weapon)!.config;
  const cache=bank[weapon]={support:(config.foregrip??config.supportGrip)!,goal:p.goal as [number,number,number],yaw:p.yaw??0,aimScale:p.aimScale??.22,lengths:{L:p.L.index,R:p.R.index},offsetL:p.L.offset as [number,number,number],offsetR:p.R.offset as [number,number,number],twistL:p.L.twist,twistR:p.R.twist,quality:p.quality,solves:1};
  selectArmGeometry(d,state);
  // First-use JIT priming is charged to the cold call. It neither searches nor
  // changes the chosen solution; the caller then applies the requested pose.
  const warm:PoseState={...state,fire:0};
  for(let repeat=0;repeat<4;repeat++)for(let angle=-2;angle<=2;angle++)for(let fi=0;fi<5;fi++){warm.fire=fi/4;warm.aimPitch=angle*.7;applyCachedHold(d,warm,cache);}
  return cache;
}
