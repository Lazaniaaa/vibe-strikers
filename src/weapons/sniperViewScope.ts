import type { WeaponBox } from './types';
import { SNIPER_SCOPE_AXIS_Y, sniperScopeHousing, sniperScopeMounts } from './sniperScope';

const y=SNIPER_SCOPE_AXIS_Y;
const b=(size:WeaponBox['size'],position:WeaponBox['position'],color:WeaponBox['color']='shadow',top:WeaponBox['top']='steel',rotate?:WeaponBox['rotate']):WeaponBox=>({size,position,color,top,...(rotate?{rotate}:{})});
/** VM only. The world-model scope and its approved geometry stay unchanged. */
export const sniperViewRearFrame:readonly WeaponBox[]=[
 b([.268,.018,.010],[0,y+.115,-.014]),b([.268,.018,.010],[0,y-.115,-.014]),
 b([.018,.248,.010],[-.125,y,-.014]),b([.018,.248,.010],[.125,y,-.014]),
];
export const sniperViewRearBezel:readonly WeaponBox[]=[
 b([.32,.021,.09],[0,y+.1345,-.055],'accent','accentTop'),b([.32,.021,.09],[0,y-.1345,-.055],'accent','accentTop'),
 b([.026,.29,.09],[-.147,y,-.055],'accent','accentTop'),b([.026,.29,.09],[.147,y,-.055],'accent','accentTop'),
];
/** Full rear face remains .32 x .29; the thin inset frame has a .232 x .212 aperture. */
export const sniperViewTube:readonly WeaponBox[]=[
 ...sniperScopeMounts,
 b([.285,.010,Math.hypot(.465,.029)],[0,y+.1255,-.3325],'shadow','steel',['x',Math.atan2(.029,.465)]),
 b([.285,.010,Math.hypot(.465,.029)],[0,y-.1255,-.3325],'shadow','steel',['x',-Math.atan2(.029,.465)]),
 ...[-1,1].map(s=>b([.005,.29,Math.hypot(.665,.039)],[s*.138,y,-.4325],'shadow','steel',['y',-s*Math.atan2(.039,.665)])),
 // Recessed carrier behind the removable thin frame, hidden together with the tube.
 ...sniperViewRearBezel,
 // Original front ring, hood and turret; all disappear in ADS.
 ...sniperScopeHousing.slice(8),
];
export const sniperViewScopeBoxes:readonly WeaponBox[]=[...sniperViewTube,...sniperViewRearFrame];
