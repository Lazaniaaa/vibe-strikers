import type { Vec3 } from '../characters/types';
import type { WeaponBox, WeaponConfig, WeaponPalette, WeaponId } from './types';

export const NEW_WEAPON_IDS = ['beam','bouncer','slingshot','rail','splat','paintGrenade'] as const;
export type ToyWeaponId = typeof NEW_WEAPON_IDS[number];
export const isToyWeapon=(id:WeaponId):id is ToyWeaponId=>NEW_WEAPON_IDS.includes(id as ToyWeaponId);
export const TOY_VISUALS = { bandX:.14,bandY:.28,bandZ:-.39,pouchY:.13,pouchZ:-.28,pull:.31,
  flashHz:7,paintHeight:.26,paintBottom:.19,throwRelease:.72,throwReach:.37 } as const;
const rotation:Vec3=[.8301798509004253,.39225080435706616,-.396043081009474];
const palette=(accent:WeaponPalette['accent'],accentTop:WeaponPalette['accentTop'],steel:WeaponPalette['steel'],top:WeaponPalette['top']):WeaponPalette=>({
  accent,accentTop,steel,top,shadow:'#26344B',grip:'#38415B',outline:'#171825',glass:'#FF763D',glassTop:'#FFE8A3',
});
const b=(size:Vec3,position:Vec3,color:WeaponBox['color']='steel',top:WeaponBox['top']='top',glow=false):WeaponBox=>({size,position,color,top,glow});
const grip=()=>[b([.15,.27,.15],[0,0,0],'grip','shadow'),b([.17,.065,.17],[0,-.12,0],'accent','accentTop'),
  b([.12,.17,.12],[-.105,-.035,-.17],'grip','shadow')];
const common={hold:{position:[0,0,0] as Vec3,rotation},stockBack:.1,mirrorSafe:true,foregrip:[-.105,-.035,-.17] as Vec3};
const ring=(z:number,color:WeaponBox['color'],glow=false):WeaponBox[]=>[
  b([.31,.035,.045],[0,.37,z],color,color,glow),b([.31,.035,.045],[0,.09,z],color,color,glow),
  b([.035,.245,.045],[-.1375,.23,z],color,color,glow),b([.035,.245,.045],[.1375,.23,z],color,color,glow)];

/** Six original toy silhouettes. Main grip stays at the origin; all distances are visual metres. */
export const toyWeapons:readonly WeaponConfig[]=[
  { ...common,id:'beam',kind:'beam',displayName:'Pixel Beam',palette:palette('#28D8E0','#B7FFFF','#5367D6','#8EAAFF'),
    tipDistance:.76,muzzle:[0,.19,-.76],parts:{
      heat:{position:[0,.20,-.31],boxes:[b([.016,.04,.26],[-.188,0,0],'glassTop','glassTop',true),b([.016,.04,.26],[.188,0,0],'glassTop','glassTop',true)]},
      alarm:{position:[0,.39,-.27],boxes:[b([.11,.045,.09],[0,0,0],'glass','glass',true)]}},
    body:[...grip(),b([.28,.25,.43],[0,.19,-.23]),b([.29,.27,.20],[0,.19,-.55],'accent','accentTop'),
      b([.21,.17,.10],[0,.19,-.70],'shadow','top'),b([.14,.095,.025],[0,.19,-.755],'accentTop','accentTop',true),
      b([.04,.18,.29],[.16,.19,-.31],'shadow','shadow'),b([.04,.18,.29],[-.16,.19,-.31],'shadow','shadow'),
      ...[-.4,-.29,-.18].map(z=>b([.29,.045,.035],[0,.32,z],'accent','accentTop'))]},
  { ...common,id:'bouncer',kind:'bouncer',displayName:'Bouncy Blaster',palette:palette('#FFB83D','#FFE292','#C959A6','#FF93D9'),
    tipDistance:.65,muzzle:[0,.20,-.65],parts:{},body:[...grip(),b([.26,.25,.32],[0,.17,-.20]),
      b([.29,.29,.12],[0,.20,-.58],'accent','accentTop'),b([.17,.17,.026],[0,.20,-.647],'grip','shadow'),
      ...[-.37,-.42,-.47,-.52].map((z,i)=>b([.18+i*.015,.18+i*.015,.029],[0,.20,z],i%2?'steel':'accent',i%2?'top':'accentTop')),
      b([.25,.22,.23],[0,.39,-.21],'shadow','top'),b([.18,.16,.17],[0,.54,-.21],'accent','accentTop'),
      b([.12,.07,.12],[0,.645,-.21],'steel','top')]},
  { ...common,id:'slingshot',kind:'slingshot',displayName:'Slingshot',palette:palette('#F2AC35','#FFE297','#39BBA4','#91F2CF'),
    tipDistance:.44,muzzle:[0,.27,-.44],parts:{
      bandL:{position:[-.07,.205,-.335],boxes:[b([.035,.035,1],[0,0,0],'glass','glassTop')]},
      bandR:{position:[.07,.205,-.335],boxes:[b([.035,.035,1],[0,0,0],'glass','glassTop')]},
      pouch:{position:[0,.13,-.28],boxes:[b([.10,.075,.085],[0,0,0],'grip','top'),b([.055,.055,.055],[0,0,-.035],'accent','accentTop')]}},
    body:[...grip(),b([.11,.22,.12],[0,.13,-.28]),b([.30,.085,.10],[0,.20,-.39],'accent','accentTop'),
      b([.07,.23,.10],[-.14,.30,-.39]),b([.07,.23,.10],[.14,.30,-.39]),
      b([.09,.055,.12],[-.14,.425,-.39],'accent','accentTop'),b([.09,.055,.12],[.14,.425,-.39],'accent','accentTop')]},
  { ...common,id:'rail',kind:'rail',displayName:'Rail Pixel',palette:palette('#E768D4','#FFA9EB','#5D6BC3','#A6B5FF'),
    tipDistance:1.04,muzzle:[0,.23,-1.04],parts:Object.fromEntries([0,1,2,3].map(i=>['coil'+i,{position:[0,0,-.40-i*.15],boxes:ring(0,'accentTop',true).map(box=>({...box,size:[box.size[0]*.8,box.size[1]*.8,.055] as Vec3}))}])),
    body:[...grip(),b([.25,.23,.32],[0,.16,-.18]),
      b([.07,.08,.76],[-.12,.23,-.65]),b([.07,.08,.76],[.12,.23,-.65]),
      ...[0,1,2,3].flatMap(i=>ring(-.40-i*.15,'shadow')),
      b([.31,.12,.08],[0,.23,-1.0],'accent','accentTop'),b([.10,.12,.17],[0,.35,-.20],'accent','accentTop')]},
  { ...common,id:'splat',kind:'splat',displayName:'Splat Gun',palette:palette('#FF6B8B','#FFBDD0','#47B4D8','#9FF1FF'),
    tipDistance:.60,muzzle:[0,.18,-.60],parts:{paint:{position:[.14,.32,-.23],boxes:[b([.06,.26,.16],[0,0,0],'accent','accentTop')]}},
    body:[...grip(),b([.27,.23,.36],[0,.17,-.22]),b([.28,.20,.12],[0,.18,-.51],'accent','accentTop'),
      b([.15,.09,.025],[0,.18,-.594],'shadow','shadow'),b([.23,.05,.22],[0,.475,-.23],'accent','accentTop'),
      b([.23,.05,.22],[0,.175,-.23],'accent','accentTop'),b([.16,.26,.22],[-.035,.325,-.23]),
      b([.09,.07,.11],[0,.535,-.23],'shadow','top'),b([.05,.07,.05],[.14,.335,-.13],'accentTop','accentTop')]},
  { id:'paintGrenade',kind:'paintGrenade',displayName:'Paint Bomb',palette:palette('#FFD53D','#FFF2A0','#49D4B4','#A5FFE1'),
    hold:{position:[0,0,0],rotation},stockBack:.10,mirrorSafe:true,tipDistance:.40,muzzle:[0,.37,-.16],parts:{},
    body:[b([.09,.22,.09],[0,.015,0],'grip','top'),b([.24,.25,.24],[0,.25,-.035]),
      b([.25,.045,.25],[0,.12,-.035],'accent','accentTop'),b([.25,.045,.25],[0,.38,-.035],'accent','accentTop'),
      b([.14,.04,.14],[0,.425,-.035],'shadow','top'),b([.18,.035,.06],[0,.46,-.065],'accent','accentTop'),
      b([.045,.14,.045],[.105,.385,-.065],'grip','top'),b([.08,.10,.012],[0,.25,-.162],'accent','accentTop')]},
];
