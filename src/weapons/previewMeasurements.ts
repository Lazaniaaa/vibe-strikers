import { Matrix4, Mesh, SkinnedMesh } from 'three';
import type { Group, BufferGeometry } from 'three';
import { poseViewmodel } from './viewmodel';
import { sniperViewTube } from './sniperViewScope';
import { sniperScopeBoxes } from './sniperScope';
import { weapons } from './weapons';
import type { CharacterConfig } from '../characters/types';
import type { WeaponId, ViewmodelState } from './types';
import type { DiagnosticGeometry, DiagnosticPiece, DiagnosticRequest } from './previewMeasureCore';

export interface PreviewMeasurementInput {weapon:WeaponId;character:CharacterConfig;state:ViewmodelState;aspect:number;model?:Group}
type Result={key:string;token:number;ads:number;angle:number;centreClear:boolean;rays:number;coverage?:number;clearWidth?:number;clearHeight?:number;workerMs:number;bvhBuilds:number;error?:string};
const snapshotMatrix=new Matrix4();
const sniperGunBoxCount=weapons.find(w=>w.id==='sniper')!.body.filter(b=>!sniperScopeBoxes.includes(b)).length;
/** Read-only copies go to a worker once per cached geometry, never from an input handler. */
export function snapshotDiagnostic(vm:Group,input:PreviewMeasurementInput,token:number,key:string,sent:Set<string>):DiagnosticRequest{
 const geometries:DiagnosticGeometry[]=[],opaque:DiagnosticPiece[]=[],scope:DiagnosticPiece[]=[];
 const add=(g:BufferGeometry,matrix:Matrix4,bone:number,list:DiagnosticPiece[],start=0,end=g.index?.count??g.attributes.position.count)=>{
  const id=start||end!==(g.index?.count??g.attributes.position.count)?`${g.uuid}:${start}:${end}`:g.uuid;
  if(!sent.has(id)){
   const p=g.attributes.position,index=g.index,skin=g.attributes.skinIndex;
   const positions=new Float32Array(p.count*3),indices=new Uint32Array(end-start),bones=skin?new Uint16Array(p.count):undefined;
   for(let i=0;i<p.count;i++){positions[i*3]=p.getX(i);positions[i*3+1]=p.getY(i);positions[i*3+2]=p.getZ(i);if(bones)bones[i]=skin.getX(i);}
   for(let i=0;i<indices.length;i++)indices[i]=index?index.getX(start+i):start+i;
   geometries.push({id,positions,index:indices,bones});sent.add(id);
  }
  list.push({geometry:id,matrix:matrix.elements.slice(),bone});
 };
 vm.updateMatrixWorld(true);
 vm.traverseVisible(o=>{if(!(o instanceof Mesh)||o.name.startsWith('lens-'))return;
  if(o instanceof SkinnedMesh){for(let i=0;i<o.skeleton.bones.length;i++){
   snapshotMatrix.copy(o.matrixWorld).multiply(o.bindMatrixInverse).multiply(o.skeleton.bones[i].matrixWorld).multiply(o.skeleton.boneInverses[i]).multiply(o.bindMatrix);
   add(o.geometry,snapshotMatrix,i,opaque);
  }}else add(o.geometry,o.matrixWorld,-1,opaque);
 });
 if(input.weapon==='sniper'){
  const w=vm.userData.weapon as Group,body=w.userData.scopeBody as SkinnedMesh,g=body.geometry,index=g.index!,skin=g.attributes.skinIndex;
  let fixedIndices=0;while(fixedIndices<index.count&&skin.getX(index.getX(fixedIndices))===0)fixedIndices++;
  const perBox=fixedIndices/(sniperGunBoxCount+sniperViewTube.length);
  if(!Number.isInteger(perBox))throw new Error('Unexpected sniper fixed box layout');
  // Read index ranges of the existing scope, rather than constructing diagnostic geometry.
  add(g,body.matrixWorld,-1,scope,sniperGunBoxCount*perBox,fixedIndices);
  const rear=w.userData.scopeRear as Mesh;add(rear.geometry,rear.matrixWorld,-1,scope);
  w.traverseVisible(o=>{if(o instanceof Mesh&&o.name.startsWith('lens-'))add(o.geometry,o.matrixWorld,-1,scope);});
 }
 return {token,key,ads:Math.round((input.state.ads??0)*20)/20,aspect:input.aspect,geometries,opaque,scope};
}
export function createPreviewMeasurements(read:()=>PreviewMeasurementInput,show:(text:string)=>void){
 const worker=new Worker(new URL('./previewMeasureWorker.ts',import.meta.url),{type:'module'}),sent=new Set<string>(),cache=new Map<string,Result>();
 const jobs=new Map<number,{signature:string;weapon:WeaponId}>();
 let token=0,gate=0,idle=0,disposed=false;
 const stats={requests:0,workerJobs:0,cacheHits:0,results:0,maxSnapshotMs:0,lastWorkerMs:0,bvhBuilds:0,maxRays:0,scheduled:false,inFlight:0};
 const signature=(v:PreviewMeasurementInput)=>`${v.weapon}|${v.state.holdSide??'right'}|${Math.round((v.state.ads??0)*20)}|${v.character.id}|${v.state.fire}|${v.state.reload}|${v.state.cycle}|${v.state.equip}|${v.state.moveSpeed}|${v.state.strafe}|${v.state.grounded}|${v.state.crouching}|${v.state.aimPitch}|${v.aspect.toFixed(3)}`;
 const label=(r:Result,weapon:WeaponId)=>{
  if(weapon==='sniper'&&r.ads>=.9){show(`ADS ${r.ads.toFixed(2)} · 2D піксельний приціл · viewmodel прихований`);return;}
  let text=weapon==='knife'?'Ніж · без ADS':`ADS ${r.ads.toFixed(2)} · чистий кут ${r.angle.toFixed(1)}° · ціль ≥${weapon==='sniper'?20:25}° при ADS 1`;
  if(r.coverage!==undefined)text+=' · проєкція прицілу HIP '+r.coverage.toFixed(2)+'%';
  if(r.clearWidth!==undefined)text+=' · чиста область 16:9 '+(r.clearWidth*100).toFixed(1)+'% × '+(r.clearHeight!*100).toFixed(1)+'%';
  show(text);
 };
 worker.onmessage=(event:MessageEvent<Result>)=>{
  const r=event.data,job=jobs.get(r.token);jobs.delete(r.token);if(!job||disposed)return;stats.inFlight--;
  if(r.error){console.error('Preview measurement',r.error);return;}
  cache.set(job.signature,r);stats.results++;stats.lastWorkerMs=r.workerMs;stats.bvhBuilds=r.bvhBuilds;stats.maxRays=Math.max(stats.maxRays,r.rays);
  if(signature(read())===job.signature)label(r,job.weapon);
 };
 const launch=()=>{
  stats.scheduled=false;if(disposed)return;const input=read(),key=signature(input),hit=cache.get(key);
  if(hit){stats.cacheHits++;label(hit,input.weapon);return;}
  const began=performance.now(),vm=input.model!;
  const sample={...input.state,ads:Math.round((input.state.ads??0)*20)/20};poseViewmodel(vm,sample);
  let request:DiagnosticRequest;
  try{request=snapshotDiagnostic(vm,{...input,state:sample},++token,key,sent);}
  finally{poseViewmodel(vm,input.state);vm.updateMatrixWorld(true);}
  jobs.set(token,{signature:key,weapon:input.weapon});stats.workerJobs++;stats.inFlight++;
  stats.maxSnapshotMs=Math.max(stats.maxSnapshotMs,performance.now()-began);worker.postMessage(request);
 };
 return {stats,request(){
  stats.requests++;stats.scheduled=true;cancelAnimationFrame(gate);if(idle){if('cancelIdleCallback'in window)window.cancelIdleCallback(idle);else clearTimeout(idle);}
  // Let the visual frame present first. All per-vertex work then happens off the UI thread.
  gate=requestAnimationFrame(()=>{idle='requestIdleCallback'in window?window.requestIdleCallback(launch,{timeout:500}):window.setTimeout(launch,0);});
 },dispose(){disposed=true;cancelAnimationFrame(gate);if(idle){if('cancelIdleCallback'in window)window.cancelIdleCallback(idle);else clearTimeout(idle);}worker.terminate();cache.clear();}};
}
