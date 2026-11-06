import type { HexColor } from '../characters/types';
import type { WeaponId } from './types';
import { weaponIds } from './weaponIds.ts';
import { CANDY_PALETTES, CANDY_PATTERNS, DETAIL_KITS, type KitFamily } from './skinParts.ts';
import { RARITY_STYLES } from './skinRarity.ts';
export { RARITY_STYLES } from './skinRarity.ts';
export { CANDY_PALETTES, CANDY_PATTERNS, DETAIL_KITS } from './skinParts.ts';
export const SKIN_RARITIES=['common','uncommon','rare','epic','legendary','mythic'] as const;
export type SkinRarity=typeof SKIN_RARITIES[number];
export type SkinPattern=typeof CANDY_PATTERNS[number];
export interface SkinTraits {
 readonly version:3;readonly season:'Candy & Toys';readonly weapon:WeaponId;readonly rarity:SkinRarity;readonly seed:number;
 readonly silhouette:Readonly<{id:string;name:string;level:number}>;
 readonly dyeBatch:number;
 readonly colourSet:Readonly<{id:string;name:string;ink:HexColor;glow:HexColor}>;
 readonly body:Readonly<{name:string;color:HexColor;top:HexColor}>;
 readonly accent:Readonly<{name:string;color:HexColor;top:HexColor}>;
 readonly pattern:Readonly<{id:SkinPattern;name:string;columns:number;rows:number;ink:HexColor;variant:number}>;
 readonly detail:Readonly<{id:string;name:string;family:KitFamily;density:number;variant:number}>;
 readonly finish:'Flat candy'|'Candy enamel'|'Sugar frost'|'Foil gold'|'Prismatic candy';readonly addon:string;readonly glow:'None'|'Candy light'|'Reactive candy light';
}
export interface GenerateSkinOptions {weapon:WeaponId;rarity:SkinRarity;seed:number}
const titles:Record<WeaponId,string>={knife:'Knife',pistol:'Pistol',rifle:'Rifle',sniper:'Sniper',shotgun:'Shotgun',beam:'Pixel Beam',bouncer:'Bouncy Blaster',slingshot:'Slingshot',rail:'Rail Pixel',splat:'Splat Gun',paintGrenade:'Paint Bomb'};
const names:Record<SkinPattern,string>={stripes:'Candy stripes',checks:'Wafer checks',camo:'Mallow blocks',pixels:'Sugar sprinkles',bricks:'Toy bricks',circuit:'Sugar circuit'};
/** Integer-only PRNG: no trigonometry, platform colour conversion, time or ambient randomness. */
export function skinHash(value:number):number{let x=value>>>0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return(x^(x>>>16))>>>0;}
function word(text:string):number{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;}
/** Flat dye-batch tint, at most eight RGB steps per channel: variety without surface noise or a new tier hue. */
function candyDye(hex:HexColor,batch:number):HexColor{const value=parseInt(hex.slice(1),16),offsets=[batch%17-8,Math.floor(batch/17)%17-8,Math.floor(batch/289)%17-8],channels=[value>>>16,(value>>>8)&255,value&255];return ('#'+channels.map((v,i)=>Math.max(0,Math.min(255,v+offsets[i])).toString(16).padStart(2,'0')).join('')) as HexColor;}
export function generateSkinTraits({weapon,rarity,seed}:GenerateSkinOptions):SkinTraits{
 if(!weaponIds.includes(weapon))throw Error('Unknown skin weapon');const tier=SKIN_RARITIES.indexOf(rarity);if(tier<0||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Expected rarity and uint32 seed');
 let state=skinHash(seed^word(weapon)^Math.imul(tier+1,0x9e3779b9));const next=()=>{state=(state+0x9e3779b9)>>>0;return skinHash(state);};
 const style=RARITY_STYLES[rarity],set=CANDY_PALETTES[style.palettes[next()%style.palettes.length]],pattern=CANDY_PATTERNS[next()%6],kit=DETAIL_KITS[weapon][next()%5],variant=next();
 const dyeBatch=tier<2?variant%4913:0,body=tier===5?'#FFF2FA':tier===4?'#513443':tier<2?candyDye(set.body,dyeBatch):set.body,top=tier===5?'#FFFFFF':tier===4?'#D99A31':tier<2?candyDye(set.top,dyeBatch):set.top;
 const accent=tier===5?'#974DE0':tier===4?'#F8C44F':tier===0?body:tier===1?'#FFF0BE':tier===3?'#56E2EC':set.accent;
 const accentTop=tier===5?'#E2C6FF':tier===4?'#FFF0AE':tier===0?top:tier===1?'#FFFFFF':tier===3?'#B3FFFF':set.accentTop;
 return Object.freeze({version:3,season:'Candy & Toys',weapon,rarity,seed,dyeBatch,silhouette:Object.freeze({id:style.id,name:style.name,level:tier}),
  colourSet:Object.freeze({id:set.id,name:set.name,ink:set.ink,glow:tier===3?'#73FFFF':tier===4?'#FFEFC2':tier===5?'#7BFFFF':set.glow}),body:Object.freeze({name:set.name,color:body,top}),accent:Object.freeze({name:tier===4?'Reserved gold foil':tier===5?'Reserved prismatic trim':set.name+' trim',color:accent,top:accentTop}),
  pattern:Object.freeze({id:pattern,name:tier===0?'Solid candy':tier===1?'Cream strap':tier===2?'Candy inlay':names[pattern],columns:tier===0?1:tier===1?2:tier<4?4:tier===4?5:6,rows:tier<2?1:tier<3?2:tier<5?3:4,ink:set.ink,variant}),
  detail:Object.freeze({...kit,density:style.density,variant:next()}),finish:tier<2?'Flat candy':tier===2?'Candy enamel':tier===3?'Sugar frost':tier===4?'Foil gold':'Prismatic candy',addon:kit.name,
  glow:tier<3?'None':tier<5?'Candy light':'Reactive candy light'});
}
function canonical(value:unknown):string{if(!value||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';}
export function validateSkinTraits(traits:SkinTraits,weapon:WeaponId=traits.weapon):SkinTraits{if(traits.weapon!==weapon)throw Error('Skin/weapon mismatch');const expected=generateSkinTraits(traits);if(canonical(expected)!==canonical(traits))throw Error('Invalid or unsupported generated skin traits');return expected;}
// Quiet tiers deliberately have a finite set of simple looks: unused random words are not uniqueness.
export function skinVisualKey(t:SkinTraits):string{return canonical({version:t.version,weapon:t.weapon,rarity:t.rarity,silhouette:t.silhouette,set:t.colourSet.id,body:t.body,accent:t.accent,pattern:t.silhouette.level>=2?t.pattern:null,family:t.detail.family,emission:t.silhouette.level>=3?t.detail.variant%9:null,finish:t.finish,glow:t.glow});}
export function skinMetadata(traits:SkinTraits,tokenId:string|number){const t=validateSkinTraits(traits);return{name:titles[t.weapon]+' · '+t.rarity[0].toUpperCase()+t.rarity.slice(1)+' #'+tokenId,description:'An original Vibe Strikers Candy & Toys weapon, generated from seed '+t.seed+'. Cosmetic only.',attributes:[{trait_type:'Season',value:t.season},{trait_type:'Weapon',value:titles[t.weapon]},{trait_type:'Rarity',value:t.rarity},{trait_type:'Silhouette',value:t.silhouette.name},{trait_type:'Colour set',value:t.colourSet.name},{trait_type:'Candy dye batch',value:t.dyeBatch},{trait_type:'Detail kit',value:t.detail.name},{trait_type:'Surface pattern',value:t.pattern.name},{trait_type:'Finish',value:t.finish},{trait_type:'Glow',value:t.glow},{trait_type:'Seed',value:t.seed},{trait_type:'Generator version',value:t.version}]};}
