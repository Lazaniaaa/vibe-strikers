import { loadAo, AO_AUTHORING, type AoPatch } from './aoCache';
import { AoField, BAKED_AO } from './bakedAo';
import { BoxGeometry,BufferGeometry,Color,Float32BufferAttribute,Group,HemisphereLight,InstancedMesh,Matrix4,Mesh,MeshLambertMaterial } from 'three';
import type { MapBox,MapData,MapStats } from './types';
import {expandedBoxes} from './boxes';
const CHUNK=35,E=.002;
let unit:BoxGeometry|null=null,material:MeshLambertMaterial|null=null;
const cache=new Map<string,{chunks:{name:string;geometry:BufferGeometry;x:number;z:number}[];prefabs:{name:string;geometry:BufferGeometry;matrices:Matrix4[]}[];stats:MapStats}>();
const geometries=new Set<BufferGeometry>();
const instancedMeshes=new Set<InstancedMesh>();
export interface MapBuildOptions { /** Static vertex-colour AO. Default true. */ bakedAo?:boolean }
interface DrawBox {source:MapBox;shade:boolean;x:number;y:number;z:number;w:number;h:number;d:number;color:string;top:string}
function drawBoxes(box:MapBox,palette:MapData['palette']):DrawBox[]{
 const {x,y,z,w,h,d}=box,color=palette[box.color],top=palette[box.top??box.color];
 if(!box.outline)return [{source:box,shade:true,x,y,z,w,h,d,color,top}];
 const border=Math.min(.025,Math.min(w,h,d)*.14),dark=palette.outline;
 // Base plus five inset face plates; bottom stays flat/dark. Plates are offset 2mm.
 return [{source:box,shade:false,x,y,z,w,h:h-E*2,d,color:dark,top:dark},
  ...[-1,1].map(s=>({source:box,shade:true,x,y,z:z+s*(d/2+E),w:w-2*border,h:h-2*border,d:E,color,top:color})),
  ...[-1,1].map(s=>({source:box,shade:true,x:x+s*(w/2+E),y,z,w:E,h:h-2*border,d:d-2*border,color,top:color})),
  {source:box,shade:true,x,y:y+h/2+E,z,w:w-2*border,h:E,d:d-2*border,color:top,top}];
}
function geometry(boxes:readonly DrawBox[],name:string,field?:AoField,subdivide=false,patches?:readonly AoPatch[]):BufferGeometry{
 if(!unit)unit=new BoxGeometry(1,1,1);
 const p=unit.attributes.position,n=unit.attributes.normal,indices=unit.index!,positions:number[]=[],normals:number[]=[],colors:number[]=[],index:number[]=[];
 const rgb=new Map<string,Color>(),get=(hex:string)=>{let c=rgb.get(hex);if(!c){c=new Color(hex);rgb.set(hex,c);}return c;};
 const patchMap=new Map(patches?.map(p=>[p.i,p]));const recorded:AoPatch[]=[];let ordinal=0;
 let extra=0;
 for(const box of boxes){const c=get(box.color),t=get(box.top);
  if(!field&&!patches){const base=positions.length/3;for(let i=0;i<p.count;i++){positions.push(p.getX(i)*box.w+box.x,p.getY(i)*box.h+box.y,p.getZ(i)*box.d+box.z);normals.push(n.getX(i),n.getY(i),n.getZ(i));const face=n.getY(i)>.5?t:c;colors.push(face.r,face.g,face.b);}for(let i=0;i<indices.count;i++)index.push(base+indices.getX(i));continue;}
  const active=box.shade&&!(box.source.kind==='floor'&&box.source.y<0);
  const near=active&&field?field.neighbors(box.x,box.y,box.z,box.w,box.h,box.d):[];
  for(let face=0;face<6;face++){
   const saved=patchMap.get(ordinal),patch:AoPatch={i:ordinal++,u:[],v:[],l:[]};
   const at=face*4,normal=[n.getX(at),n.getY(at),n.getZ(at)],axis=normal.findIndex(v=>v!==0),sign=normal[axis],u=(axis+1)%3,v=(axis+2)%3;
   const center=[box.x,box.y,box.z],size=[box.w,box.h,box.d],plane=center[axis]+sign*size[axis]/2;
   let us=[center[u]-size[u]/2,center[u]+size[u]/2],vs=[center[v]-size[v]/2,center[v]+size[v]/2];
   const exposed=Math.abs(plane-[box.source.x,box.source.y,box.source.z][axis])>=[box.source.w,box.source.h,box.source.d][axis]/2-E;
   if(field&&active&&subdivide&&exposed&&near.length&&size[u]*size[v]>=BAKED_AO.minFaceArea&&Math.max(size[u],size[v])>=BAKED_AO.minFaceSpan){
    const cu=field.cuts(us[0],us[1],u,axis,plane,near,box.source),cv=field.cuts(vs[0],vs[1],v,axis,plane,near,box.source),added=((cu.length-1)*(cv.length-1)-1)*2;
    if(extra+added<=BAKED_AO.maxExtraPerChunk){us=cu;vs=cv;extra+=added;}
   }
   if(saved?.u.length){us=saved.u;vs=saved.v;}patch.u=us;patch.v=vs;let sample=0;
   const color=normal[1]>.5?t:c;
   for(let a=0;a<us.length-1;a++)for(let b=0;b<vs.length-1;b++){
    const base=positions.length/3;
    for(const [uu,vv] of [[us[a],vs[b]],[us[a+1],vs[b]],[us[a+1],vs[b+1]],[us[a],vs[b+1]]]){const point=[...center];point[axis]=plane;point[u]=uu;point[v]=vv;const light=saved?saved.l[sample++]:active&&field?Math.round(field.factor(point,axis,sign,near,normal[1]>.5,center)*100000)/100000:1;patch.l.push(light);positions.push(...point);normals.push(...normal);colors.push(color.r*light,color.g*light,color.b*light);}
    if(sign>0)index.push(base,base+1,base+2,base,base+2,base+3);else index.push(base,base+2,base+1,base,base+3,base+2);
   }
   if(field&&(us.length>2||vs.length>2||patch.l.some(v=>v<1)))recorded.push(patch);
  }
 }
 if(AO_AUTHORING.recording)AO_AUTHORING.parts[name]=recorded;
 const g=new BufferGeometry();g.name=name;g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('normal',new Float32BufferAttribute(normals,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(index);g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);return g;
}
export function buildMap(data:MapData,options?:MapBuildOptions):Group{
 const bakedAo=options?.bakedAo??true;
 const key=JSON.stringify([data,bakedAo]);let entry=cache.get(key);
 if(!entry){
  // Collidable prefabs are static map scenery: bake them into the same four
  // quadrants instead of spending a draw per prop skin. Complex visual families
  // retain real GPU instancing (window / shutter / awning assemblies).
  const bakedInstances=data.instances.filter(i=>data.prefabs[i.prefab].some(b=>b.kind!=='decor'||b.collide||b.blocksShots)||data.prefabs[i.prefab].length<12);
  const visualInstances=data.instances.filter(i=>!bakedInstances.includes(i));
  const staticBoxes=expandedBoxes({...data,instances:bakedInstances});
  const bank=bakedAo&&!AO_AUTHORING.recording?loadAo(data):null;
  const field=bakedAo&&!bank?new AoField(staticBoxes):undefined;
  const buckets=new Map<string,{x:number;z:number;boxes:DrawBox[]}>();let renderBoxes=0;
  for(const b of staticBoxes)for(const draw of drawBoxes(b,data.palette)){
   const x0=draw.x-draw.w/2,x1=draw.x+draw.w/2,z0=draw.z-draw.d/2,z1=draw.z+draw.d/2;
   for(let cx=Math.floor(x0/CHUNK);cx<=Math.floor((x1-1e-8)/CHUNK);cx++)for(let cz=Math.floor(z0/CHUNK);cz<=Math.floor((z1-1e-8)/CHUNK);cz++){
    const left=Math.max(x0,cx*CHUNK),right=Math.min(x1,(cx+1)*CHUNK),back=Math.max(z0,cz*CHUNK),front=Math.min(z1,(cz+1)*CHUNK);if(right-left<1e-7||front-back<1e-7)continue;
    const id=cx+','+cz;let bucket=buckets.get(id);if(!bucket)buckets.set(id,bucket={x:cx,z:cz,boxes:[]});bucket.boxes.push({...draw,x:(left+right)/2,z:(back+front)/2,w:right-left,d:front-back});renderBoxes++;
   }
  }
  const chunks=[...buckets.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,b])=>({name:'chunk:'+name,x:b.x,z:b.z,geometry:geometry(b.boxes,'chunk:'+name,field,true,bank?.parts['chunk:'+name])}));
  const prefabGroups=new Map<string,Matrix4[]>();
  for(const instance of visualInstances){let list=prefabGroups.get(instance.prefab);if(!list)prefabGroups.set(instance.prefab,list=[]);const m=new Matrix4().makeRotationY(instance.yaw);m.setPosition(instance.x,instance.y,instance.z);list.push(m);}
  const prefabs=[...prefabGroups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,matrices])=>{
   const boxes=data.prefabs[name].flatMap(b=>drawBoxes(b,data.palette));renderBoxes+=boxes.length*matrices.length;return {name:'prefab:'+name,geometry:geometry(boxes,'prefab:'+name,bakedAo&&!bank?new AoField(data.prefabs[name]):undefined,false,bank?.parts['prefab:'+name]),matrices};
  });
  const stats:MapStats={boxes:data.boxes.length+data.instances.reduce((n,i)=>n+data.prefabs[i.prefab].length,0),renderBoxes,triangles:chunks.reduce((n,c)=>n+c.geometry.index!.count/3,0)+prefabs.reduce((n,p)=>n+p.geometry.index!.count/3*p.matrices.length,0),drawCalls:chunks.length+prefabs.length,chunks:chunks.length,instancedPrefabs:prefabs.length,instances:data.instances.length,shadowChunks:Math.min(6,chunks.length)};
  entry={chunks,prefabs,stats};cache.set(key,entry);
 }
 if(!material){material=new MeshLambertMaterial({vertexColors:true});material.name='maps-shared-lambert';}
 const group=new Group();group.name='map:'+data.id;
 const shadowNames=new Set([...entry.chunks].sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count||a.name.localeCompare(b.name)).slice(0,6).map(c=>c.name));
 for(const c of entry.chunks){const mesh=new Mesh(c.geometry,material);mesh.name=c.name;mesh.castShadow=shadowNames.has(c.name);mesh.receiveShadow=true;group.add(mesh);}
 for(const p of entry.prefabs){const mesh=new InstancedMesh(p.geometry,material,p.matrices.length);instancedMeshes.add(mesh);mesh.name=p.name;for(let i=0;i<p.matrices.length;i++)mesh.setMatrixAt(i,p.matrices[i]);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);}
 if(data.light.hemisphere){const fill=data.light.hemisphere,light=new HemisphereLight(fill.sky,fill.ground,fill.intensity);light.name='map-hemisphere';group.add(light);}
 group.userData={mapId:data.id,stats:{...entry.stats},chunkSize:CHUNK,bakedAo,aoSource:bakedAo?'vertex-colours':'disabled'};return group;
}
export function disposeMapResources():void{for(const mesh of instancedMeshes)mesh.dispose();instancedMeshes.clear();for(const g of geometries)g.dispose();geometries.clear();cache.clear();unit?.dispose();unit=null;material?.dispose();material=null;}
