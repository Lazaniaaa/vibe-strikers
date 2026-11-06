import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('../..',import.meta.url));
const server=await createServer({configFile:false,root,server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const api=await server.ssrLoadModule('/src/weapons/index.ts'),ca=await server.ssrLoadModule('/src/characters/index.ts');
 const poses=[['idle',0,0,-1,false,true,false],['run',1,0,-1,false,true,false],['strafe',1,1,0,false,true,false],['back',1,0,1,false,true,false],['crouch',0,0,-1,true,true,false],['jump',0,0,-1,false,false,false],['dead',0,0,-1,false,true,true]];
 const s={weapon:'beam',speed:0,moveDir:{x:0,z:-1},aimPitch:0,shooting:false,fire:0,reload:null,cycle:null,equip:1,heat:.5,charge:.5,paintLevel:.5,time:0,crouching:false,grounded:true,dead:false};
 const fixtures=[];let maxColdMs=0;
 for(const c of ca.characters){const g=ca.createCharacter(c),items=[];for(const id of api.NEW_WEAPON_IDS){const w=api.createWeapon(id);api.attachWeapon(g,w);s.weapon=id;const t=performance.now();api.poseArmedCharacter(g,s,0);const ms=performance.now()-t;assert(ms<30,'First use '+c.id+'/'+id+' '+ms);maxColdMs=Math.max(maxColdMs,ms);items.push({id,w,binding:g.userData.weaponBinding,coldMs:ms});}fixtures.push({c,g,items});}
 for(const f of fixtures)for(const item of f.items){f.g.userData.weaponBinding=item.binding;s.weapon=item.id;for(let i=0;i<250;i++){s.aimPitch=(i%179-89)*Math.PI/180;api.poseArmedCharacter(f.g,s,0);api.poseWeapon(item.w,s);}}
 const results=[];let calls=0,maxHotMs=0;
 for(const f of fixtures){let maxMs=0;for(const item of f.items){f.g.userData.weaponBinding=item.binding;s.weapon=item.id;global.gc?.();
  for(const p of poses){s.speed=p[1];s.moveDir.x=p[2];s.moveDir.z=p[3];s.crouching=p[4];s.grounded=p[5];s.dead=p[6];
   for(const aim of[-89,-45,0,45,89])for(const fire of[0,1]){s.aimPitch=aim*Math.PI/180;s.shooting=!!fire;s.fire=fire;const t=performance.now();api.poseArmedCharacter(f.g,s,0);api.poseWeapon(item.w,s);const ms=performance.now()-t;maxMs=Math.max(maxMs,ms);calls++;}
  }
 }assert(maxMs<=.5,f.c.id+' hot '+maxMs+'ms');maxHotMs=Math.max(maxHotMs,maxMs);results.push({character:f.c.id,maxMs});}
 const report={pass:true,calls,maxColdMs,maxHotMs,limits:{coldMs:30,hotMs:.5},results};await writeFile(new URL('./toy-performance.json',import.meta.url),JSON.stringify(report,null,2));console.log('TOY PERFORMANCE PASS',calls,'cold',maxColdMs,'hot',maxHotMs);
}finally{await server.close();}
