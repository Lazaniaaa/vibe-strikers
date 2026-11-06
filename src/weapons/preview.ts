/// <reference types="vite/client" />
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { characters, createCharacter, disposeCharacterResources } from '../characters';
import type { CharacterRuntime } from '../characters';
import { poseArmedCharacter as poseCharacter, attachWeapon, createWeapon, createWeaponEffects, createViewmodel, disposeWeaponResources, poseWeapon, poseViewmodel, weapons, sniperScopeSize } from './index';
import type { WeaponCharacterState as PoseState } from './characterPose';
import type { HoldSide, ViewmodelState, WeaponId } from './types';
import { materials } from './resources';
import { SNIPER_SCOPE_AXIS_Y } from './sniperScope';
import { ARM_MIN_EXTRA, ARM_MAX_EXTRA, ARM_LENGTH_STEP } from '../characters/armVariants';
import holdSummary from './round5-summary.json';
import { installPreviewPerf } from './previewPerf';
import { createPreviewMeasurements } from './previewMeasurements';
import { createScopeOverlay, scopeOverlaySvg, scopeOverlayOpacity } from './scopeOverlay';
import { fovForAds } from './ads';
import { createPreviewWorld } from './previewWorld';
import '../characters/preview.css';
import './preview.css';

document.title='VOXEL / LAB — Зброя · Stage A';
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const controlsMarkup=[['fire','Віддача',0,1,.01,0],['reload','Перезаряджання',0,1,.01,0],['cycle','Затвор / помпа',0,1,.01,0],['equip','Витягування',0,1,.01,1],['move','Швидкість руху',0,1,.01,0],['strafe','Стрейф',-1,1,.01,0],['aim','Нахил прицілу',-89,89,1,0],['heat','Тепло · Pixel Beam',0,1,.01,0],['charge','Натяг / заряд',0,1,.01,0],['paint','Рівень фарби',0,1,.01,1],['throw','Кидок · Paint Bomb',0,1,.01,0]];
$('#app').innerHTML=`
  <header class="header"><a class="brand" href="./"><span class="brand-icon"><i></i><i></i><i></i><i></i></span>VOXEL <span class="brand-slash">/</span> LAB</a><div class="header-center"><span class="live-dot"></span>Студія зброї <span class="header-divider">/</span><span class="muted">NFT Arsenal</span></div><div class="stage-badge"><span>STAGE A</span> Форма й анімації</div></header>
  <main class="weapon-workspace">
    <aside class="controls panel weapon-controls">
      <div class="section-label"><span>АРСЕНАЛ</span><span class="counter">${weapons.length} МОДЕЛЕЙ</span></div>
      <label class="sr-only" for="weapon-select">Вибрати зброю</label><select id="weapon-select"></select>
      <div class="section-label section-space"><span>ПЕРСОНАЖ</span><span class="small-tag">33 NFT</span></div>
      <label class="sr-only" for="nft-select">Вибрати персонажа</label><select id="nft-select"></select>
      <p class="collection-note">Бластери — дві кисті.<br>Ніж / бомба — одна точка хвату.</p>
      <div class="section-label section-space"><span>ПЕРША ОСОБА · ЛИШЕ ЛОКАЛЬНО</span></div><label class="collection-note" for="hold-side">Сторона HIP viewmodel</label>
      <select id="hold-side"><option value="right">Справа</option><option value="left">Зліва</option></select>
      <label class="collection-note" for="vm-pose">Поза viewmodel</label><select id="vm-pose"><option value="hip">Від стегна</option><option value="ads">Приціл</option></select>
      <div class="range-head"><label for="w-ads">ADS · лише перша особа</label><output id="value-ads">0.00</output></div>
      <input id="w-ads" type="range" min="0" max="1" step="0.01" value="0">
      <p id="ads-clear" class="collection-note" aria-live="polite">Вимірювання отвору…</p>
      <button id="export-sides" class="grid-toggle">↓ PNG · HIP трьох NFT</button><button id="export-first-person" class="grid-toggle">↓ PNG · перша особа HIP / ADS</button>
      <label class="check-row"><input type="checkbox" id="show-targets">Показати цілі</label>
      <p id="live-grip" class="collection-note" aria-live="polite"></p>
      <div class="section-label section-space"><span>ПОЗА ПЕРСОНАЖА</span></div>
      <div class="pose-grid">${[['idle','Спокій'],['run','Біг'],['strafe','Стрейф'],['backward','Назад'],['crouch','Присід'],['jump','Стрибок'],['dead','Загибель']].map(([id,name])=>`<button class="pose-button ${id==='idle'?'active':''}" data-pose="${id}">${name}</button>`).join('')}</div>
      <div class="section-label section-space"><span>АНІМАЦІЯ · 0 → 1</span></div>
      ${controlsMarkup.map(([id,label,min,max,step,value])=>`<div class="range-head"><label for="w-${id}">${label}</label><output id="value-${id}" for="w-${id}">${Number(value).toFixed(2)}</output></div><input id="w-${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`).join('')}
      <label class="check-row"><input type="checkbox" id="w-crouch">Присід viewmodel</label>
      <label class="check-row"><input type="checkbox" id="w-air">Viewmodel у повітрі</label>
      <button id="export-toys" class="grid-toggle">↓ PNG · нові 6 у руці / на землі / FPS</button><button id="export-toy-progress" class="grid-toggle">↓ PNG · heat / charge / paint / throw</button><button id="test-effect" class="grid-toggle">Ефект вибраної зброї</button><button id="clear-effects" class="grid-toggle">Очистити ефекти / фарбу</button><p id="effect-stats" class="collection-note" data-decals="0">Ефекти: до 3 draw calls · 128 декалей</p><button id="reset-weapon" class="grid-toggle">↺ Скинути анімації</button>
      <a class="back-link" href="./">← Колекція персонажів</a>
    </aside>
    <section class="weapon-stage">
      <div class="weapon-heading"><div><p class="eyebrow">ІГРАШКОВИЙ АРСЕНАЛ / ОДИН СТИЛЬ</p><h1>Арсенал у кубах.</h1><p class="stage-description">Товсті форми. Тонкий контур. Власний колір.</p></div><div class="weapon-actions"><button id="spin" class="icon-button active" aria-pressed="true">↻ Обертати</button><button id="fit-held" class="icon-button">⊡ Вмістити</button><button id="export-weapons" class="icon-button">↓ PNG × ${weapons.length}</button><button id="export-review" class="icon-button">Хвати ±89°</button><button id="export-sniper-scope" class="icon-button" style="display:none">↓ PNG · sniper scope</button></div></div>
      <div id="weapon-canvas"></div>
      <div id="weapon-grid" class="weapon-grid" aria-label="Сітка всіх видів зброї"></div>
      <div class="studio-heading"><div><p class="eyebrow">ПЕРЕВІРКА МАСШТАБУ Й РУХУ</p><h2 id="selected-name"></h2></div><span class="studio-pill">ADS і сторона — лише перша особа</span></div>
      <div class="weapon-studios">
        <article class="studio-panel"><div class="studio-label"><span>ТРЕТЯ ОСОБА · ПОСТІЙНИЙ HIP СПРАВА</span><span>OrbitControls ↔</span></div><div id="held-view" class="studio-viewport" aria-label="Персонаж зі зброєю"></div><div class="studio-caption"><strong id="held-character"></strong><span id="held-grip-label">Дві кисті · supportGrip</span></div></article>
        <article class="studio-panel"><div class="studio-label"><span>ВІД ПЕРШОЇ ОСОБИ</span><span>Світ · 8 / 15 / 30 / 60 / 100 м</span></div><div id="fps-view" class="studio-viewport fps-view" aria-label="Зброя і власні руки NFT від першої особи"><span class="fps-crosshair">+</span><span class="fps-note">Власні кольори й розміри кистей NFT</span></div><div class="studio-caption"><strong>Камера → viewmodel</strong><span id="fps-fov">FOV 70° · near 0,05 м</span></div></article>
      </div>
      <div class="weapon-data"><dl id="weapon-specs"></dl><p id="weapon-parts"></p></div>
      <div id="weapon-exports" class="weapon-exports"></div>
      <div id="grip-results" class="grip-results" aria-live="polite"></div>
      <p class="weapon-limit-note">Дворучні бластери: supportGrip. Paint Bomb: правий хват, ліва рука напоготові. Heat / charge / paint — лише візуальні входи.</p>
    </section>
  </main>
  <footer class="footer"><span><span class="footer-square"></span>BOX GEOMETRY / VERTEX COLORS</span><span id="weapon-runtime">Локальне прев’ю</span><span>33 NFT · ЗВИЧАЙНА ГЕОМЕТРІЯ ЗБЕРЕЖЕНА</span></footer>`;

const stage=$('.weapon-stage'),canvasRoot=$('#weapon-canvas');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
renderer.domElement.setAttribute('aria-label','3D рендери зброї, персонажа та рук');canvasRoot.append(renderer.domElement);
const scopeOverlay=createScopeOverlay(),scopeSvgNode=scopeOverlay.firstElementChild,scopeMarkup=scopeOverlaySvg();
$('#fps-view').append(scopeOverlay);
let overlayMutations=0,lastOverlayOpacity=-1,lastWorldFov=-1;
const overlayObserver=new MutationObserver(records=>{overlayMutations+=records.length;});overlayObserver.observe(scopeOverlay,{childList:true,subtree:true});
const fpsReticle=$('.fps-crosshair'),fpsNote=$('.fps-note'),fovLabel=$('#fps-fov');
const scopeImages=new Map<string,Promise<HTMLImageElement>>();
function scopeImage(width:number,height:number):Promise<HTMLImageElement>{
 const key=width+'x'+height;let image=scopeImages.get(key);
 if(!image){const element=new Image();element.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(scopeMarkup.replace('width="100%"',`width="${width}"`).replace('height="100%"',`height="${height}"`));image=element.decode().then(()=>element);scopeImages.set(key,image);}
 return image;
}
// Rasterisation is prepared at load, never on input or in the render loop.
void scopeImage(600,338);void scopeImage(700,394);void scopeImage(700,600);
async function paintScope(c:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,id:WeaponId,ads:number):Promise<void>{
 const opacity=id==='sniper'?scopeOverlayOpacity(ads):0;if(!opacity)return;
 const image=await scopeImage(width,height);c.save();c.globalAlpha=opacity;c.drawImage(image,x,y,width,height);c.restore();
}
function scene(background:string):THREE.Scene{
  const s=new THREE.Scene();s.background=new THREE.Color(background);s.add(new THREE.AmbientLight(0xffffff,Math.PI));return s;
}
const weaponScene=scene('#EEECE5'),heldScene=scene('#EEECE5'),viewScene=scene('#DFE4E2');
viewScene.background=null;
const sampleWorld=createPreviewWorld(),sampleScene=scene('#CADBD6');sampleScene.add(sampleWorld.group);
const targetScene=new THREE.Scene();
const markerGeometries:THREE.BoxGeometry[]=[];
function targetMarker(color:string):THREE.Mesh {
  const geometry=new THREE.BoxGeometry(.035,.035,.035),values=new Float32Array(geometry.attributes.position.count*3),tint=new THREE.Color(color);
  for(let i=0;i<values.length;i+=3){values[i]=tint.r;values[i+1]=tint.g;values[i+2]=tint.b;}
  geometry.setAttribute('color',new THREE.BufferAttribute(values,3));markerGeometries.push(geometry);
  const marker=new THREE.Mesh(geometry,materials()[1]);targetScene.add(marker);return marker;
}
const mainMarker=targetMarker('#FF794F'),supportMarker=targetMarker('#33DCCB');
const livePalm=new THREE.Vector3(),liveTarget=new THREE.Vector3();
function gripErrors(avatar:THREE.Group,weapon:THREE.Group):[number,number] {
  avatar.updateMatrixWorld(true);const d=avatar.userData as CharacterRuntime,values:[number,number]=[0,0];
  for(let i=0;i<2;i++){
    const side=i===0?'R':'L',b=d.armVariants.active?d.armVariants[`hand${side}`]:d.dimensions[`hand${side}`];
    const main=i===0;
    const target=main?weapon.getObjectByName('mainGrip'):weapon.userData.supportGrip;
    if(!target)continue;
    livePalm.set((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2).applyMatrix4(d[`arm${side}`].matrixWorld);
    target.getWorldPosition(liveTarget);values[i]=livePalm.distanceTo(liveTarget);
  }
  return values;
}
const gridModels=weapons.map(w=>createWeapon(w.id));
const turntables=gridModels.map(model=>{
  const center=new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  const table=new THREE.Group(),placement=new THREE.Group();table.position.copy(center);placement.position.copy(center).negate();
  table.add(placement);placement.add(model);weaponScene.add(table);return table;
});
const gridCamera=new THREE.OrthographicCamera(-1,1,1,-1,.01,30);
gridCamera.position.set(3.5,2.1,-2.4);
const heldCamera=new THREE.PerspectiveCamera(34,1,.05,30);heldCamera.position.set(2.9,2.55,-4.5);
const heldControls=new OrbitControls(heldCamera,$('#held-view'));heldControls.target.set(0,.95,-.1);heldControls.enableDamping=true;heldControls.enablePan=false;heldControls.minDistance=2.7;heldControls.maxDistance=7;
const fpsCamera=new THREE.PerspectiveCamera(70,1,.05,180),fpsWeaponCamera=new THREE.PerspectiveCamera(70,1,.05,20);
/** World zoom is separate from the approved, fixed-FOV weapon/hand rendering. */
function renderFirstPerson(modelScene:THREE.Scene,worldCamera:THREE.PerspectiveCamera,id:WeaponId,ads:number):void{
 worldCamera.fov=fovForAds(id,ads);worldCamera.updateProjectionMatrix();renderer.render(sampleScene,worldCamera);
 fpsWeaponCamera.aspect=worldCamera.aspect;fpsWeaponCamera.updateProjectionMatrix();
 renderer.autoClear=false;renderer.clearDepth();renderer.render(modelScene,fpsWeaponCamera);renderer.autoClear=true;
}
const floorGeometry=new THREE.BoxGeometry(4,.035,3),floorMaterial=new THREE.MeshLambertMaterial({color:'#F6F4EB'});
const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.position.y=-.023;heldScene.add(floor);
const effects=createWeaponEffects(heldScene,{surfaceBoxes:[{min:{x:-2,y:-.04,z:-1.5},max:{x:2,y:0,z:1.5}}]});
const effectMuzzle=new THREE.Vector3(),effectHit=new THREE.Vector3(0,.01,-1),effectBounce=new THREE.Vector3(1,.5,-.5);
$('#test-effect').addEventListener('click',()=>{heldWeapon.updateWorldMatrix(true,false);heldWeapon.userData.muzzle.getWorldPosition(effectMuzzle);switch(weapons[selected].id){case 'beam':effects.beam(effectMuzzle,effectHit);break;case 'bouncer':effects.bouncer([effectMuzzle,effectBounce,effectHit]);break;case 'rail':effects.rail(effectMuzzle,effectHit);break;case 'splat':effects.splat(effectMuzzle,effectHit,'#FF6B8B');break;case 'paintGrenade':effects.grenadeArc(effectMuzzle,effectHit,.75,'#49D4B4');break;default:effects.rail(effectMuzzle,effectHit,'#FFD53D');}});
$('#export-toy-progress').addEventListener('click',async()=>{const {captureToyProgress}=await import('./toyReview');captureToyProgress(renderer,characters[characterIndex],$('#weapon-exports'));resize();render();});
$('#clear-effects').addEventListener('click',()=>effects.clear());
$('#export-toys').addEventListener('click',async()=>{const {captureToyWeapons}=await import('./toyReview');captureToyWeapons(renderer,characters[characterIndex],$('#weapon-exports'));resize();render();});
const gridCards:HTMLElement[]=[],cardViews:HTMLElement[]=[];
const bounds=gridModels.map(w=>new THREE.Box3().setFromObject(w));
for(let i=0;i<weapons.length;i++){
  const cfg=weapons[i],boundsSize=bounds[i].getSize(new THREE.Vector3());
  let meshes=0,lenses=0;gridModels[i].traverse(o=>{if(o instanceof THREE.Mesh){if(o.name.startsWith('lens-'))lenses++;else meshes++;}});
  const card=document.createElement('button');card.className='weapon-card';card.dataset.id=cfg.id;card.setAttribute('aria-label',`Вибрати ${cfg.displayName}`);
  card.innerHTML=`<span class="weapon-index">${String(i+1).padStart(2,'0')}</span><span class="weapon-accent" style="background:${cfg.palette.accent}"></span><span class="weapon-card-view"></span><span class="weapon-card-caption"><strong>${cfg.displayName}</strong><span>${cfg.tipDistance.toFixed(2)} м · ${meshes} меші${lenses?` + ${lenses} лінз${lenses===1?'а':'и'}`:''}</span></span>`;
  $('#weapon-grid').append(card);cardViews.push(card.querySelector('.weapon-card-view')!);gridCards.push(card);
  card.addEventListener('click',()=>selectWeapon(i));
  const opt=document.createElement('option');opt.value=String(i);opt.textContent=cfg.displayName;$('#weapon-select').append(opt);
  card.dataset.bounds=`${boundsSize.x.toFixed(3)} × ${boundsSize.y.toFixed(3)} × ${boundsSize.z.toFixed(3)}`;
}
characters.forEach((cfg,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=cfg.name;$('#nft-select').append(o);});
let selected=0,characterIndex=0,spinning=true,pose='idle';
let character=createCharacter(characters[0]),heldWeapon=createWeapon('knife'),viewmodel=createViewmodel('knife',characters[0]);
const heldModels=new Map<WeaponId,THREE.Group>([['knife',heldWeapon]]);
const viewModels=new Map<string,THREE.Group>([['knife|'+characters[0].id,viewmodel]]);
heldScene.add(character);viewScene.add(viewmodel);let heldMount=attachWeapon(character,heldWeapon);
const state:ViewmodelState={holdSide:'right',ads:0,fire:0,reload:null,cycle:null,equip:1,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,time:0};
const characterState:PoseState={speed:0,moveDir:{x:0,z:-1},aimPitch:0,shooting:false,crouching:false,grounded:true,dead:false};
const previewPerf=installPreviewPerf();
const adsSlider=$<HTMLInputElement>('#w-ads'),adsOutput=$('#value-ads'),vmPose=$<HTMLSelectElement>('#vm-pose');
const controlInputs=controlsMarkup.map(([id])=>$<HTMLInputElement>(`#w-${id}`));
const controlOutputs=controlsMarkup.map(([id])=>$(`#value-${id}`));
let controlsDirty=true;
/** The existing animation loop owns the single pending frame; inputs coalesce here. */
function requestPreviewRender():void{controlsDirty=true;}
const measurements=createPreviewMeasurements(()=>{
 const rect=$('#fps-view').getBoundingClientRect();return {weapon:weapons[selected].id,character:characters[characterIndex],state,model:viewmodel,aspect:Math.max(.1,rect.width/rect.height)};
},text=>{$('#ads-clear').textContent=text;});
previewPerf?.attach(()=>{
 const ids:string[]=[];for(const model of [...heldModels.values(),...viewModels.values()])model.traverse(o=>{if(o instanceof THREE.Mesh){ids.push(o.geometry.uuid);for(const m of Array.isArray(o.material)?o.material:[o.material])ids.push(m.uuid);}});
 return {measurement:{...measurements.stats},resources:ids.sort().join('|'),heldInstances:heldModels.size,viewInstances:viewModels.size,gpuGeometries:renderer.info.memory.geometries,overlayBuilds:1+overlayMutations,overlayNodeStable:scopeOverlay.firstElementChild===scopeSvgNode};
});
function details():void{
  const cfg=weapons[selected];$<HTMLButtonElement>('#test-effect').disabled=!['beam','bouncer','rail','splat','paintGrenade'].includes(cfg.id);$('#selected-name').textContent=cfg.displayName;$('#held-character').textContent=characters[characterIndex].name;
  $('#held-grip-label').textContent=(cfg.kind==='knife'||cfg.id==='paintGrenade')?'Одна кисть':'Дві кисті · supportGrip';
  gridCards.forEach((card,i)=>card.classList.toggle('selected',i===selected));
  $('#export-sniper-scope').style.display=cfg.id==='sniper'?'inline-flex':'none';
  $('#weapon-specs').innerHTML=`<div><dt>Кінчик від хвату</dt><dd>${cfg.tipDistance.toFixed(2)} м</dd></div><div><dt>Ш × В × Г</dt><dd>${gridCards[selected].dataset.bounds} м</dd></div><div><dt>Акцент</dt><dd><i style="background:${cfg.palette.accent}"></i>${cfg.palette.accent}</dd></div>`;
  $('#weapon-parts').textContent=`Рухомі частини: ${Object.keys(cfg.parts).join(' · ')||'немає'}. Сокети: muzzle${(cfg.kind!=='knife'&&cfg.id!=='paintGrenade')?' · supportGrip':''}${cfg.foregrip?' · foregrip':''}${cfg.ejectPort?' · ejectPort':''}. Позаду хвату: ${cfg.stockBack.toFixed(3)} м. ${cfg.lenses?.length?'Блакитне скло · 35%':''}`;
  if(cfg.id==='sniper'){const size=sniperScopeSize(heldWeapon);$('#weapon-parts').textContent+=' Приціл Stage A: '+size.width.toFixed(3)+' × '+size.height.toFixed(3)+' × '+size.depth.toFixed(3)+' м. ADS: 2D піксельний приціл, FOV 28°; від 0,9 viewmodel прихований.';}
}
function updateViewmodel():void{
  const key=weapons[selected].id+'|'+characters[characterIndex].id;
  viewScene.remove(viewmodel);let cached=viewModels.get(key);
  if(!cached){cached=createViewmodel(weapons[selected].id,characters[characterIndex],{holdSide:state.holdSide});viewModels.set(key,cached);}
  viewmodel=cached;viewScene.add(viewmodel);measurements.request();requestPreviewRender();
}
function fitHeldView():void{
  characterState.weapon=weapons[selected].id;characterState.aimPitch=state.aimPitch;characterState.fire=state.fire;characterState.reload=state.reload;characterState.cycle=state.cycle;
  poseCharacter(character,characterState,0);poseWeapon(heldWeapon,state);
  const bounds=new THREE.Box3().setFromObject(character),sphere=bounds.getBoundingSphere(new THREE.Sphere()),center=bounds.getCenter(new THREE.Vector3());
  const rect=$('#held-view').getBoundingClientRect(),aspect=Math.max(.1,rect.width/rect.height);
  const distance=Math.max(4.8,sphere.radius/Math.sin(THREE.MathUtils.degToRad(heldCamera.fov/2))*1.12/Math.min(1,aspect));
  heldControls.target.copy(center);heldCamera.position.set(2.9,1.6,-4.4).normalize().multiplyScalar(distance).add(center);
  heldControls.maxDistance=Math.max(10,distance*1.5);heldControls.update();
}
$('#fit-held').addEventListener('click',fitHeldView);
function selectWeapon(i:number):void{
  selected=i;$<HTMLSelectElement>('#weapon-select').value=String(i);
  heldMount.removeFromParent();let cached=heldModels.get(weapons[i].id);if(!cached){cached=createWeapon(weapons[i].id);heldModels.set(weapons[i].id,cached);}
  heldWeapon=cached;heldMount=attachWeapon(character,heldWeapon);updateViewmodel();details();fitHeldView();
}
$('#weapon-select').addEventListener('change',()=>selectWeapon(Number($<HTMLSelectElement>('#weapon-select').value)));
$('#nft-select').addEventListener('change',()=>{
  characterIndex=Number($<HTMLSelectElement>('#nft-select').value);heldScene.remove(character);character=createCharacter(characters[characterIndex]);heldScene.add(character);
  heldMount.removeFromParent();heldMount=attachWeapon(character,heldWeapon);updateViewmodel();details();fitHeldView();
});
function readState():void{
  const val=(id:string)=>Number($<HTMLInputElement>(`#w-${id}`).value);
  state.fire=val('fire');state.reload=val('reload')||null;state.cycle=val('cycle')||null;state.equip=val('equip');
  state.moveSpeed=val('move');state.strafe=val('strafe');state.aimPitch=THREE.MathUtils.degToRad(val('aim'));
  state.crouching=$<HTMLInputElement>('#w-crouch').checked;state.grounded=!$<HTMLInputElement>('#w-air').checked;
  state.ads=val('ads');state.heat=val('heat');state.charge=val('charge');state.paintLevel=val('paint');state.throw=val('throw');
  state.holdSide=$<HTMLSelectElement>('#hold-side').value as HoldSide;
  requestPreviewRender();
}
function onAdsInput():void{state.ads=Number(adsSlider.value);requestPreviewRender();}
function onAnimationInput(event:Event):void{
 const input=event.currentTarget as HTMLInputElement,value=Number(input.value);
 switch(input.id){
  case 'w-fire':state.fire=value;break;case 'w-reload':state.reload=value||null;break;case 'w-cycle':state.cycle=value||null;break;
  case 'w-equip':state.equip=value;break;case 'w-move':state.moveSpeed=value;break;case 'w-strafe':state.strafe=value;break;
  case 'w-aim':state.aimPitch=THREE.MathUtils.degToRad(value);break;
  case 'w-heat':state.heat=value;break;case 'w-charge':state.charge=value;break;case 'w-paint':state.paintLevel=value;break;case 'w-throw':state.throw=value;break;
 }
 requestPreviewRender();
}
$('#hold-side').addEventListener('change',()=>{
  readState();measurements.request();
});
$('#vm-pose').addEventListener('change',()=>{adsSlider.value=vmPose.value==='ads'?'1':'0';readState();measurements.request();});
adsSlider.addEventListener('input',onAdsInput);adsSlider.addEventListener('change',()=>measurements.request());
for(const input of controlInputs){input.addEventListener('input',onAnimationInput);input.addEventListener('change',()=>measurements.request());}
for(const id of ['w-crouch','w-air','show-targets'])$( '#'+id).addEventListener('input',readState);
for(const id of ['w-crouch','w-air'])$( '#'+id).addEventListener('change',()=>measurements.request());
document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(button=>button.addEventListener('click',()=>{
  pose=button.dataset.pose!;document.querySelectorAll('[data-pose]').forEach(b=>b.classList.toggle('active',(b as HTMLElement).dataset.pose===pose));
}));
$('#reset-weapon').addEventListener('click',()=>{
  for(const[id,,,,,value]of controlsMarkup)$<HTMLInputElement>(`#w-${id}`).value=String(value);
  $<HTMLInputElement>('#w-crouch').checked=false;$<HTMLInputElement>('#w-air').checked=false;
  adsSlider.value='0';readState();measurements.request();
});
$('#spin').addEventListener('click',()=>{spinning=!spinning;$('#spin').setAttribute('aria-pressed',String(spinning));$('#spin').classList.toggle('active',spinning);});
function resize():void{
  const r=canvasRoot.getBoundingClientRect();renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5,renderer.capabilities.maxTextureSize/Math.max(r.width,r.height)));
  renderer.setSize(r.width,r.height,false);
}
const observer=new ResizeObserver(resize);observer.observe(stage);
function area(element:HTMLElement):void{
  const outer=canvasRoot.getBoundingClientRect(),r=element.getBoundingClientRect();
  renderer.setViewport(r.left-outer.left,outer.bottom-r.bottom,r.width,r.height);renderer.setScissor(r.left-outer.left,outer.bottom-r.bottom,r.width,r.height);
}
function fitWeapon(i:number,aspect:number):void{
  const b=bounds[i],half=Math.max(.30,b.getSize(fitSize).length()*.58);
  gridCamera.left=-half*aspect;gridCamera.right=half*aspect;gridCamera.top=half;gridCamera.bottom=-half;
  gridCamera.lookAt(0,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2);gridCamera.updateProjectionMatrix();
}
const fitSize=new THREE.Vector3();
function render():void{
  renderer.setScissorTest(false);renderer.setClearColor('#EEECE5');renderer.clear();renderer.setScissorTest(true);
  for(let i=0;i<gridModels.length;i++){
    for(let j=0;j<gridModels.length;j++)gridModels[j].visible=i===j;
    area(cardViews[i]);const r=cardViews[i].getBoundingClientRect();fitWeapon(i,r.width/r.height);renderer.render(weaponScene,gridCamera);
  }
  area($('#held-view'));let r=$('#held-view').getBoundingClientRect();heldCamera.aspect=r.width/r.height;heldCamera.updateProjectionMatrix();renderer.render(heldScene,heldCamera);
  if($<HTMLInputElement>('#show-targets').checked){
    heldWeapon.getObjectByName('mainGrip')!.getWorldPosition(mainMarker.position);
    supportMarker.visible=!!heldWeapon.userData.supportGrip;
    if(supportMarker.visible)heldWeapon.userData.supportGrip.getWorldPosition(supportMarker.position);
    renderer.autoClear=false;renderer.clearDepth();renderer.render(targetScene,heldCamera);renderer.autoClear=true;
  }
  area($('#fps-view'));r=$('#fps-view').getBoundingClientRect();fpsCamera.aspect=r.width/r.height;
  renderFirstPerson(viewScene,fpsCamera,weapons[selected].id,state.ads??0);
  const opacity=weapons[selected].id==='sniper'?scopeOverlayOpacity(state.ads??0):0;
  if(opacity!==lastOverlayOpacity){lastOverlayOpacity=opacity;scopeOverlay.style.opacity=String(opacity);scopeOverlay.style.visibility=opacity===0?'hidden':'visible';fpsReticle.style.visibility=opacity?'hidden':'visible';fpsNote.style.visibility=opacity?'hidden':'visible';}
  if(fpsCamera.fov!==lastWorldFov){lastWorldFov=fpsCamera.fov;fovLabel.textContent=`FOV ${fpsCamera.fov.toFixed(1)}° · near 0,05 м`;}
  renderer.setScissorTest(false);
}
let previous=0,lastStats=0,frames=0;
renderer.setAnimationLoop(time=>{
  const frameStarted=previewPerf?performance.now():0;
  const dt=previous?Math.min((time-previous)/1000,.05):0;previous=time;state.time=time/1000;
  if(controlsDirty){
   controlsDirty=false;adsOutput.textContent=(state.ads??0).toFixed(2);vmPose.value=(state.ads??0)>=.5?'ads':'hip';
   for(let i=0;i<controlInputs.length;i++){const value=Number(controlInputs[i].value);controlOutputs[i].textContent=controlInputs[i].id==='w-aim'?`${value}°`:value.toFixed(2);}
  }
  for(let i=0;i<gridModels.length;i++){
    poseWeapon(gridModels[i],state);
    // Turntable is preview-owned placement; poseWeapon itself has no clock.
    turntables[i].rotation.y=spinning?time*.00035:.18;
  }
  characterState.speed=pose==='run'?1:pose==='strafe'||pose==='backward'?.8:0;
  characterState.moveDir.x=pose==='strafe'?1:0;characterState.moveDir.z=pose==='strafe'?0:pose==='backward'?1:-1;
  characterState.aimPitch=state.aimPitch;characterState.shooting=state.fire>0;characterState.crouching=pose==='crouch';characterState.grounded=pose!=='jump';characterState.dead=pose==='dead';
  characterState.weapon=weapons[selected].id;
  characterState.fire=state.fire;characterState.reload=state.reload;characterState.cycle=state.cycle;
  poseCharacter(character,characterState,dt);character.position.y=pose==='jump'?.18:0;
  effects.update(dt);poseWeapon(heldWeapon,state);poseViewmodel(viewmodel,state);heldControls.update(dt);render();frames++;
  if(time-lastStats>1000){
    $('#effect-stats').dataset.decals=String(effects.decals.count);$('#effect-stats').textContent=`Ефекти: до 3 draw calls · ${effects.decals.count}/128 декалей`;
    $('#weapon-runtime').textContent=`${Math.round(frames*1000/(time-lastStats))} FPS · ДЕТЕРМІНОВАНІ ПОЗИ`;
    const [r,l]=gripErrors(character,heldWeapon);$('#live-grip').textContent=(weapons[selected].kind==='knife'||weapons[selected].id==='paintGrenade')?'Одна точка хвату':`R ${(r*100).toFixed(1)} см · L ${(l*100).toFixed(1)} см · межа 10 см${r>.10||l>.10?' · FAIL':''}`;
    frames=0;lastStats=time;
  }
  previewPerf?.frame(frameStarted);
});
// User-facing actual WebGL captures. Links remain in the DOM for saving/inspection.
$('#export-weapons').addEventListener('click',async()=>{
  const out=$('#weapon-exports');out.replaceChildren();
  const contact=document.createElement('canvas');contact.width=1500;contact.height=80+Math.ceil(weapons.length/3)*465;const all=contact.getContext('2d')!;
  all.fillStyle='#EEECE5';all.fillRect(0,0,1500,contact.height);all.fillStyle='#292B29';all.font='600 30px Segoe UI';all.fillText('VIBE STRIKERS / LAB · Іграшкова зброя',28,48);
  renderer.setPixelRatio(1);renderer.setSize(900,600,false);renderer.setScissorTest(false);renderer.setViewport(0,0,900,600);
  for(let i=0;i<weapons.length;i++){
    for(let j=0;j<gridModels.length;j++)gridModels[j].visible=i===j;
    poseWeapon(gridModels[i],{fire:0,reload:null,cycle:null,equip:1});turntables[i].rotation.y=.18;
    fitWeapon(i,1.5);renderer.render(weaponScene,gridCamera);
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=700;const c=canvas.getContext('2d')!;
    c.drawImage(renderer.domElement,0,0);c.fillStyle='#FAF9F5';c.fillRect(0,600,900,100);c.fillStyle='#292B29';c.font='600 24px Segoe UI';c.fillText(weapons[i].displayName,24,639);
    c.fillStyle='#7B856F';c.font='16px Segoe UI';c.fillText(`${weapons[i].tipDistance.toFixed(2)} м від хвату до кінчика · Ш × В × Г: ${gridCards[i].dataset.bounds} м`,24,671);
    const a=document.createElement('a');a.id=`shot-${weapons[i].id}`;a.href=canvas.toDataURL('image/png');a.download=`voxel-${weapons[i].id}.png`;a.textContent=`${weapons[i].displayName} ↗`;out.append(a);
    const x=20+(i%3)*495,y=80+Math.floor(i/3)*465;all.drawImage(canvas,x,y,480,373);
  }
  const studio=document.createElement('canvas');studio.width=1400;studio.height=690;const sc=studio.getContext('2d')!;
  sc.fillStyle='#FAF9F5';sc.fillRect(0,0,1400,690);
  renderer.setSize(700,600,false);renderer.setViewport(0,0,700,600);
  heldCamera.aspect=700/600;heldCamera.updateProjectionMatrix();renderer.render(heldScene,heldCamera);sc.drawImage(renderer.domElement,0,0);
  fpsCamera.aspect=700/600;renderFirstPerson(viewScene,fpsCamera,weapons[selected].id,state.ads??0);sc.drawImage(renderer.domElement,700,0);
  await paintScope(sc,700,0,700,600,weapons[selected].id,state.ads??0);
  sc.fillStyle='#292B29';sc.font='600 22px Segoe UI';sc.fillText(weapons[selected].displayName+' · '+characters[characterIndex].name,24,636);
  sc.fillStyle='#7B856F';sc.font='15px Segoe UI';sc.fillText(`Праворуч — FOV 70°, near 0,05 м · власні кисті NFT · ${(weapons[selected].kind==='knife'||weapons[selected].id==='paintGrenade')?'одноручний':'дворучний'} хват`,24,666);
  const studioLink=document.createElement('a');studioLink.id='shot-studio';studioLink.href=studio.toDataURL('image/png');studioLink.download='voxel-weapon-studio.png';studioLink.textContent='Персонаж + viewmodel ↗';out.append(studioLink);

  const a=document.createElement('a');a.id='weapons-contact-sheet';a.href=contact.toDataURL('image/png');a.download='voxel-weapons-grid.png';a.textContent='Повна сітка ↗';out.prepend(a);
  resize();render();
});
details();readState();resize();fitHeldView();measurements.request();
$('#export-review').addEventListener('click',()=>{
  $('#grip-results').innerHTML=`<strong>${!holdSummary.checked?'ЩЕ НЕ ПЕРЕВІРЕНО':holdSummary.failedCombinations?'FAIL':'PASS'} · ${holdSummary.checked.toLocaleString()} перевірок</strong><p>Кеш довжин +${ARM_MIN_EXTRA.toFixed(2)}…${ARM_MAX_EXTRA.toFixed(2)} м, крок ${ARM_LENGTH_STEP.toFixed(2)} м. Одна HIP-пара на NFT, верхні блоки ×5/6. Плечі нерухомі. Межа R / L: 0,10 м. ADS є лише у viewmodel. Від’ємний просвіт означає перетин. Помаранчева ціль — mainGrip; бірюзова — supportGrip.</p><table><thead><tr><th>Зброя · HIP справа</th><th>max R, м</th><th>max L, м</th><th>min просвіт, м</th><th>FAIL</th></tr></thead><tbody>${holdSummary.rows.map(r=>`<tr><td>${r.weapon}</td><td>${r.maxRightError.toFixed(4)}</td><td>${r.maxLeftError.toFixed(4)}</td><td>${r.minClearance.toFixed(4)}</td><td>${r.failedCases}</td></tr>`).join('')}</tbody></table><p>Повна матриця: npm run verify. Світова поза завжди HIP справа.</p>`;
  const out=$('#weapon-exports');out.replaceChildren();
  const reviewConfig=characters[characterIndex],reviewScene=scene('#EEECE5'),avatar=createCharacter(reviewConfig);reviewScene.add(avatar);
  const pad=new THREE.Mesh(floorGeometry,floorMaterial);pad.position.y=-.023;reviewScene.add(pad);
  const reviewCamera=new THREE.PerspectiveCamera(35,780/720,.05,30);
  reviewCamera.position.set(2.8,1.9,-4.4);reviewCamera.lookAt(.15,.96,-.12);
  const reviewBounds=new THREE.Box3(),reviewSphere=new THREE.Sphere(),reviewCenter=new THREE.Vector3();
  const reviewDirection=new THREE.Vector3(2.8,.94,-4.28).normalize();
  const atlas=document.createElement('canvas');atlas.width=1624;atlas.height=110+weapons.length*552;
  const ac=atlas.getContext('2d')!;ac.fillStyle='#EEECE5';ac.fillRect(0,0,atlas.width,atlas.height);
  ac.fillStyle='#292B29';ac.font='600 27px Segoe UI';ac.fillText(`Дворучні хвати · ${reviewConfig.name} · −89° / 0° / +89°`,24,44);
  ac.font='14px Segoe UI';ac.fillStyle='#7B856F';ac.fillText('Голова: 0,6×, максимум ±35° · 4 види вогнепальної — дві кисті · ніж — одна',25,72);
  renderer.setPixelRatio(1);renderer.setSize(780,720,false);renderer.setScissorTest(false);renderer.setViewport(0,0,780,720);
  for(let i=0;i<weapons.length;i++){
    const cfg=weapons[i],weapon=createWeapon(cfg.id),mount=attachWeapon(avatar,weapon);
    for(let col=0;col<3;col++){
      const aim=[-89,0,89][col],d=avatar.userData as CharacterRuntime;d.phase=0;
      poseCharacter(avatar,{speed:0,moveDir:{x:0,z:-1},aimPitch:aim*Math.PI/180,shooting:false,crouching:false,grounded:true,dead:false,weapon:cfg.id},0);
      poseWeapon(weapon,{fire:0,reload:null,cycle:null,equip:1});
      avatar.updateMatrixWorld(true);reviewBounds.setFromObject(avatar);reviewBounds.getBoundingSphere(reviewSphere);reviewBounds.getCenter(reviewCenter);
      reviewCamera.position.copy(reviewDirection).multiplyScalar(reviewSphere.radius/Math.sin(35*Math.PI/360)*1.12).add(reviewCenter);reviewCamera.lookAt(reviewCenter);
      renderer.render(reviewScene,reviewCamera);
      const shot=document.createElement('canvas');shot.width=780;shot.height=790;const sc=shot.getContext('2d')!;
      sc.drawImage(renderer.domElement,0,0);sc.fillStyle='#FAF9F5';sc.fillRect(0,720,780,70);
      sc.fillStyle='#292B29';sc.font='600 21px Segoe UI';sc.fillText(`${cfg.displayName} · aimPitch ${aim>0?'+':''}${aim}°`,20,750);
      const [r,l]=gripErrors(avatar,weapon);
      sc.fillStyle=r>.10||l>.10?'#B23C36':'#7B856F';sc.font='14px Segoe UI';sc.fillText(`Голова ${Math.round(d.head.rotation.x*180/Math.PI)}° · R ${(r*100).toFixed(1)} см / L ${(l*100).toFixed(1)} см · ${d.armVariants.active?'armLong':'normal'}`,20,776);
      const a=document.createElement('a');a.id=`review-${cfg.id}-${col}`;a.download=`${cfg.id}-aim-${aim}.png`;a.href=shot.toDataURL('image/png');a.textContent=`${cfg.id} ${aim}° ↗`;out.append(a);
      if((cfg.kind!=='knife'&&cfg.id!=='paintGrenade'))ac.drawImage(shot,20+col*532,94+(i-1)*552,520,527);
    }
    mount.removeFromParent();
  }
  const a=document.createElement('a');a.id='review-atlas';a.download=`${reviewConfig.id}-two-handed.png`;a.href=atlas.toDataURL('image/png');a.textContent='Усі хвати ±89° ↗';out.prepend(a);
  reviewScene.remove(avatar,pad);
  const sniper=createWeapon('sniper'),scopeScene=scene('#DFE4E2');scopeScene.add(sniper);
  const scopeCamera=new THREE.OrthographicCamera(-.30,.30,.30,-.30,.01,4);scopeCamera.position.set(0,SNIPER_SCOPE_AXIS_Y,.8);scopeCamera.lookAt(0,SNIPER_SCOPE_AXIS_Y,-1.4);
  renderer.setSize(720,720,false);renderer.setViewport(0,0,720,720);renderer.render(scopeScene,scopeCamera);
  const scopeLink=document.createElement('a');scopeLink.id='review-scope';scopeLink.download='sniper-scope-lenses.png';scopeLink.href=renderer.domElement.toDataURL('image/png');scopeLink.textContent='Скло прицілу ↗';out.append(scopeLink);
  resize();render();
});
// Export actions allocate only on the button click, never in the pose/frame loop.
$('#export-sides').addEventListener('click',()=>{
  const configs=[characters[0],characters.find(c=>c.id.endsWith('bureau-25'))!,characters.find(c=>c.id.endsWith('viber-32'))!];
  const shotScene=scene('#EEECE5'),avatars:THREE.Group[]=[],held:THREE.Group[]=[],union=new THREE.Box3();
  const weaponConfig=weapons[selected];
  for(const config of configs){
    const avatar=createCharacter(config),weapon=createWeapon(weaponConfig.id);attachWeapon(avatar,weapon);
    poseCharacter(avatar,{speed:0,moveDir:{x:0,z:-1},aimPitch:0,shooting:false,crouching:false,grounded:true,dead:false,weapon:weaponConfig.id},0);
    poseWeapon(weapon,{fire:0,reload:null,cycle:null,equip:1});shotScene.add(avatar);avatars.push(avatar);held.push(weapon);union.union(new THREE.Box3().setFromObject(avatar));
  }
  const sphere=union.getBoundingSphere(new THREE.Sphere()),center=union.getCenter(new THREE.Vector3()),camera=new THREE.PerspectiveCamera(35,700/620,.05,40);
  camera.position.set(2.7,1.3,-4.4).normalize().multiplyScalar(sphere.radius/Math.sin(35*Math.PI/360)*1.12).add(center);camera.lookAt(center);
  const strip=document.createElement('canvas');strip.width=2100;strip.height=780;const c=strip.getContext('2d')!;
  c.fillStyle='#EEECE5';c.fillRect(0,0,2100,780);c.fillStyle='#292B29';c.font='600 25px Segoe UI';c.fillText(weaponConfig.displayName+' · Третя особа · постійний HIP справа',24,36);
  renderer.setPixelRatio(1);renderer.setScissorTest(false);renderer.setSize(700,620,false);renderer.setViewport(0,0,700,620);
  for(let col=0;col<3;col++){
    avatars.forEach((avatar,i)=>avatar.visible=i===col);renderer.render(shotScene,camera);c.drawImage(renderer.domElement,col*700,60);
    const [r,l]=gripErrors(avatars[col],held[col]);c.fillStyle='#292B29';c.font='600 20px Segoe UI';c.fillText(configs[col].name,col*700+18,714);
    c.font='16px Segoe UI';c.fillText('R '+(r*100).toFixed(2)+' см · L '+(l*100).toFixed(2)+' см · межа 10 см',col*700+18,746);
  }
  const out=$('#weapon-exports');out.replaceChildren();const a=document.createElement('a');a.id='side-strip';a.href=strip.toDataURL('image/png');a.download='hip-'+weaponConfig.id+'.png';a.textContent='PNG · HIP трьох NFT ↗';out.append(a);a.click();resize();render();
});
$('#export-first-person').addEventListener('click',async()=>{
  const configs=weapons.filter(w=>w.kind!=='knife'),config=characters[characterIndex],camera=new THREE.PerspectiveCamera(70,16/9,.05,180);
  const atlas=document.createElement('canvas');atlas.width=2400;atlas.height=1810;const c=atlas.getContext('2d')!;
  c.fillStyle='#EEECE5';c.fillRect(0,0,2400,1810);c.fillStyle='#292B29';c.font='600 28px Segoe UI';c.fillText('Перша особа · '+config.name+' · справа HIP / ADS · зліва HIP / ADS',24,42);
  const overlay=await scopeImage(600,338);
  renderer.setPixelRatio(1);renderer.setScissorTest(false);renderer.setSize(600,338,false);renderer.setViewport(0,0,600,338);
  for(let row=0;row<configs.length;row++)for(let col=0;col<4;col++){
    const side:HoldSide=col<2?'right':'left',ads=col%2,vm=createViewmodel(configs[row].id,config,{holdSide:side}),shotScene=new THREE.Scene();shotScene.add(new THREE.AmbientLight(0xffffff,Math.PI),vm);
    poseViewmodel(vm,{holdSide:side,ads,fire:0,reload:null,cycle:null,equip:1,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,time:0});renderFirstPerson(shotScene,camera,configs[row].id,ads);
    const x=col*600,y=90+row*420;c.drawImage(renderer.domElement,x,y);
    if(configs[row].id==='sniper'&&ads)c.drawImage(overlay,x,y,600,338);
    c.fillStyle='#292B29';c.font='600 18px Segoe UI';c.fillText(configs[row].displayName+' · '+(side==='right'?'справа':'зліва')+' · ADS '+ads,x+15,y+366);
    c.font='15px Segoe UI';c.fillText(`FOV ${fovForAds(configs[row].id,ads)}° · світ 8–100 м`+(configs[row].id==='sniper'&&ads?' · 2D приціл':''),x+15,y+390);
  }
  const out=$('#weapon-exports');out.replaceChildren();const a=document.createElement('a');a.id='fps-strip';a.href=atlas.toDataURL('image/png');a.download='first-person-hip-ads.png';a.textContent='PNG · усі viewmodel HIP / ADS ↗';out.append(a);a.click();resize();render();
});
// Sniper-only review strip. World geometry/pose are unchanged; FPS panels use 16:9.
$('#export-sniper-scope').addEventListener('click',async()=>{
  const overlay=await scopeImage(700,394);
  const config=characters[0],avatar=createCharacter(config),weapon=createWeapon('sniper'),world=scene('#EEECE5');attachWeapon(avatar,weapon);
  poseCharacter(avatar,{weapon:'sniper',speed:0,moveDir:{x:0,z:-1},aimPitch:0,shooting:false,crouching:false,grounded:true,dead:false},0);
  poseWeapon(weapon,{fire:0,reload:null,cycle:null,equip:1});world.add(avatar);
  const bounds=new THREE.Box3().setFromObject(avatar),sphere=bounds.getBoundingSphere(new THREE.Sphere()),center=bounds.getCenter(new THREE.Vector3());
  const third=new THREE.PerspectiveCamera(35,700/620,.05,30);third.position.set(2.8,1.3,-4.4).normalize().multiplyScalar(sphere.radius/Math.sin(35*Math.PI/360)*1.1).add(center);third.lookAt(center);
  const first=new THREE.PerspectiveCamera(70,16/9,.05,180),vm=createViewmodel('sniper',config,{holdSide:'right'}),local=new THREE.Scene();local.add(new THREE.AmbientLight(0xffffff,Math.PI),vm);
  const strip=document.createElement('canvas');strip.width=2100;strip.height=800;const c=strip.getContext('2d')!;
  c.fillStyle='#EEECE5';c.fillRect(0,0,2100,800);c.fillStyle='#292B29';c.font='600 27px Segoe UI';c.fillText('Round 9 · Sniper · світ / зум / піксельний приціл · Малиновий',24,38);
  renderer.setPixelRatio(1);renderer.setScissorTest(false);renderer.setSize(700,620,false);renderer.setViewport(0,0,700,620);
  renderer.render(world,third);c.drawImage(renderer.domElement,0,60);
  c.font='600 21px Segoe UI';c.fillText('Третя особа · HIP справа',20,718);
  renderer.setSize(700,394,false);renderer.setViewport(0,0,700,394);
  for(let ads=0;ads<=1;ads++){
    poseViewmodel(vm,{holdSide:'right',ads,fire:0,reload:null,cycle:null,equip:1,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,time:0});renderFirstPerson(local,first,'sniper',ads);c.drawImage(renderer.domElement,(ads+1)*700,173);
    if(ads)c.drawImage(overlay,(ads+1)*700,173,700,394);
    c.fillStyle='#292B29';c.font='600 21px Segoe UI';c.fillText('Перша особа · ADS '+ads,(ads+1)*700+20,718);
    c.font='16px Segoe UI';c.fillText(`FOV ${fovForAds('sniper',ads)}° · `+(ads?'2D приціл · viewmodel прихований':'збережений HIP · світ 8–100 м'),(ads+1)*700+20,749);
  }
  c.font='16px Segoe UI';c.fillText('Світова зброя та HIP без змін · вікно 90% висоти · 48 клітин · бузковий обідок · scoped FOV 28°',24,781);
  const out=$('#weapon-exports');out.replaceChildren();const link=document.createElement('a');link.id='sniper-scope-strip';link.href=strip.toDataURL('image/png');link.download='round9-sniper-scope.png';link.textContent='PNG · sniper HIP / ADS0 / ADS1 ↗';out.append(link);link.click();resize();render();
});
if(import.meta.hot)import.meta.hot.dispose(()=>{
  measurements.dispose();viewModels.clear();heldModels.clear();
  overlayObserver.disconnect();sampleWorld.dispose();
  renderer.setAnimationLoop(null);observer.disconnect();heldControls.dispose();renderer.dispose();
  effects.dispose();floorGeometry.dispose();floorMaterial.dispose();disposeWeaponResources();disposeCharacterResources();
  for(const geometry of markerGeometries)geometry.dispose();
});
