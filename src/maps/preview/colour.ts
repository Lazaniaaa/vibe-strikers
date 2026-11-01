import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildMap,loadMapData} from '../index';
const query=new URLSearchParams(location.search),stage='after',id=query.get('map')??'toy-town-l1-r1';
const data=loadMapData(id),scene=new THREE.Scene();scene.background=new THREE.Color(data.sky.color);scene.fog=new THREE.Fog(data.fog.color,data.fog.near,data.fog.far);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1280,800);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;document.querySelector('#viewport')!.append(renderer.domElement);
scene.add(new THREE.AmbientLight(data.light.ambient.color,data.light.ambient.intensity));const sun=new THREE.DirectionalLight(data.light.sun.color,data.light.sun.intensity);sun.position.set(...data.light.sun.direction).normalize().multiplyScalar(70);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:180});sun.shadow.bias=-.0005;sun.shadow.normalBias=.03;scene.add(sun);
const map=buildMap(data);scene.add(map);const camera=new THREE.PerspectiveCamera(70,1.6,.08,260),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;
const views={
 'spawn-a':{name:'Спавн A',position:[-30,2.7,-8],target:[-20,1.8,9]},
 'spawn-b':{name:'Спавн B',position:[30,2.7,-8],target:[20,1.8,9]},
 fountain:{name:'Площа з фонтаном',position:[-10,6,-10],target:[0,1,1]},
 market:{name:'Ринок',position:[-29,8,-15],target:[-20,1.7,-25]},
} as const;
type View=keyof typeof views;
const frames:Record<string,unknown>={};
function render(){renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);}
function setView(id:View){const v=views[id];camera.position.set(v.position[0],v.position[1],v.position[2]);controls.target.set(v.target[0],v.target[1],v.target[2]);camera.lookAt(controls.target);controls.update();render();}
controls.addEventListener('change',render);
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view as View));
function download(name:string,canvas:HTMLCanvasElement){const a=document.createElement('a');a.download=name;a.href=canvas.toDataURL('image/png');a.textContent=name;a.dataset.file=name;document.querySelector('#downloads')!.append(a);}
function capture(){document.querySelector('#downloads')!.replaceChildren();const sheet=document.createElement('canvas');sheet.width=2560;sheet.height=1600;const sheetContext=sheet.getContext('2d')!;let n=0;
 for(const [key,v]of Object.entries(views)){setView(key as View);frames[key]={position:v.position,target:v.target,fov:camera.fov,width:1280,height:800,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,mapStats:map.userData.stats};const c=document.createElement('canvas');c.width=1280;c.height=800;const ctx=c.getContext('2d')!;ctx.drawImage(renderer.domElement,0,0);ctx.fillStyle='#17233a';ctx.fillRect(0,0,1280,43);ctx.fillStyle='#f1e1bc';ctx.font='600 20px Segoe UI';ctx.fillText(`ПІСЛЯ · ${v.name} · ${id} · FOV 70°`,18,29);download(`${stage}-${key}.png`,c);sheetContext.drawImage(c,(n%2)*1280,Math.floor(n/2)*800);n++;}
 download(`${stage}-contact.png`,sheet);(document.querySelector('#capture-stats') as HTMLTextAreaElement).value=JSON.stringify({stage,id,frames},null,2);document.querySelector('#status')!.textContent='Готово · чотири незмінні ракурси · ACES / sRGB · показники включають тіні';}
document.querySelector<HTMLButtonElement>('#capture')!.onclick=capture;setView('fountain');document.querySelector('#status')!.textContent=`${id} · ${stage} · ${map.userData.stats.drawCalls} map batches`;capture();



