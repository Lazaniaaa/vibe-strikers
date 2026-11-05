// Authoring only. The lobby is deliberately not registered as a playable map.
import { writeFileSync } from 'node:fs';
const boxes=[];
function box(x,y,z,w,h,d,color,top=color,outline=true){boxes.push({x,y,z,w,h,d,color,top,outline,kind:'decor',collide:false,blocksShots:false});}
const palette={outline:'#262B44',stone:'#5A6988',stoneTop:'#8B9BB4',trim:'#0099DB',trimTop:'#2CE8F5',
 floor:'#EAD4AA',floorTop:'#FFFFFF',tile:'#C0CBDC',wood:'#B86F50',woodTop:'#E4A672',woodDark:'#733E39',
 metal:'#3A4466',metalTop:'#5A6988',leaf:'#3E8948',leafTop:'#63C74D',soil:'#3E2731',
 flower:'#E43B44',flowerTop:'#FEAE34',lamp:'#FEE761',lampTop:'#FFFFFF',ally:'#0099DB',enemy:'#E43B44',
 cloud:'#C0CBDC',cloudTop:'#FFFFFF'};
// Compact rooftop, with a stepped underside that reads as a floating toy island.
box(0,-.53,.45,6.8,.56,5.5,'stone','stoneTop');
box(0,-.92,.6,5.9,.26,4.65,'metal','stone');
box(.25,-1.18,.65,3.8,.28,3.3,'stone','stoneTop');
box(-.6,-1.41,.8,1.9,.18,1.9,'metal','stone');
box(0,-.265,.45,6.9,.09,5.6,'trim','trimTop');
// Individual calm tiles carry contact AO around the planters and pedestal.
for(let x=0;x<7;x++)for(let z=0;z<5;z++)box((x-3)*.96,-.19,(z-2)*1.08+.45,.95,.06,1.07,(x+z)%3?'floor':'tile','floor');
// Low rim at the rear only; no fence crossing the hero silhouette.
box(0,.005,3.12,6.7,.32,.16,'stone','stoneTop');
box(-3.25,-.015,1.95,.16,.28,2.2,'stone','stoneTop');
box(3.25,-.015,1.95,.16,.28,2.2,'stone','stoneTop');
// Bench, offset to the left behind the hero.
for(const x of [-2.65,-1.75])box(x,.07,1.8,.12,.46,.6,'metal','metalTop');
box(-2.2,.34,1.8,1.4,.12,.6,'wood','woodTop');
for(const y of [.67,.89])box(-2.2,y,2.08,1.4,.16,.11,'wood','woodTop');
for(const x of [-2.75,-1.65])box(x,.65,2.12,.08,.86,.09,'metal','metalTop');
// Two small parcels, simple straps rather than busy cargo stacks.
for(const [x,y,z,s]of [[2.3,.18,1.65,.7],[2.77,.05,.96,.44]]){
 box(x,y,z,s,s,s,'wood','woodTop');box(x,y,z-s/2-.008,.08,s*.92,.025,'woodDark');
 box(x,y+s/2+.008,z,.08,.025,s*.92,'woodDark');
}
// Street lamp with a chunky cream lantern.
box(-2.65,.86,2.5,.1,2.05,.1,'metal','metalTop');
box(-2.65,-.06,2.5,.32,.18,.32,'metal','metalTop');
box(-2.65,1.94,2.5,.43,.1,.43,'metal','metalTop');
box(-2.65,1.72,2.5,.28,.34,.28,'lamp','lampTop');
box(-2.65,1.49,2.5,.38,.1,.38,'metal','metalTop');
// Flower boxes in front corners leave the feet/pedestal unobstructed.
for(const x of [-2.5,2.5]){
 box(x,.02,-1.35,1.05,.35,.48,'wood','woodTop');box(x,.21,-1.35,.91,.05,.35,'soil');
 for(let i=0;i<3;i++){const xx=x+(i-1)*.29;box(xx,.36,-1.35,.08,.28,.08,'leaf');box(xx,.5,-1.35,.19,.15,.19,i%2?'lamp':'flower','flowerTop');box(xx+.09,.32,-1.35,.18,.09,.15,'leaf','leafTop');}
}
// Tiny block topiary and flags: team colours are replaced from TEAM_COLORS by the caller.
box(3.05,.02,2.62,.62,.36,.62,'stone','stoneTop');box(3.05,.57,2.62,.15,.85,.15,'wood','woodTop');
box(3.05,1.14,2.62,.87,.69,.78,'leaf','leafTop');box(2.92,1.55,2.67,.63,.27,.61,'leaf','leafTop');
for(const [x,color]of [[-2.2,'ally'],[2.2,'enemy']]){
 box(x,.63,2.84,.06,1.6,.06,'metal','metalTop');box(x+.24,1.19,2.84,.44,.31,.045,color,color);
 box(x,-.1,2.84,.24,.12,.24,'stone','stoneTop');
}
// Leave sky visible below the front edge, with the hero still at the same scale.
for(const b of boxes){b.x*=.65;b.z*=.65;b.w*=.65;b.d*=.65;if(b.y<-.3){b.y=-.16+(b.y+.16)*.6;b.h*=.6;}}
const data={id:'lobby-island',name:'Lobby Island',bounds:{x:12,z:12},killY:-20,
 sky:{color:'#0099DB',horizon:'#C0CBDC'},fog:{color:'#C0CBDC',near:35,far:80},
 // Lighting is intentionally disabled metadata. The menu owns all lighting in MENU.
 light:{sun:{direction:[0,1,0],color:'#FFFFFF',intensity:0},ambient:{color:'#FFFFFF',intensity:0}},
 palette,prefabs:{},boxes,instances:[],spawns:[],lootSpots:[],zones:[],
 pedestal:{radius:1.2,height:.16,segments:48,border:.035,side:'stone',top:'floor',stripe:'trim'},
 cloudShape:[{x:2,y:1,z:2,w:3.7,h:.5,d:1.6},{x:1.3,y:1.35,z:2,w:1.4,h:.7,d:1.4},{x:2.7,y:1.2,z:2.1,w:1.25,h:.55,d:1.2}],
 clouds:[[-5,-2.2,-1,.8],[5,-2.7,0,1],[-8,-1,9,1.2],[7,-.6,12,1.3],[-1,-3.5,6,.85],[0,1.2,23,1.4],[-13,2,24,1.7],[13,2.5,27,1.5]]};
writeFileSync(new URL('../data/lobby-island.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log('Lobby Island: '+boxes.length+' static boxes');
