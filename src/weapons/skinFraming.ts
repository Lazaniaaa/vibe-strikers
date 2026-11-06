import {Vector3,type Box3,type OrthographicCamera}from'three';
/** One camera/scale for base and every rarity; auto-fitting each crown would hide the size progression. */
export function frameSkinImage(camera:OrthographicCamera,base:Box3):void{
 const bounds=base.clone(),size=base.getSize(new Vector3());bounds.min.x-=size.x*.075;bounds.max.x+=size.x*.075;bounds.min.z-=size.z*.075;bounds.max.z+=size.z*.075;bounds.min.y-=size.y*.02;bounds.max.y+=size.y*.15;
 const center=bounds.getCenter(new Vector3());camera.position.set(2.8,1.5,-2.6).normalize().multiplyScalar(6).add(center);camera.lookAt(center);camera.updateMatrixWorld(true);
 let extent=0;const corner=new Vector3();for(let i=0;i<8;i++){corner.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).applyMatrix4(camera.matrixWorldInverse);extent=Math.max(extent,Math.abs(corner.x),Math.abs(corner.y));}
 const radius=Math.max(.05,extent*1.04);camera.left=camera.bottom=-radius;camera.right=camera.top=radius;camera.updateProjectionMatrix();
}
