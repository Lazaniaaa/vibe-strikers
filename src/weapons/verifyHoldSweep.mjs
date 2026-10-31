import assert from'node:assert/strict';
import{writeFile,mkdir}from'node:fs/promises';
import{performance}from'node:perf_hooks';
import{collectBeforeFixture}from'./verifyHoldPerf.mjs';
import{Matrix4,Vector3,Quaternion,Mesh}from'three';
import{OBB}from'three/addons/math/OBB.js';


// A small synchronous timer loop can be optimized independently of the large
// geometric oracle. In particular the benchmark must not allocate boxed timer
// numbers in an unoptimized async oracle, then charge its GC to poseCharacter.
export function timeFixture(f,s,poses,poseCharacter){
 let max=0,worst=null,calls=0;
 const {g,d,c}=f;
 for(let wi=0;wi<f.weapons.length;wi++){
  const entry=f.weapons[wi];s.weapon=entry.w.userData.weaponId;d.weaponBinding=entry.binding;
  for(let pi=0;pi<poses.length;pi++){
   const p=poses[pi];s.speed=p[1];s.moveDir.x=p[2];s.moveDir.z=p[3];s.crouching=p[4];s.grounded=p[5];s.dead=p[6];
   for(let fi=0;fi<5;fi++){
    s.fire=fi/4;s.shooting=fi>0;
    for(let angle=-89;angle<=89;angle++){
     s.aimPitch=angle*Math.PI/180;
     const t=performance.now();poseCharacter(g,s,0);const ms=performance.now()-t;calls++;
     if(ms>max){max=ms;worst={weapon:s.weapon,pose:p[0],fire:s.fire,aim:angle,startTime:t};}
    }
   }
  }
 }
 return {character:c.id,maxHotMs:max,worst,calls};
}

/** Fine-grid oracle; separate timing and geometry passes avoid charging oracle
 * allocations/raycast work to the production pose function. No timing trimming. */
export async function verifyHoldSweep(api,characters,createCharacter,poseCharacter){
 const poses=[['idle',0,0,-1,false,true,false],['run',1,0,-1,false,true,false],['strafe',1,1,0,false,true,false],['back',1,0,1,false,true,false],['crouch',0,0,-1,true,true,false],['jump',0,0,-1,false,false,false],['dead',0,0,-1,false,true,true]];
 const tolerated=new Set(['vibe-vibers-viber-142','vibe-vibers-bureau-roll-40-10']);
 const s={weapon:'pistol',speed:0,moveDir:{x:0,z:-1},crouching:false,grounded:true,dead:false,aimPitch:0,shooting:false,fire:0};
 const action={fire:0,reload:null,cycle:null,equip:1};
 const result={complete:false,cases:0,timedCalls:0,maxHotMs:0,maxDegreesPerDegree:0,maxFistError:0,minClearance:.01,rows:[],violations:[],bestEffort:[]};
 const fixtures=characters.map(c=>{const g=createCharacter(c),d=g.userData;return{c,g,d,weapons:api.weapons.filter(w=>w.kind!=='knife').map(cfg=>{const w=api.createWeapon(cfg.id);api.attachWeapon(g,w);s.weapon=cfg.id;s.aimPitch=0;poseCharacter(g,s,0);return{w,binding:d.weaponBinding,main:w.getObjectByName('mainGrip'),support:w.userData.supportGrip};})};});
 await new Promise(resolve=>setImmediate(resolve));
 collectBeforeFixture();
 for(const f of fixtures){f.timing=timeFixture(f,s,poses,poseCharacter);result.timedCalls+=f.timing.calls;result.maxHotMs=Math.max(result.maxHotMs,f.timing.maxHotMs);}
 const armBox=new OBB(),torsoBox=new OBB();
 const inverseH=new Matrix4(),inverseT=new Matrix4(),matrix=new Matrix4(),point=new Vector3(),palm=new Vector3(),grip=new Vector3(),lastL=new Quaternion(),lastR=new Quaternion();
 let limits=new Float64Array(12);
 function distance(a,m,j){let min=.01;const e=m.elements;for(let i=0;i<a.length;i+=3){const x=a[i],y=a[i+1],z=a[i+2];const dx=Math.abs(e[0]*x+e[4]*y+e[8]*z+e[12]-limits[j])-limits[j+3];if(dx>=min)continue;const dy=Math.abs(e[1]*x+e[5]*y+e[9]*z+e[13]-limits[j+1])-limits[j+4];if(dy>=min)continue;const dz=Math.abs(e[2]*x+e[6]*y+e[10]*z+e[14]-limits[j+2])-limits[j+5];if(dz>=min)continue;min=Math.min(min,Math.hypot(Math.max(0,dx),Math.max(0,dy),Math.max(0,dz))+Math.min(0,Math.max(dx,dy,dz)));}return min;}
 const csv=['character,weapon,pose,fire,aim,rightError,leftError,clearance,armStepDeg,clearanceAllowed'];
 for(const f of fixtures){const{c,g,d}=f;for(let j=0;j<2;j++){const name=j?'torso':'head',b=d.bodyExtents.parts[name],r=d.restPose[name],size=d.dimensions.components[name];for(let axis=0;axis<3;axis++){limits[j*6+axis]=(b.min[axis]+b.max[axis])/2-r[axis];limits[j*6+3+axis]=size[axis]/2-.01;}}
  for(const{w,binding,main,support}of f.weapons){d.weaponBinding=binding;s.weapon=w.userData.weaponId;poseCharacter(g,s,0);
   const row={character:c.id,weapon:s.weapon,cases:0,maxHotMs:f.timing.maxHotMs,maxFistError:0,maxRightError:0,maxLeftError:0,minClearance:.01,minDeadClearance:.01,maxDeadFistError:0,maxArmStepDeg:0,maxShoulderOffset:0,shoulderFailures:0,contactFailures:0,lengths:d.firearmHolds[s.weapon].lengths,clearanceFailures:0,reachFailures:0,smoothnessFailures:0,worstClearance:null,worstStep:null};
   // Mesh resources and unique point clouds are created outside the pose loop.
   const meshes=[];w.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});meshes.push(d.armVariants.meshL,d.armVariants.meshR);
   const points=meshes.map(o=>{const a=o.geometry.attributes.position.array,out=[],seen=new Set();for(let i=0;i<a.length;i+=3){const key=a[i]+','+a[i+1]+','+a[i+2];if(!seen.has(key)){seen.add(key);out.push(a[i],a[i+1],a[i+2]);}}return new Float32Array(out);});
   for(const[p,speed,x,z,crouching,grounded,dead]of poses){s.speed=speed;s.moveDir.x=x;s.moveDir.z=z;s.crouching=crouching;s.grounded=grounded;s.dead=dead;
    for(let fi=0;fi<5;fi++){s.fire=fi/4;s.shooting=fi>0;action.fire=s.fire;
     for(let angle=-89;angle<=89;angle++){s.aimPitch=angle*Math.PI/180;d.phase=.71;poseCharacter(g,s,0);api.poseWeapon(w,action);g.updateMatrixWorld(true);
      const step=angle===-89?0:2*Math.acos(Math.min(1,Math.min(Math.abs(lastL.dot(d.armL.quaternion)),Math.abs(lastR.dot(d.armR.quaternion)))))*180/Math.PI;lastL.copy(d.armL.quaternion);lastR.copy(d.armR.quaternion);
      let re=0,le=0;for(const side of['R','L']){const b=d.armVariants['hand'+side];palm.set((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2).applyMatrix4(d['arm'+side].matrixWorld);(side==='R'?main:support).getWorldPosition(grip);const error=palm.distanceTo(grip);if(side==='R')re=error;else le=error;}
      inverseH.copy(d.head.matrixWorld).invert();inverseT.copy(d.torso.matrixWorld).invert();let clearance=.01;
      for(let mi=0;mi<meshes.length;mi++){matrix.multiplyMatrices(inverseH,meshes[mi].matrixWorld);clearance=Math.min(clearance,distance(points[mi],matrix,0));matrix.multiplyMatrices(inverseT,meshes[mi].matrixWorld);clearance=Math.min(clearance,distance(points[mi],matrix,6));}
      assert.ok(Number.isFinite(step)&&Number.isFinite(re)&&Number.isFinite(le)&&Number.isFinite(clearance));
      let offset=0,contact=true;
      const tb=d.bodyExtents.parts.torso,tr=d.restPose.torso;
      torsoBox.center.set((tb.min[0]+tb.max[0])/2-tr[0],(tb.min[1]+tb.max[1])/2-tr[1],(tb.min[2]+tb.max[2])/2-tr[2]);torsoBox.halfSize.set(tb.width/2,tb.height/2,tb.depth/2);torsoBox.rotation.identity();torsoBox.applyMatrix4(d.torso.matrixWorld);
      for(const side of ['L','R']){
       const arm=d['arm'+side],rest=d.restPose['arm'+side],b=d.armVariants['selected'+side].upper;
       offset=Math.max(offset,Math.hypot(arm.position.x-rest[0],arm.position.y-rest[1],arm.position.z-rest[2]));
       armBox.center.set((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);armBox.halfSize.set(b.width/2,b.height/2,b.depth/2);armBox.rotation.identity();armBox.applyMatrix4(arm.matrixWorld);contact=contact&&armBox.intersectsOBB(torsoBox,1e-7);
      }
      row.maxShoulderOffset=Math.max(row.maxShoulderOffset,offset);if(offset>.030000001)row.shoulderFailures++;if(!dead&&!contact)row.contactFailures++;

      const intrusion=!dead&&clearance< -1e-9,reach=!dead&&Math.max(re,le)>.100000001,smooth=step>2.000001,allowed=tolerated.has(c.id);
      if(!dead&&clearance<row.minClearance){row.minClearance=clearance;row.worstClearance={pose:p,fire:s.fire,aim:angle};}if(step>row.maxArmStepDeg){row.maxArmStepDeg=step;row.worstStep={pose:p,fire:s.fire,aim:angle};}
      row.cases++;result.cases++;if(!dead){row.maxFistError=Math.max(row.maxFistError,re,le);row.maxRightError=Math.max(row.maxRightError,re);row.maxLeftError=Math.max(row.maxLeftError,le);}else{row.minDeadClearance=Math.min(row.minDeadClearance,clearance);row.maxDeadFistError=Math.max(row.maxDeadFistError,re,le);}row.clearanceFailures+=intrusion&&!allowed?1:0;row.reachFailures+=reach?1:0;row.smoothnessFailures+=smooth?1:0;
      if(intrusion||reach||smooth)csv.push([c.id,s.weapon,p,s.fire,angle,re,le,clearance,step,allowed].join(','));
     }
    }
   }
   result.rows.push(row);result.maxFistError=Math.max(result.maxFistError,row.maxFistError);result.minClearance=Math.min(result.minClearance,row.minClearance);result.maxDegreesPerDegree=Math.max(result.maxDegreesPerDegree,row.maxArmStepDeg);
   if(row.clearanceFailures||row.reachFailures||row.smoothnessFailures||row.shoulderFailures||row.contactFailures)result.violations.push(row);if(tolerated.has(c.id))result.bestEffort.push(row);
  }console.log('FINE HOLD SWEEP',c.id);
 }
 result.complete=true;await mkdir(new URL('../../outputs/hold-performance/',import.meta.url),{recursive:true});await writeFile(new URL('../../outputs/hold-performance/fine-sweep.json',import.meta.url),JSON.stringify(result,null,2)+'\n');await writeFile(new URL('../../outputs/hold-performance/fine-sweep-failures.csv',import.meta.url),csv.join('\n')+'\n');
 console.log('FINE SWEEP SUMMARY',JSON.stringify({cases:result.cases,calls:result.timedCalls,maxHotMs:result.maxHotMs,maxFistError:result.maxFistError,minClearance:result.minClearance,maxStep:result.maxDegreesPerDegree,failedRows:result.violations.length}));
 assert.ok(result.maxHotMs<=.5&&result.violations.length===0,'Fine hold sweep failed; outputs/hold-performance/fine-sweep.json and CSV');return result;
}
