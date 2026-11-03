import { useEffect, useMemo } from 'react';
import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, HalfFloatType, Vector2, type Object3D, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
// n8ao 2.0.1 ships JS without declarations; isolate the untyped dependency here.
// @ts-expect-error No upstream declarations.
import { N8AOPostPass } from 'n8ao';
import { createSky } from './sky';
import { LIGHTING } from '../../src/config/game';
import { getSettingsPanel } from '../../src/ui/settingsPanel';
import { settings, onSettingsChange } from '../../src/ui/settings';
import type { MapData } from '../../src/maps/types';
const query=new URLSearchParams(location.search);
/** Debug review only: `?lightingReview=before` renders the pre-lighting-pass look for comparisons. */
export const lightingBaseline=query.get('lightingReview')==='before';
/** Debug review only: `?debug=1&view=<id>` freezes the offline game at a fixed camera (LIGHTING.review.views). */
export const reviewView=query.get('debug')==='1'?query.get('view'):null;
export class WorldRenderer {
  private composer: EffectComposer | null = null;
  private unsubscribe: () => void;
  private readonly size = new Vector2();
  private readonly sky;
  private disposed=false;
  private frame=0;
  private measuredFrames=0;private elapsed=0;
  private readonly result={fps:0,calls:0,triangles:0,frames:0,maxCalls:0,maxTriangles:0};
  private output:HTMLOutputElement|null=null;
  private reviewButton:HTMLButtonElement|null=null;
  private readonly review = LIGHTING.review.views.find(v=>v.id===reviewView);
  readonly tone = query.get('tone') ?? 'neutral';
  constructor(private gl:WebGLRenderer,private scene:Scene,private camera:PerspectiveCamera,data:MapData){
    this.sky=createSky(data.sky.horizon??data.fog.color,data.sky.color);
    if(!lightingBaseline)scene.add(this.sky.mesh);
    gl.toneMapping=lightingBaseline||this.tone==='aces'?ACESFilmicToneMapping:this.tone==='agx'?AgXToneMapping:NeutralToneMapping;
    gl.toneMappingExposure=LIGHTING.exposure;gl.info.autoReset=false;
    if(query.has('ao'))settings.ambientOcclusion=query.get('ao')==='off'?'off':'on';
    if(this.review){this.output=document.createElement('output');this.output.id='lighting-measurement';this.output.style.cssText='position:fixed;bottom:4px;left:4px;color:white;background:#17233a;font:12px monospace;z-index:99';this.output.textContent='Warming up lighting benchmark...';document.body.append(this.output);this.reviewButton=document.createElement('button');this.reviewButton.textContent='Lighting settings';this.reviewButton.style.cssText='position:fixed;top:36px;left:4px;z-index:99';this.reviewButton.onclick=()=>getSettingsPanel().open();document.body.append(this.reviewButton);}
    this.sync();this.unsubscribe=onSettingsChange(this.sync);
  }
  /** Builds the AO composer the first time AO is switched on; off = plain renderer, zero composer cost. */
  private sync=()=>{if(this.disposed||lightingBaseline||settings.ambientOcclusion==='off'||this.composer)return;
    const tone=this.gl.toneMapping;
    this.composer=new EffectComposer(this.gl,{frameBufferType:HalfFloatType});
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    const ao=new N8AOPostPass(this.scene,this.camera);
    // Glass optics/effects keep the beauty colour; avoid two extra world renders for transparency AO.
    ao.autoDetectTransparency=false;
    Object.assign(ao.configuration,{halfRes:LIGHTING.ao.halfRes,aoRadius:LIGHTING.ao.radius,distanceFalloff:LIGHTING.ao.falloff,intensity:LIGHTING.ao.intensity,aoSamples:LIGHTING.ao.samples,denoiseSamples:LIGHTING.ao.denoiseSamples,denoiseRadius:LIGHTING.ao.denoiseRadius,gammaCorrection:false,transparencyAware:false,denoiseIterations:LIGHTING.ao.denoiseIterations});
    this.composer.addPass(ao);
    this.composer.addPass(new EffectPass(this.camera,new ToneMappingEffect({mode:this.tone==='aces'?ToneMappingMode.ACES_FILMIC:this.tone==='agx'?ToneMappingMode.AGX:ToneMappingMode.NEUTRAL})));
    this.gl.toneMapping=tone;this.resize();
  };
  resize(){this.gl.getSize(this.size);this.composer?.setSize(this.size.x,this.size.y);}
  private readonly weaponShadow=(o:Object3D)=>{o.castShadow=false;};
  private readonly shadowPolicy=(o:Object3D)=>{
    if(o.name.startsWith('weapon-'))o.traverse(this.weaponShadow);
    else if(o.parent?.parent?.name==='rig'&&o.name.endsWith('-boxes'))o.castShadow=LIGHTING.actorShadowParts.includes(o.name);
  };
  render(camera:PerspectiveCamera,dt:number){
    // New rigs / weapons appear rarely; re-apply the shadow policy every few frames, not every frame.
    if(!lightingBaseline&&this.frame++%LIGHTING.shadowPolicyEvery===0)this.scene.traverse(this.shadowPolicy);
    if(reviewView){const v=this.review;if(v){camera.position.set(v.position[0],v.position[1],v.position[2]);camera.lookAt(v.target[0],v.target[1],v.target[2]);camera.updateMatrixWorld();}}
    this.sky.update(camera);this.gl.info.reset();this.gl.autoClear=true;
    if(!lightingBaseline&&settings.ambientOcclusion==='on'&&this.composer){this.composer.setMainCamera(camera);this.composer.render(dt);}else this.gl.render(this.scene,camera);
  }
  record(dt:number){if(!this.output)return;this.measuredFrames++;
    if(this.measuredFrames<=LIGHTING.review.warmup||this.result.frames>=LIGHTING.review.frames)return;
    this.elapsed+=dt;this.result.frames++;this.result.calls+=this.gl.info.render.calls;this.result.triangles+=this.gl.info.render.triangles;
    this.result.maxCalls=Math.max(this.result.maxCalls,this.gl.info.render.calls);this.result.maxTriangles=Math.max(this.result.maxTriangles,this.gl.info.render.triangles);
    if(this.result.frames===LIGHTING.review.frames){this.result.fps=this.result.frames/this.elapsed;this.result.calls/=this.result.frames;this.result.triangles/=this.result.frames;this.output.value=JSON.stringify(this.result);this.output.dataset.ready='true';}
  }
  renderViewmodel(scene:Scene,camera:PerspectiveCamera){const tone=this.gl.toneMapping;this.gl.toneMapping=ACESFilmicToneMapping;this.gl.render(scene,camera);this.gl.toneMapping=tone;}
  dispose(){this.disposed=true;this.unsubscribe();this.output?.remove();this.reviewButton?.remove();this.composer?.dispose();this.scene.remove(this.sky.mesh);this.sky.dispose();this.gl.info.autoReset=true;}
}
export function useWorldRenderer(gl:WebGLRenderer,scene:Scene,camera:PerspectiveCamera,data:MapData,width:number,height:number){
  const renderer=useMemo(()=>new WorldRenderer(gl,scene,camera,data),[gl,scene,camera,data]);
  useEffect(()=>{renderer.resize();},[renderer,width,height]);
  useEffect(()=>()=>renderer.dispose(),[renderer]);return renderer;
}
