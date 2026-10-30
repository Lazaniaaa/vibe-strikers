import { BufferAttribute, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Boxes } from '../characters/boxGeometry';
import type { WeaponBox, WeaponPalette } from './types';

let lambert: MeshLambertMaterial | null = null;
let basic: MeshBasicMaterial | null = null;
let glass: MeshBasicMaterial | null = null;
const geometries = new Map<string, BufferGeometry>();
/** One pair for all weapons AND all first-person arms; never called in a pose. */
export function materials(): readonly [MeshLambertMaterial, MeshBasicMaterial] {
  if (!lambert) {
    lambert = new MeshLambertMaterial({ vertexColors: true }); lambert.name = 'weapons-shared-lambert';
    basic = new MeshBasicMaterial({ vertexColors: true }); basic.name = 'weapons-shared-glow';
  }
  return [lambert, basic!];
}
/** The sole additional material, shared by every lens and skin. */
export function lensMaterial():MeshBasicMaterial{
  if(!glass){glass=new MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.35,depthWrite:false,toneMapped:false});glass.name='weapons-shared-lens';}
  return glass;
}
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const record = v as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter(k=>record[k]!==undefined).map(k=>`${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
}
/** All faces built by the unchanged character Boxes.outlined treatment. */
export function mergedBoxes(boxes: readonly WeaponBox[], palette: WeaponPalette, name: string): BufferGeometry {
  const key = canonical({boxes,palette});
  const hit = geometries.get(key); if (hit) return hit;
  const pieces: BufferGeometry[] = [];
  for (const box of boxes) {
    const builder = new Boxes();
    // Tiny details retain a proportionate thin outline, rather than becoming solid black.
    const border = Math.min(.009, Math.min(...box.size) * .18);
    builder.outlined(box.size,[0,0,0],palette[box.color],palette.outline,palette[box.top ?? box.color],border,palette[box.side ?? box.color]);
    const g = builder.finish('box');
    if (box.rotate) {
      const [axis, angle] = box.rotate;
      if (axis==='x') g.rotateX(angle); else if (axis==='y') g.rotateY(angle); else g.rotateZ(angle);
    }
    g.translate(...box.position); pieces.push(g);
  }
  const result = mergeGeometries(pieces,false);
  if (!result) throw new Error('Cannot merge weapon boxes');
  for (const g of pieces) g.dispose();
  result.name = name;
  result.userData = { source:'BoxGeometry/Boxes.outlined', boxes:boxes.length, boxAxes:boxes.map(b=>b.rotate?.[0] ?? null) };
  result.computeBoundingBox(); result.computeBoundingSphere(); geometries.set(key,result); return result;
}
export function mergedPanes(boxes:readonly WeaponBox[],palette:WeaponPalette,name:string):BufferGeometry{
  const key=canonical({kind:'lens',boxes,palette});const hit=geometries.get(key);if(hit)return hit;
  const builder=new Boxes();
  for(const box of boxes)builder.add(box.size,box.position,palette[box.color],palette[box.top??box.color]);
  const geometry=builder.finish(name);geometry.userData={source:'BoxGeometry/lens panes',boxes:boxes.length};geometries.set(key,geometry);return geometry;
}
/** Construction-time rigid skin: mechanism pivots still animate, in one draw call. */
export function mergedRigidBoxes(pieces:readonly {boxes:readonly WeaponBox[];position:readonly [number,number,number];bone:number}[],palette:WeaponPalette):BufferGeometry{
  const key=canonical({kind:'sniper-viewmodel-rigid',pieces,palette}),hit=geometries.get(key);if(hit)return hit;
  const geometriesToMerge=pieces.map(piece=>{
    const g=mergedBoxes(piece.boxes,palette,'sniper-rigid-source').clone();g.translate(...piece.position);
    const n=g.attributes.position.count,indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
    for(let i=0;i<n;i++){indices[i*4]=piece.bone;weights[i*4]=1;}
    g.setAttribute('skinIndex',new BufferAttribute(indices,4));g.setAttribute('skinWeight',new BufferAttribute(weights,4));return g;
  });
  const geometry=mergeGeometries(geometriesToMerge,false);if(!geometry)throw new Error('Cannot merge sniper rigid geometry');
  for(const g of geometriesToMerge)g.dispose();
  geometry.name='sniper-viewmodel-scopeBody';geometry.userData={source:'BoxGeometry/Boxes.outlined',rigid:true};
  geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.set(key,geometry);return geometry;
}
export function disposeSharedResources(): void {
  for (const geometry of geometries.values()) geometry.dispose();
  geometries.clear(); lambert?.dispose(); basic?.dispose(); glass?.dispose(); lambert=null; basic=null;glass=null;
}
