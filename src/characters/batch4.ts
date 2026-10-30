import {B,make,rgb,roll,paint,antenna,horns,mohawk,glasses,cap,nose} from './configTools';
import type {CharacterConfig} from './types';
const p24={...rgb,body:'#D69056',top:'#EEA05F',side:'#A77043',mask:'#282C31',green:'#AAEFA1'} as const;
const p22={...roll,body:'#393B40',top:'#393B40',side:'#2C2E32',brown:'#9E5F48',brownTop:'#B06A50',brownSide:'#7B4A38',chest:'#635848'} as const;
const p6={...rgb,body:'#462F22',top:'#4F3328',side:'#37241D',eye:'#AAEFA1',metal:'#8B97A5',metalSide:'#6C7681',brown:'#635848',brownSide:'#4E4538'} as const;
const p63={...rgb,body:'#462F22',top:'#4F3328',side:'#37241D',lens:'#A988FE',red:'#BB4333',redTop:'#D14B3A',redSide:'#923429',brown:'#635848',brownSide:'#4E4538'} as const;
const p84={...rgb,body:'#D8D1C3',top:'#D8D1C3',side:'#A8A399',red:'#BB4333',redTop:'#D14B3A',redSide:'#923429',brown:'#635848',brownSide:'#4E4538',chest:'#282C31'} as const;
export const batch4:readonly CharacterConfig[]=[
 make('bureau-24',p24,[...antenna(p24,p24.green),
  B('head',[1.08,.91,.055],[0,.455,-.44],p24.mask),B('head',[.85,.19,.08],[0,.35,-.51],p24.dark),
  ...[-1,1].flatMap(s=>[B('head',[.13,.12,.07],[s*.24,.35,-.58],p24.light),B('head',[.13,.12,.14],[s*.60,.80,.03],p24.light),B('head',[.13,.12,.14],[s*.60,.44,.03],p24.body)]),
  B('torso',[.62,.30,.07],[0,-.20,-.29],p24.light),B('torso',[.14,.13,.10],[0,-.20,-.38],p24.dark),
  B('torso',[1.10,.07,.65],[0,-.43,0],p24.mask),
  ...[-1,1].map(s=>B(s<0?'legL':'legR',[.47,.10,.055],[0,-.145,-.40],p24.light)),
 ],{proportions:{torso:[.74,.40,.50],arm:[.21,.34,.25],hand:[.26,.10,.28],leg:[.15,.10,.20],foot:[.49,.13,.68]},
 layout:{pivots:{legL:[-.42,.21,0],legR:[.42,.21,0]}},surfaces:{leg:paint(p24.body,p24.top,p24.side)},
 flags:['P2: короткі ноги частково перекриті широкою нижньою полицею; довгі розставлені стопи','Передня темна маска є накладкою, прихована спина залишається помаранчевою']}),
 make('bureau-roll-22-12',p22,[
  B('head',[1.35,.08,1.04],[0,.95,0],p22.dark),B('head',[1.18,.19,.93],[0,1.085,.035],p22.light,{topColor:p22.lightTop,sideColor:p22.lightSide}),
  B('head',[1.00,.11,.07],[0,1.05,-.52],p22.brown,{topColor:p22.brownTop,sideColor:p22.brownSide}),
  ...[-1,1].map(s=>B('head',[.13,.13,.10],[s*.31,.51,-.47],p22.dark)),
  B('head',[1.08,.25,.10],[0,.19,-.47],p22.dark),nose(p22,-.56,.13),
  B('torso',[.42,.25,.09],[.04,-.23,-.30],p22.chest),B('torso',[.14,.12,.08],[-.25,-.31,-.38],p22.light),
  B('torso',[.14,.12,.08],[.02,-.055,-.31],p22.brown),
 ],{proportions:{head:[1.13,.91,.84],torso:[.74,.43,.50],arm:[.12,.50,.16],hand:[.11,.08,.18],leg:[.21,.10,.23],foot:[.40,.12,.56]},
 surfaces:{arm:paint(p22.light,p22.lightTop,p22.lightSide),hand:paint(p22.light,p22.lightTop,p22.lightSide),leg:paint(p22.body,p22.top,p22.side),foot:paint(p22.brown,p22.brownTop,p22.brownSide)},
 flags:['H3/P1/P2: широкий низький убір, короткі ноги й довгі світлі руки; межі кистей оцінені']}),
 make('viber-6',p6,[...horns(p6),B('head',[1.12,.19,.08],[0,.76,-.46],p6.light),
  ...[-1,1].flatMap(s=>[B('head',[.49,.34,.09],[s*.29,.42,-.46],p6.dark),B('head',[.13,.12,.07],[s*.29,.405,-.54],p6.eye,{border:.007})]),
  B('head',[1.12,.09,.84],[0,.015,0],p6.metal,{sideColor:p6.metalSide}),
  ...[-.22,0,.22].map(x=>B('torso',[.20,.10,.07],[x,-.065,-.29],p6.metal)),
  B('torso',[.83,.12,.58],[0,-.41,-.02],p6.brown,{sideColor:p6.brownSide}),
 ],{proportions:{head:[1.12,.91,.84],torso:[.74,.40,.50],arm:[.12,.52,.15],hand:[.12,.07,.18],leg:[.20,.075,.25],foot:[.28,.09,.42]},
 layout:{centers:{handL:[0,-.46,-.025],handR:[0,-.46,-.025]}},surfaces:{arm:paint(p6.light,p6.lightTop,p6.lightSide),leg:paint(p6.brown),foot:paint(p6.brown,p6.brown,p6.brownSide)},
 flags:['P2: дуже низькі ноги та охриста нижня площадка; ноги не подовжувалися до 01','Зелені очі без явного ореолу — звичайний Lambert']}),
 make('viber-63',p63,[...mohawk(p63,p63.red,p63.redTop,p63.redSide),...glasses(p63,p63.lens),nose(p63),
  B('head',[.29,.10,.08],[-.29,.58,-.47],p63.dark),
  B('torso',[.72,.11,.10],[0,-.20,-.30],p63.brown),
  B('torso',[.22,.11,.11],[.25,-.33,-.40],p63.red),B('torso',[.18,.11,.11],[-.055,-.33,-.40],p63.red),B('torso',[.20,.11,.11],[-.285,-.33,-.40],p63.red),
  B('torso',[.90,.08,.55],[0,-.425,0],p63.brown,{sideColor:p63.brownSide}),
 ],{proportions:{head:[1.12,.91,.84],torso:[.74,.38,.50],arm:[.25,.30,.28],hand:[.28,.09,.32],leg:[.20,.075,.25],foot:[.33,.085,.45]},
 surfaces:{leg:paint(p63.brown),foot:paint(p63.brown,p63.brown,p63.brownSide)},flags:['P2: короткі опори злиті з нижньою площадкою, окремий поділ leg/foot оцінений','Одна брова і три різні червоні виступи, без симетризації']}),
 make('viber-84',p84,[...cap(p84,p84.red,p84.redTop,p84.redSide),
  ...[-1,1].map(s=>B('head',[.26,.25,.09],[s*.30,.31,-.49],p84.dark)),nose(p84,-.53,.13),
  B('head',[.93,.11,.08],[0,.42,-.51],p84.red,{topColor:p84.redTop}),...[-1,1].map(s=>B('head',[.13,.11,.11],[s*.51,.42,-.51],p84.red)),
  B('torso',[.20,.26,.25],[-.56,0,.20],p84.red),B('torso',[.63,.10,.08],[0,-.055,-.29],p84.brown),
  B('torso',[.21,.12,.10],[0,-.055,-.37],p84.red),B('torso',[.55,.12,.08],[0,-.18,-.29],p84.chest),B('torso',[.53,.10,.08],[0,-.28,-.29],p84.light),
  B('torso',[.63,.10,.08],[0,-.37,-.29],p84.brown),B('torso',[.92,.085,.56],[0,-.45,0],p84.brown,{sideColor:p84.brownSide}),
 ],{proportions:{head:[1.14,.91,.90],torso:[.72,.42,.50],arm:[.24,.30,.28],hand:[.26,.22,.30],leg:[.20,.07,.25],foot:[.30,.08,.42]},
 layout:{centers:{handL:[0,-.28,-.025],handR:[0,-.28,-.025]}},surfaces:{hand:paint(p84.red,p84.redTop,p84.redSide),leg:paint(p84.brown),foot:paint(p84.brown,p84.brown,p84.brownSide)},
 flags:['H3/P1/P2: низ під площадкою оцінений, кепку продовжено без нових задніх деталей','H4: один червоний задньобічний блок, не повний рюкзак']}),
];
