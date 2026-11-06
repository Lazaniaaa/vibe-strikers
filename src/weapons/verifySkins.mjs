import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {Box3,Vector3} from 'three';
import ts from 'typescript';

const root=fileURLToPath(new URL('../..',import.meta.url));
const server=await createServer({configFile:false,root,cacheDir:root+'/work/skin-check-cache',server:{middlewareMode:true,hmr:false,ws:false}});
const hash=g=>{const h=createHash('sha256');g.traverse(o=>{h.update(JSON.stringify([o.name,...o.position,...o.quaternion,...o.scale,o.visible]));if(o.isMesh){for(const[key,a]of Object.entries(o.geometry.attributes)){h.update(key);h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}h.update(Buffer.from(o.geometry.index.array.buffer));}});return h.digest('hex');};
// Triangle ceiling includes dormant animated parts: the far rig merges those too.
const counts=g=>{let triangles=0,meshes=0;g.traverse(o=>{if(o.isMesh&&!(g.userData.farRig&&o.name.startsWith('lens-'))){triangles+=o.geometry.index.count/3;meshes++;}});return{triangles,meshes};};
const snapshot=g=>{const a=[];g.traverse(o=>{if(!o.userData.skinDecoration)a.push(o.name,...o.position,...o.quaternion,...o.scale,o.visible);});return a;};
const joints=g=>{const a=[];g.traverse(o=>{if(!o.isMesh&&!o.userData.skinDecoration)a.push(o.name,...o.position,...o.quaternion,...o.scale,o.visible);});return a;};
const state={fire:0,reload:0,cycle:0,equip:1,heat:0,charge:0,paintLevel:1,throw:0,time:0,moveSpeed:0,strafe:0,grounded:true,crouching:false,aimPitch:0,ads:0};
const closeBounds=(a,b,label)=>{assert(a.min.distanceTo(b.min)<1e-6&&a.max.distanceTo(b.max)<1e-6,label+' bounds');};
// Exact transformed vertices: rotating a merged barrel+crown AABB invents empty extreme corners.
const sizeRatio=(g,b,label)=>{g.updateMatrixWorld(true);const box=new Box3().setFromObject(g,true),size=box.getSize(new Vector3()),old=b.getSize(new Vector3());let max=0;for(const axis of['x','y','z']){const r=size[axis]/old[axis];assert(r<=1.15+1e-6,label+' size '+axis+' '+r);max=Math.max(max,r);}return max;};
try{
 const api=await server.ssrLoadModule('/src/weapons/index.ts'),ca=await server.ssrLoadModule('/src/characters/index.ts');
 const baseline=JSON.parse(await readFile(new URL('./skin-review/base-before.json',import.meta.url),'utf8'));
 const expectedIds=api.weapons.map(w=>w.id);assert.deepEqual(api.weaponIds,expectedIds,'No missing pure weapon enumeration');
 assert.equal(api.CANDY_PALETTES.length,8);assert.equal(api.CANDY_PATTERNS.length,6);for(const id of api.weaponIds)assert.equal(api.DETAIL_KITS[id].length,5);
 const reserved=new Map();for(const rarity of api.SKIN_RARITIES)for(const palette of api.RARITY_STYLES[rarity].palettes){assert(!reserved.has(palette),'Disjoint tier palette pools');reserved.set(palette,rarity);}assert.equal(reserved.size,8);
 assert.equal(new Set(Object.values(api.RARITY_STYLES).map(s=>s.id)).size,6);assert.deepEqual(Object.values(api.RARITY_STYLES).map(s=>s.crown.length),[0,1,3,5,7,9]);
 const probe=`import{registerHooks}from'node:module';registerHooks({resolve(s,c,next){if(s==='three'||s.startsWith('three/'))throw Error('Three dependency in pure generator');return next(s,c)}});const{generateSkinTraits}=await import(${JSON.stringify(new URL('./skinTraits.ts',import.meta.url).href)});process.stdout.write(JSON.stringify(generateSkinTraits({weapon:'rifle',rarity:'mythic',seed:1234})));`;
 const first=execFileSync(process.execPath,['--experimental-strip-types','--no-warnings','--input-type=module','-e',probe]);
 const second=execFileSync(process.execPath,['--experimental-strip-types','--no-warnings','--input-type=module','-e',probe]);assert(first.equals(second),'Separate processes: byte-identical traits');assert.equal(first.toString(),JSON.stringify(api.generateSkinTraits({weapon:'rifle',rarity:'mythic',seed:1234})));
 assert.throws(()=>api.generateSkinTraits({weapon:'rifle',rarity:'epic',seed:NaN}));assert.throws(()=>api.generateSkinTraits({weapon:'unknown',rarity:'epic',seed:1}));
 const base={};
 for(const id of api.weaponIds){const w=api.createWeapon(id);assert.equal(hash(w),baseline.weapons[id],id+' base world byte-identical');base[id]={...counts(w),bounds:new Box3().setFromObject(w,true)};
  const vm=api.createViewmodel(id,ca.characters[0]);for(let i=0;i<3;i++){const n=i/2;api.poseViewmodel(vm,{...state,fire:n,reload:n,cycle:n,heat:n,charge:n,paintLevel:n,moveSpeed:n,strafe:n,aimPitch:n,time:.7});assert.equal(hash(vm),baseline.viewmodels[id][i],id+' base VM byte-identical');}
 }
 const rows=[],duplicates=[];let seeds=0,rng=0x9a7fc231;const started=performance.now();
 for(const id of api.weaponIds){const stats=api.SKIN_RARITIES.map(rarity=>({weapon:id,rarity,seeds:0,baseTriangles:base[id].triangles,baseCalls:base[id].meshes,nearTriangles:0,farTriangles:0,nearCalls:0,farCalls:0,maxSizeRatio:0})),looks=new Map();
  for(let i=0;i<1000;i++){rng=(Math.imul(rng,1664525)+1013904223)>>>0;const rarity=api.SKIN_RARITIES[i%6],traits=api.generateSkinTraits({weapon:id,rarity,seed:rng}),json=JSON.stringify(traits);
   assert.equal(json,JSON.stringify(api.generateSkinTraits({weapon:id,rarity,seed:rng})));assert(Object.isFrozen(traits)&&Object.isFrozen(traits.body));
   const fingerprint=api.skinVisualKey(traits);if(looks.has(fingerprint))duplicates.push({weapon:id,rarity,first:looks.get(fingerprint),second:rng});looks.set(fingerprint,rng);
   assert(traits.detail.id&&traits.detail.density>=100,'Common already has a full detail kit');assert.equal(traits.glow!=='None',i%6>=3,'Epic+ glow');
   assert.equal(traits.silhouette.id,api.RARITY_STYLES[rarity].id);assert.equal(reserved.get(api.CANDY_PALETTES.findIndex(p=>p.id===traits.colourSet.id)),rarity,'Tier-exclusive palette');
   assert.equal(traits.finish==='Foil gold',rarity==='legendary');assert.equal(traits.finish==='Prismatic candy',rarity==='mythic');if(i%6<2)assert.equal(traits.finish,'Flat candy');
   const w=api.createWeapon(id,{skin:traits}),far=api.createWeapon(id,{skin:traits,lod:'far'}),count=counts(w),f=counts(far),row=stats[i%6];
   assert(count.triangles<=base[id].triangles*3,id+'/'+rarity+' near triangle budget');assert(count.meshes<=base[id].meshes+1,id+'/'+rarity+' near draws');assert(f.triangles<=base[id].triangles,'Far <= base triangles');assert.equal(f.meshes,1,'Far one draw');
   row.maxSizeRatio=Math.max(row.maxSizeRatio,sizeRatio(w,base[id].bounds,id+'/'+rarity));sizeRatio(far,base[id].bounds,id+' far');
   w.traverse(o=>{if(o.isMesh)for(const a of Object.values(o.geometry.attributes))for(const n of a.array)assert(Number.isFinite(n),'Finite skin buffers');});
   const metadata=api.skinMetadata(traits,'42');assert(!Object.hasOwn(metadata,'image'));assert(metadata.name&&metadata.description&&metadata.attributes.every(a=>typeof a.trait_type==='string'&&Object.hasOwn(a,'value')));
   if(i<6){for(const [model,lod]of[[w,'near'],[far,'far']]){const copy=api.createWeapon(id,{skin:JSON.parse(json),lod}),am=[],bm=[];model.traverse(o=>{if(o.isMesh)am.push(o)});copy.traverse(o=>{if(o.isMesh)bm.push(o)});assert(am.every((m,k)=>m.geometry===bm[k].geometry&&m.material===bm[k].material),'Equal skins share all geometry/materials');}}
   row.seeds++;row.nearTriangles=Math.max(row.nearTriangles,count.triangles);row.nearCalls=Math.max(row.nearCalls,count.meshes);row.farTriangles=Math.max(row.farTriangles,f.triangles);row.farCalls=Math.max(row.farCalls,f.meshes);seeds++;
   if(i%25===24)api.disposeWeaponResources();
  }rows.push(...stats);console.log('SKIN SEEDS',id,1000);
 }
 let vmCases=0,worldCases=0,farPoseCases=0;
 for(const id of api.weaponIds)for(const rarity of api.SKIN_RARITIES){
  const kitSeeds=[],families=new Set();for(let seed=0;seed<128&&families.size<5;seed++){const t=api.generateSkinTraits({weapon:id,rarity,seed});if(!families.has(t.detail.family)){families.add(t.detail.family);kitSeeds.push(seed);}}assert.equal(families.size,5,'All five detail families covered');
  for(const seed of kitSeeds){const t=api.generateSkinTraits({weapon:id,rarity,seed}),baseW=api.createWeapon(id),skin=api.createWeapon(id,{skin:t}),far=api.createWeapon(id,{skin:t,lod:'far'});
  for(const value of[0,.5,1]){const s={...state,fire:value,reload:value,cycle:value,heat:value,charge:value,paintLevel:value,time:.7};api.poseWeapon(baseW,s);api.poseWeapon(skin,s);api.poseWeapon(far,s);assert.deepEqual(snapshot(skin),snapshot(baseW),'World part/socket transforms unchanged');assert.deepEqual(joints(far),joints(baseW),'Far part/socket transforms unchanged');const bounds=new Box3().setFromObject(baseW,true),nearSize=sizeRatio(skin,bounds,'Animated '+id+'/'+rarity+'/'+value),farSize=sizeRatio(far,bounds,'Animated far '+id+'/'+rarity+'/'+value),row=rows.find(r=>r.weapon===id&&r.rarity===rarity);row.maxSizeRatio=Math.max(row.maxSizeRatio,nearSize,farSize);worldCases++;farPoseCases++;}
  for(const side of['right','left']){const a=api.createViewmodel(id,ca.characters[0],{holdSide:side}),b=api.createViewmodel(id,ca.characters[0],{holdSide:side,skin:t});
   const reference=counts(a.userData.weapon);assert(counts(b.userData.weapon).triangles<=reference.triangles*3,'VM triangle budget');assert(counts(b.userData.weapon).meshes<=reference.meshes+1,'VM draw budget');
   for(const value of[0,.5,1]){const s={...state,fire:value,reload:value,cycle:value,heat:value,charge:value,paintLevel:value,time:.7,ads:value};api.poseViewmodel(a,s);api.poseViewmodel(b,s);assert.deepEqual(snapshot(b),snapshot(a),'VM hands/grips and animation unchanged');vmCases++;}
  }
  }
 }
 const traits=api.generateSkinTraits({weapon:'rifle',rarity:'mythic',seed:78}),a=api.createWeapon('rifle',{skin:traits}),b=api.createWeapon('rifle',{skin:traits});api.poseWeapon(b,state);
 const before=b.userData.skinGain,geometry=hash(b);api.poseWeapon(a,{...state,fire:1,time:1});assert.equal(b.userData.skinGain,before);assert.equal(hash(b),geometry,'No shared state between skin instances');
 assert.throws(()=>api.createWeapon('knife',{skin:traits}),/mismatch/);assert.throws(()=>api.createWeapon('rifle',{skin:{...traits,seed:7}}),/Invalid/);
 const old=a.getObjectByName('body').geometry;let disposed=0;old.addEventListener('dispose',()=>disposed++);api.disposeWeaponResources();assert.equal(disposed,1);assert.notEqual(api.createWeapon('rifle',{skin:traits}).getObjectByName('body').geometry,old);
 for(const [file,fn]of[['skinGeometry.ts','poseSkin'],['skinRig.ts','poseSkinRigs']]){const src=ts.createSourceFile(file,await readFile(new URL('./'+file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);for(const node of src.statements)if(ts.isFunctionDeclaration(node)&&node.name?.text===fn){const scan=n=>{assert(!ts.isNewExpression(n)&&!ts.isArrayLiteralExpression(n)&&!ts.isObjectLiteralExpression(n)&&!ts.isArrowFunction(n),'Allocation in '+fn);ts.forEachChild(n,scan);};scan(node.body);}}
 const report={pass:true,seeds,worldCases,farPoseCases,vmCases,independentProcessBytes:true,generatorHasNoThree:true,baseByteIdentical:true,maxAllowed:{nearTriangleMultiple:3,nearExtraCalls:1,sizeMultiple:1.15,farTriangleMultiple:1},visualCollisions:duplicates,elapsedMs:performance.now()-started,rows};
 await writeFile(new URL('./skin-review/results.json',import.meta.url),JSON.stringify(report,null,2));console.table(rows);console.log('SKINS PASS',seeds,'seeds,',worldCases,'world /',vmCases,'VM, appearance collisions:',duplicates.length);
 api.disposeWeaponResources();ca.disposeCharacterResources();
}finally{await server.close();}
