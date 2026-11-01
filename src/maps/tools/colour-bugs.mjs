/** Editor/verification only. Mutates the supplied clone; every change is allowlisted. */
export function fixColourBugs(data,expandedBoxes){
 const fixes=[],near=(a,b)=>Math.abs(a-b)<.002;
 const blocked=data.boxes.filter(b=>b.kind==='wall'&&b.collide&&near(Math.abs(b.x),20.9)&&near(b.z,-28.7)&&Math.abs(b.w-3)<.02&&Math.abs(b.d-1)<.02&&Math.abs(b.h-1.61)<.03);
 data.boxes=data.boxes.filter(b=>!blocked.includes(b));
 for(const b of blocked)fixes.push({type:'stair-entrance',before:{...b},after:null});
 if(blocked.length)for(const b of data.boxes.filter(b=>b.kind==='wall'&&b.collide&&near(b.z,-28.9)&&b.w<.25&&(near(Math.abs(b.x),19.52)||near(Math.abs(b.x),22.28)))){const before={...b};b.x+=Math.sign(b.x)*(near(Math.abs(b.x),19.52)?-.05:.05);fixes.push({type:'stair-entrance-post',before,after:{...b}});}
 // Keep the long M2 baffles in the same corridor. Their original 16.452m
 // body crossed the house wall: split only that covered interval, then put
 // the prefab origin at the outer segment rather than shifting the barrier.
 const screen=data.instances.find(i=>i.prefab==='screenB'&&near(i.x,25.026));
 if(screen){
  const body=data.prefabs.screenB.find(b=>b.collide),lo=screen.x+body.x-body.w/2,hi=Math.min(screen.x+body.x+body.w/2,...data.boxes.filter(b=>b.kind==='wall'&&b.collide&&b.x>33&&b.w<2&&Math.abs(screen.z-b.z)<b.d/2).map(b=>b.x-b.w/2-.004));
  const wall=data.boxes.find(b=>b.collide&&b.kind==='wall'&&b.w<1&&b.x>lo&&b.x<hi&&Math.abs(b.z-screen.z)<b.d/2&&b.y-b.h/2<body.y-body.h/2+.03&&b.y+b.h/2>body.y+body.h/2-.03);
  if(!wall)throw new Error('Missing M2 baffle junction');
  const gap=.004,leftEnd=wall.x-wall.w/2-gap,rightStart=wall.x+wall.w/2+gap,origin=(rightStart+hi)/2;
  const oldA=data.prefabs.screenA,oldB=data.prefabs.screenB;
  for(const side of ['A','B']){const sign=side==='B'?1:-1,old=side==='B'?oldB:oldA;
   data.prefabs['screen'+side]=old.flatMap(b=>[{...b,x:0,w:hi-rightStart},{...b,x:sign*((lo+leftEnd)/2-origin),w:leftEnd-lo}]);
   for(const i of data.instances.filter(i=>i.prefab==='screen'+side)){const before={...i};i.x=sign*origin;fixes.push({type:'prop-in-wall',before,after:{...i},junctionTrim:{wallX:sign*wall.x,gap,beforePrefab:old,afterPrefab:data.prefabs['screen'+side]}});}
  }
 }
 const bounds=b=>({minX:b.x-b.w/2,maxX:b.x+b.w/2,minY:b.y-b.h/2,maxY:b.y+b.h/2,minZ:b.z-b.d/2,maxZ:b.z+b.d/2});
 const intersects=(a,b,gap=.025)=>Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)>-gap&&Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY)>1e-5&&Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)>-gap;
 for(const inst of data.instances.filter(i=>i.x>0)){
  const bench=/^bench/.test(inst.prefab)&&near(inst.x,26.5)&&near(Math.abs(inst.z),8),lamp=/^lamp/.test(inst.prefab)&&near(inst.x,28.5)&&near(Math.abs(inst.z),8),crate=/^crate/.test(inst.prefab)&&near(inst.x,7.7)&&near(inst.z,-22),screen=/^screen/.test(inst.prefab)&&Math.abs(inst.x-25.026)<.03&&near(Math.abs(inst.z),20);
  if(!bench&&!lamp&&!crate&&!screen)continue;
  const mate=data.instances.find(i=>i.prefab===inst.prefab.replace(/B$/,'A')&&near(i.x,-inst.x)&&near(i.z,inst.z));if(!mate)throw new Error('Missing mirrored bug prop: '+inst.prefab);
  const other=data.instances.filter(i=>i!==inst&&i!==mate),obstacles=expandedBoxes({...data,instances:other}).filter(b=>b.collide&&b.kind!=='floor').map(bounds);
  const narrow=(p,o)=>{if(p.maxY<.5||p.minY>=1.8||o.maxY<.5||o.minY>=1.8)return false;for(const [a,b,c,d]of[['minX','maxX','minZ','maxZ'],['minZ','maxZ','minX','maxX']]){const gap=Math.max(p[a],o[a])-Math.min(p[b],o[b]);if(gap>.05&&gap<2.6-1e-6&&Math.min(p[d],o[d])-Math.max(p[c],o[c])>=.8)return true;}return false;};
  const candidates=[];for(let dx=crate?-24:-10;dx<=(crate?24:10);dx++)for(let dz=(screen||crate)?-36:-12;dz<=((screen||crate)?36:12);dz++){
   const x=inst.x+dx*.25,z=inst.z+dz*.25;if(x<0||Math.abs(x)>33||Math.abs(z)>33||(bench||lamp)&&Math.abs(z)<8.9)continue;
   candidates.push({x,z,score:dx*dx+dz*dz+(screen&&dx<0?.001:0)});
  }candidates.sort((a,b)=>a.score-b.score||a.x-b.x||a.z-b.z);
  let chosen=null;
  for(const c of candidates){let valid=true;for(const side of [1,-1]){
   const sample={...(side===1?inst:mate),x:side*c.x,z:c.z},parts=expandedBoxes({...data,boxes:[],instances:[sample]}).filter(b=>b.collide).map(bounds);
   if(parts.some(p=>p.minX< -data.bounds.x||p.maxX>data.bounds.x||p.minZ< -data.bounds.z||p.maxZ>data.bounds.z||obstacles.some(o=>intersects(p,o)||narrow(p,o)))){valid=false;break;}
   for(const p of parts)for(const s of data.spawns){if(p.maxY<=s.y+.012||p.minY>=s.y+2)continue;const d=Math.hypot(Math.max(p.minX-s.x,0,s.x-p.maxX),Math.max(p.minZ-s.z,0,s.z-p.maxZ));if(d<1.2-1e-6)valid=false;}
  }if(valid){chosen=c;break;}}
  if(!chosen)throw new Error('No safe relocation: '+data.id+'/'+inst.prefab);
  for(const item of [inst,mate]){const before={...item};item.x=Math.sign(item.x)*chosen.x;item.z=chosen.z;fixes.push({type:'prop-in-wall',before,after:{...item}});}
 }
 return fixes;
}
