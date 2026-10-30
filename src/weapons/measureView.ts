import { Mesh, Raycaster, Vector3 } from 'three';
import type { Group, Intersection } from 'three';

const ray=new Raycaster(),origin=new Vector3(),direction=new Vector3();
const opaque:Mesh[]=[],hits:Intersection[]=[];
function collect(object:import('three').Object3D):void {
  if(object instanceof Mesh&&!object.name.startsWith('lens-'))opaque.push(object);
}
/**
 * Preview/verification diagnostic, NEVER called by poseViewmodel.
 * A 360-degree fan, 10-degree azimuth spacing, 0.25-degree radial spacing.
 * Returns the conservative diameter before the first opaque hit, capped at FOV 70.
 */
export function measureViewmodelClearAngle(viewmodel:Group):number {
  viewmodel.updateMatrixWorld(true);opaque.length=0;viewmodel.traverseVisible(collect);
  ray.near=.05;ray.far=20;
  for(let radius=0;radius<=35;radius+=.25){
    const polar=radius*Math.PI/180;
    for(let azimuth=0;azimuth<360;azimuth+=10){
      const az=azimuth*Math.PI/180;
      direction.set(Math.sin(polar)*Math.cos(az),Math.sin(polar)*Math.sin(az),-Math.cos(polar));
      ray.set(origin,direction);hits.length=0;ray.intersectObjects(opaque,false,hits);
      if(hits.length)return Math.max(0,(radius-.25)*2);
    }
  }
  return 70;
}
