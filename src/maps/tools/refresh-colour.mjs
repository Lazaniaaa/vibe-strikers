import fs from 'node:fs/promises';import{gunzipSync}from'node:zlib';import{expandedBoxes}from'../boxes.ts';import{fixColourBugs}from'./colour-bugs.mjs';
const colours=['BE4A2F','D77643','EAD4AA','E4A672','B86F50','733E39','3E2731','A22633','E43B44','F77622','FEAE34','FEE761','63C74D','3E8948','265C42','193C3E','124E89','0099DB','2CE8F5','FFFFFF','C0CBDC','8B9BB4','5A6988','3A4466','262B44','181425','FF0044','68386C','B55088','F6757A','E8B796','C28569'].map(c=>'#'+c);
const ramp={outline:['#262B44','#262B44'],sand:['#EAD4AA','#FFFFFF'],stone:['#5A6988','#8B9BB4'],blue:['#124E89','#0099DB'],clay:['#B86F50','#FEAE34'],wood:['#B86F50','#FEAE34'],leaf:['#3E8948','#63C74D'],glass:['#0099DB','#2CE8F5'],water:['#0099DB','#2CE8F5'],cream:['#EAD4AA','#FFFFFF'],gold:['#FEAE34','#FEE761']};
const warm={...ramp,sand:['#B86F50','#EAD4AA'],stone:['#B86F50','#EAD4AA'],blue:['#F77622','#FEAE34'],clay:['#B86F50','#FEAE34'],wood:['#B86F50','#FEAE34']};
const cool={...ramp,sand:['#5A6988','#8B9BB4'],stone:['#5A6988','#8B9BB4'],blue:['#0099DB','#2CE8F5'],clay:['#0099DB','#2CE8F5'],wood:['#0099DB','#2CE8F5'],cream:['#C0CBDC','#FFFFFF']};
const team=z=>/Spawn A|West Gallery|Balcony A/.test(z)?'A':/Spawn B|East Gallery|Balcony B/.test(z)?'B':null;
const nearest=hex=>{const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const a=rgb(hex);return [...colours].sort((x,y)=>{const d=h=>rgb(h).reduce((n,v,i)=>n+(v-a[i])**2,0);return d(x)-d(y);})[0];};
function palette(old){const p={};for(const[k,v]of Object.entries(old)){
 let c,parts=k.split(':'),key=parts.at(-1),top=key.endsWith('Top')||key==='top',base=key.replace(/Top$/,'');
 if(parts[0]==='zone'){const side=team(parts[1]);let r=side==='A'?warm:side==='B'?cool:ramp;if(parts[1]==='North House')r={...ramp,sand:warm.sand,blue:warm.blue,stone:warm.wood,clay:warm.clay};if(parts[1]==='Market Court')r=cool;c=(r[base]??ramp.stone)[top?1:0];}
 else if(parts[0]==='floor'){const side=team(parts[1]);c=side==='B'||parts[1]==='Market Court'?(key==='-1'?'#C0CBDC':'#FFFFFF'):(key==='-1'?'#EAD4AA':'#FFFFFF');}
 else if(parts[0]==='path')c=team(parts[1])==='B'||parts[1]==='Market Court'?'#2CE8F5':'#FEAE34';
 else if(parts[0]==='accent'||parts[0]==='legend'){const side=team(parts[1]);c=side==='A'?'#F77622':side==='B'?'#0099DB':parts[1]==='North House'?'#BE4A2F':parts[1]==='Market Court'?'#0099DB':'#FEAE34';}
 else if(parts[0]==='green')c=parts[1]==='1'?(top?'#3E8948':'#265C42'):(top?'#63C74D':'#3E8948');
 else if(parts[0]==='bench')c=parts[1]==='A'?'#F77622':'#0099DB';
 else if(parts[0]==='roof')c=key==='terracottaLight'?'#F77622':'#BE4A2F';
 else if(parts[0]==='awning')c=key==='cream'?'#FFFFFF':'#0099DB';
 else if(parts[0]==='clock')c=key==='face'?'#EAD4AA':'#FEAE34';
 else if(parts[0]==='backdrop')c=['#D77643','#FEAE34','#0099DB','#124E89'][Number(key)%4];
 else c=ramp[base]?.[top?1:0]??nearest(v);p[k]=c;
 }
 Object.assign(p,{'roof:teamB':'#124E89','roof:teamBTop':'#0099DB','awning:warm':'#F77622'});return p;}
const box=(x,y,z,w,h,d,color,top=color,outline=false)=>({x,y,z,w,h,d,color,top,outline,kind:'decor',collide:false,blocksShots:false});
function skins(side){const z='zone:Spawn '+side+':';return {accent:z+'blue',bright:z+'blueTop',cream:z+'cream',creamTop:z+'creamTop',wood:z+'wood',woodTop:z+'woodTop'};}
function windowPanel(side){const c=skins(side),b=[];b.push(box(0,0,0,1.65,1.25,.07,'outline'),box(0,0,-.055,1.3,1.02,.045,'glass','glassTop'));
 for(const x of[-.72,.72])b.push(box(x,0,-.075,.12,1.22,.10,c.cream,c.creamTop));for(const y of[-.55,.55])b.push(box(0,y,-.075,1.56,.12,.10,c.cream,c.creamTop));b.push(box(0,0,-.1,.065,1.0,.08,c.cream,c.creamTop));
 for(const x of[-.96,.96]){b.push(box(x,0,-.025,.34,1.2,.13,c.accent,c.bright,true));for(const y of[-.35,0,.35])b.push(box(x,y,-.103,.28,.035,.025,c.bright));}
 b.push(box(0,-.82,-.18,1.35,.23,.36,c.wood,c.woodTop,true));for(const x of[-.44,0,.44]){b.push(box(x,-.62,-.2,.31,.26,.24,'leaf','leafTop'));b.push(box(x,-.43,-.23,.15,.15,.15,x===0?'goldTop':'clayTop'));}
 for(let i=0;i<5;i++)b.push(box((i-2)*.44,.79,-.27,.43,.10,.65,i%2?c.accent:'awning:cream',i%2?c.bright:'awning:cream'));
 b.push(box(0,-1.18,-.02,.74,.20,.08,c.accent,c.bright));for(let i=0;i<3;i++)b.push(box(-.20+i*.20,-1.18,-.068,.10,.07,.025,'creamTop'));
 return b;}
function foliage(side){const c=skins(side);return [box(0,.25,0,.70,.49,.70,c.wood,c.woodTop,true),box(0,.85,0,.16,.75,.16,'wood','woodTop',true),box(0,1.43,0,1.10,.62,1.10,'green:1','green:1:top',true),box(0,1.94,0,.76,.44,.76,'green:0','green:0:top',true)];}
function arch(side){const c=skins(side),b=[box(-1.39,1.5,-.02,.12,3,.13,c.accent,c.bright,true),box(1.39,1.5,-.02,.12,3,.13,c.accent,c.bright,true),box(0,3.12,-.02,2.90,.16,.13,c.accent,c.bright,true),box(0,3.42,-.02,1.20,.27,.12,'outline')];for(let i=0;i<3;i++)b.push(box((i-1)*.25,3.42,-.095,.15,.11,.04,c.bright));return b;}
const original=JSON.parse(gunzipSync(await fs.readFile('src/maps/baselines/colour-before.json.gz'))),report={palette:'Endesga 32',source:'https://lospec.com/palette-list/endesga-32',maps:{}};
for(const[id,record]of Object.entries(original)){
 const d=structuredClone(record.data),fixes=fixColourBugs(d,expandedBoxes).filter(f=>!f.after||f.before.x!==f.after.x||f.before.z!==f.after.z);d.palette=palette(d.palette);d.sky={color:'#0099DB',horizon:'#8B9BB4'};d.fog={color:'#8B9BB4',near:45,far:120};d.light={sun:{direction:[...d.light.sun.direction],color:'#EAD4AA',intensity:2.8},ambient:{color:'#C0CBDC',intensity:.9},hemisphere:{sky:'#C0CBDC',ground:'#EAD4AA',intensity:.85}};
 const retint=(b,side)=>{for(const key of['color','top']){if(side==='B'&&b[key]?.startsWith('roof:terracotta'))b[key]=b[key].endsWith('Light')?'roof:teamBTop':'roof:teamB';if(side==='A'&&b[key]==='awning:blue')b[key]='awning:warm';}};
 for(const b of d.boxes)retint(b,b.x<0?'A':'B');for(const[name,boxes]of Object.entries(d.prefabs))for(const b of boxes)retint(b,name.endsWith('A')?'A':'B');
 for(const side of['A','B']){d.prefabs['townWindow'+side]=windowPanel(side);d.prefabs['townFoliage'+side]=foliage(side);d.prefabs['townArch'+side]=arch(side);if(side==='B')for(const key of['townWindowB','townFoliageB','townArchB'])for(const b of d.prefabs[key])b.x=-b.x;}
 const addPair=(prefab,x,y,z,yaw=0)=>{d.instances.push({prefab:prefab+'A',x,y,z,yaw},{prefab:prefab+'B',x:-x,y,z,yaw:-yaw});};
 const windows=[];const walls=d.boxes.filter(b=>b.collide&&b.kind==='wall'&&b.x<-.1&&b.y-b.h/2<.8&&b.h>=3.1&&((b.w>=3.2&&b.d<1.1)||(b.d>=3.2&&b.w<1.1)));
 walls.sort((a,b)=>(Math.abs(a.z)<10?0:a.z<0?1:2)-(Math.abs(b.z)<10?0:b.z<0?1:2)||Math.abs(a.x+27)-Math.abs(b.x+27));
 const quotas={spawn:0,market:0,house:0};for(const b of walls){const region=Math.abs(b.z)<10?'spawn':b.z<0?'market':'house';if(quotas[region]>=3)continue;let x=b.x,z=b.z,yaw;
  if(b.w>b.d){const direction=b.z>0?-1:1;z+=direction*(b.d/2+.035);yaw=direction<0?0:Math.PI;}else{const direction=b.x< -23?-1:1;x+=direction*(b.w/2+.035);yaw=direction<0?Math.PI/2:-Math.PI/2;}
  addPair('townWindow',x,2.12,z,yaw);windows.push({x,z,region,yaw});quotas[region]++;
 }
 const doorways=[];for(const b of d.boxes.filter(b=>b.x<-.1&&b.kind==='wall'&&b.collide&&b.w>=2.8&&b.w<=3.4&&b.d<1.1&&b.y-b.h/2>=2.95&&b.y-b.h/2<=3.45&&b.h>.3).slice(0,5)){const direction=b.z>0?-1:1,z=b.z+direction*(b.d/2+.04);addPair('townArch',b.x,0,z,direction<0?0:Math.PI);doorways.push({x:b.x,z});}
 const collision=expandedBoxes(d).filter(b=>b.collide&&b.y+b.h/2>.03),clear=(x,z)=>collision.every(b=>Math.abs(b.x-x)>=b.w/2+.65||Math.abs(b.z-z)>=b.d/2+.65||b.y-b.h/2>2.25);
 const trees=[];for(const[x,z]of[[-31.5,5.2],[-31.5,-5.2],[-26.5,30.8],[-26.5,-31.2],[-12.2,25.4],[-12.2,-25.4],[-17.0,11.2],[-17.0,-11.2],[-30.5,3.0],[-30.5,-3.0]]){if(trees.length>=6)break;if(clear(x,z)&&clear(-x,z)){addPair('townFoliage',x,0,z);trees.push({x,z});}}
 let rims=0;for(const b of [...d.boxes].filter(b=>b.collide&&b.kind==='wall'&&b.y>3&&b.h<.45&&b.w>3.5&&b.d>3.5)){const c=b.x>0?'zone:Spawn B:blue':'zone:Spawn A:blue';for(const sign of[-1,1]){d.boxes.push(box(b.x,b.y+b.h/2+.065,b.z+sign*(b.d/2-.10),b.w-.16,.12,.12,c,b.x>0?'zone:Spawn B:blueTop':'zone:Spawn A:blueTop'));d.boxes.push(box(b.x+sign*(b.w/2-.10),b.y+b.h/2+.065,b.z,.12,.12,b.d-.16,c,b.x>0?'zone:Spawn B:blueTop':'zone:Spawn A:blueTop'));rims+=2;}}
 for(const side of[-1,1])for(const zSign of[-1,1])for(let i=0;i<4;i++)d.boxes.push(box(side*(30.4-i*.52),.020,zSign*4.9,.30,.010,1.7,side<0?'accent:Spawn A':'accent:Spawn B'));
 const newline=(await fs.readFile('src/maps/data/'+id+'.json','utf8')).includes('\r\n')?'\r\n':'\n';await fs.writeFile('src/maps/data/'+id+'.json',(JSON.stringify(d,null,2)+'\n').replaceAll('\n',newline));report.maps[id]={fixes,windows,doorways,trees,roofEdgeBoxes:rims,newDecorInstances:d.instances.length-record.data.instances.length,paletteColours:new Set(Object.values(d.palette)).size};console.log(id,JSON.stringify({fixes:fixes.length,windows:windows.length*2,arches:doorways.length*2,trees:trees.length*2}));
}
await fs.writeFile('src/maps/palettes/endesga32.json',JSON.stringify({name:'Endesga 32',author:'ENDESGA',source:report.source,colours},null,2)+'\n');await fs.writeFile('src/maps/reports/colour/design.json',JSON.stringify(report,null,2)+'\n');

