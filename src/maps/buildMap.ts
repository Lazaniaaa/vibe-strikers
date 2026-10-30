import { BoxGeometry,BufferGeometry,Color,Float32BufferAttribute,Group,InstancedMesh,Matrix4,Mesh,MeshLambertMaterial } from 'three';
import type { MapBox,MapData,MapStats } from './types';
const CHUNK=16,E=.002;
let unit:BoxGeometry|null=null,material:MeshLambertMaterial|null=null;
const cache=new Map<string,{chunks:{name:string;geometry:BufferGeometry;x:number;z:number}[];prefabs:{name:string;geometry:BufferGeometry;matrices:Matrix4[]}[];stats:MapStats}>();
const geometries=new Set<BufferGeometry>();
const instancedMeshes=new Set<InstancedMesh>();
interface DrawBox {x:number;y:number;z:number;w:number;h:number;d:number;color:string;top:string}
function drawBoxes(box:MapBox,palette:MapData['palette']):DrawBox[]{
 const {x,y,z,w,h,d}=box,color=palette[box.color],top=palette[box.top??box.color];
 if(!box.outline)return [{x,y,z,w,h,d,color,top}];
 const border=Math.min(.025,Math.min(w,h,d)*.14),dark=palette.outline;
 // Base plus five inset face plates; bottom stays flat/dark. Plates are offset 2mm.
 return [{x,y,z,w,h:h-E*2,d,color:dark,top:dark},
  ...[-1,1].map(s=>({x,y,z:z+s*(d/2+E),w:w-2*border,h:h-2*border,d:E,color,top:color})),
  ...[-1,1].map(s=>({x:x+s*(w/2+E),y,z,w:E,h:h-2*border,d:d-2*border,color,top:color})),
  {x,y:y+h/2+E,z,w:w-2*border,h:E,d:d-2*border,color:top,top}];
}
function geometry(boxes:readonly DrawBox[],name:string):BufferGeometry{
 if(!unit)unit=new BoxGeometry(1,1,1);
 const p=unit.attributes.position,n=unit.attributes.normal,indices=unit.index!,positions:number[]=[],normals:number[]=[],colors:number[]=[],index:number[]=[];
 const rgb=new Map<string,Color>(),get=(hex:string)=>{let c=rgb.get(hex);if(!c){c=new Color(hex);rgb.set(hex,c);}return c;};
 for(const box of boxes){const base=positions.length/3,c=get(box.color),t=get(box.top);
  for(let i=0;i<p.count;i++){positions.push(p.getX(i)*box.w+box.x,p.getY(i)*box.h+box.y,p.getZ(i)*box.d+box.z);normals.push(n.getX(i),n.getY(i),n.getZ(i));const face=n.getY(i)>.5?t:c;colors.push(face.r,face.g,face.b);}
  for(let i=0;i<indices.count;i++)index.push(base+indices.getX(i));
 }
 const g=new BufferGeometry();g.name=name;g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('normal',new Float32BufferAttribute(normals,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(index);g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);return g;
}
export function buildMap(data:MapData):Group{
 const key=JSON.stringify(data);let entry=cache.get(key);
 if(!entry){
  const buckets=new Map<string,{x:number;z:number;boxes:DrawBox[]}>();let renderBoxes=0;
  for(const b of data.boxes)for(const draw of drawBoxes(b,data.palette)){
   const x0=draw.x-draw.w/2,x1=draw.x+draw.w/2,z0=draw.z-draw.d/2,z1=draw.z+draw.d/2;
   for(let cx=Math.floor(x0/CHUNK);cx<=Math.floor((x1-1e-8)/CHUNK);cx++)for(let cz=Math.floor(z0/CHUNK);cz<=Math.floor((z1-1e-8)/CHUNK);cz++){
    const left=Math.max(x0,cx*CHUNK),right=Math.min(x1,(cx+1)*CHUNK),back=Math.max(z0,cz*CHUNK),front=Math.min(z1,(cz+1)*CHUNK);if(right-left<1e-7||front-back<1e-7)continue;
    const id=cx+','+cz;let bucket=buckets.get(id);if(!bucket)buckets.set(id,bucket={x:cx,z:cz,boxes:[]});bucket.boxes.push({...draw,x:(left+right)/2,z:(back+front)/2,w:right-left,d:front-back});renderBoxes++;
   }
  }
  const chunks=[...buckets.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,b])=>({name:'chunk:'+name,x:b.x,z:b.z,geometry:geometry(b.boxes,'chunk:'+name)}));
  const prefabGroups=new Map<string,Matrix4[]>();
  for(const instance of data.instances){let list=prefabGroups.get(instance.prefab);if(!list)prefabGroups.set(instance.prefab,list=[]);const m=new Matrix4().makeRotationY(instance.yaw);m.setPosition(instance.x,instance.y,instance.z);list.push(m);}
  const prefabs=[...prefabGroups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,matrices])=>{
   const boxes=data.prefabs[name].flatMap(b=>drawBoxes(b,data.palette));renderBoxes+=boxes.length*matrices.length;return {name:'prefab:'+name,geometry:geometry(boxes,'prefab:'+name),matrices};
  });
  const stats:MapStats={boxes:data.boxes.length+data.instances.reduce((n,i)=>n+data.prefabs[i.prefab].length,0),renderBoxes,triangles:chunks.reduce((n,c)=>n+c.geometry.index!.count/3,0)+prefabs.reduce((n,p)=>n+p.geometry.index!.count/3*p.matrices.length,0),drawCalls:chunks.length+prefabs.length,chunks:chunks.length,instancedPrefabs:prefabs.length,instances:data.instances.length,shadowChunks:Math.min(6,chunks.length)};
  entry={chunks,prefabs,stats};cache.set(key,entry);
 }
 if(!material){material=new MeshLambertMaterial({vertexColors:true});material.name='maps-shared-lambert';}
 const group=new Group();group.name='map:'+data.id;
 const shadowNames=new Set([...entry.chunks].sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count||a.name.localeCompare(b.name)).slice(0,6).map(c=>c.name));
 for(const c of entry.chunks){const mesh=new Mesh(c.geometry,material);mesh.name=c.name;mesh.castShadow=shadowNames.has(c.name);mesh.receiveShadow=true;group.add(mesh);}
 for(const p of entry.prefabs){const mesh=new InstancedMesh(p.geometry,material,p.matrices.length);instancedMeshes.add(mesh);mesh.name=p.name;for(let i=0;i<p.matrices.length;i++)mesh.setMatrixAt(i,p.matrices[i]);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);}
 group.userData={mapId:data.id,stats:{...entry.stats},chunkSize:CHUNK};return group;
}
export function disposeMapResources():void{for(const mesh of instancedMeshes)mesh.dispose();instancedMeshes.clear();for(const g of geometries)g.dispose();geometries.clear();cache.clear();unit?.dispose();unit=null;material?.dispose();material=null;}
