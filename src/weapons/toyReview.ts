import { AmbientLight, Box3, BoxGeometry, Color, Mesh, MeshLambertMaterial, PerspectiveCamera, Scene, Sphere, Vector3, type WebGLRenderer } from 'three';
import type { CharacterConfig } from '../characters/types';
import { createCharacter } from '../characters/createCharacter';
import { createWeapon } from './createWeapon';
import { attachWeapon } from './hold';
import { poseArmedCharacter } from './characterPose';
import { poseWeapon } from './poseWeapon';
import { createViewmodel, poseViewmodel } from './viewmodel';
import { toyWeapons } from './toyWeapons';

/** Actual WebGL authoring capture. Runs on an explicit button, outside the animation loop. */
export function captureToyWeapons(renderer:WebGLRenderer,character:CharacterConfig,host:HTMLElement):void {
  const width=360,height=330,rowHeight=385;
  const atlas=document.createElement('canvas');atlas.width=width*3;atlas.height=rowHeight*toyWeapons.length;
  const ac=atlas.getContext('2d')!;host.replaceChildren();
  const floorGeometry=new BoxGeometry(5,.04,5),floorMaterial=new MeshLambertMaterial({color:'#FFF0D4'});
  const world=new Scene();world.background=new Color('#D7E6EF');
  world.add(new AmbientLight(0xffffff,Math.PI));
  const pad=new Mesh(floorGeometry,floorMaterial);pad.position.y=-.025;world.add(pad);
  const camera=new PerspectiveCamera(38,width/height,.05,30);
  const state={fire:0,reload:null,cycle:null,equip:1,heat:.72,charge:1,paintLevel:.65,time:0};
  const first=new Scene();first.background=world.background;first.add(new AmbientLight(0xffffff,Math.PI));
  const fps=new PerspectiveCamera(70,width/height,.05,20);
  const sphere=new Sphere(),center=new Vector3(),direction=new Vector3(1.15,.95,-1.7).normalize();
  renderer.setPixelRatio(1);renderer.setScissorTest(false);renderer.setSize(width,height,false);renderer.setViewport(0,0,width,height);
  for(let i=0;i<toyWeapons.length;i++){
    const cfg=toyWeapons[i],row=document.createElement('canvas');row.width=width*3;row.height=rowHeight;const c=row.getContext('2d')!;
    c.fillStyle='#FAF7EE';c.fillRect(0,0,row.width,row.height);c.fillStyle='#26344B';c.font='bold 17px system-ui';
    c.fillText(cfg.displayName+' · '+character.name,12,24);
    const avatar=createCharacter(character),held=createWeapon(cfg.id);attachWeapon(avatar,held);
    poseArmedCharacter(avatar,{weapon:cfg.id,speed:0,moveDir:{x:0,z:-1},aimPitch:0,shooting:false,crouching:false,grounded:true,dead:false},0);
    poseWeapon(held,state);world.add(avatar);camera.position.set(2.4,1.65,-3.5);camera.lookAt(.1,.91,-.2);renderer.render(world,camera);c.drawImage(renderer.domElement,0,35);world.remove(avatar);
    const loose=createWeapon(cfg.id);poseWeapon(loose,state);loose.rotation.y=.65;world.add(loose);
    const bounds=new Box3().setFromObject(loose);loose.position.y=-bounds.min.y+.006;
    bounds.setFromObject(loose);bounds.getCenter(center);bounds.getBoundingSphere(sphere);
    camera.position.copy(direction).multiplyScalar(sphere.radius/Math.sin(38*Math.PI/360)*1.15).add(center);camera.lookAt(center);
    renderer.render(world,camera);c.drawImage(renderer.domElement,width,35);world.remove(loose);
    const vm=createViewmodel(cfg.id,character);poseViewmodel(vm,{...state,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,ads:0});first.add(vm);
    renderer.render(first,fps);c.drawImage(renderer.domElement,width*2,35);first.remove(vm);
    c.fillStyle='#26344B';c.font='13px system-ui';c.fillText('HIP · in hand',12,379);c.fillText('Ground / pickup',width+12,379);c.fillText('First person · FOV 70',width*2+12,379);
    ac.drawImage(row,0,i*rowHeight);
    const link=document.createElement('a');link.href=row.toDataURL('image/png');link.download=`toy-${cfg.id}.png`;link.dataset.toy=cfg.id;link.textContent=cfg.displayName+' · PNG';host.append(link);
  }
  const link=document.createElement('a');link.id='toy-atlas';link.href=atlas.toDataURL('image/png');link.download='vibe-strikers-six-toys.png';link.textContent='All six · in hand / ground / first person';host.prepend(link);
  floorGeometry.dispose();floorMaterial.dispose();
}

/** Three progress samples expose the animated visual inputs without relying on a timed screenshot. */
export function captureToyProgress(renderer:WebGLRenderer,character:CharacterConfig,host:HTMLElement):void {
  const ids=['beam','slingshot','rail','splat','paintGrenade'] as const,width=360,height=300,rowHeight=345;
  const atlas=document.createElement('canvas');atlas.width=1080;atlas.height=ids.length*rowHeight;const c=atlas.getContext('2d')!;
  const scene=new Scene();scene.background=new Color('#D7E6EF');scene.add(new AmbientLight(0xffffff,Math.PI));
  const camera=new PerspectiveCamera(38,width/height,.05,20),fps=new PerspectiveCamera(70,width/height,.05,20);
  const sphere=new Sphere(),center=new Vector3(),direction=new Vector3(1.15,.8,-1.7).normalize();
  renderer.setPixelRatio(1);renderer.setScissorTest(false);renderer.setSize(width,height,false);renderer.setViewport(0,0,width,height);
  c.fillStyle='#FAF7EE';c.fillRect(0,0,atlas.width,atlas.height);
  for(let i=0;i<ids.length;i++){
    const id=ids[i],isThrow=id==='paintGrenade',model=isThrow?createViewmodel(id,character):createWeapon(id);scene.add(model);
    for(let col=0;col<3;col++){
      const progress=col/2,state={fire:0,reload:null,cycle:null,equip:1,heat:progress,charge:progress,paintLevel:progress,time:0};
      if(isThrow)poseViewmodel(model,{...state,throw:col===2?.85:progress,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0});
      else{poseWeapon(model,state);const bounds=new Box3().setFromObject(model);bounds.getCenter(center);bounds.getBoundingSphere(sphere);
        if(id==='slingshot')camera.position.set(1.8,.65,.6).normalize();else camera.position.copy(direction);
        camera.position.multiplyScalar(sphere.radius/Math.sin(38*Math.PI/360)*1.15).add(center);camera.lookAt(center);}
      renderer.render(scene,isThrow?fps:camera);c.drawImage(renderer.domElement,col*width,i*rowHeight+25);
      c.fillStyle='#26344B';c.font='bold 16px system-ui';c.fillText(id+' · '+(isThrow?['ready','wind-up','released'][col]:progress.toFixed(1)),col*width+12,i*rowHeight+19);
    }
    scene.remove(model);
  }
  host.replaceChildren();const link=document.createElement('a');link.id='toy-progress';link.href=atlas.toDataURL('image/png');link.download='toy-visual-inputs.png';link.textContent='Heat / pull / coils / paint / throw · PNG';host.append(link);
}
