import type { CharacterRuntime, PoseState } from '../characters/types';
import { selectArmGeometry } from '../characters/armVariants';
import { cachedHold } from './holdCache';
import { applyCachedHold } from './holdSolve';
/** First use binds one preflight result; subsequent frames never solve again. */
export function poseFirearmArms(d:CharacterRuntime,state:PoseState):void{
  const cache=cachedHold(d,state.weapon!,state);
  // The first call selects its immutable bank entries; later calls already
  // selected them in poseCharacter's normal reset/select pass.
  if(d.armVariants.selectedL!==d.armVariants.variantsL[cache.lengths.L]||d.armVariants.selectedR!==d.armVariants.variantsR[cache.lengths.R])selectArmGeometry(d,state);
  applyCachedHold(d,state,cache);
}
