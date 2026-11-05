/** Dedicated menu scenery. Import this entry explicitly; it is never part of mapIds or server map selection. */
import source from './data/lobby-island.json';
import { Color, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildMap, disposeMapResources } from './buildMap';
import type { MapData } from './types';

export interface LobbySceneData extends MapData {
  pedestal: { radius:number; height:number; segments:number; border:number; side:string; top:string; stripe:string };
  cloudShape: readonly {x:number;y:number;z:number;w:number;h:number;d:number}[];
  clouds: readonly (readonly number[])[];
}
function freeze<T>(value:T):T { if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value; }
const data=freeze(source as unknown as LobbySceneData);
const owned=new Set<BufferGeometry>();
const instances=new Set<InstancedMesh>();
export function loadLobbyScene():LobbySceneData { return data; }

/** Reuses the game's box outlines, shared Lambert material, geometry cache and vertex-colour AO. */
export function buildLobbyScene(options?:{teamColors?:{ally:string;enemy:string};bakedAo?:boolean}):Group {
  const palette:MapData['palette']={...data.palette,...options?.teamColors};
  const island=buildMap({...data,palette},{bakedAo:options?.bakedAo??true});
  island.name='lobby-island';
  island.traverse(object=>{if(object instanceof Mesh){object.castShadow=false;object.receiveShadow=false;}});
  const material=(island.children.find(child=>child instanceof Mesh) as Mesh).material;
  const p=data.pedestal;
  const cylinder=(radius:number,height:number,y:number,color:string,open=false)=>{
    const g=new CylinderGeometry(radius,radius,height,p.segments,1,open);g.translate(0,y,0);
    const rgb=new Color(palette[color]),colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=rgb.r;colors[i+1]=rgb.g;colors[i+2]=rgb.b;}
    g.setAttribute('color',new Float32BufferAttribute(colors,3));return g;
  };
  // The recessed base cap and raised inset disc never share a plane. The side skin has no caps.
  const layers=[cylinder(p.radius,p.height-p.border,-(p.height+p.border)/2,'outline'),
    cylinder(p.radius+p.border/10,p.height-p.border*2,-p.height/2,p.side,true),
    cylinder(p.radius-p.border,p.border,-p.border/2,p.top),
    cylinder(p.radius+p.border,p.border,-p.height+p.border/2,p.stripe)];
  const geometry=mergeGeometries(layers)!;for(const layer of layers)layer.dispose();owned.add(geometry);
  const pedestal=new Mesh(geometry,material);pedestal.name='pedestal';pedestal.receiveShadow=true;island.add(pedestal);
  const cloudMap:MapData={...data,id:'lobby-cloud',palette,boxes:data.cloudShape.map(b=>({...b,color:'cloud',top:'cloudTop',outline:false,kind:'decor',collide:false,blocksShots:false})),instances:[]};
  const cloudModel=buildMap(cloudMap,{bakedAo:false});
  const cloudGeometry=(cloudModel.children.find(child=>child instanceof Mesh) as Mesh).geometry;
  const clouds=new InstancedMesh(cloudGeometry,material,data.clouds.length),matrix=new Matrix4();
  for(let i=0;i<data.clouds.length;i++){const [x,y,z,scale]=data.clouds[i];matrix.makeScale(scale,scale,scale);matrix.setPosition(x-2*scale,y-scale,z-2*scale);clouds.setMatrixAt(i,matrix);}
  clouds.name='clouds';clouds.computeBoundingSphere();instances.add(clouds);island.add(clouds);
  island.userData.clouds=data.clouds.length;
  return island;
}

/** Only call after the menu is removed; game and menu renderer lifetimes must not overlap. */
export function disposeLobbySceneResources():void {
  for(const mesh of instances)mesh.dispose();instances.clear();
  for(const geometry of owned)geometry.dispose();owned.clear();disposeMapResources();
}
