import {B,make,rgb,paint,glasses,eyes,cap,horns,mohawk,pack,nose} from './configTools';
import type {CharacterConfig} from './types';
const p10={...rgb,body:'#284C40',top:'#284C40',side:'#1F3C32',green:'#335F40',greenTop:'#396848',greenSide:'#294832',lens:'#7FE8D9',chest:'#282C31',brown:'#635848'} as const;
const p103={...rgb,lightTop:'#EDF2FE',body:'#97895E',top:'#A79967',side:'#776A4A',eye:'#EDF2FE',chest:'#282C31'} as const;
const p31={...rgb,body:'#B53B29',top:'#C9412D',side:'#8E2E21',brown:'#9E6047',brownSide:'#7B4938',pack:'#635848',packSide:'#4E4538'} as const;
const p42={...rgb,body:'#D69056',top:'#D69056',side:'#A77043',green:'#335F40',greenTop:'#396848',greenSide:'#294832',eye:'#7FE8D9',brown:'#635848',brownSide:'#4E4538'} as const;
const p71={...rgb,body:'#814328',top:'#8E4A2A',side:'#653420',lens:'#AAEFA1',chest:'#282C31',beige:'#BB9F7B'} as const;
export const batch2:readonly CharacterConfig[]=[
 make('viber-10',p10,[...cap(p10,p10.green,p10.greenTop,p10.greenSide),...glasses(p10,p10.lens),
  ...[-1,1].map(s=>B('head',[.13,.115,.085],[s*.35,.66,-.45],p10.light)),
  B('torso',[.38,.11,.075],[0,-.07,-.29],p10.chest),B('torso',[.13,.24,.075],[0,-.22,-.29],p10.chest),
  ...[-1,1].map(s=>B('torso',[.15,.13,.075],[s*.12,-.37,-.30],p10.chest)),
  ...[-1,1].map(s=>B(s<0?'legL':'legR',[.404,.08,.564],[0,-.32,-.035],p10.lens)),
 ],{proportions:{leg:[.25,.16,.30],foot:[.40,.22,.56]},surfaces:{hand:paint(p10.brown),leg:paint(p10.chest),foot:paint(p10.chest)},flags:['H3/P1: кепка з одним спостережуваним заднім виступом; aqua-підошви без glow']}),
 make('viber-103',p103,[...horns(p103),...eyes(p103,p103.eye),
  ...[-.30,0,.30].map(x=>B('torso',[.13,.35,.08],[x,-.23,-.31],p103.chest)),
  ...[-.385,-.15,.15,.385].map(x=>B('torso',[.095,.35,.045],[x,-.23,-.275],p103.eye)),
  ...[-1,1].map(s=>B(s<0?'armL':'armR',[.22,.16,.26],[0,-.48,-.025],p103.eye)),
 ],{proportions:{torso:[.82,.46,.50]},surfaces:{arm:paint(p103.chest),leg:paint(p103.body,p103.top,p103.side)},flags:['Нижні білі блоки кистей відновлені симетрично за видимою праворуч на PNG рукою']}),
 make('viber-31',p31,[...mohawk(p31,p31.brown,p31.brown,p31.brownSide),...pack(p31,p31.pack,p31.packSide),
  ...[-1,1].flatMap(s=>[B('head',[.31,.30,.09],[s*.31,.39,-.46],p31.light),B('head',[.105,.10,.07],[s*.31,.285,-.535],p31.dark,{border:.007})]),
  nose(p31,-.51,.17),B('head',[.13,.105,.08],[0,.07,-.51],p31.brown),
  B('torso',[.66,.41,.07],[0,-.22,-.29],p31.dark),B('torso',[.28,.18,.09],[-.16,-.11,-.36],p31.brown),
  B('torso',[.085,.085,.045],[.06,-.11,-.34],p31.light),
  ...[-1,1].map(s=>B(s<0?'armL':'armR',[.25,.08,.28],[0,-.25,-.025],p31.dark)),
 ],{proportions:{leg:[.23,.11,.26],foot:[.25,.10,.34]},flags:['H2: один бічний блок зі світлим стрижнем, кріплення спини не вигадане','Коричнева накладка грудей залишається однією; чотири пластини ірокеза різні']}),
 make('viber-42',p42,[
  B('head',[.99,.09,.77],[0,.955,0],p42.green,{topColor:p42.greenTop,sideColor:p42.greenSide}),
  ...horns(p42,p42.light,p42.lightTop,p42.lightSide,1.00),...eyes(p42,p42.eye),...pack(p42,p42.brown,p42.brownSide),
  B('torso',[.68,.105,.07],[0,-.12,-.29],p42.light),B('torso',[.13,.115,.08],[.12,-.12,-.37],p42.green),
  ...[-1,1].map(s=>B(s<0?'legL':'legR',[.30,.12,.055],[0,-.25,-.27],p42.light)),
 ],{surfaces:{hand:paint(p42.brown),leg:paint(p42.body,p42.top,p42.side),foot:paint(p42.body,p42.top,p42.side)},flags:['H2/P1: одиночний бічний модуль; верх голови під зеленою плитою оцінено','Aqua-очі не мають явного ореолу, glow не доданий']}),
 make('viber-71',p71,[
  ...[-1,1].flatMap(s=>[B('head',[.18,.46,.32],[s*.67,.60,.06],p71.body,{topColor:p71.top,sideColor:p71.side}),
   B('head',[.22,.12,.34],[s*.67,.94,.06],p71.body,{topColor:p71.top}),B('head',[.12,.09,.20],[s*.67,.32,.03],p71.body)]),
  B('head',[.43,.43,.09],[.30,.31,-.46],p71.lens),B('head',[.25,.25,.055],[.30,.30,-.535],p71.light),
  B('head',[.25,.25,.10],[-.31,.31,-.465],p71.dark),B('head',[.13,.25,.11],[-.31,.06,-.465],p71.light),nose(p71,-.51,.12),
  B('head',[.13,.23,.08],[-.31,.72,-.46],p71.light),B('head',[.13,.23,.10],[.62,.72,-.40],p71.beige),
  B('torso',[.67,.41,.07],[0,-.23,-.29],p71.chest),
  ...[.53,.48,.41].map((w,i)=>B('torso',[w,.085,.08],[.03+i*.025,-.105-i*.105,-.36],p71.light)),
 ],{proportions:{head:[1.16,.91,.86],arm:[.12,.40,.18],hand:[.18,.12,.22],foot:[.27,.13,.35]},
 surfaces:{leg:paint(p71.body,p71.top,p71.side)},flags:['Асиметрія: одна зелена лінза, одне чорне око зі світлим виступом; різні верхні куби не дзеркалилися','H1 застосовано лише до великої форми вух та кінцівок']}),
];
