import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {setFlagsFromString} from 'node:v8';
import {runInNewContext} from 'node:vm';
let collectGarbage=global.gc;
export function collectBeforeFixture(){
 if(!collectGarbage){setFlagsFromString('--expose_gc');collectGarbage=runInNewContext('gc');setFlagsFromString('--no_expose_gc');}
 collectGarbage();
}
import {performance} from 'node:perf_hooks';
import {Matrix4,Vector3,Quaternion} from 'three';

export async function verifyHoldPerf(api,characters,createCharacter,poseCharacter){
 const poses=[['idle',0,0,-1,false,true,false],['run',1,0,-1,false,true,false],['strafe',1,1,0,false,true,false],['back',1,0,1,false,true,false],['crouch',0,0,-1,true,true,false],['jump',0,0,-1,false,false,false],['dead',0,0,-1,false,true,true]];
 const states=[];
 for(const weapon of ['pistol','rifle','sniper','shotgun'])for(const[pose,speed,x,z,crouching,grounded,dead]of poses)for(const aim of[-89,-45,0,45,89])for(const fire of[0,1])states.push({pose,weapon,speed,moveDir:{x,z},crouching,grounded,dead,aimPitch:aim*Math.PI/180,shooting:!!fire,fire});
 const report={limits:{coldMs:30,hotMs:.5,unchangedPoseDelta:.001},rows:[],cold:[],calls:0,maxHotMs:0,maxColdMs:0,maxPoseDelta:0,poseCases:0,armedChanges:[],failures:[]};
 const fixtures=characters.map(c=>({c,g:createCharacter(c),weapons:['pistol','rifle','sniper','shotgun'].map(id=>api.createWeapon(id)),cold:0,bindings:[],cases:[]}));
 for(const f of fixtures)for(const w of f.weapons){
  api.attachWeapon(f.g,w);f.bindings.push(f.g.userData.weaponBinding);
  const cases=states.filter(s=>s.weapon===w.userData.weaponId);f.cases.push(cases);
  const t=performance.now();poseCharacter(f.g,cases[0],0);const ms=performance.now()-t;
  f.cold=Math.max(f.cold,ms);report.cold.push({character:f.c.id,weapon:w.userData.weaponId,ms});
 }
 await new Promise(resolve=>setImmediate(resolve));collectBeforeFixture();
 for(const f of fixtures){
  const{c,g,weapons}=f,d=g.userData;let hot=0,worst=null;
  const cache=d.firearmHolds,identities=Object.values(cache).map(c=>[c,c.lengths,c.solves]);
  for(let wi=0;wi<weapons.length;wi++){
   d.weaponBinding=f.bindings[wi];
   for(let repeat=0;repeat<3;repeat++)for(const s of f.cases[wi]){
    d.phase=.71;const t=performance.now();poseCharacter(g,s,0);const ms=performance.now()-t;report.calls++;
    if(ms>hot){hot=ms;worst={weapon:s.weapon,pose:s.pose,aim:s.aimPitch*180/Math.PI,fire:s.fire,repeat};}
   }
  }
  assert.equal(d.firearmHolds,cache);for(const[c,r,n]of identities){assert.equal(c.lengths,r);assert.equal(c.solves,n,'Cached hold must never solve again');}
  report.rows.push({character:c.id,maxColdMs:f.cold,maxHotMs:hot,worst});report.maxHotMs=Math.max(report.maxHotMs,hot);report.maxColdMs=Math.max(report.maxColdMs,f.cold);
  if(f.cold>30||hot>.5)report.failures.push({character:c.id,cold:f.cold,hot,worst});
 }
 const golden=JSON.parse(gunzipSync(await readFile(new URL('./hold-pose-baselines.json.gz',import.meta.url))));
 const point=new Vector3(),previousPoint=new Vector3(),before=new Matrix4(),q=new Quaternion(),p=new Vector3(),scale=new Vector3();
 const csv=['character,weapon,pose,aim,fire,part,rotationDegrees,pivotShiftM,maxBasisShiftM'];
 for(const{c,g,weapons}of fixtures)for(const w of weapons){
  const d=g.userData,mount=api.attachWeapon(g,w);
  for(const r of golden.filter(r=>r.id===c.id&&r.state.weapon===w.userData.weaponId)){
   d.phase=.71;poseCharacter(g,r.state,0);
   const parts=[d.head,d.torso,d.armL,d.armR,d.legL,d.legR,d.rig,mount];
   for(let j=0;j<parts.length;j++){
    const o=parts[j],a=r.parts[j];p.fromArray(a);q.fromArray(a,3);scale.fromArray(a,7);before.compose(p,q,scale);o.updateMatrix();let delta=0;
    for(let axis=-1;axis<3;axis++)for(const sign of[-1,1]){
     point.set(0,0,0);if(axis>=0)point.setComponent(axis,sign);previousPoint.copy(point).applyMatrix4(before);
     delta=Math.max(delta,previousPoint.distanceTo(point.applyMatrix4(o.matrix)));
    }
    const armed=j===2||j===3||j===7;
    if(!armed){report.maxPoseDelta=Math.max(report.maxPoseDelta,delta);continue;}
    const rotationDegrees=q.angleTo(o.quaternion)*180/Math.PI,pivotShift=p.distanceTo(o.position);
    if(delta>.001){
     const change={character:c.id,weapon:r.state.weapon,pose:r.state.pose,aim:Math.round(r.state.aimPitch*180/Math.PI),fire:r.state.fire,part:j===2?'armL':j===3?'armR':'mount',rotationDegrees,pivotShift,maxBasisShift:delta};
     report.armedChanges.push(change);csv.push(Object.values(change).join(','));
    }
   }
   report.poseCases++;
  }
 }
 if(report.maxPoseDelta>.001)report.failures.push({check:'Unchanged head/torso/legs/rig',delta:report.maxPoseDelta});
 await mkdir(new URL('../../outputs/hold-performance/',import.meta.url),{recursive:true});
 await writeFile(new URL('../../outputs/hold-performance/timings.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 await writeFile(new URL('../../outputs/hold-performance/armed-pose-exceptions.csv',import.meta.url),csv.join('\n')+'\n');
 console.log('HOLD PERFORMANCE',JSON.stringify({calls:report.calls,maxHotMs:report.maxHotMs,maxColdMs:report.maxColdMs,unchangedDelta:report.maxPoseDelta,poseCases:report.poseCases,armedChanges:report.armedChanges.length,failures:report.failures.length}));
 assert.equal(report.failures.length,0,'Hold performance/pose budget failed; outputs/hold-performance/timings.json');return report;
}
