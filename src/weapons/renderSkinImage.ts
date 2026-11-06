import type { SkinTraits } from './skinTraits';
import { validateSkinTraits } from './skinTraits';
import type { OrthographicCamera, Scene, WebGLRenderer } from 'three';
import type { WeaponId } from './types';
export interface SkinImageOptions {lod?:'near'|'far';time?:number}

let renderer:WebGLRenderer|undefined,scene:Scene|undefined,camera:OrthographicCamera|undefined;
let queue:Promise<unknown>=Promise.resolve();
/** Browser-only PNG data URL. Renderer is lazy and reused; nothing creates WebGL on a Node/server import. */
export function renderSkinImage(input:SkinTraits,size=512,options:SkinImageOptions={}):Promise<string>{
  const traits=validateSkinTraits(input);
  return renderImage(traits.weapon,size,traits,options);
}
/** Review-only baseline, using exactly the same framing and light as a skin. */
export function renderBaseWeaponImage(weapon:WeaponId,size=512):Promise<string>{return renderImage(weapon,size);}
function renderImage(weapon:WeaponId,size:number,traits?:SkinTraits,options:SkinImageOptions={}):Promise<string>{
  if(!Number.isInteger(size)||size<64||size>1024)return Promise.reject(new RangeError('Skin PNG size must be 64–1024'));
  const job=queue.then(async()=>{
    if(typeof document==='undefined')throw new Error('renderSkinImage requires a browser WebGL context');
    const THREE=await import('three'),{createWeapon}=await import('./createWeapon'),{frameSkinImage}=await import('./skinFraming'),{poseWeapon}=await import('./poseWeapon');
    if(!renderer){renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
      scene=new THREE.Scene();scene.background=new THREE.Color('#D7E6EF');scene.add(new THREE.AmbientLight(0xffffff,Math.PI));
      camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,30);
    }
    const base=createWeapon(weapon),model=traits?createWeapon(weapon,{skin:traits,lod:options.lod}):base;if(traits)poseWeapon(model,{fire:0,reload:null,cycle:null,equip:1,time:options.time??1});scene!.add(model);model.updateMatrixWorld(true);
    frameSkinImage(camera!,new THREE.Box3().setFromObject(base));
    renderer.setSize(size,size,false);renderer.render(scene!,camera!);const png=renderer.domElement.toDataURL('image/png');scene!.remove(model);return png;
  });
  queue=job.catch(()=>{});return job;
}
/** After pending renders finish; shared weapon geometries have their separate existing lifetime. */
export async function disposeSkinImageRenderer():Promise<void>{await queue;renderer?.dispose();renderer?.forceContextLoss();renderer=undefined;scene=undefined;camera=undefined;}
