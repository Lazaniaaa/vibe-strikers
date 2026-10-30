import type { LensSpec, WeaponBox } from './types';

/** Original Stage-A housing envelope, restored without changing the rifle or its hold. */
export const SNIPER_SCOPE_AXIS_Y = .57;
const y=SNIPER_SCOPE_AXIS_Y;
const b=(size:WeaponBox['size'],position:WeaponBox['position'],color:WeaponBox['color']='shadow',top:WeaponBox['top']='steel',rotate?:WeaponBox['rotate']):WeaponBox=>({size,position,color,top, ...(rotate?{rotate}:{})});

export const sniperScopeMounts:readonly WeaponBox[]=[
 b([.12,.195,.09],[0,.3475,-.16]),b([.12,.195,.09],[0,.3475,-.51]),
];
export const sniperScopeHousing:readonly WeaponBox[]=[
 // A flared box tunnel: rear opening .07 square, widening towards the objective.
 b([.285,.010,Math.hypot(.465,.10)],[0,y+.09,-.3325],'shadow','steel',['x',Math.atan2(.10,.465)]),
 b([.285,.010,Math.hypot(.465,.10)],[0,y-.09,-.3325],'shadow','steel',['x',-Math.atan2(.10,.465)]),
 ...[-1,1].map(s=>b([.005,.29,Math.hypot(.665,.12)],[s*.0975,y,-.4325],'shadow','steel',['y',-s*Math.atan2(.12,.665)])),
 // Original .32 x .29 rear ring; the empty .07 x .07 centre is retained through its depth.
 b([.32,.11,.09],[0,y+.09,-.055],'accent','accentTop'),
 b([.32,.11,.09],[0,y-.09,-.055],'accent','accentTop'),
 b([.125,.29,.09],[-.0975,y,-.055],'accent','accentTop'),
 b([.125,.29,.09],[.0975,y,-.055],'accent','accentTop'),
 // Inset horizontal objective rim and a short side hood keep the original outer length.
 b([.32,.010,.09],[0,y+.14,-.61],'accent','accentTop'),
 b([.32,.010,.09],[0,y-.14,-.61],'accent','accentTop'),
 b([.005,.29,.21],[-.1575,y,-.66],'accent','accentTop'),
 b([.005,.29,.21],[.1575,y,-.66],'accent','accentTop'),
 b([.34,.075,.12],[0,y+.175,-.30],'steel','top'),
];
export const sniperScopeBoxes:readonly WeaponBox[]=[...sniperScopeMounts,...sniperScopeHousing];
export const sniperScopeLenses:readonly LensSpec[]=[
 {id:'objective',boxes:[b([.304,.266,.006],[0,y,-.61],'glass','glassTop'),b([.30,.006,.008],[0,y+.130,-.614],'glassTop','glassTop'),b([.016,.012,.008],[-.11,y+.10,-.614],'glassTop','glassTop')]},
 {id:'eyepiece',viewmodelHidden:true,boxes:[b([.068,.068,.006],[0,y,-.018],'glass','glassTop'),b([.064,.004,.008],[0,y+.032,-.014],'glassTop','glassTop'),b([.008,.008,.008],[-.021,y+.021,-.014],'glassTop','glassTop')]},
];
