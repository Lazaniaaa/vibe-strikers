import type { WeaponId } from './types';
import { weaponIds } from './weaponIds.ts';

export const CANDY_PALETTES=[
 {id:'strawberry',name:'Strawberry Fizz',body:'#F46B91',top:'#FFBDD0',accent:'#FFF0BE',accentTop:'#FFFFFF',ink:'#662F58',glow:'#FFE878'},
 {id:'raspberry',name:'Blue Raspberry',body:'#458EDD',top:'#9AE8FF',accent:'#F9A6E5',accentTop:'#FFDBF3',ink:'#293663',glow:'#72FFFF'},
 {id:'sherbet',name:'Lemon Sherbet',body:'#F3C33D',top:'#FFF0A1',accent:'#EB7D4C',accentTop:'#FFBF94',ink:'#70413F',glow:'#B0FFE8'},
 {id:'mint',name:'Mint Mallow',body:'#43BBA2',top:'#A0F4CF',accent:'#F4D6F2',accentTop:'#FFFFFF',ink:'#255654',glow:'#EEFF9D'},
 {id:'grape',name:'Grape Soda',body:'#9663C9',top:'#D0B1F4',accent:'#F1BA4E',accentTop:'#FFE5A1',ink:'#42305F',glow:'#FF94EC'},
 {id:'peach',name:'Peach Jelly',body:'#EB9473',top:'#FFD4B3',accent:'#72C6E6',accentTop:'#C0F4FF',ink:'#6E3F4E',glow:'#FFF39B'},
 {id:'cocoa',name:'Cocoa Cream',body:'#9D685C',top:'#D7A78A',accent:'#FFE4AA',accentTop:'#FFF9DF',ink:'#423138',glow:'#FFAD87'},
 {id:'bubblegum',name:'Bubblegum Pop',body:'#D56BCE',top:'#F7B8F1',accent:'#67D8D3',accentTop:'#BAFFF1',ink:'#56366C',glow:'#AAFAFF'},
] as const;
export const CANDY_PATTERNS=['stripes','checks','camo','pixels','bricks','circuit'] as const;
export type KitFamily='wafer'|'gumball'|'licorice'|'blocks'|'ribbon';
export interface DetailPiece {u:number;v:number;w:number;h:number;layer:number;role:'body'|'top'|'accent'|'ink'|'glow';angle?:number}
/** Raised top silhouettes: a wafer fin, paired gum pods, cable rails, toy studs or gift bow. */
export const TOP_KITS:Readonly<Record<KitFamily,readonly DetailPiece[]>>={
 wafer:[{u:0,v:0,w:.78,h:.72,layer:0,role:'body'},{u:0,v:0,w:.70,h:.52,layer:2,role:'accent'},{u:0,v:0,w:.16,h:.64,layer:4,role:'glow'}],
 gumball:[{u:0,v:0,w:.82,h:.70,layer:0,role:'ink'},{u:-.21,v:0,w:.30,h:.55,layer:3,role:'top'},{u:.21,v:0,w:.30,h:.55,layer:4,role:'glow'}],
 licorice:[{u:0,v:0,w:.85,h:.65,layer:0,role:'ink'},{u:-.30,v:0,w:.14,h:.54,layer:4,role:'accent'},{u:.30,v:0,w:.14,h:.54,layer:4,role:'glow'}],
 blocks:[{u:0,v:0,w:.80,h:.70,layer:0,role:'body'},{u:-.21,v:0,w:.25,h:.32,layer:4,role:'accent'},{u:.21,v:0,w:.25,h:.32,layer:4,role:'glow'}],
 ribbon:[{u:0,v:0,w:.80,h:.70,layer:0,role:'body'},{u:0,v:0,w:.66,h:.16,layer:3,role:'accent',angle:30},{u:0,v:0,w:.66,h:.16,layer:4,role:'glow',angle:-30}],
};
/** Ready modular box parts, in normalized panel coordinates. Same library fits the actual weapon anatomy. */
export const KIT_PARTS:Readonly<Record<KitFamily,readonly DetailPiece[]>>={
 wafer:[{u:0,v:0,w:.94,h:.85,layer:0,role:'ink'},{u:0,v:0,w:.87,h:.7,layer:1,role:'body'},
  {u:0,v:-.32,w:.86,h:.09,layer:2,role:'accent'},{u:0,v:.32,w:.86,h:.09,layer:2,role:'accent'},
  {u:-.28,v:0,w:.09,h:.62,layer:3,role:'top'},{u:-.09,v:0,w:.09,h:.62,layer:3,role:'accent'},
  {u:.10,v:0,w:.09,h:.62,layer:3,role:'top'},{u:.29,v:0,w:.09,h:.62,layer:3,role:'glow'},
  {u:-.41,v:0,w:.06,h:.73,layer:3,role:'ink'},{u:.41,v:0,w:.06,h:.73,layer:3,role:'ink'}],
 gumball:[{u:0,v:0,w:.92,h:.86,layer:0,role:'ink'},{u:0,v:0,w:.84,h:.72,layer:1,role:'accent'},
  {u:-.25,v:0,w:.32,h:.57,layer:2,role:'body'},{u:.14,v:0,w:.32,h:.57,layer:2,role:'body'},
  {u:-.25,v:0,w:.22,h:.39,layer:3,role:'top'},{u:.14,v:0,w:.22,h:.39,layer:3,role:'glow'},
  {u:.37,v:-.22,w:.13,h:.18,layer:4,role:'top'},{u:.37,v:.03,w:.13,h:.18,layer:4,role:'accent'},
  {u:-.4,v:-.34,w:.12,h:.12,layer:3,role:'accent'},{u:.37,v:.3,w:.13,h:.18,layer:4,role:'body'}],
 licorice:[{u:0,v:0,w:.93,h:.87,layer:0,role:'body'},{u:-.33,v:0,w:.17,h:.72,layer:1,role:'ink'},
  {u:.33,v:0,w:.17,h:.72,layer:1,role:'ink'},{u:0,v:0,w:.6,h:.13,layer:2,role:'ink',angle:20},
  {u:0,v:0,w:.6,h:.07,layer:3,role:'glow',angle:20},{u:-.28,v:-.28,w:.25,h:.15,layer:4,role:'accent'},
  {u:.29,v:.28,w:.25,h:.15,layer:4,role:'accent'},{u:-.3,v:.28,w:.15,h:.12,layer:3,role:'top'},
  {u:.30,v:-.28,w:.15,h:.12,layer:3,role:'top'},{u:0,v:-.3,w:.3,h:.08,layer:3,role:'accent'}],
 blocks:[{u:0,v:0,w:.94,h:.86,layer:0,role:'ink'},{u:-.22,v:0,w:.4,h:.7,layer:1,role:'body'},
  {u:.22,v:0,w:.4,h:.7,layer:1,role:'accent'},{u:-.22,v:-.2,w:.16,h:.21,layer:3,role:'top'},
  {u:-.22,v:.2,w:.16,h:.21,layer:3,role:'glow'},{u:.22,v:-.2,w:.16,h:.21,layer:3,role:'top'},
  {u:.22,v:.2,w:.16,h:.21,layer:3,role:'body'},{u:-.42,v:0,w:.07,h:.77,layer:4,role:'accent'},
  {u:.42,v:0,w:.07,h:.77,layer:4,role:'accent'},{u:0,v:0,w:.06,h:.8,layer:3,role:'ink'}],
 ribbon:[{u:0,v:0,w:.93,h:.86,layer:0,role:'body'},{u:0,v:0,w:.9,h:.2,layer:1,role:'ink'},
  {u:0,v:0,w:.9,h:.1,layer:2,role:'accent'},{u:0,v:0,w:.19,h:.8,layer:1,role:'ink'},
  {u:0,v:0,w:.10,h:.8,layer:2,role:'accent'},{u:0,v:0,w:.27,h:.37,layer:3,role:'ink',angle:45},
  {u:0,v:0,w:.18,h:.26,layer:4,role:'glow',angle:45},{u:-.29,v:.23,w:.24,h:.15,layer:3,role:'top',angle:-25},
  {u:.29,v:-.23,w:.24,h:.15,layer:3,role:'top',angle:-25},{u:-.3,v:-.28,w:.12,h:.13,layer:4,role:'accent'}],
};
const kitNames:Record<WeaponId,readonly string[]>={knife:['Wafer blade','Gumball guard','Licorice spine','Brick cutter','Ribbon dagger'],pistol:['Wafer pocket','Gumball cap','Licorice loop','Brick popper','Gift slide'],rifle:['Wafer runner','Gumball rail','Licorice harness','Block trooper','Ribbon carbine'],sniper:['Wafer telescope','Gumball spotter','Licorice barrel','Block lookout','Ribbon ranger'],shotgun:['Wafer boom','Gumball pump','Licorice grip','Block blunder','Gift blaster'],beam:['Wafer capacitor','Gumball battery','Licorice coils','Block ray','Ribbon projector'],bouncer:['Wafer spring','Gumball stack','Licorice bounce','Block hopper','Ribbon boing'],slingshot:['Wafer fork','Gumball prongs','Licorice bow','Block catapult','Ribbon launcher'],rail:['Wafer rails','Gumball coils','Licorice tracks','Block accelerator','Ribbon sled'],splat:['Wafer tank','Gumball paint','Licorice hose','Block sprayer','Gift paintbox'],paintGrenade:['Wafer canister','Gumball bomb','Licorice fuse','Block parcel','Ribbon surprise']};
export const DETAIL_KITS=Object.freeze(Object.fromEntries(weaponIds.map(weapon=>[weapon,Object.freeze((['wafer','gumball','licorice','blocks','ribbon'] as const).map((family,i)=>Object.freeze({id:weapon+'-'+family,name:kitNames[weapon][i],family})))]))) as Readonly<Record<WeaponId,readonly {id:string;name:string;family:KitFamily}[]>>;
for(const palette of CANDY_PALETTES)Object.freeze(palette);Object.freeze(CANDY_PALETTES);Object.freeze(CANDY_PATTERNS);
for(const parts of Object.values(KIT_PARTS)){for(const part of parts)Object.freeze(part);Object.freeze(parts);}Object.freeze(KIT_PARTS);
for(const parts of Object.values(TOP_KITS)){for(const part of parts)Object.freeze(part);Object.freeze(parts);}Object.freeze(TOP_KITS);
