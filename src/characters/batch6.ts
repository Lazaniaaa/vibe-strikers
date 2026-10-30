import {B,make,rgb,paint,hat} from './configTools';
import type {CharacterConfig} from './types';
const p15={body:'#8DC2AE',top:'#B5D5C5',side:'#84AE9D',outline:'#57D9BB',dark:'#548B7B',darkSide:'#508072',light:'#8BC9B9',lightTop:'#B5D5C5',lightSide:'#84AE9D',accent:'#69A090'} as const;
const p24={...rgb,body:'#462F22',top:'#462F22',side:'#37241D',eyeL:'#FFD88A',eyeR:'#FED98A',green:'#335F40',chest:'#282C31'} as const;
const p9={...rgb,light:'#FFE48B',lightTop:'#FFE48B',lightSide:'#FFE48B',body:'#267CB3',top:'#267CB3',side:'#1D618C',hat:'#635848',hatTop:'#6F6250',hatSide:'#4E4538',green:'#335F40',greenTop:'#396848',greenSide:'#294832',eye:'#FFE48B',chest:'#282C31'} as const;
export const batch6:readonly CharacterConfig[]=[
 make('viber-extra-15',p15,[
  B('head',[1.14,.07,.91],[0,.945,0],p15.body,{topColor:p15.top,sideColor:p15.side}),B('head',[.87,.15,.68],[0,1.055,0],p15.accent,{topColor:p15.top,sideColor:p15.side}),B('head',[.10,.12,.10],[0,1.19,0],p15.accent),
  ...[-1,1].map(s=>B('head',[.25,.37,.065],[s*.30,.40,-.46],p15.dark,{topColor:p15.accent,sideColor:p15.darkSide})),
  B('head',[.13,.24,.08],[0,.03,-.48],p15.dark,{topColor:p15.accent}),B('head',[.12,.45,.17],[-.595,.33,0],p15.dark,{sideColor:p15.darkSide}),B('head',[.12,.12,.17],[-.595,.66,0],p15.accent),
  B('torso',[.14,.25,.07],[.25,-.20,-.30],p15.dark),B('torso',[.13,.39,.07],[0,-.16,-.30],p15.dark),B('torso',[.14,.25,.07],[-.25,-.20,-.30],p15.dark),B('torso',[.78,.07,.08],[0,-.40,-.31],p15.dark),
  ...[-1,1].map(s=>B(s<0?'legL':'legR',[.33,.10,.045],[0,-.165,-.315],p15.light)),
 ],{proportions:{head:[1.08,.91,.84],torso:[.75,.44,.51],arm:[.22,.31,.25],hand:[.23,.14,.28],leg:[.22,.12,.29],foot:[.36,.13,.52]},
 surfaces:{arm:paint(p15.body,p15.top,p15.side),hand:paint(p15.body,p15.top,p15.side),leg:paint(p15.body,p15.top,p15.side),foot:paint(p15.body,p15.top,p15.side)},
 flags:['T1: прозорий оригінал навмисно відтворено SOLID у знятих teal-кольорах, alpha невідновлювана','H4/P1: один видимий бічний модуль; наскрізні лінії не стали додатковим декором','Мʼятні контури без ореолу, додатковий glow-матеріал не застосовано']}),
 make('viber-extra-24',p24,[...hat(p24),
  ...[-1,1].flatMap(s=>[B('head',[.32,.31,.09],[s*.32,.30,-.46],p24.dark),B('head',[.115,.105,.06],[s*.32,.285,-.535],s>0?p24.eyeL:p24.eyeR,{glow:true,border:.007})]),
  B('torso',[.11,.40,.07],[0,-.24,-.30],p24.light),B('torso',[.13,.12,.08],[.08,-.09,-.38],p24.green),B('torso',[.55,.055,.055],[0,-.47,-.285],p24.green),
  ...[-1,1].map(s=>B(s<0?'armL':'armR',[.25,.08,.28],[0,-.22,-.025],p24.dark)),
 ],{proportions:{leg:[.24,.15,.29],foot:[.40,.14,.55]},surfaces:{leg:paint(p24.chest),foot:paint(p24.chest)},
 flags:['H3/P1: верх голови під світлим капелюхом оцінено','C2/G1: різні виміряні ядра очей #FFD88A / #FED98A збережені окремо; без bloom']}),
 make('viber-extra-9',p9,[
  B('head',[1.47,.28,1.13],[0,.81,0],p9.hat,{topColor:p9.hatTop,sideColor:p9.hatSide}),
  ...[-1,1].map(s=>B('head',[.22,.24,.25],[s*.41,1.07,.10],p9.hat,{topColor:p9.hatTop,sideColor:p9.hatSide})),B('head',[.82,.12,.16],[0,1.02,.34],p9.hat),
  ...[-1,1].flatMap(s=>[B('head',[.33,.31,.09],[s*.30,.27,-.49],p9.dark),B('head',[.115,.105,.06],[s*.30,.255,-.565],p9.eye,{glow:true,border:.007})]),
  B('head',[.38,.32,.48],[-.75,.34,.08],p9.green,{topColor:p9.greenTop,sideColor:p9.greenSide}),B('head',[.14,.11,.28],[-.65,.07,.10],p9.green),B('head',[1.25,.10,.97],[0,-.045,0],p9.green,{sideColor:p9.greenSide}),
  B('torso',[.73,.11,.09],[0,-.16,-.33],p9.hat),...[-1,1].map(s=>B('torso',[.13,.12,.10],[s*.18,-.29,-.33],p9.hat)),
 ],{proportions:{head:[1.16,.67,.90],torso:[.80,.40,.54],arm:[.18,.24,.23],hand:[.14,.28,.22],leg:[.20,.10,.25],foot:[.27,.11,.36]},
 surfaces:{arm:paint(p9.chest),hand:paint(p9.dark),leg:paint(p9.dark),foot:paint(p9.eye,p9.dark,p9.eye)},
 flags:['H4/P1: один зелений бічний модуль, широка низька голова під великим убором оцінена','C2/G1: світні лише очі; G2: жовті підошви звичайні, однаковий HEX не доказ glow','Охристі верхні куби та задня перекладина продовжені без нових прихованих елементів']}),
];
