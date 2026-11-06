import {Box3,BoxGeometry,BufferAttribute,Color,Matrix4,Mesh,Raycaster,Vector3,type BufferGeometry,type Group} from 'three';
import {mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import {materials}from'./resources';
import {skinHash,skinVisualKey,validateSkinTraits,type SkinTraits}from'./skinTraits';
import {KIT_PARTS,type DetailPiece}from'./skinParts';
import {RARITY_STYLES}from'./skinRarity';
import {crownGeometry,simplifyFarBoxes,type CrownAnchor}from'./skinCrown';
import {bindFarSkin,bindSkinGlow,disposeSkinRigs,poseSkinRigs,type GlowPiece}from'./skinRig';
import type{WeaponPalette,WeaponRuntime,WeaponState}from'./types';
interface Face{mesh:Mesh;offset:number;area:number}
interface Bundle{geometry:BufferGeometry;glow?:BufferGeometry}
let cache=new WeakMap<BufferGeometry,Map<string,Bundle>>();let farGlowCache=new WeakMap<BufferGeometry,BufferGeometry>();const owned=new Set<BufferGeometry>(),plans=new Map<string,readonly{mesh:number;offset:number}[]>();
const colourKey=(r:number,g:number,b:number)=>[Math.fround(r),Math.fround(g),Math.fround(b)].join(',');
function paletteFor(base:WeaponPalette,t:SkinTraits):WeaponPalette{return{...base,steel:t.body.color,top:t.body.top,accent:t.accent.color,accentTop:t.accent.top};}
function candidateFaces(mesh:Mesh,outline:Color):Face[]{
  const g=mesh.geometry,index=g.index!,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,result:Face[]=[];
  if(!index||p.count%144!==0||index.count%216!==0)return result;
  const expected=[-1,5,4,1,0,2]; // The six boxes emitted by Boxes.outlined; outer coloured faces only.
  for(let offset=0;offset<index.count;offset+=6){const cube=Math.floor(offset/36),face=(offset/6)%6;
    if(expected[cube%6]!==face)continue;const a=index.getX(offset),b=index.getX(offset+2),d=index.getX(offset+1);
    if(g.attributes.skinIndex&&g.attributes.skinIndex.getX(a)!==0)continue;
    if(Math.abs(c.getX(a)-outline.r)+Math.abs(c.getY(a)-outline.g)+Math.abs(c.getZ(a)-outline.b)<1e-6)continue;
    const ax=p.getX(b)-p.getX(a),ay=p.getY(b)-p.getY(a),az=p.getZ(b)-p.getZ(a),bx=p.getX(d)-p.getX(a),by=p.getY(d)-p.getY(a),bz=p.getZ(d)-p.getZ(a);
    const area=Math.sqrt((ay*bz-az*by)**2+(az*bx-ax*bz)**2+(ax*by-ay*bx)**2);
    if(area>.0003)result.push({mesh,offset,area:area*(Math.abs(n.getX(a))>.6?1.7:Math.abs(n.getY(a))>.6?.7:.9)});
  }return result;
}
/** Construction-only visibility plan, shared by every skin on this base model. Avoids painting buried caps. */
function exposedPlan(group:Group,meshes:Mesh[],base:WeaponPalette):Face[]{
  const key=meshes.map(m=>m.geometry.uuid).join('|'),hit=plans.get(key);if(hit)return hit.map(p=>({mesh:meshes[p.mesh],offset:p.offset,area:0}));
  group.updateMatrixWorld(true);const opaque:Mesh[]=[];group.traverseVisible(o=>{if(o instanceof Mesh&&!o.name.startsWith('lens-'))opaque.push(o);});
  const all=meshes.flatMap(m=>candidateFaces(m,new Color(base.outline))).sort((a,b)=>b.area-a.area),candidatePoint=new Vector3();
  const roofY=(f:Face)=>candidatePoint.fromBufferAttribute(f.mesh.geometry.attributes.position,f.mesh.geometry.index!.getX(f.offset)).applyMatrix4(f.mesh.matrixWorld).y;
  const roofs=all.filter(f=>f.mesh.geometry.attributes.normal.getY(f.mesh.geometry.index!.getX(f.offset))>.6).sort((a,b)=>roofY(b)-roofY(a)).slice(0,8);
  const candidates=[...new Set([...all.slice(0,48),...roofs])];
  const ray=new Raycaster(),normal=new Vector3(),point=new Vector3(),a=new Vector3(),u=new Vector3(),v=new Vector3(),origin=new Vector3();
  const visible:{face:Face;nx:number;ny:number;y:number}[]=[],hits:import('three').Intersection[]=[];
  for(const face of candidates){const g=face.mesh.geometry,idx=g.index!,p=g.attributes.position,first=idx.getX(face.offset);
    a.fromBufferAttribute(p,first);u.fromBufferAttribute(p,idx.getX(face.offset+2)).sub(a);v.fromBufferAttribute(p,idx.getX(face.offset+1)).sub(a);
    normal.fromBufferAttribute(g.attributes.normal,first).transformDirection(face.mesh.matrixWorld);let clear=0;
    for(const [x,y]of[[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]]){point.copy(a).addScaledVector(u,x).addScaledVector(v,y).applyMatrix4(face.mesh.matrixWorld);
      origin.copy(point).addScaledVector(normal,10);ray.set(origin,normal.clone().negate());ray.near=0;ray.far=10.00001;hits.length=0;ray.intersectObjects(opaque,false,hits);
      if(!hits.length||hits[0].distance>=9.99999)clear++;
    }
    if(clear)visible.push({face:{...face,area:face.area*clear/5},nx:normal.x,ny:normal.y,y:point.y});
  }
  visible.sort((a,b)=>b.face.area-a.face.area);const chosen:Face[]=[];
  for(const sign of[1,-1]){const best=visible.find(v=>v.nx*sign>.6);if(best)chosen.push(best.face);}
  for(const item of visible)if(chosen.length<2&&!chosen.includes(item.face))chosen.push(item.face);
  if(chosen.length<2)for(const item of candidates)if(chosen.length<2&&!chosen.some(c=>c.mesh===item.mesh&&c.offset===item.offset))chosen.push(item);
  const roof=visible.filter(v=>v.ny>.6&&!chosen.includes(v.face)).sort((a,b)=>b.y-a.y||b.face.area-a.face.area)[0];if(roof)chosen.push(roof.face);
  plans.set(key,chosen.map(f=>({mesh:meshes.indexOf(f.mesh),offset:f.offset})));return chosen;
}

function pixel(t:SkinTraits,u:number,v:number,face:number):string{
 if(t.rarity==='common')return t.body.color;
 if(t.rarity==='uncommon')return u===0?t.accent.color:t.body.color;
 const h=skinHash(t.pattern.variant^Math.imul(u+1,0x45d9f3b)^Math.imul(v+1,0x119de1f3)^face);let ink=false;
 if(t.pattern.id==='stripes')ink=(u+v+t.pattern.variant)%3===0;
 else if(t.pattern.id==='checks')ink=((u+v+t.pattern.variant)&1)===0;
 else if(t.pattern.id==='camo')ink=skinHash(t.pattern.variant^Math.imul((u>>1)+3,631)^Math.imul((v>>1)+7,977))%3===0;
 else if(t.pattern.id==='pixels')ink=h%3===0;
 else if(t.pattern.id==='bricks')ink=v%2===0?u%3===0:(u+1)%3===0;
 else ink=(u===t.pattern.variant%4||v===t.pattern.variant%3)&&h%5!==0;
 if(h%100>=RARITY_STYLES[t.rarity].pattern*100)return t.body.color;
 return ink?t.pattern.ink:h%4===0?t.accent.color:t.finish==='Sugar frost'&&h%5===0?t.body.top:t.body.color;
}
function tintGeometry(g:BufferGeometry,t:SkinTraits,role:string,part:number):void{
 const n=g.attributes.position.count,colors=new Float32Array(n*3),uv=g.attributes.uv;
 for(let i=0;i<n;i+=6){let u=0,v=0;for(let k=0;k<6;k++){u+=uv.getX(i+k);v+=uv.getY(i+k);}const cellU=Math.floor(u/6*2),cellV=Math.floor(v/6*2);
  const hex=role==='ink'?t.colourSet.ink:role==='glow'?(t.glow==='None'?t.accent.color:t.colourSet.glow):role==='top'?t.body.top:role==='accent'?t.accent.color:pixel(t,cellU+part%5,cellV+(part/5|0),part);
  const c=new Color(hex);for(let k=0;k<6;k++){colors[(i+k)*3]=c.r;colors[(i+k)*3+1]=c.g;colors[(i+k)*3+2]=c.b;}}
 g.setAttribute('color',new BufferAttribute(colors,3));g.setIndex(Array.from({length:n},(_,i)=>i));
}
function build(mesh:Mesh,t:SkinTraits,base:WeaponPalette,faces:readonly number[],counts:readonly number[],topFaces:readonly number[],vm:boolean,sidePad:number,topPad:number,far:boolean,crown?:CrownAnchor):Bundle{
 const source=mesh.geometry,key=JSON.stringify({appearance:skinVisualKey(t),faces,counts,topFaces,vm,sidePad,topPad,far,crown});let bucket=cache.get(source);if(!bucket){bucket=new Map();cache.set(source,bucket);}const hit=bucket.get(key);if(hit)return hit;
 const g=source.clone(),palette=paletteFor(base,t),replacement=new Map<string,Color>();for(const name of['steel','top','accent','accentTop']as const){const c=new Color(base[name]);replacement.set(colourKey(c.r,c.g,c.b),new Color(palette[name]));}
 const col=g.attributes.color,original=source.attributes.color,outline=new Color(base.outline);for(let i=0;i<col.count;i++){const c=replacement.get(colourKey(col.getX(i),col.getY(i),col.getZ(i)));if(c)col.setXYZ(i,c.r,c.g,c.b);}
 if(far){const emission=new Float32Array(col.count),idx=g.index!,accentKeys=new Set([base.accent,base.accentTop].map(hex=>{const c=new Color(hex);return colourKey(c.r,c.g,c.b);}));for(let q=0;q<idx.count;q+=6){const a=idx.getX(q);if(Math.abs(original.getX(a)-outline.r)+Math.abs(original.getY(a)-outline.g)+Math.abs(original.getZ(a)-outline.b)<1e-6)continue;
   const cube=Math.floor(q/36),face=Math.floor(q/6)%6,trim=accentKeys.has(colourKey(original.getX(a),original.getY(a),original.getZ(a)))||source.attributes.normal.getY(a)>.6;
   const c=trim?new Color(col.getX(a),col.getY(a),col.getZ(a)):new Color(pixel(t,cube%7,face,cube)),lit=t.glow!=='None'&&!trim&&((cube+t.detail.variant)%9===0);if(lit)c.set(t.rarity==='legendary'?t.accent.color:t.colourSet.glow);
   for(let k=0;k<6;k++){const v=idx.getX(q+k);col.setXYZ(v,c.r,c.g,c.b);if(lit)emission[v]=.75;}}
  g.setAttribute('skinEmission',new BufferAttribute(emission,1));simplifyFarBoxes(g);
  let geometry=g;if(crown){const c=crownGeometry(t,crown,true),parts=[g,...Object.values(c)];if(parts.length>1){geometry=mergeGeometries(parts,false)!;for(const part of parts)part.dispose();}}
  geometry.computeBoundingBox();geometry.computeBoundingSphere();owned.add(geometry);const result={geometry};bucket.set(key,result);return result;
 }
 const arrays:Record<string,number[]>={};for(const[name,attr]of Object.entries(g.attributes))arrays[name]=Array.from(attr.array);const index:number[]=[],old=source.index!,selected=new Set(faces),glows:BufferGeometry[]=[];
 const appendVertex=(vertices:readonly number[],weights:readonly number[],tint:Color,inset:number):number=>{const id=arrays.position.length/3;for(const[name,attr]of Object.entries(source.attributes))for(let k=0;k<attr.itemSize;k++){let value=0;for(let j=0;j<4;j++)value+=attr.array[vertices[j]*attr.itemSize+k]*weights[j];if(name==='color')value=k===0?tint.r:k===1?tint.g:tint.b;if(name==='position')value-=source.attributes.normal.array[vertices[0]*3+k]*inset;arrays[name].push(value);}return id;};
 const appendBox=(box:BufferGeometry,reference:number)=>{const start=arrays.position.length/3;for(let i=0;i<box.attributes.position.count;i++)for(const[name,attr]of Object.entries(source.attributes))for(let k=0;k<attr.itemSize;k++)arrays[name].push(box.attributes[name]?.array[i*attr.itemSize+k]??attr.array[reference*attr.itemSize+k]);for(const v of box.index!.array)index.push(start+v);};
 for(let offset=0;offset<old.count;offset+=6){if(!selected.has(offset)){for(let k=0;k<6;k++)index.push(old.getX(offset+k));continue;}
  const corners=[old.getX(offset),old.getX(offset+2),old.getX(offset+1),old.getX(offset+4)],cols=t.pattern.columns,rows=t.pattern.rows;
  for(let v=0;v<rows;v++)for(let u=0;u<cols;u++){const tint=new Color(pixel(t,u,v,offset)),ids=[];for(const[x,y]of[[u/cols,v/rows],[(u+1)/cols,v/rows],[u/cols,(v+1)/rows],[(u+1)/cols,(v+1)/rows]])ids.push(appendVertex(corners,[(1-x)*(1-y),x*(1-y),(1-x)*y,x*y],tint,vm?.0008:0));index.push(ids[0],ids[2],ids[1],ids[2],ids[3],ids[1]);}
  const a=new Vector3().fromBufferAttribute(source.attributes.position,corners[0]),u=new Vector3().fromBufferAttribute(source.attributes.position,corners[1]).sub(a),v=new Vector3().fromBufferAttribute(source.attributes.position,corners[2]).sub(a),normal=new Vector3().fromBufferAttribute(source.attributes.normal,corners[0]);
  const width=u.length(),height=v.length(),axisU=u.clone().normalize(),axisV=v.clone().normalize().negate(),basis=new Matrix4().makeBasis(axisU,axisV,normal);
  const ornament=topFaces.includes(offset),style=RARITY_STYLES[t.rarity],pad=ornament?topPad:sidePad;
  const pieces:readonly DetailPiece[]=ornament?style.crown.map(p=>({u:p.x/1.2,v:p.z,w:p.w/1.2,h:p.d,layer:Math.round(p.y*4),role:p.role})):KIT_PARTS[t.detail.family],count=counts[faces.indexOf(offset)];
  if(ornament&&!vm)continue;
  for(let i=0;i<count;i++){
   let part:DetailPiece;if(i<pieces.length)part=pieces[i];else{const j=i-pieces.length,slots=Math.max(2,Math.ceil((count-pieces.length)/2));part={u:-.4+.8*(j%slots)/(slots-1),v:j<slots?-.38:.38,w:.07,h:.08,layer:4,role:j%3?'accent':'top'};}
   const angle=(part.angle??0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));let pw=width*part.w,ph=height*part.h;const fit=Math.min(1,width*.98/(pw*c+ph*s),height*.98/(pw*s+ph*c));pw*=fit;ph*=fit;
   const extentU=(pw*c+ph*s)/2,extentV=(pw*s+ph*c)/2,cu=Math.max(extentU/width,Math.min(1-extentU/width,.5+part.u)),cv=Math.max(extentV/height,Math.min(1-extentV/height,.5-part.v));
   const front=vm?-.00061+part.layer*.00013:pad*(.16+part.layer*.18)*style.relief,depth=vm?.00010:pad*.12*style.relief;
   const at=a.clone().addScaledVector(u,cu).addScaledVector(v,cv).addScaledVector(normal,front-depth/2),matrix=basis.clone().multiply(new Matrix4().makeRotationZ(angle));matrix.setPosition(at);
   const outer=new BoxGeometry(pw,ph,depth).toNonIndexed();tintGeometry(outer,t,'ink',i);outer.applyMatrix4(matrix);appendBox(outer,corners[0]);outer.dispose();
   const lit=t.glow!=='None'&&(part.role==='glow'||i===count-1),panel=new BoxGeometry(pw*.82,ph*.76,vm?.00002:depth*.16,2,2,1).toNonIndexed();tintGeometry(panel,t,lit?'glow':part.role,i);
   matrix.setPosition(a.clone().addScaledVector(u,cu).addScaledVector(v,cv).addScaledVector(normal,front+(vm?.000025:depth*.13)));panel.applyMatrix4(matrix);
   if(lit)glows.push(panel);else{appendBox(panel,corners[0]);panel.dispose();}
  }
 }
 if(crown&&!vm){const c=crownGeometry(t,crown,false);if(c.solid){appendBox(c.solid,0);c.solid.dispose();}if(c.glow)glows.push(c.glow);}
 for(const[name,attr]of Object.entries(source.attributes)){const Constructor=attr.array.constructor as typeof Float32Array;g.setAttribute(name,new BufferAttribute(new Constructor(arrays[name]),attr.itemSize,attr.normalized));}g.setIndex(index);g.computeBoundingBox();g.computeBoundingSphere();g.name=source.name+'-candy-skin';owned.add(g);
 let glow:BufferGeometry|undefined;if(glows.length){glow=mergeGeometries(glows,false)!;for(const p of glows)p.dispose();owned.add(glow);}
 const result={geometry:g,glow};bucket.set(key,result);return result;
}
function farGlow(source:BufferGeometry):BufferGeometry{const hit=farGlowCache.get(source);if(hit)return hit;const g=source.clone();g.setAttribute('skinEmission',new BufferAttribute(new Float32Array(g.attributes.position.count).fill(1),1));owned.add(g);farGlowCache.set(source,g);return g;}
export function applyWeaponSkin(group:Group,input:SkinTraits,options:{viewmodel?:boolean;lod?:'near'|'far'}={}):Group{
 const d=group.userData as WeaponRuntime,t=validateSkinTraits(input,d.weaponId),base=d.palette,meshes:Mesh[]=[];group.traverse(o=>{if(o instanceof Mesh&&!o.name.startsWith('lens-')&&o.material===materials()[0])meshes.push(o);});
 const far=options.lod==='far'&&!options.viewmodel,chosen=exposedPlan(group,meshes,base);let triangles=0;
 if(!far&&chosen.length<2)throw new Error('Candy detail kit needs two exposed box faces: '+d.weaponId);
 group.traverse(o=>{if(o instanceof Mesh)triangles+=o.geometry.index!.count/3;});
 // Pad is a fraction of the smallest existing axis, never a gameplay size or a hand offset.
 let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
 for(const m of meshes){m.geometry.computeBoundingBox();const b=m.geometry.boundingBox!;minX=Math.min(minX,b.min.x);minY=Math.min(minY,b.min.y);minZ=Math.min(minZ,b.min.z);maxX=Math.max(maxX,b.max.x);maxY=Math.max(maxY,b.max.y);maxZ=Math.max(maxZ,b.max.z);}
 const style=RARITY_STYLES[t.rarity],roof=chosen[2];if(!roof)throw new Error('Missing rarity roof anchor: '+d.weaponId);const crownMesh=meshes.find(m=>m.name==='body')??roof.mesh;
 const bounds=new Box3().setFromObject(group),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3()),roofGeometry=roof.mesh.geometry,roofPosition=roofGeometry.attributes.position,roofIndices=roofGeometry.index!;
 const roofCenter=new Vector3();for(let k=0;k<6;k++)roofCenter.add(new Vector3().fromBufferAttribute(roofPosition,roofIndices.getX(roof.offset+k)).applyMatrix4(roof.mesh.matrixWorld));roofCenter.multiplyScalar(1/6);
 const crownDepth=Math.min(size.x*.65,size.z*.8),crown:CrownAnchor={w:Math.max(.01,size.x*(d.weaponId==='pistol'?.80:.94)-.004),h:size.y*.12,d:crownDepth,x:center.x,y:bounds.max.y-.0005,z:Math.max(bounds.min.z+crownDepth/2,Math.min(bounds.max.z-crownDepth/2,roofCenter.z)),local:new Matrix4().copy(crownMesh.matrixWorld).invert().elements.slice()};
 const pad=Math.min(maxX-minX,maxY-minY,maxZ-minZ)*.07,topPad=(maxY-minY)*.10,total=Math.ceil(triangles/72*t.detail.density/100),sides=total-style.crown.length,perFace=chosen.map((_,i)=>i===2?style.crown.length:Math.floor(sides/2)+(i<sides%2?1:0)),pieces:GlowPiece[]=[];
 for(const mesh of meshes){const faces=chosen.filter(f=>f.mesh===mesh).map(f=>f.offset),topFaces=chosen.filter((f,i)=>i===2&&f.mesh===mesh).map(f=>f.offset),counts=chosen.map((f,i)=>f.mesh===mesh?perFace[i]:-1).filter(n=>n>=0),result=build(mesh,t,base,faces,counts,topFaces,!!options.viewmodel,pad,topPad,far,crownMesh===mesh?crown:undefined);mesh.geometry=result.geometry;if(result.glow)pieces.push({geometry:result.glow,source:mesh});}
 d.skin=t;d.palette=paletteFor(base,t);
 if(far){const all:GlowPiece[]=[];group.traverse(o=>{if(o instanceof Mesh){if(o.name.startsWith('lens-')){o.visible=false;return;}if(o.material===materials()[1]){o.geometry=farGlow(o.geometry);}all.push({geometry:o.geometry,source:o});}});bindFarSkin(group,all,d);}
 else bindSkinGlow(group,pieces,d);
 poseSkinRigs(d);return group;
}
export function poseSkin(d:WeaponRuntime,state:WeaponState):void{
 if(!d.skin)return;poseSkinRigs(d);if(d.skin.glow!=='Reactive candy light')return;
 const time=Number.isFinite(state.time)?state.time!:0,p=((time%2)+2)%2,triangle=p<1?p:2-p;
 const fire=Number.isFinite(state.fire)?Math.max(0,Math.min(1,state.fire)):0,heat=Number.isFinite(state.heat)?Math.max(0,Math.min(1,state.heat!)):0,charge=Number.isFinite(state.charge)?Math.max(0,Math.min(1,state.charge!)):0;
 d.skinGain=.32+.68*Math.max(triangle,fire,heat,charge);
}
export function disposeSkinResources():void{disposeSkinRigs();for(const g of owned)g.dispose();owned.clear();plans.clear();cache=new WeakMap();farGlowCache=new WeakMap();}
