import { B,make,rgb,roll,paint,glasses,hat,antenna,nose } from './configTools';
import type { CharacterConfig } from './types';
const p25={...rgb,body:'#37343C',top:'#37343C',side:'#2A292E',lens:'#AAEFA1',metal:'#8B97A5',metalTop:'#9AA8B7',metalSide:'#6C7681'} as const;
const p22={...roll,body:'#36343A',top:'#3C3A40',side:'#2A292D',lens:'#A9EFA0',green:'#345E41',greenSide:'#294932',metal:'#282B31'} as const;
const p48={...roll,body:'#472F24',top:'#4F3428',side:'#37241C',lens:'#A9EFA0',metal:'#51565E',metalSide:'#3F4349',chest:'#282B31'} as const;
const p7={...roll,body:'#D89E82',top:'#F0B090',side:'#A87B65',red:'#BC4334',redTop:'#D14A3A',redSide:'#923429',brown:'#635848'} as const;
const p32={...rgb,body:'#A6AAAD',top:'#B8BCBF',side:'#828486',orange:'#D68133',orangeTop:'#EE8F39',orangeSide:'#A76328',brown:'#635848'} as const;
export const batch1:readonly CharacterConfig[]=[
 make('bureau-25',p25,[...hat(p25),...glasses(p25,p25.lens),
  B('head',[.36,.12,.085],[.29,.59,-.465],p25.metal,{topColor:p25.metalTop,sideColor:p25.metalSide}),
  B('head',[.36,.12,.085],[-.29,.02,-.465],p25.metal,{sideColor:p25.metalSide}),
  B('head',[.10,.23,.15],[-.59,.40,.08],p25.body,{sideColor:p25.side}),
  B('torso',[.12,.32,.075],[0,-.19,-.29],p25.metal,{sideColor:p25.metalSide}),
  B('torso',[.14,.09,.08],[0,-.40,-.29],p25.dark),
 ],{surfaces:{arm:paint(p25.dark),foot:paint(p25.metal,p25.metalTop,p25.metalSide)},
 flags:['H3/P1: верх під капелюхом оцінений','H4: одна бічна накладка; сірі брова/нижня накладка асиметричні']}),
 make('bureau-roll-22-11',p22,[...antenna(p22,p22.green,.91,true),...glasses(p22,p22.lens),nose(p22),
  B('head',[.29,.10,.08],[-.29,.58,-.47],p22.dark),
  ...[0,1,2,3].map(i=>B('torso',[i%2?.63:.60,.085,.07],[i%2?.015:-.015,-.06-i*.10,-.295],p22.light,{topColor:p22.lightTop})),
  ...[-1,1].map(s=>B(s<0?'legL':'legR',[.30,.12,.055],[0,-.25,-.27],p22.light)),
 ],{surfaces:{arm:paint(p22.dark),hand:paint(p22.metal),leg:paint(p22.body,p22.top,p22.side)},
 flags:['Одна чорна брова, планки грудей різної довжини; не симетризовано']}),
 make('bureau-roll-48-7',p48,[...antenna(p48,p48.lens),
  B('head',[.10,.20,.12],[.48,1.00,.23],p48.metal),
  B('head',[.99,.20,.08],[0,.29,-.46],p48.dark),
  ...[-1,1].map(s=>B('head',[.25,.24,.075],[s*.30,.29,-.535],p48.light)),nose(p48),
  B('torso',[.62,.38,.07],[0,-.23,-.29],p48.chest),
  ...[-1,1].flatMap(s=>[B('torso',[.115,.33,.07],[s*.255,-.25,-.34],p48.metal,{sideColor:p48.metalSide}),B('torso',[.23,.095,.075],[s*.255,-.06,-.34],p48.metal)]),
  B('legL',[.30,.12,.055],[0,-.25,-.27],p48.light),
 ],{surfaces:{arm:paint(p48.dark),hand:paint(p48.chest)},flags:['H4: один сірий задньобічний стрижень','Світлий носок лише лівої ноги (праворуч на PNG), без прихованої копії']}),
 make('bureau-roll-7-11',p7,[...antenna(p7,p7.red,.91,true),
  ...[-1,1].flatMap(s=>[B('head',[.24,.25,.11],[s*.32,.41,-.465],p7.dark),
   B('head',[.18,.49,.26],[s*.635,.30,.01],p7.body,{sideColor:p7.side}),B('head',[.24,.23,.29],[s*.635,.66,.01],p7.light,{topColor:p7.lightTop})]),
  B('head',[.18,.28,.07],[-.565,.35,-.10],p7.light),
  B('head',[.62,.22,.10],[0,.10,-.47],p7.red,{topColor:p7.redTop,sideColor:p7.redSide}),
  B('head',[.36,.12,.075],[0,.05,-.56],p7.brown),
  B('torso',[.13,.11,.10],[0,-.015,-.30],p7.red),B('torso',[.61,.32,.08],[0,-.22,-.29],p7.light),
  B('torso',[.14,.14,.10],[0,-.22,-.38],p7.dark),
 ],{surfaces:{hand:paint(p7.body,p7.top,p7.side)},flags:['Світла бічна вставка частково перекрита вухом; H1 застосовано до великих вух']}),
 make('viber-32',p32,[
  ...[-1,1].flatMap(s=>[B('head',[.12,.31,.12],[s*.28,1.065,0],p32.dark),B('head',[.14,.12,.14],[s*.34,1.265,0],p32.orange,{topColor:p32.orangeTop,sideColor:p32.orangeSide}),
   B('head',[.33,.10,.08],[s*.32,.46,-.46],p32.orange,{topColor:p32.orangeTop}),B('head',[.12,.22,.08],[s*.32,.29,-.46],p32.orange)]),nose(p32),
  B('torso',[.24,.40,.065],[0,-.23,-.29],p32.light),
  ...[0,1,2].map(i=>B('torso',[.12,.10,.075],[0,-.10-i*.105,-.36],i===1?p32.dark:p32.orange)),
 ],{surfaces:{hand:paint(p32.brown),leg:paint(p32.body,p32.top,p32.side),foot:paint(p32.orange,p32.orangeTop,p32.orangeSide)},flags:['Окремих зіниць немає: Т-подібні форми збережені без вигаданих очей']}),
];
