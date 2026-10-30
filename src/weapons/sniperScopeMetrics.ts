import { Box3, Matrix4, PerspectiveCamera, Vector3, Vector4 } from 'three';
import type { Group, BufferGeometry } from 'three';
import { mergedBoxes } from './resources';
import { sniperScopeBoxes, sniperScopeHousing } from './sniperScope';
import { sniperViewScopeBoxes } from './sniperViewScope';

/** Diagnostics only. Never called from poseViewmodel or a frame loop. */
export function sniperScopeSize(weapon:Group,includeMounts=false):{width:number;height:number;depth:number}{
 const geometry=mergedBoxes(includeMounts?sniperScopeBoxes:sniperScopeHousing,weapon.userData.palette,'sniper-scope-measure');
 const size=geometry.boundingBox!.getSize(new Vector3());
 return {width:size.x,height:size.y,depth:size.z};
}

/**
 * Projected triangle-union coverage at HIP, FOV70. Includes mounts and visible lenses.
 * No rifle/hand occlusion is subtracted, so this conservatively bounds visible coverage.
 * Rasterize the actual indexed vertices at pixel centres, clipped to the viewport.
 */
function raster(aspect:number,height:number){
 const width=Math.round(height*aspect),mask=new Uint8Array(width*height);
 const camera=new PerspectiveCamera(70,aspect,.05,20),mvp=new Matrix4(),point=new Vector4();
 const draw=(geometry:BufferGeometry,matrix:Matrix4)=>{
  mvp.multiplyMatrices(camera.projectionMatrix,matrix);
  const a=geometry.attributes.position,xy=new Float64Array(a.count*2);
  for(let i=0;i<a.count;i++){
   point.set(a.getX(i),a.getY(i),a.getZ(i),1).applyMatrix4(mvp);
   if(point.w<=0||point.z< -point.w||point.z>point.w)throw new Error('Visible sniper geometry crosses near/far plane');
   xy[i*2]=(point.x/point.w+1)*width/2;xy[i*2+1]=(1-point.y/point.w)*height/2;
  }
  const index=geometry.index;
  for(let i=0;i<(index?.count??a.count);i+=3){
   const ai=index?index.getX(i):i,bi=index?index.getX(i+1):i+1,ci=index?index.getX(i+2):i+2;
   const ax=xy[ai*2],ay=xy[ai*2+1],bx=xy[bi*2],by=xy[bi*2+1],cx=xy[ci*2],cy=xy[ci*2+1];
   const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<1e-10)continue;
   const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
   const minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const px=x+.5,py=y+.5,u=((bx-px)*(cy-py)-(by-py)*(cx-px))/area,v=((cx-px)*(ay-py)-(cy-py)*(ax-px))/area;
    if(u>=-1e-9&&v>=-1e-9&&u+v<=1+1e-9)mask[y*width+x]=1;
   }
  }
 };
 return {draw,mask,width,height};
}
function coverage(mask:Uint8Array,width:number,height:number){
 let pixels=0,minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){pixels++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 return {percentage:pixels/mask.length*100,boundsPercentage:pixels?(maxX-minX+1)*(maxY-minY+1)/mask.length*100:0,pixels,width,height};
}
export function measureSniperScopeCoverage(vm:Group,aspect=16/9,height=360){
 const weapon=vm.userData.weapon as Group;
 if(weapon.userData.weaponId!=='sniper')throw new Error('Sniper-only coverage diagnostic');
 vm.updateMatrixWorld(true);const r=raster(aspect,height);
 const boxes=weapon.userData.isSniperViewmodel?sniperViewScopeBoxes:sniperScopeBoxes;
 r.draw(mergedBoxes(boxes,weapon.userData.palette,'sniper-scope-measure'),weapon.matrixWorld);
 weapon.traverseVisible(o=>{if(o.name.startsWith('lens-'))r.draw((o as import('three').Mesh).geometry,o.matrixWorld);});
 return coverage(r.mask,r.width,r.height);
}
/** Actual visible opaque triangles, FOV70. A centred clear rectangle, not an aperture formula. */
export function measureSniperAdsView(vm:Group,aspect=16/9,height=720){
 vm.updateMatrixWorld(true);const r=raster(aspect,height),{width,height:h,mask}=r;
 vm.traverseVisible(o=>{const m=o as import('three').Mesh;if(m.isMesh&&!m.name.startsWith('lens-'))r.draw(m.geometry,m.matrixWorld);});
 const cx=Math.floor(width/2),cy=Math.floor(h/2);let left=0,right=width,top=0,bottom=h;
 for(let x=cx-1;x>=0;x--)if(mask[cy*width+x]){left=x+1;break;}
 for(let x=cx;x<width;x++)if(mask[cy*width+x]){right=x;break;}
 for(let y=cy-1;y>=0;y--)if(mask[y*width+cx]){top=y+1;break;}
 for(let y=cy;y<h;y++)if(mask[y*width+cx]){bottom=y;break;}
 // Confirm the entire rectangle, so a diagonal/internal obstruction cannot escape axis tests.
 let blockedPixels=0;for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)blockedPixels+=mask[y*width+x];
 return {clearWidthFraction:(right-left)/width,clearHeightFraction:(bottom-top)/h,blockedPixels,
  opaqueCoveragePercent:coverage(mask,width,h).percentage,width,height:h};
}
