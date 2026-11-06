/** Browser-only authoring checks. Never imported by the game/skin generator. */
import * as T from 'three';
import {createViewmodel,poseViewmodel}from'./viewmodel';
import {createWeapon}from'./createWeapon';
import {generateSkinTraits,SKIN_RARITIES}from'./skinTraits';
import {weaponIds}from'./weaponIds';
import {characters,createCharacter}from'../characters/index';
import {buildMap,loadMapData}from'../maps/index';
import {attachWeapon}from'./hold';
import {poseWeapon}from'./poseWeapon';
import {frameSkinImage}from'./skinFraming';
const SIZE={w:384,h:216},VALUES=[0,.5,1];
export async function checkSkinRenders(progress:(text:string)=>void){
 const renderer=new T.WebGLRenderer({antialias:false,alpha:true});renderer.setPixelRatio(1);renderer.setSize(SIZE.w,SIZE.h,false);renderer.setClearColor(0,0);
 const camera=new T.PerspectiveCamera(70,16/9,.01,200),scene=new T.Scene(),target=new T.WebGLRenderTarget(SIZE.w,SIZE.h),mask=new T.MeshBasicMaterial({color:0xffffff});
 scene.overrideMaterial=mask;const pixels=new Uint8Array(SIZE.w*SIZE.h*4),baseMask=new Uint8Array(SIZE.w*SIZE.h);
 const state={fire:0,reload:0,cycle:0,equip:1,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,time:.7,ads:0,heat:0,charge:0,paintLevel:1};
 const render=(g:T.Group)=>{scene.add(g);g.traverse(o=>{if(o.name.startsWith('lens-'))o.visible=false;});renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,SIZE.w,SIZE.h,pixels);scene.remove(g);};
 let cases=0,maxExtra=0;const failures:unknown[]=[],coverage:unknown[]=[];
 try{
  for(const id of weaponIds){
   for(const side of['right','left']as const){const base=createViewmodel(id,characters[0],{holdSide:side});
    const skins=SKIN_RARITIES.map(rarity=>createViewmodel(id,characters[0],{holdSide:side,skin:generateSkinTraits({weapon:id,rarity,seed:1234})}));
    for(const value of VALUES){state.fire=state.reload=state.cycle=state.heat=state.charge=state.ads=value;state.paintLevel=value;poseViewmodel(base,state);render(base);let baseCount=0;
     for(let i=0;i<baseMask.length;i++){baseMask[i]=pixels[i*4+3]>250?1:0;baseCount+=baseMask[i];}
     for(let tier=0;tier<skins.length;tier++){const model=skins[tier];poseViewmodel(model,state);render(model);let extra=0,count=0;for(let i=0;i<baseMask.length;i++)if(pixels[i*4+3]>250){count++;if(!baseMask[i])extra++;}
      cases++;maxExtra=Math.max(maxExtra,extra);coverage.push({id,side,rarity:SKIN_RARITIES[tier],value,basePixels:baseCount,skinPixels:count,extraPixels:extra});if(extra>0)failures.push(coverage.at(-1));
     }
    }
   }progress('VM coverage: '+id+' · '+cases+' cases');await new Promise<void>(r=>setTimeout(r,0));
  }
  // Compare silhouettes at thumbnail size with identical camera/scale, in both LODs.
  const thumbTarget=new T.WebGLRenderTarget(64,64),thumbCamera=new T.OrthographicCamera(-1,1,1,-1,.01,30),thumbPixels=new Uint8Array(64*64*4),silhouettes:{weapon:string;lod:string;minimumDifference:number;adjacent:number[]}[]=[];
  for(const id of weaponIds){frameSkinImage(thumbCamera,new T.Box3().setFromObject(createWeapon(id)));for(const lod of['near','far']as const){const masks:Uint8Array[]=[];
   for(const rarity of SKIN_RARITIES){const model=createWeapon(id,{skin:generateSkinTraits({weapon:id,rarity,seed:1234}),lod});model.traverse(o=>{if(o.name.startsWith('lens-'))o.visible=false;});scene.add(model);renderer.setRenderTarget(thumbTarget);renderer.render(scene,thumbCamera);renderer.readRenderTargetPixels(thumbTarget,0,0,64,64,thumbPixels);scene.remove(model);masks.push(Uint8Array.from({length:4096},(_,i)=>thumbPixels[i*4+3]>250?1:0));}
   let minimumDifference=4096;const adjacent:number[]=[];for(let a=0;a<6;a++)for(let b=a+1;b<6;b++){let difference=0;for(let p=0;p<4096;p++)if(masks[a][p]!==masks[b][p])difference++;minimumDifference=Math.min(minimumDifference,difference);if(b===a+1)adjacent.push(difference);}
   silhouettes.push({weapon:id,lod,minimumDifference,adjacent});if(minimumDifference===0)failures.push({kind:'Identical rarity silhouettes at 64px',weapon:id,lod});
  }}thumbTarget.dispose();
  // Alternating instances must upload their own reactive gain, even with shared shaders.
  scene.overrideMaterial=null;scene.add(new T.AmbientLight(0xffffff,Math.PI));const recipe=generateSkinTraits({weapon:'rifle',rarity:'mythic',seed:1234});
  const a=createViewmodel('rifle',characters[0],{skin:recipe}),b=createViewmodel('rifle',characters[0],{skin:recipe});
  poseViewmodel(b,{...state,fire:0,time:0,ads:0,heat:0,charge:0});render(b);const before=pixels.slice();poseViewmodel(a,{...state,fire:0,time:1,ads:0,heat:0,charge:0});render(a);render(b);
  const instanceColourIsolated=before.every((value,i)=>value===pixels[i]);if(!instanceColourIsolated)failures.push({kind:'shared glow uniform leaked between instances'});
  const farA=createWeapon('rifle',{skin:recipe,lod:'far'}),farB=createWeapon('rifle',{skin:recipe,lod:'far'});
  frameSkinImage(thumbCamera,new T.Box3().setFromObject(createWeapon('rifle')));const colour=(g:T.Group)=>{scene.add(g);renderer.setRenderTarget(target);renderer.render(scene,thumbCamera);renderer.readRenderTargetPixels(target,0,0,SIZE.w,SIZE.h,pixels);scene.remove(g);};
  poseWeapon(farB,{...state,fire:0,time:0,heat:0,charge:0});colour(farB);const farBefore=pixels.slice();poseWeapon(farA,{...state,fire:0,time:1,heat:0,charge:0});colour(farA);const farGlowAnimated=farBefore.some((v,i)=>v!==pixels[i]);colour(farB);const farColourIsolated=farBefore.every((v,i)=>v===pixels[i]);
  if(!farGlowAnimated||!farColourIsolated)failures.push({kind:'Far glow animation/isolation',farGlowAnimated,farColourIsolated});
  // Actual Three draw counters, including the optional shadow pass. No map/character changes.
  scene.overrideMaterial=null;renderer.setRenderTarget(null);renderer.setClearColor('#D7E6EF',1);scene.add(new T.AmbientLight(0xffffff,1));const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(-20,40,15);scene.add(sun);
  const map=buildMap(loadMapData('toy-town-l1-r1'));scene.add(map);camera.position.set(36,32,48);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const models:T.Group[]=[];const config=characters.find(c=>c.id.endsWith('viber-extra-11'))??characters[0];
  for(let i=0;i<8;i++){const c=createCharacter(config);c.position.set((i%4-1.5)*3,0,(i<4?-3:3));scene.add(c);models.push(c);}
  renderer.render(scene,camera);const baseline={...renderer.info.render};
  const held:T.Group[]=[];for(const c of models){const w=createWeapon('rail',{skin:generateSkinTraits({weapon:'rail',rarity:'mythic',seed:1234}),lod:'far'});attachWeapon(c,w);held.push(w);}
  renderer.render(scene,camera);const farFrame={...renderer.info.render};
  renderer.shadowMap.enabled=true;sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-40;sun.shadow.camera.right=sun.shadow.camera.top=40;sun.shadow.camera.far=100;
  for(const w of held)w.visible=false;renderer.render(scene,camera);const baselineWithShadows={...renderer.info.render};for(const w of held)w.visible=true;renderer.render(scene,camera);const shadowFrame={...renderer.info.render};
  const budgetPass=shadowFrame.calls<=120&&shadowFrame.triangles<=200000;
  const report={pass:failures.length===0&&budgetPass,assetPass:failures.length===0,budgetPass,cases,resolution:SIZE,maxExtraPixels:maxExtra,instanceColourIsolated,farColourIsolated,farGlowAnimated,silhouettes,failures,coverage,frame:{view:'Toy Town world pass overview, 8 characters + mythic rail far; no viewmodel/postfx',character:config.id,baseline,baselineWithShadows,farFrame,shadowFrame,colourPassWithinBudget:farFrame.calls<=120&&farFrame.triangles<=200000,shadowPassWithinBudget:budgetPass}};
  return report;
 }finally{mask.dispose();target.dispose();renderer.dispose();renderer.forceContextLoss();}
}
