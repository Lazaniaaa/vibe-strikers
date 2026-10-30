import {B,make,rgb,roll,paint,mohawk,antenna,pack} from './configTools';
import type {CharacterConfig} from './types';
const p20={...rgb,body:'#C0AF8C',top:'#D7C29B',side:'#96896B',red:'#BB4333',redTop:'#D14B3A',redSide:'#923429'} as const;
const p31={...rgb,body:'#31DAC6',top:'#36F2DB',side:'#25A99A',lime:'#CDFF65',chest:'#282C31',cuff:'#282025'} as const;
const p9={...roll,light:'#E6E1D6',lightTop:'#E6E1D6',lightSide:'#E6E1D6',body:'#4D565F',top:'#55606A',side:'#3B434A',orange:'#FFA060',chest:'#282B31',chestSide:'#1F2226',metal:'#51565E'} as const;
const p123={...rgb,body:'#9481C0',top:'#A68FD7',side:'#756497',blue:'#9AB7FF',beige:'#BB9F7B',chest:'#282C31'} as const;
const p19={...rgb,body:'#462F22',top:'#462F22',side:'#37241D',blue:'#5DACCF',green:'#AAEFA1',brown:'#635848',brownSide:'#4E4538',chest:'#282C31',blackTop:'#1A1C1E'} as const;
export const batch5:readonly CharacterConfig[]=[
 make('viber-extra-20',p20,[...mohawk(p20,p20.red,p20.redTop,p20.redSide),
  ...[-1,1].map(s=>B('head',[.30,.29,.09],[s*.31,.34,-.46],p20.light)),
  B('head',[.115,.105,.075],[.43,.46,-.54],p20.dark,{border:.007}),B('head',[.115,.105,.075],[-.43,.23,-.54],p20.dark,{border:.007}),
  B('head',[.32,.10,.09],[0,.12,-.49],p20.dark),B('torso',[.105,.40,.07],[0,-.23,-.29],p20.red),B('torso',[.12,.18,.09],[0,-.26,-.37],p20.red),
 ],{proportions:{torso:[.74,.45,.50],leg:[.15,.08,.20],foot:[.40,.11,.52]},
 surfaces:{leg:paint(p20.body,p20.top,p20.side),foot:paint(p20.red,p20.redTop,p20.redSide)},flags:['P2: дуже короткі гомілки, широкі червоні стопи','Чорні зіниці мають різні верхнє/нижнє зміщення, як на PNG']}),
 make('bureau-31',p31,[...antenna(p31,p31.lime),
  B('head',[1.08,.53,.09],[0,.49,-.465],p31.chest),
  ...[[.44,.40,.35],[.21,.47,.48],[-.12,.49,.38],[-.43,.28,.22]].map(([x,y,h])=>B('head',[.135,h,.10],[x,y,-.56],p31.lime,{glow:true})),
  B('torso',[.61,.10,.09],[0,-.09,-.31],p31.dark),B('torso',[.61,.10,.09],[0,-.33,-.31],p31.dark),
  ...[-1,1].map(s=>B('torso',[.07,.32,.09],[s*.31,-.21,-.31],p31.dark)),B('torso',[.48,.09,.055],[0,-.21,-.29],p31.chest),
  B('torso',[.13,.12,.09],[-.23,-.22,-.40],p31.lime,{glow:true}),
  ...[-1,1].map(s=>B(s<0?'armL':'armR',[.25,.09,.33],[0,-.21,0],p31.cuff)),
  B('legL',[.29,.11,.055],[0,-.225,-.27],p31.light),
 ],{proportions:{head:[1.08,.91,.84],torso:[.74,.43,.50],arm:[.24,.32,.32],hand:[.28,.22,.34],leg:[.24,.18,.28],foot:[.31,.13,.43]},
 surfaces:{arm:paint(p31.chest),hand:paint(p31.chest)},flags:['C2/G1: чотири різновисокі світні стовпчики обличчя та світний грудний куб; ореол не геометрія','Світний грудний куб визначений за спільним оформленням, його власний ореол не доведений','Один світлий носок, без другої прихованої копії; кінчик антени звичайний']}),
 make('bureau-roll-9-5',p9,[...antenna(p9,p9.orange),
  B('head',[.90,.56,.09],[0,.49,-.46],p9.orange),B('head',[.68,.38,.065],[0,.49,-.54],p9.light),
  B('head',[.15,.11,.10],[0,.11,-.49],p9.dark),...[-1,1].map(s=>B('head',[.13,.13,.16],[s*.60,.23,.04],p9.metal)),
  B('torso',[.35,.35,.08],[0,-.21,-.29],p9.chest),B('torso',[.12,.24,.07],[0,-.20,-.37],p9.orange),
 ],{proportions:{head:[1.08,.91,.84],torso:[.74,.43,.50],arm:[.21,.22,.25],hand:[.38,.29,.40],leg:[.20,.26,.25],foot:[.24,.08,.36],
  sides:{legL:[.32,.26,.40],footL:[.32,.08,.40],legR:[.07,.08,.10],footR:[.07,.04,.10]}},
 layout:{pivots:{head:[0,.77,0],torso:[0,.77,0],armL:[-.58,.71,0],armR:[.58,.71,0],legL:[0,.34,0],legR:[-.24,.27,.14]},
  centers:{legL:[0,-.13,0],footL:[0,-.30,0],legR:[0,-.04,0],footR:[0,-.10,0],handL:[0,-.33,-.05],handR:[0,-.33,-.05]}},
 surfaces:{arm:paint(p9.body,p9.top,p9.side),hand:paint(p9.chest,p9.chest,p9.chestSide),legL:paint(p9.dark),footL:paint(p9.dark),legR:paint(p9.light),footR:paint(p9.light)},
 flags:['P3: одна велика центральна чорна опора й малий світлий задній фрагмент; друга повна нога не вигадана','Велика оправа одна, не дві симетричні лінзи']}),
 make('viber-123',p123,[
  B('head',[.72,.42,.64],[0,1.12,.02],p123.lightTop,{sideColor:p123.light}),B('head',[.10,.10,.10],[0,1.38,.02],p123.light),
  B('head',[.10,.18,.12],[.60,1.00,.20],p123.beige),B('head',[1.08,.53,.09],[0,.265,-.46],p123.dark),
  ...[-1,1].map(s=>B('head',[.23,.11,.07],[s*.30,.43,-.54],p123.blue)),
  B('head',[.60,.17,.08],[0,.16,-.56],p123.chest),B('head',[.48,.11,.08],[0,.16,-.64],p123.light),
  B('head',[.20,.05,.06],[0,.27,-.55],p123.blue),B('head',[.20,.05,.06],[0,.055,-.55],p123.blue),
  B('torso',[.50,.25,.09],[0,-.14,-.30],p123.blue),B('torso',[.76,.09,.13],[0,-.31,-.35],p123.beige),B('torso',[.53,.08,.08],[0,-.41,-.30],p123.chest),
 ],{proportions:{head:[1.08,.91,.84],arm:[.18,.34,.24],hand:[.20,.10,.26],leg:[.19,.13,.23],foot:[.16,.10,.23]},
 surfaces:{arm:paint(p123.light,p123.lightTop,p123.lightSide),hand:paint(p123.beige),leg:paint(p123.chest)},flags:['H4/P1: один бежевий задньобічний стрижень, верх голови під високим світлим убором оцінено','Блакитні вставки без ореолу, glow не додано']}),
 make('viber-extra-19',p19,[
  B('head',[1.20,.10,.95],[0,.96,0],p19.dark,{topColor:p19.blackTop}),
  B('head',[.57,.60,.55],[0,1.31,0],p19.dark,{topColor:p19.blackTop,sideColor:p19.darkSide}),B('head',[.585,.09,.565],[0,1.16,0],p19.blue),
  B('head',[1.08,.71,.09],[0,.355,-.46],p19.dark),...[-1,1].map(s=>B('head',[.115,.105,.07],[s*.32,.31,-.54],p19.green,{border:.007})),
  B('head',[1.06,.07,.84],[0,-.02,0],p19.blue),...pack(p19,p19.brown,p19.brownSide),B('torso',[.11,.11,.09],[0,-.08,-.31],p19.blue),
  B('legL',[.30,.12,.055],[0,-.25,-.27],p19.light),
 ],{surfaces:{arm:paint(p19.chest)},flags:['H2/H3/P1: один задньобічний блок, верх голови під високим убором оцінено','Світлий носок лише праворуч на PNG; зелені очі без явного ореолу']}),
];
