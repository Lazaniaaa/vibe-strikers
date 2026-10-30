import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

export async function verifyScope(api,module,characters){
 const grid=module.scopeOverlayGrid,cells=new Map(grid.cells.map(c=>[`${c.x},${c.y}`,c.layer]));
 assert.equal(grid.size,48);assert.equal(grid.diameter,.9);
 for(let y=0;y<48;y++)for(let x=0;x<48;x++){
  assert.equal(cells.has(`${x},${y}`),Math.hypot(x+.5-24,y+.5-24)<=24,'Every cell centre inside the radius, no extras');
  assert.equal(cells.get(`${x},${y}`),cells.get(`${47-x},${y}`),'Horizontal symmetry, including both rings');
  assert.equal(cells.get(`${x},${y}`),cells.get(`${x},${47-y}`),'Vertical symmetry, including both rings');
 }
 const markup=api.scopeOverlaySvg();assert.equal(markup,api.scopeOverlaySvg());
 assert.ok(markup.includes('preserveAspectRatio="xMidYMid slice"'));assert.ok(markup.includes('pointer-events:none'));
 assert.ok(markup.includes(api.weapons.find(w=>w.id==='sniper').palette.accent));
 assert.doesNotMatch(markup,/gradient|filter=|blur|<image|<script/i);
 const holePath=markup.match(/fill-rule="evenodd" d="([^"]+)"/)[1],svgCells=new Set();
 const rectangles=[...holePath.matchAll(/M(-?[\d.]+) (-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)h(-?[\d.]+)Z/g)];
 assert.equal(rectangles.length,49,'One outer mask rectangle and 48 actual stepped rows');
 for(const rectangle of rectangles.slice(1)){
  const x=Number(rectangle[1])+24,y=Number(rectangle[2])+24,w=Number(rectangle[3]);assert.equal(Number(rectangle[4]),1);
  for(let i=0;i<w;i++)svgCells.add(`${x+i},${y}`);
 }
 assert.deepEqual(svgCells,new Set(cells.keys()),'Actual SVG window is exactly the verified radial cell set');
 assert.ok(markup.includes('M-24 0H-.6M.6 0H24M0 -24V-.6M0 .6V24'),'Both crosshair axes intersect at (0,0), with a symmetric centre gap');
 const box=markup.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);const viewports=[];
 for(const [width,height]of [[1280,720],[1920,1080],[390,844],[600,338]]){
  const scale=Math.max(width/box[2],height/box[3]),diameter=48*scale;
  assert.ok(Math.abs(diameter/height-.9)<1e-12,'Window diameter = 90% viewport height, including portrait');
  assert.equal(box[0]+box[2]/2,0);assert.equal(box[1]+box[3]/2,0);viewports.push({width,height,diameter});
 }
 for(const ads of [-1,0,.5,.69,.7])assert.equal(api.scopeOverlayOpacity(ads),0);assert.equal(api.scopeOverlayOpacity(1),1);
 let previous=0;for(let i=0;i<=100;i++){const opacity=api.scopeOverlayOpacity(i/100);assert.ok(opacity>=previous&&opacity>=0&&opacity<=1);previous=opacity;}
 for(const value of [NaN,Infinity,-Infinity])assert.ok(Number.isFinite(api.scopeOverlayOpacity(value)));
 const expected={pistol:60,rifle:55,sniper:28,shotgun:62},fovs=[];
 for(const weapon of api.weapons){
  assert.equal(api.fovForAds(weapon.id,0),70);assert.equal(api.adsSensitivityScale(weapon.id,0),1);
  if(weapon.id==='knife'){assert.equal(weapon.adsFov,undefined);assert.equal(api.fovForAds('knife',1),70);continue;}
  assert.equal(weapon.adsFov,expected[weapon.id]);assert.equal(api.fovForAds(weapon.id,1),weapon.adsFov);
  let prior=70;for(let i=0;i<=100;i++){const f=api.fovForAds(weapon.id,i/100);assert.ok(f<=prior&&f>=weapon.adsFov);assert.ok(Math.abs(api.adsSensitivityScale(weapon.id,i/100)-Math.tan(f*Math.PI/360)/Math.tan(70*Math.PI/360))<1e-12);prior=f;}
  fovs.push({weapon:weapon.id,hip:70,ads:weapon.adsFov,sensitivity:api.adsSensitivityScale(weapon.id,1)});
 }
 // A DOM-free server harness observes construction, then 120 style-only updates.
 let elements=0,builds=0;const original=globalThis.document;
 try{
  globalThis.document={createElement(){elements++;return {style:{},setAttribute(){},set innerHTML(value){this.markup=value;builds++;},get innerHTML(){return this.markup;}};}};
  const overlay=api.createScopeOverlay();assert.ok(overlay.style.cssText.includes('visibility:hidden'));
  for(let i=0;i<120;i++){const a=i<60?i/59:(119-i)/59,o=api.scopeOverlayOpacity(a);overlay.style.opacity=String(o);overlay.style.visibility=o?'visible':'hidden';}
  assert.equal(elements,1);assert.equal(builds,1);assert.equal(overlay.innerHTML,markup);
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
 let visibilityChecks=0;
 for(const c of characters)for(const id of api.weaponIds){
  const vm=api.createViewmodel(id,c);
  for(const ads of [0,.7,.8,.899,.9,1,.2]){
   api.poseViewmodel(vm,{ads,fire:1,reload:.5,cycle:.5,equip:1,moveSpeed:1,strafe:.5,grounded:true,crouching:false,aimPitch:0,time:0});
   assert.equal(vm.visible,id!=='sniper'||ads<.9,'Only scoped sniper is hidden, and HIP visibility restores');visibilityChecks++;
  }
 }
 const result={pass:true,cells:cells.size,accentCells:grid.cells.filter(c=>c.layer==='accent').length,bandCells:grid.cells.filter(c=>c.layer==='band').length,domElements:elements,domBuilds:builds,viewports,fovs,visibilityChecks};
 const perfFile=process.argv.find(a=>a.startsWith('--preview-performance='))?.slice('--preview-performance='.length);
 if(perfFile){const perf=JSON.parse(await readFile(perfFile,'utf8'));assert.equal(perf.pass,true);assert.equal(perf.count,120);assert.ok(perf.worstHandlerMs<=8,'Worst ADS input <=8 ms');assert.equal(perf.initialDiagnostics.measurement.requests,perf.afterInputs.measurement.requests);assert.equal(perf.finalDiagnostics.overlayBuilds,1);assert.equal(perf.finalDiagnostics.overlayNodeStable,true);result.performance={pass:true,inputs:120,worstMs:perf.worstHandlerMs,burstMs:perf.burstMs,overlayBuilds:1};}
 await writeFile('work/round9-scope-contract.json',JSON.stringify(result,null,2)+'\n');console.log('PASS SCOPE/FOV',JSON.stringify(result));return result;
}
