import { sniperScopeBoxes, sniperScopeLenses, SNIPER_SCOPE_AXIS_Y } from './sniperScope';
import type { Vec3 } from '../characters/types';
import type { WeaponBox, WeaponConfig, WeaponPalette } from './types';

const palette = (accent: WeaponPalette['accent'], accentTop: WeaponPalette['accentTop']): WeaponPalette => ({
  steel: '#424A55', top: '#65717E', shadow: '#282E37', grip: '#242932', outline: '#130F0C', accent, accentTop,
  glass:'#67D9F2',glassTop:'#D3F7FF',
});
const b = (size: Vec3, position: Vec3, color: WeaponBox['color'] = 'steel',
  top: WeaponBox['top'] = 'top', rotate?: WeaponBox['rotate'], glow = false): WeaponBox => ({ size, position, color, top, rotate, glow });
// Inverse of the ready arm's fixed outward roll + original socket orientation.
const readyRotation:Vec3=[.8301798509004253,.39225080435706616,-.396043081009474];

/** Visual designs only. Units: metres; main grip centre = origin, muzzle = -Z. */
export const weapons: readonly WeaponConfig[] = [
  {
    id: 'knife', kind: 'knife', displayName: 'Ніж · Бірюза', palette: palette('#38CDBD', '#80E8D8'),
    mirrorSafe:false,
    tipDistance: .55, muzzle: [0, .025, -.55], parts: {},
    hold:{position:[0,-.035,.025],rotation:readyRotation},stockBack:.111,
    body: [
      b([.16,.15,.22],[0,0,0],'grip','shadow'),
      b([.18,.17,.065],[0,0,.077],'accent','accentTop'),
      b([.18,.17,.045],[0,0,-.07],'accent','accentTop'),
      b([.32,.10,.08],[0,.015,-.145],'shadow','steel'),
      b([.19,.075,.24],[0,.025,-.30],'steel','top'),
      b([.14,.075,.08],[-.025,.025,-.46],'steel','top'),
      b([.075,.065,.05],[-.055,.025,-.525],'accent','accentTop'),
      b([.065,.035,.11],[.035,.066,-.29],'accent','accentTop',undefined,true),
    ],
  },
  {
    id: 'pistol', kind: 'pistol', displayName: 'Пістолет · Корал', palette: palette('#DF7065', '#F59F8E'),
    mirrorSafe:false, sight:{position:[0,.305,.1725],part:'slide'}, adsFovHint:55, adsFov:60,
    tipDistance: .45, muzzle: [0,.22,-.45], ejectPort: [.135,.225,-.16],
    hold:{position:[0,0,0],rotation:readyRotation},stockBack:.106,
    supportGrip:[-.105,-.035,-.15],
    lenses:[{id:'dot',part:'slide',viewmodelHidden:true,boxes:[b([.105,.095,.006],[0,.305,.133],'glass','glassTop'),b([.145,.008,.014],[0,.374,.123],'glassTop','glassTop'),b([.018,.014,.009],[-.032,.331,.128],'glassTop','glassTop')]}],
    body: [
      b([.165,.30,.15],[0,0,0],'grip','shadow',['x',-.16]),
      b([.21,.12,.43],[0,.12,-.155],'shadow','steel'),
      b([.16,.12,.08],[0,.22,-.41],'grip','steel'),
      b([.10,.065,.025],[0,.22,-.438],'shadow','shadow'),
      b([.065,.07,.05],[0,.335,-.355],'accent','accentTop'),
      b([.045,.15,.05],[0,-.005,-.16],'steel','top',['x',-.25]),
      b([.045,.05,.14],[0,-.065,-.095],'steel','top'),
      b([.18,.065,.12],[0,.015,.005],'accent','accentTop'),
    ],
    parts: {
      mag: { position:[0,-.15,.015], boxes:[b([.14,.16,.12],[0,-.025,0],'shadow','steel'), b([.19,.045,.17],[0,-.105,0],'accent','accentTop')] },
      slide: { position:[0,.235,-.16], boxes:[b([.24,.15,.53],[0,0,0]), b([.252,.055,.29],[0,.005,-.075],'accent','accentTop'), b([.252,.035,.07],[0,.005,.18],'shadow','steel'),
        b([.12,.166,.045],[0,.158,.15],'shadow','top'),
        b([.16,.023,.045],[0,.3685,.15],'shadow','top'),b([.16,.023,.045],[0,.2415,.15],'shadow','top'),
        b([.025,.15,.045],[-.0675,.305,.15],'shadow','top'),b([.025,.15,.045],[.0675,.305,.15],'shadow','top')] },
    },
  },
  {
    id: 'rifle', kind: 'rifle', displayName: 'Автомат · Лайм', palette: palette('#A6CF62', '#D0E99B'),
    mirrorSafe:false, sight:{position:[0,.53,-.1525]}, adsFovHint:55, adsFov:55,
    tipDistance: 1.1, muzzle:[0,.18,-1.1], foregrip:[-.105,-.035,-.17], ejectPort:[.155,.18,-.28],
    hold:{position:[0,0,0],rotation:readyRotation},stockBack:.241,
    lenses:[{id:'sight',viewmodelHidden:true,boxes:[b([.14,.12,.006],[0,.53,-.202],'glass','glassTop'),b([.18,.008,.014],[0,.623,-.212],'glassTop','glassTop'),b([.023,.018,.009],[-.043,.556,-.207],'glassTop','glassTop')]}],
    body: [
      b([.17,.30,.17],[0,0,0],'grip','shadow',['x',-.18]),
      b([.28,.24,.52],[0,.17,-.25]),
      b([.31,.20,.39],[0,.15,-.68],'accent','accentTop'),
      b([.12,.18,.12],[-.105,-.035,-.17],'grip','shadow'),
      b([.21,.12,.12],[0,.12,-.91],'shadow','steel'),
      b([.16,.16,.13],[0,.18,-1.035],'shadow','top'),
      b([.08,.08,.025],[0,.18,-1.087],'grip','shadow'),
      b([.22,.16,.19],[0,.15,.135],'steel','top'),
      b([.26,.24,.07],[0,.11,.205],'shadow','steel'),
      b([.18,.10,.15],[0,.08,.08],'grip','shadow'),
      b([.10,.07,.52],[0,.315,-.36],'shadow','steel'),
      b([.07,.09,.065],[0,.335,-.55],'steel','top'),
      b([.12,.10,.09],[0,.39,-.18],'shadow','steel'),
      b([.20,.025,.055],[0,.6075,-.18],'shadow','top'),b([.20,.025,.055],[0,.4525,-.18],'shadow','top'),
      b([.025,.18,.055],[-.0875,.53,-.18],'shadow','top'),b([.025,.18,.055],[.0875,.53,-.18],'shadow','top'),
      b([.318,.045,.22],[0,.16,-.67],'shadow','steel'),
      b([.08,.035,.20],[0,.37,-.37],'accent','accentTop',undefined,true),
    ],
    parts: { mag: { position:[0,.035,-.26], boxes:[b([.18,.19,.22],[0,-.105,0],'shadow','steel'), b([.18,.14,.21],[0,-.255,.035],'shadow','steel',['x',-.16]), b([.215,.065,.24],[0,-.33,.055],'accent','accentTop')] } },
  },
  {
    id: 'sniper', kind: 'sniper', displayName: 'Снайперська · Бузок', palette: palette('#A68BD9', '#CDB7F0'),
    mirrorSafe:false, sight:{position:[0,SNIPER_SCOPE_AXIS_Y,-.01]}, adsFovHint:28, adsFov:28,
    tipDistance:1.4, muzzle:[0,.19,-1.4], foregrip:[-.105,-.035,-.17], ejectPort:[.13,.19,-.27],
    hold:{position:[0,0,0],rotation:readyRotation},stockBack:.281,
    lenses:sniperScopeLenses,
    body: [
      b([.17,.29,.17],[0,0,0],'grip','shadow',['x',-.16]),
      b([.23,.21,.69],[0,.17,-.33]),
      b([.25,.12,.34],[0,.09,-.65],'accent','accentTop'),
      b([.12,.20,.12],[-.105,-.035,-.17],'grip','shadow'),
      b([.12,.12,.42],[0,.19,-.99],'steel','top'),
      b([.24,.21,.20],[0,.19,-1.30],'shadow','steel'),
      b([.105,.09,.025],[0,.19,-1.387],'grip','shadow'),
      b([.21,.17,.23],[0,.14,.155],'steel','top'),
      b([.25,.28,.075],[0,.08,.2425],'accent','accentTop'),
      ...sniperScopeBoxes,
    ],
    parts: {
      mag:{position:[0,-.005,-.28],boxes:[b([.17,.19,.23],[0,-.10,0],'shadow','steel'),b([.21,.05,.25],[0,-.21,0],'accent','accentTop')]},
      bolt:{position:[.14,.21,-.145],boxes:[b([.13,.055,.075],[.055,0,0],'steel','top'),b([.08,.14,.08],[.105,-.055,0],'steel','top'),b([.14,.12,.14],[.105,-.12,0],'accent','accentTop')]},
    },
  },
  {
    id:'shotgun',kind:'shotgun',displayName:'Помпова · Бурштин',palette:palette('#E5A44F','#FFD18C'),
    mirrorSafe:false, sight:{position:[0,.60,-.0425]}, adsFovHint:55, adsFov:62,
    tipDistance:1,muzzle:[0,.21,-1],foregrip:[-.105,-.035,-.17],ejectPort:[.15,.17,-.25],
    hold:{position:[0,0,0],rotation:readyRotation},stockBack:.221,
    body:[
      b([.12,.20,.12],[-.105,-.035,-.17],'grip','shadow'),
      b([.18,.30,.18],[0,0,0],'grip','shadow',['x',-.2]),
      b([.29,.24,.43],[0,.17,-.21],'steel','top'),
      b([.23,.17,.58],[0,.21,-.70],'shadow','steel'),
      b([.14,.105,.52],[0,.065,-.67],'steel','top'),
      b([.28,.21,.065],[0,.21,-.9675],'accent','accentTop'),
      b([.13,.10,.02],[0,.21,-.989],'grip','shadow'),
      b([.22,.17,.19],[0,.15,.105],'steel','top'),
      b([.26,.25,.07],[0,.10,.185],'accent','accentTop'),
      b([.13,.08,.13],[0,.06,.08],'grip','shadow'),
      b([.06,.055,.04],[0,.33,-.91],'accent','accentTop'),
      b([.15,.05,.27],[0,.315,-.20],'shadow','steel'),
      b([.08,.1775,.055],[0,.42875,-.07],'shadow','steel'),
      b([.15,.025,.055],[0,.67,-.07],'shadow','steel'),
      b([.15,.025,.055],[0,.53,-.07],'shadow','steel'),
      b([.025,.165,.055],[-.0625,.60,-.07],'shadow','steel'),
      b([.025,.165,.055],[.0625,.60,-.07],'shadow','steel'),
    ],
    parts:{pump:{position:[0,.045,-.61],boxes:[b([.32,.21,.32],[0,0,0],'accent','accentTop'),...[-.10,0,.10].map(z=>b([.335,.22,.035],[0,0,z],'shadow','steel'))]}},
  },
];
export const weaponIds: readonly WeaponConfig['id'][] = Object.freeze(weapons.map(w=>w.id));





