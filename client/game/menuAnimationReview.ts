import { OrthographicCamera, SRGBColorSpace, WebGLRenderTarget, type Scene, type WebGLRenderer } from 'three';
import { characters, createCharacter, prepareLobbyAnimation, playEmote, updateAnimation, LOBBY_EMOTES } from '../../src/characters';
import { MENU } from '../../src/config/game';

/** Authoring-only proof. A bounded row is rendered per task, never from the live animation callback. */
export async function captureAnimationSheets(renderer:WebGLRenderer,scene:Scene,host:HTMLElement,isActive:()=>boolean):Promise<void> {
  const c=MENU.animationReview,size=c.size,rowHeight=size+c.labelHeight;
  host.replaceChildren();host.dataset.ready='false';
  const target=new WebGLRenderTarget(size,size);target.texture.colorSpace=SRGBColorSpace;
  const camera=new OrthographicCamera(-c.span/2,c.span/2,c.span/2,-c.span/2,c.near,c.far);
  camera.position.set(...c.camera);camera.lookAt(0,c.targetY,0);
  const pixels=new Uint8Array(size*size*4),tile=document.createElement('canvas');tile.width=tile.height=size;
  const context=tile.getContext('2d')!,image=context.createImageData(size,size);
  const idleAtlas=document.createElement('canvas');idleAtlas.width=size*3*c.columns;idleAtlas.height=rowHeight*Math.ceil(characters.length/c.columns);
  const emoteAtlas=document.createElement('canvas');emoteAtlas.width=size*3*c.examples.length;emoteAtlas.height=rowHeight*LOBBY_EMOTES.length;
  const idleContext=idleAtlas.getContext('2d')!,emoteContext=emoteAtlas.getContext('2d')!;
  const save=(canvas:HTMLCanvasElement,kind:string,id:string)=>{const img=document.createElement('img');img.dataset.kind=kind;img.dataset.character=id;img.src=canvas.toDataURL('image/png');host.append(img);};
  const capture=(row:CanvasRenderingContext2D,column:number)=>{
    renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);renderer.setRenderTarget(null);
    const bytes=size*4;for(let y=0;y<size;y++)for(let x=0;x<bytes;x++)image.data[y*bytes+x]=pixels[(size-y-1)*bytes+x];
    context.putImageData(image,0,0);row.drawImage(tile,column*size,c.labelHeight);
  };
  const rowCanvas=(label:string)=>{const canvas=document.createElement('canvas');canvas.width=size*3;canvas.height=rowHeight;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle=MENU.palette.ink;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=MENU.palette.cream;ctx.font=c.font;ctx.fillText(label,5,c.labelHeight-7);return canvas;};
  try{
    for(let index=0;index<characters.length;index++){
      if(!isActive())return;
      const model=createCharacter(characters[index]);prepareLobbyAnimation(model);model.rotation.y=MENU.portrait.yaw;scene.add(model);
      const row=rowCanvas(characters[index].name.replace(/^vibe-vibers-/,''));const ctx=row.getContext('2d')!;let time=0;
      for(let i=0;i<c.idleTimes.length;i++){while(time+c.step<c.idleTimes[i]){updateAnimation(model,c.step);time+=c.step;}updateAnimation(model,c.idleTimes[i]-time);time=c.idleTimes[i];capture(ctx,i);}
      scene.remove(model);save(row,'idle',characters[index].id);idleContext.drawImage(row,(index%c.columns)*row.width,Math.floor(index/c.columns)*rowHeight);
      await new Promise<void>(resolve=>window.setTimeout(resolve,0));
    }
    for(let column=0;column<c.examples.length;column++)for(let clipIndex=0;clipIndex<LOBBY_EMOTES.length;clipIndex++){
      if(!isActive())return;
      const config=characters[c.examples[column]],clip=LOBBY_EMOTES[clipIndex],model=createCharacter(config);prepareLobbyAnimation(model);playEmote(model,clip.id);model.rotation.y=MENU.portrait.yaw;scene.add(model);
      const row=rowCanvas(config.name.replace(/^vibe-vibers-/,'')+' / '+clip.name),ctx=row.getContext('2d')!;let time=0;
      for(let i=0;i<c.emoteFractions.length;i++){const goal=c.emoteFractions[i]*clip.duration;while(time+c.step<goal){updateAnimation(model,c.step);time+=c.step;}updateAnimation(model,goal-time);time=goal;capture(ctx,i);}
      scene.remove(model);save(row,clip.id,config.id);emoteContext.drawImage(row,column*row.width,clipIndex*rowHeight);
      await new Promise<void>(resolve=>window.setTimeout(resolve,0));
    }
    save(idleAtlas,'idle-atlas','all-33');save(emoteAtlas,'emote-atlas','three-proportions');host.dataset.ready='true';
  }finally{target.dispose();renderer.setRenderTarget(null);}
}
