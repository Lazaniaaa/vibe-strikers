import { BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three';

/** Preview-only metre-scale landmarks. Not exported by the game/weapon API. */
export function createPreviewWorld(){
 const group=new Group();group.name='preview-sample-world';
 const geometry=new BoxGeometry(1,1,1),materials=new Map<string,MeshLambertMaterial>();
 const box=(color:string,x:number,y:number,z:number,w:number,h:number,d:number)=>{
  let material=materials.get(color);if(!material){material=new MeshLambertMaterial({color});materials.set(color,material);}
  const mesh=new Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;
 };
 box('#B4B7A6',0,-1.75,-62,160,.3,145);box('#DBDED1',0,8,-115,100,20,1);
 for(const z of [8,15,30,60,100])box('#959E91',0,-1.594,-z,36,.008,.09);
 // Separate angular lanes keep the 60/100m cubes visible behind the nearer landmarks.
 const landmarks:readonly [number,number,number,string][]=[[-3,8,1.4,'#38CDBD'],[3,8,1.1,'#DF7065'],[-3,15,1.8,'#A6CF62'],[3,15,1.5,'#A68BD9'],[-3,30,2,'#DFAC56'],[3,30,1.7,'#64A7CC'],[-1.2,60,2,'#8DD5A3'],[2,100,2,'#C73B94']];
 for(const [x,distance,size,color]of landmarks){const cube=box(color,x,-1.6+size/2,-distance,size,size,size);cube.name=`landmark-${distance}m`;}
 box('#A2ADA7',-12,3,-114.4,.15,9,.1);box('#A2ADA7',12,3,-114.4,.15,9,.1);
 return {group,dispose(){geometry.dispose();for(const material of materials.values())material.dispose();}};
}
