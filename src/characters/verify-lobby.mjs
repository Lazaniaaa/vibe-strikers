import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true}});
try{
 const api=await server.ssrLoadModule('/src/characters/index.ts');
 const {Box3,Vector3}=await server.ssrLoadModule('three');
 const {OBB}=await server.ssrLoadModule('three/addons/math/OBB.js');
 const baseline=JSON.parse(await fs.readFile(new URL('./baselines/lobby-match-poses.json',import.meta.url),'utf8'));
 const names=['rig','head','torso','armL','armR','legL','legR'];
 const snapshot=d=>names.flatMap(k=>[...d[k].position.toArray(),...d[k].rotation.toArray().slice(0,3),...d[k].scale.toArray()]).map(v=>v===0?0:v);
 const bound=(extent,part,rest=[0,0,0])=>new Box3(new Vector3(...extent.min).sub(new Vector3(...rest)),new Vector3(...extent.max).sub(new Vector3(...rest))).applyMatrix4(part.matrix);
 const results=[];let samples=0,maxGap=0,minimumClearance=Infinity,maxPivotStep=0;
 for(const config of api.characters){
  const g=api.createCharacter(config),d=g.userData;
  const original=baseline.characters[config.id];assert(original);
  g.traverse(o=>{if(o.isMesh){const h=crypto.createHash('sha256');for(const a of Object.values(o.geometry.attributes))h.update(Buffer.from(a.array.buffer));h.update(Buffer.from(o.geometry.index.array.buffer));assert.equal(h.digest('hex'),original.geometry[o.name],config.id+' geometry '+o.name);}});
  for(let i=0;i<baseline.states.length;i++){d.phase=0;api.poseCharacter(g,baseline.states[i],0);assert.deepEqual(snapshot(d),original.poses[i],config.id+' original match pose '+i);}
  api.prepareLobbyAnimation(g);const s=d.lobbyAnimation;
  const geometry=d.armVariants.meshL.geometry;let maxOffset=0,minHandY=Infinity;
  const outer=[...g.position.toArray(),...g.rotation.toArray(),...g.scale.toArray()];
  for(const clip of [null,...api.LOBBY_EMOTES]){
   if(clip)api.playEmote(g,clip.id);
   const previous=[...d.armL.position.toArray(),...d.armR.position.toArray()];
   const frames=Math.ceil(((clip?.duration??api.LOBBY_ANIMATION.idlePeriod)+.3)*60);
   for(let frame=0;frame<frames;frame++){
    api.updateAnimation(g,1/60);samples++;
    for(let side=0;side<2;side++){const part=side?d.armR:d.armL,k=side*3;const x=part.position.x-previous[k],y=part.position.y-previous[k+1],z=part.position.z-previous[k+2];maxPivotStep=Math.max(maxPivotStep,Math.sqrt(x*x+y*y+z*z));previous[k]=part.position.x;previous[k+1]=part.position.y;previous[k+2]=part.position.z;}
    for(const name of names)d[name].updateMatrix();
    const head=bound(d.bodyExtents.parts.head,d.head,d.restPose.head),torso=bound(d.bodyExtents.parts.torso,d.torso,d.restPose.torso);
    for(const side of ['L','R']){
     const arm=d['arm'+side],hand=bound(d.dimensions['hand'+side],arm),upper=bound(d.armVariants['variants'+side][0].upper,arm);
     minHandY=Math.min(minHandY,hand.min.y+d.rig.position.y);
     for(const body of [head,torso])for(const extent of [d.dimensions['hand'+side],d.armVariants['variants'+side][0].upper]){
      const local=new Box3(new Vector3(...extent.min),new Vector3(...extent.max)),center=local.getCenter(new Vector3()).applyMatrix4(arm.matrix),obb=new OBB().fromBox3(local);obb.center.set(0,0,0);obb.applyMatrix4(arm.matrix);obb.center.copy(center);
      assert(!obb.intersectsBox3(body),`${config.id}/${clip?.id??'idle'}/${frame}/${side}: OBB/body intrusion`);
      for(let corner=0;corner<8;corner++){const point=new Vector3(corner&1?local.max.x:local.min.x,corner&2?local.max.y:local.min.y,corner&4?local.max.z:local.min.z).applyMatrix4(arm.matrix);minimumClearance=Math.min(minimumClearance,body.distanceToPoint(point));}
     }
     const leg=d['leg'+side],foot=bound(d.dimensions['foot'+side],leg);assert(foot.min.y+d.rig.position.y>=-1e-7,'Foot below floor');
     const gap=d.armVariants['variants'+side][0].upper.min[1]-d.dimensions['hand'+side].max[1];maxGap=Math.max(maxGap,gap);assert(gap<=.012,'Disconnected hand geometry');
    }
    for(const value of snapshot(d))assert(Number.isFinite(value));
    assert.deepEqual([...g.position.toArray(),...g.rotation.toArray(),...g.scale.toArray()],outer,'Outer ownership');
    assert.equal(d.armVariants.meshL.geometry,geometry,'No geometry change');
   }
   if(clip)assert.equal(s.emote,null,'Clip returns to idle');
  }
  // Includes rapid interruptions and a smooth return to the continuing idle clock.
  api.playEmote(g,'wave');for(let i=0;i<25;i++)api.updateAnimation(g,1/60);const start=d.armR.rotation.z;
  api.playEmote(g,'shrug');api.updateAnimation(g,0);assert(Math.abs(d.armR.rotation.z-start)<1e-10,'No interrupt snap');
  maxOffset=s.maxShoulderOffset;
  results.push({id:config.id,idleRollL:s.rollL,idleRollR:s.rollR,minHandY,maxShoulderOffset:maxOffset});
  // A game can take the same instance back: the lobby clock/pose must not leak into poseCharacter.
  for(let i=0;i<baseline.states.length;i++){d.phase=0;api.poseCharacter(g,baseline.states[i],0);assert.deepEqual(snapshot(d),original.poses[i],config.id+' match after lobby '+i);}
 }
 const first=api.createCharacter(api.characters[0]),second=api.createCharacter(api.characters[0]);api.prepareLobbyAnimation(first);api.prepareLobbyAnimation(second);api.playEmote(first,'dance');api.playEmote(second,'dance');
 for(let i=0;i<180;i++){api.updateAnimation(first,1/60);api.updateAnimation(second,1/60);assert.deepEqual(snapshot(first.userData),snapshot(second.userData),'Independent deterministic clocks');}
 assert(maxPivotStep<.05,'A shoulder jumped more than 5cm in one 60Hz frame: '+maxPivotStep);
 const source=ts.createSourceFile('lobbyAnimation.ts',await fs.readFile(new URL('./lobbyAnimation.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const hot=new Set(['transformed','satAxis','outward','clearArm','plant','crossfade','updateAnimation']);
 for(const node of source.statements)if(ts.isFunctionDeclaration(node)&&hot.has(node.name?.text)){const visit=n=>{assert(!ts.isNewExpression(n)&&!ts.isArrayLiteralExpression(n)&&!ts.isObjectLiteralExpression(n)&&!ts.isArrowFunction(n)&&!ts.isForOfStatement(n),'Allocating construct in '+node.name.text);ts.forEachChild(n,visit);};visit(node.body);}
 console.log(execFileSync(process.execPath,['--expose-gc',fileURLToPath(new URL('./benchmark-lobby.mjs',import.meta.url))],{encoding:'utf8'}));
 const perf=JSON.parse(await fs.readFile(new URL('../../client/game/animation-review/performance.json',import.meta.url),'utf8'));
 for(const row of results)row.maxMs=perf.results.find(p=>p.id===row.id).maxMs;
 const report={pass:true,characters:results.length,samples,minimumClearance,maxHandJointGap:maxGap,maxPivotStep,allocationSourceAudit:true,results};
 await fs.writeFile(new URL('../../client/game/animation-review/contracts.json',import.meta.url),JSON.stringify(report,null,2));
 console.table(results.map(r=>({id:r.id.replace('vibe-vibers-',''),relaxedDegrees:(r.idleRollR*180/Math.PI).toFixed(1),shoulderOffset:r.maxShoulderOffset.toFixed(4),maxMs:r.maxMs.toFixed(4)})));
 console.log('LOBBY ANIMATION VERIFIED:',{samples,minimumClearance,maxGap});
 api.disposeCharacterResources();
}finally{await server.close();}
