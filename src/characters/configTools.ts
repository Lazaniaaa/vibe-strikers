import type { BoxSpec, CharacterConfig, CharacterColors, HexColor, PartName, Surface, Vec3 } from './types';
export type Palette = CharacterColors;
export const B = (part: PartName,size: Vec3,position: Vec3,color: HexColor,
  options: Partial<Omit<BoxSpec,'part'|'size'|'position'|'color'>> = {}): BoxSpec => ({part,size,position,color,...options});
export const rgb = {outline:'#130F0C',dark:'#17191A',darkSide:'#121416',light:'#CECBC1',lightTop:'#E7E2D6',lightSide:'#A29E96'} as const;
export const roll = {outline:'#14100D',dark:'#17191B',darkSide:'#121415',light:'#CFCBC1',lightTop:'#E6E1D6',lightSide:'#A19E96'} as const;
export const sharedFlags = ['H0: спина й прихований бік однотонні, без вигаданих деталей',
  'H1: симетричні парні деталі віддзеркалені за видимою формою',
  'P0: глибина, стики та пропорції оцінені з одного 3/4-ракурсу'];
export const paint = (color: HexColor,topColor=color,sideColor=color): Surface => ({color,topColor,sideColor});
const defaultSizes = {head:[1.08,.91,.82],torso:[.74,.46,.50],arm:[.22,.26,.26],hand:[.25,.19,.28],leg:[.23,.20,.26],foot:[.32,.14,.46]} as const;
/** Config data helper only. Every model is built by the one createCharacter template. */
export function make(stem:string,p:Palette,extras:BoxSpec[],options:Partial<Omit<CharacterConfig,'id'|'name'|'colors'|'extras'>>={}):CharacterConfig{
 const id='vibe-vibers-'+stem;
 return {id,name:id,colors:p,proportions:{...defaultSizes,...options.proportions},
  surfaces:{head:paint(p.body,p.top??p.body,p.side??p.body),torso:paint(p.body,p.top??p.body,p.side??p.body),
   arm:paint(p.body,p.top??p.body,p.side??p.body),hand:paint(p.light,p.lightTop,p.lightSide),
   leg:paint(p.light,p.lightTop,p.lightSide),foot:paint(p.dark,p.dark,p.darkSide),...options.surfaces},
  layout:options.layout,extras,flags:[...sharedFlags,...(options.flags??[])]};
}
export function glasses(p:Palette,lens:HexColor,opts:{y?:number,z?:number,w?:number,h?:number,pupilW?:number,pupilH?:number,pupil?:HexColor,glow?:boolean}={}):BoxSpec[]{
 const {y=.30,z=-.46,w=.43,h=.44,pupilW=.24,pupilH=.25,pupil=p.light,glow=false}=opts;
 return [-1,1].flatMap(s=>[B('head',[w,h,.09],[s*.29,y,z],lens,{glow}),
  B('head',[pupilW,pupilH,.055],[s*.29,y-.015,z-.075],pupil,{topColor:pupil===p.dark?p.dark:p.lightTop,sideColor:pupil===p.dark?p.darkSide:p.lightSide})]);
}
export function eyes(p:Palette,color:HexColor,opts:{y?:number,z?:number,glow?:boolean}={}):BoxSpec[]{
 const {y=.30,z=-.46,glow=false}=opts;
 return [-1,1].flatMap(s=>[B('head',[.32,.31,.09],[s*.32,y,z],p.dark),
  B('head',[.115,.105,.06],[s*.32,y-.015,z-.075],color,{glow,border:.007})]);
}
export function hat(p:Palette,y=.91,color=p.light,top=p.lightTop,side=p.lightSide):BoxSpec[]{
 return [B('head',[1.40,.065,1.14],[0,y+.0325,0],color,{topColor:top,sideColor:side}),
  B('head',[.88,.22,.76],[0,y+.175,.025],color,{topColor:top,sideColor:side})];
}
export function cap(p:Palette,color:HexColor,top=color,side=color,y=.91):BoxSpec[]{
 return [B('head',[1.12,.17,.88],[0,y+.085,0],color,{topColor:top,sideColor:side}),
  B('head',[.64,.075,.55],[0,y+.2075,-.04],color,{topColor:top,sideColor:side}),
  B('head',[1.12,.075,.26],[0,y+.11,.55],color,{topColor:top,sideColor:side})];
}
export function antenna(p:Palette,color:HexColor,y=.91,t=false):BoxSpec[]{
 return [B('head',[.12,.27,.12],[0,y+.135,.015],p.dark),
  ...(t?[B('head',[.33,.095,.14],[0,y+.3025,.015],color),B('head',[.12,.10,.14],[0,y+.40,.015],color)]:[B('head',[.12,.11,.12],[0,y+.325,.015],color)])];
}
export function mohawk(p:Palette,color:HexColor,top=color,side=color,y=.91):BoxSpec[]{
 return [.29,.48,.61,.45].map((h,i)=>B('head',[.105,h,.12],[0,y+h/2,-.30+i*.20],color,{topColor:top,sideColor:side}));
}
export function horns(p:Palette,color=p.body,top=p.top??color,side=p.side??color,y=.91):BoxSpec[]{
 return [-1,1].flatMap(s=>[B('head',[.22,.24,.25],[s*.35,y+.12,0],color,{topColor:top,sideColor:side}),
  B('head',[.15,.14,.19],[s*.385,y+.31,.025],color,{topColor:top,sideColor:side})]);
}
export function pack(p:Palette,color:HexColor,side=color):BoxSpec[]{
 return [B('torso',[.27,.86,.34],[-.66,.015,.20],color,{sideColor:side}),
  B('torso',[.14,.43,.18],[-.66,.66,.20],p.light,{topColor:p.lightTop,sideColor:p.lightSide})];
}
export function nose(p:Palette,z=-.505,y=.10):BoxSpec{return B('head',[.13,.13,.11],[0,y,z],p.dark);}
