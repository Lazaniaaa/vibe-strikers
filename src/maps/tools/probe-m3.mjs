import fs from 'node:fs/promises';
import {createServer} from 'vite';
const vite=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {Navigation}=await vite.ssrLoadModule('../maps/navigation.ts'),{expandedBoxes}=await vite.ssrLoadModule('../maps/boxes.ts'),{coplanarFaces,ShotTree}=await vite.ssrLoadModule('../maps/analysis.ts'),{buildMap,disposeMapResources}=await vite.ssrLoadModule('../maps/buildMap.ts'),{pathsFor}=await vite.ssrLoadModule('../maps/audit.ts');
 for(const key of process.argv.slice(2).length?process.argv.slice(2):['l1-r1','l1-r2','l2-r1','l2-r2']){
  const data=JSON.parse(await fs.readFile('src/maps/data/toy-town-'+key+'.json','utf8')),boxes=expandedBoxes(data),coplanar=coplanarFaces(boxes.filter(b=>b.collide)),nav=new Navigation(data),connected=nav.flood(nav.nearest(data.spawns[0])),model=buildMap(data);
  const badSpawns=data.spawns.map((p,i)=>({i,clear:nav.spatial.cylinderClear(p.x,p.y,p.z,1.2,2)})).filter(p=>!p.clear),badLoot=data.lootSpots.map((p,i)=>({i,d:nav.nearest(p,.3),p})).filter(q=>q.d<0||!nav.reachable[q.d]);
  const path=(way)=>{let length=0;for(let i=1;i<way.length;i++)length+=nav.path(nav.nearest(way[i-1]),nav.nearest(way[i])).length;return length;};
  const start={x:-28.5,z:-1},end={x:28.5,z:-1},routes=pathsFor(data,nav).map(({points,...r})=>r),proposed=[];
  for(const z of [14.25,17.5,19,22,24.2,26])proposed.push({z,LEFT:path([start,{x:-20,z},{x:0,z},{x:20,z},end]),RIGHT:path([start,{x:-20,z:-z},{x:0,z:-z},{x:20,z:-z},end])});
  let min=Infinity,max=0;for(const a of data.spawns.filter(p=>p.team==='A'))for(const b of data.spawns.filter(p=>p.team==='B')){const l=path([a,b]);min=Math.min(min,l);max=Math.max(max,l);}
  // The broad lane mask includes its return arcade as well as the cross street.
  const tree=new ShotTree(boxes.filter(b=>b.blocksShots)),lanes=[];
  for(const sign of [1,-1]){let longest=0,worst=null;for(let id=0;id<nav.nodes.length;id++){const n=nav.nodes[id];if(!nav.reachable[id]||n.y>1||n.ix%4||n.iz%4||sign*n.z<10)continue;for(let a=0;a<360;a+=2){const dx=Math.cos(a*Math.PI/180),dz=Math.sin(a*Math.PI/180),limit=dz*sign<0?(n.z*sign-10)/(-dz*sign):100;const d=tree.distance(n.x,n.y+1.6,n.z,dx,0,dz,Math.min(100,limit));if(d>longest){longest=d;worst={x:n.x,z:n.z,a,toX:n.x+dx*d,toZ:n.z+dz*d};}}}lanes.push({id:sign===1?'LEFT':'RIGHT',longest,worst});}
  const interior=nav.nodes.map((n,i)=>({n,i})).filter(({n})=>Math.abs(n.x)<33.25&&Math.abs(n.z)<33.25),arena={total:interior.length,connected:interior.filter(({i})=>nav.reachable[i]).length,unreachable:interior.filter(({i})=>!nav.reachable[i]).reduce((m,{n})=>{const y=n.y.toFixed(2);m[y]=(m[y]||0)+1;return m;},{})};arena.ratio=arena.connected/arena.total;
  const result={key,stats:model.userData.stats,connected,arena,coplanar:coplanar.slice(0,30).map(c=>({...c,a:boxes.filter(b=>b.collide)[c.a],b:boxes.filter(b=>b.collide)[c.b]})),badSpawns,badLoot,min,max,routes,proposed,lanes};
  await fs.writeFile('src/maps/reports/m3/probe-'+key+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));disposeMapResources();
 }
}finally{await vite.close();}
