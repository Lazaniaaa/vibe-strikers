import type { SkinRarity } from './skinTraits';
export interface CrownPart {
 x:number;y:number;z:number;w:number;h:number;d:number;
 role:'body'|'accent'|'top'|'glow';
}
/** Tier grammar is fixed, independent of the random detail family. Dimensions are normalized. */
export const RARITY_STYLES={
 common:{id:'sleeve',name:'Candy sleeve',palettes:[0,5],density:110,relief:.08,pattern:0,crown:[]},
 uncommon:{id:'cap',name:'Cream cap',palettes:[1,3],density:125,relief:.18,pattern:0,crown:[
  {x:0,y:.10,z:0,w:.56,h:.20,d:.65,role:'accent'},
 ]},
 rare:{id:'fin',name:'Wafer T-fin',palettes:[2],density:145,relief:.42,pattern:.15,crown:[
  {x:0,y:.20,z:0,w:.20,h:.40,d:.55,role:'body'},
  {x:0,y:.43,z:0,w:.92,h:.18,d:.75,role:'accent'},
  {x:0,y:.55,z:0,w:.65,h:.10,d:.60,role:'top'},
 ]},
 epic:{id:'wings',name:'Neon twin wings',palettes:[4],density:160,relief:.68,pattern:.40,crown:[
  {x:0,y:.10,z:0,w:.94,h:.20,d:.72,role:'body'},
  {x:-.42,y:.40,z:0,w:.22,h:.64,d:.75,role:'accent'},
  {x:.42,y:.40,z:0,w:.22,h:.64,d:.75,role:'accent'},
  {x:-.42,y:.75,z:0,w:.22,h:.10,d:.66,role:'glow'},
  {x:.42,y:.75,z:0,w:.22,h:.10,d:.66,role:'glow'},
 ]},
 legendary:{id:'crown',name:'Golden candy crown',palettes:[6],density:180,relief:.90,pattern:.25,crown:[
  {x:0,y:.10,z:0,w:1.12,h:.20,d:.85,role:'accent'},
  {x:-.44,y:.48,z:0,w:.24,h:.62,d:.80,role:'accent'},
  {x:.44,y:.48,z:0,w:.24,h:.62,d:.80,role:'accent'},
  {x:0,y:.57,z:0,w:.22,h:.80,d:.80,role:'accent'},
  {x:-.44,y:.82,z:0,w:.22,h:.10,d:.70,role:'glow'},
  {x:.44,y:.82,z:0,w:.22,h:.10,d:.70,role:'glow'},
  {x:0,y:.97,z:0,w:.20,h:.06,d:.70,role:'top'},
 ]},
 mythic:{id:'halo',name:'Prismatic double halo',palettes:[7],density:190,relief:1,pattern:.65,crown:[
  {x:0,y:.16,z:0,w:.18,h:.32,d:.55,role:'accent'},
  {x:0,y:.38,z:-.27,w:1.14,h:.15,d:.20,role:'accent'},
  {x:0,y:.38,z:.27,w:1.14,h:.15,d:.20,role:'accent'},
  {x:-.47,y:.38,z:0,w:.20,h:.15,d:.64,role:'glow'},
  {x:.47,y:.38,z:0,w:.20,h:.15,d:.64,role:'glow'},
  {x:0,y:.87,z:-.23,w:.90,h:.15,d:.18,role:'glow'},
  {x:0,y:.87,z:.23,w:.90,h:.15,d:.18,role:'glow'},
  {x:-.37,y:.87,z:0,w:.16,h:.15,d:.52,role:'top'},
  {x:.37,y:.87,z:0,w:.16,h:.15,d:.52,role:'top'},
 ]},
} satisfies Record<SkinRarity,{id:string;name:string;palettes:number[];density:number;relief:number;pattern:number;crown:CrownPart[]}>;
for(const style of Object.values(RARITY_STYLES)){Object.freeze(style.palettes);for(const p of style.crown)Object.freeze(p);Object.freeze(style.crown);Object.freeze(style);}Object.freeze(RARITY_STYLES);
