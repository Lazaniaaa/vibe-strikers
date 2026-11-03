import {BAKED_AO}from './bakedAo';
import town from './ao-data/toy-town';
import l1r1 from './ao-data/toy-town-l1-r1';
import l1r2 from './ao-data/toy-town-l1-r2';
import l2r1 from './ao-data/toy-town-l2-r1';
import l2r2 from './ao-data/toy-town-l2-r2';
import type{MapData}from'./types';
export interface AoPatch {i:number;u:number[];v:number[];l:number[]}
export interface AoRecord {shape:string;parts:Record<string,AoPatch[]>}
/** Offline authoring only: no rays, indices or geometry are created at import time. */
export const AO_AUTHORING:{recording:boolean;parts:Record<string,AoPatch[]>}={recording:false,parts:{}};
const loaders:Record<string,()=>string>={'toy-town':town,'toy-town-l1-r1':l1r1,'toy-town-l1-r2':l1r2,'toy-town-l2-r1':l2r1,'toy-town-l2-r2':l2r2};
export function aoShape(data:MapData):string{const text=JSON.stringify([BAKED_AO,data.boxes,data.prefabs,data.instances],(key,value)=>key==='color'||key==='top'?undefined:value);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16);}
export function loadAo(data:MapData):AoRecord|null{const text=loaders[data.id]?.();if(!text)return null;const packed: {shape:string;parts:Record<string,string>}=JSON.parse(text);if(packed.shape!==aoShape(data))return null;
 const parts:Record<string,AoPatch[]>={};
 for(const [name,base64]of Object.entries(packed.parts)){
  const raw=atob(base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const view=new DataView(bytes.buffer);let offset=0,ordinal=0;const patches:AoPatch[]=[];
  while(offset<bytes.length){let delta=0,shift=0,byte;do{byte=bytes[offset++];delta|=(byte&127)<<shift;shift+=7;}while(byte&128);ordinal+=delta;
   const flags=bytes[offset++],u:number[]=[],v:number[]=[],l:number[]=[];let count=4;
   if(flags&64){const nu=bytes[offset++],nv=bytes[offset++];for(let i=0;i<nu;i++){u.push(view.getFloat32(offset,true));offset+=4;}for(let i=0;i<nv;i++){v.push(view.getFloat32(offset,true));offset+=4;}count=(nu-1)*(nv-1)*4;}
   if(flags&128){const value=bytes[offset++]/255;for(let i=0;i<count;i++)l.push(value);}else for(let i=0;i<count;i++)l.push(bytes[offset++]/255);
   patches.push({i:ordinal,u,v,l});
  }parts[name]=patches;
 }return {shape:packed.shape,parts};}
