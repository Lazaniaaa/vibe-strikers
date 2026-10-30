import {B,make,rgb,roll,paint,glasses,hat,pack,nose} from './configTools';
import type {CharacterConfig} from './types';
const p23={...rgb,body:'#DEB93D',top:'#DEB93D',side:'#AB902E',frame:'#E7E2D6',blackTop:'#1A1C1E',green:'#AAEFA1',beige:'#BB9F7B',beigeTop:'#D1B089',beigeSide:'#927B5F'} as const;
const p4={...rgb,body:'#D8D1C3',top:'#D8D1C3',side:'#A8A399',lens:'#8FE1FE',metal:'#8B97A5',metalTop:'#9AA8B7',metalSide:'#6C7681',brown:'#635848',brownSide:'#4E4538',chest:'#282C31'} as const;
const p40={...roll,body:'#4393BA',top:'#4AA3CF',side:'#347291',lens:'#A9EFA0',band:'#272024'} as const;
const p141={...rgb,body:'#3A3B3F',top:'#3A3B3F',side:'#2C2D31',metal:'#8B97A5',metalTop:'#9AA8B7',metalSide:'#6C7681',lens:'#AAEFA1',chest:'#282C31'} as const;
const p48={...rgb,body:'#2A7F79',top:'#2A7F79',side:'#21645F',metal:'#606978',metalTop:'#6A7585',metalSide:'#4A515C',lens:'#AAEFA1'} as const;
export const batch3:readonly CharacterConfig[]=[
 make('bureau-23',p23,[
  B('head',[1.50,.08,1.17],[0,.99,0],p23.dark,{topColor:p23.blackTop}),
  B('head',[.13,.13,.13],[.18,1.095,.15],p23.dark),B('head',[.13,.13,.13],[-.23,1.095,-.12],p23.beige,{topColor:p23.beigeTop}),
  ...[-1,1].map(s=>B('head',[.30,.35,.085],[s*.255,.43,-.47],p23.dark)),
  B('head',[1.12,.17,.08],[0,.80,-.48],p23.frame),B('head',[1.12,.17,.08],[0,.105,-.48],p23.frame),
  ...[-1,1].flatMap(s=>[B('head',[.15,.49,.08],[s*.485,.45,-.48],p23.frame),B('head',[.10,.12,.15],[s*.62,.53,.05],p23.light),B('head',[.10,.23,.15],[s*.62,.345,.05],p23.light)]),
  B('torso',[.50,.34,.10],[0,-.21,-.30],p23.dark),...[-1,1].map(s=>B('torso',[.10,.37,.07],[s*.29,-.21,-.28],p23.dark)),
  B('torso',[.16,.15,.09],[.04,-.22,-.40],p23.green),
 ],{proportions:{head:[1.12,.95,.85],torso:[.72,.50,.50],arm:[.12,.65,.15],hand:[.28,.12,.32],leg:[.15,.17,.20],foot:[.38,.12,.55]},
 layout:{centers:{handL:[0,-.59,0],handR:[0,-.59,0]}},surfaces:{foot:paint(p23.beige,p23.beigeTop,p23.beigeSide),leg:paint(p23.body,p23.top,p23.side)},
 flags:['H3/P1: велике поле закриває верх head-box','C1: темні очі мають намальований відблиск, без прозорого/блискучого матеріалу','Різнокольорові верхні куби не дзеркалені; H1 лише для бічних вставок']}),
 make('bureau-4',p4,[...hat(p4),...pack(p4,p4.brown,p4.brownSide),...glasses(p4,p4.lens),
  B('head',[.13,.13,.11],[0,.16,-.53],p4.metal,{topColor:p4.metalTop,sideColor:p4.metalSide}),
  B('torso',[.15,.43,.065],[0,-.23,-.29],p4.light),B('torso',[.14,.13,.075],[0,-.06,-.36],p4.metal),
 ],{proportions:{torso:[.74,.48,.50],hand:[.26,.26,.28],leg:[.24,.18,.26],foot:[.17,.09,.25]},
 surfaces:{hand:paint(p4.metal,p4.metalTop,p4.metalSide),leg:paint(p4.chest)},flags:['H2/H3/P1: один задньобічний блок; форма прихованої голови під капелюхом оцінена']}),
 make('bureau-roll-40-10',p40,[
  B('head',[1.05,.095,.83],[0,.90,0],p40.band),B('head',[1.05,.15,.83],[0,1.075,0],p40.body,{topColor:p40.top,sideColor:p40.side}),
  B('head',[.74,.075,.59],[0,1.1875,0],p40.body,{topColor:p40.top,sideColor:p40.side}),
  ...glasses(p40,p40.lens,{w:.34,h:.52,pupilW:.13,pupilH:.35,y:.31}),
  ...[-1,1].map(s=>B('head',[.11,.22,.10],[s*.057,.04,-.53],p40.light)),
  B('torso',[.23,.22,.10],[0,-.18,-.30],p40.band),
  B('torso',[.10,.41,.30],[-.56,.15,.13],p40.lens),
  ...[-1,1].map(s=>B(s<0?'armL':'armR',[.21,.19,.26],[0,0,0],p40.body,{topColor:p40.top,sideColor:p40.side})),
 ],{proportions:{head:[1.05,1.00,.82],torso:[.75,.43,.50],arm:[.12,.57,.16],hand:[.12,.08,.19],leg:[.25,.18,.25],foot:[.26,.12,.34]},
 surfaces:{arm:paint(p40.light,p40.lightTop,p40.lightSide),leg:paint(p40.body,p40.top,p40.side)},flags:['H4: одна зелена бічна деталь, не повний вигаданий рюкзак','P1: межа head-box/синього убору оцінена; тонкі руки подовжені за силуетом']}),
 make('viber-141',p141,[
  B('head',[1.45,.15,1.10],[0,.755,0],p141.metal,{topColor:p141.metalTop,sideColor:p141.metalSide}),
  B('head',[1.18,.15,.95],[0,.905,0],p141.metal,{topColor:p141.metalTop,sideColor:p141.metalSide}),
  B('head',[.90,.09,.75],[0,1.025,0],p141.metal,{topColor:p141.metalTop,sideColor:p141.metalSide}),
  B('head',[.29,.10,.09],[0,.87,-.55],p141.lens,{glow:true}),
  ...glasses(p141,p141.lens,{y:.27,z:-.49,pupil:p141.dark,pupilW:.10,pupilH:.28}),nose(p141,-.54,.11),
  B('head',[1.30,.08,.95],[0,-.04,0],p141.metal,{sideColor:p141.metalSide}),
  B('head',[.34,.33,.43],[-.73,.37,.10],p141.metal,{topColor:p141.metalTop,sideColor:p141.metalSide}),B('head',[.12,.11,.26],[-.63,.08,.10],p141.metal),
  B('torso',[.65,.30,.10],[0,-.20,-.33],p141.chest),B('torso',[.65,.10,.10],[0,-.055,-.34],p141.dark),
  B('armL',[.12,.18,.12],[.13,-.36,-.14],p141.light),
  ...[-1,1].map(s=>B(s<0?'legL':'legR',[.31,.09,.055],[0,-.16,-.285],p141.light)),
 ],{proportions:{head:[1.17,.68,.90],torso:[.82,.40,.54],arm:[.20,.30,.25],hand:[.17,.37,.22],leg:[.22,.13,.29],foot:[.33,.10,.45]},
 surfaces:{arm:paint(p141.body,p141.top,p141.side),foot:paint(p141.dark)},flags:['P1: широка низька голова під трьома ступенями шолома','H4: один бічний сірий модуль та один передній світлий виступ; прихованих копій немає','G1: світиться лише лампа; чорні центри лінз не світні']}),
 make('viber-48',p48,[
  B('head',[1.08,.16,.84],[0,1.04,0],p48.metal,{topColor:p48.metalTop,sideColor:p48.metalSide}),
  B('head',[.33,.10,.30],[0,1.17,0],p48.light),B('head',[.10,.10,.10],[0,1.27,0],p48.dark),
  B('head',[.88,.065,.12],[0,1.35,0],p48.light,{topColor:p48.lightTop}),B('head',[.12,.065,.72],[0,1.415,0],p48.light,{topColor:p48.lightTop}),
  ...glasses(p48,p48.lens),B('head',[.13,.13,.11],[0,.16,-.53],p48.metal),
  B('torso',[.62,.09,.07],[0,-.065,-.29],p48.metal),
  B('torso',[.13,.32,.07],[.16,-.19,-.35],p48.light),B('torso',[.13,.09,.08],[.16,-.395,-.35],p48.dark),
  B('torso',[.13,.20,.07],[-.15,-.13,-.35],p48.light),
 ],{proportions:{head:[1.08,.96,.84],torso:[.74,.47,.50],arm:[.12,.43,.17],hand:[.15,.11,.20],leg:[.20,.10,.24],foot:[.28,.11,.35]},
 surfaces:{leg:paint(p48.dark),foot:paint(p48.lens)},flags:['H3/P1: хрест на осі статичний, прихованого механізму немає','Дві світлі нагрудні підвіски різної довжини; не симетризовано','Яскраві зелені стопи без доведеного ореолу, не glow']}),
];
