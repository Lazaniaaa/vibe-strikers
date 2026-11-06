import { Bone, BufferAttribute, Matrix4, Mesh, ShaderLib, ShaderMaterial, UniformsUtils, Skeleton, SkinnedMesh, type BufferGeometry, type Group, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WeaponRuntime } from './types';
export interface GlowPiece {geometry:BufferGeometry;source:Mesh}
const geometries=new Map<string,BufferGeometry>(),owned=new Set<BufferGeometry>(),skeletons=new Set<Skeleton>();
let glow:ShaderMaterial|undefined,far:ShaderMaterial|undefined;
function glowMaterial():ShaderMaterial{
 if(!glow){glow=new ShaderMaterial({vertexColors:true,toneMapped:false,uniforms:{gain:{value:1}},
  vertexShader:`#include <common>\n#include <skinning_pars_vertex>\nvarying vec3 candyColour;\nvoid main(){candyColour=color;vec3 transformed=position;\n#include <skinbase_vertex>\n#include <skinning_vertex>\ngl_Position=projectionMatrix*modelViewMatrix*vec4(transformed,1.0);}`,
  fragmentShader:`uniform float gain;varying vec3 candyColour;void main(){gl_FragColor=vec4(candyColour*gain,1.0);\n#include <colorspace_fragment>\n}`});glow.name='skin-shared-candy-glow';}return glow;
}
function farMaterial():ShaderMaterial{
 if(!far){far=new ShaderMaterial({vertexColors:true,lights:true,fog:true,uniforms:{...UniformsUtils.clone(ShaderLib.lambert.uniforms),candyGain:{value:1}},
  vertexShader:'attribute float skinEmission;varying float candyEmission;\n'+ShaderLib.lambert.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\ncandyEmission=skinEmission;'),
  fragmentShader:'uniform float candyGain;varying float candyEmission;\n'+ShaderLib.lambert.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb*candyEmission*candyGain;')});far.name='skin-shared-far-lambert';}return far;
}
function rigidGeometry(group:Group,pieces:readonly GlowPiece[],label:string):BufferGeometry{
 group.updateMatrixWorld(true);const inverse=new Matrix4().copy(group.matrixWorld).invert();
 const key=label+'|'+pieces.map(p=>p.geometry.uuid+':'+p.source.matrixWorld.elements.join(',')).join('|'),hit=geometries.get(key);if(hit)return hit;
 const gs=pieces.map((p,i)=>{const g=p.geometry.clone(),m=new Matrix4().multiplyMatrices(inverse,p.source.matrixWorld);g.applyMatrix4(m);
  const indices=new Uint16Array(g.attributes.position.count*4),weights=new Float32Array(indices.length);for(let v=0;v<g.attributes.position.count;v++){indices[v*4]=i;weights[v*4]=1;}g.setAttribute('skinIndex',new BufferAttribute(indices,4));g.setAttribute('skinWeight',new BufferAttribute(weights,4));return g;});
 const result=mergeGeometries(gs,false);if(!result)throw Error('Cannot merge candy rig');for(const g of gs)g.dispose();result.name=label;result.computeBoundingBox();result.computeBoundingSphere();geometries.set(key,result);owned.add(result);return result;
}
export function bindSkinGlow(group:Group,pieces:readonly GlowPiece[],d:WeaponRuntime):void{
 if(!pieces.length)return;const geometry=rigidGeometry(group,pieces,'skin-glow-rigid'),bones=pieces.map(p=>{const b=new Bone();b.name='skin-glow-bind';b.userData.skinDecoration=true;(p.source instanceof SkinnedMesh?p.source.skeleton.bones[0]:p.source.parent!).add(b);return b;});
 const material=glowMaterial(),mesh=new SkinnedMesh(geometry,material);mesh.name='skin-glow-layer';mesh.userData.skinDecoration=true;mesh.frustumCulled=false;group.add(mesh);group.updateMatrixWorld(true);const skeleton=new Skeleton(bones);mesh.bind(skeleton);skeletons.add(skeleton);
 d.skinRig={bones,sources:pieces.map(p=>p.source)};d.skinGain=1;mesh.onBeforeRender=()=>{material.uniforms.gain.value=d.skinGain??1;material.uniformsNeedUpdate=true;};d.skinLights=[mesh];
}
/** One draw call for the remote model, including vertex-mask emissive details. */
export function bindFarSkin(group:Group,pieces:readonly GlowPiece[],d:WeaponRuntime):void{
 const geometry=rigidGeometry(group,pieces,'skin-far-rigid'),sources=pieces.map(p=>p.source.parent!),bones=pieces.map((p,i)=>{const b=new Bone();b.name='skin-far-bind';b.userData.skinDecoration=true;sources[i].add(b);return b;});
 const material=farMaterial(),mesh=new SkinnedMesh(geometry,material);mesh.name='skin-far';mesh.userData.skinDecoration=true;mesh.frustumCulled=false;mesh.castShadow=false;mesh.onBeforeRender=()=>{material.uniforms.candyGain.value=d.skinGain??1;material.uniformsNeedUpdate=true;};group.add(mesh);group.updateMatrixWorld(true);const skeleton=new Skeleton(bones);mesh.bind(skeleton);skeletons.add(skeleton);for(const p of pieces)p.source.removeFromParent();d.farRig={bones,sources};
}
export function poseSkinRigs(d:WeaponRuntime):void{
 const a=d.skinRig,b=d.farRig;
 if(a)for(let i=0;i<a.bones.length;i++){const s=a.sources[i];a.bones[i].scale.setScalar(s.visible&&(!s.parent||s.parent.visible)?1:0);}
 if(b)for(let i=0;i<b.bones.length;i++)b.bones[i].scale.setScalar(b.sources[i].visible?1:0);
}
export function disposeSkinRigs():void{for(const s of skeletons)s.dispose();skeletons.clear();for(const g of owned)g.dispose();owned.clear();geometries.clear();glow?.dispose();far?.dispose();glow=undefined;far=undefined;}
