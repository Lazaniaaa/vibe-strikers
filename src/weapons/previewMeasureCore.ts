import { Box3, Matrix4, Raycaster, Vector3 } from 'three';

export interface DiagnosticGeometry {id:string;positions:Float32Array;index:Uint32Array;bones?:Uint16Array}
export interface DiagnosticPiece {geometry:string;matrix:number[];bone:number}
export interface DiagnosticRequest {token:number;key:string;ads:number;aspect:number;geometries:DiagnosticGeometry[];opaque:DiagnosticPiece[];scope:DiagnosticPiece[]}
interface Node {box:Box3;left?:Node;right?:Node;triangles?:number[]}
interface Stored extends DiagnosticGeometry {trees:Map<number,Node>;xy:Float64Array}
/** Worker-owned acceleration and scratch memory. No geometry/material construction. */
export class PreviewMeasureCore {
 private geometries=new Map<string,Stored>();
 private raycaster=new Raycaster();private localRay=new Raycaster().ray;
 private matrix=new Matrix4();
 private a=new Vector3();private b=new Vector3();private c=new Vector3();private point=new Vector3();
 private stack:Node[]=[];private mask=new Uint8Array(1280*720);private inverses:Matrix4[]=[];
 builds=0;rays=0;
 private tree(g:Stored,bone:number):Node{
  let hit=g.trees.get(bone);if(hit)return hit;
  const triangles:number[]=[];for(let i=0;i<g.index.length;i+=3)if(bone<0||g.bones![g.index[i]]===bone)triangles.push(i);
  const p=g.positions,index=g.index;
  const build=(ids:number[]):Node=>{
   const box=new Box3();for(const t of ids)for(let k=0;k<3;k++){const i=index[t+k]*3;this.point.set(p[i],p[i+1],p[i+2]);box.expandByPoint(this.point);}
   if(ids.length<=12)return {box,triangles:ids};
   const extent=box.getSize(this.point),axis=extent.x>=extent.y&&extent.x>=extent.z?0:extent.y>=extent.z?1:2;
   const centre=(t:number)=>p[index[t]*3+axis]+p[index[t+1]*3+axis]+p[index[t+2]*3+axis];ids.sort((a,b)=>centre(a)-centre(b));
   const half=ids.length>>1;return {box,left:build(ids.slice(0,half)),right:build(ids.slice(half))};
  };
  hit=build(triangles);g.trees.set(bone,hit);this.builds++;return hit;
 }
 private hit(g:Stored,root:Node):boolean{
  const stack=this.stack;stack.length=0;stack.push(root);const p=g.positions,index=g.index;
  while(stack.length){const node=stack.pop()!;if(!this.localRay.intersectBox(node.box,this.point))continue;
   if(node.triangles){for(const t of node.triangles){this.a.fromArray(p,index[t]*3);this.b.fromArray(p,index[t+1]*3);this.c.fromArray(p,index[t+2]*3);
    if(this.localRay.intersectTriangle(this.a,this.b,this.c,false,this.point)){
     // Near/far in camera coordinates, including non-uniform model scale.
     this.point.applyMatrix4(this.matrix);const distance=this.point.length();if(distance>=.05&&distance<=20)return true;
    }
   }}else{stack.push(node.left!,node.right!);}
  }return false;
 }
 private blocked(pieces:DiagnosticPiece[],x:number,y:number):boolean{
  this.rays++;this.raycaster.ray.origin.set(0,0,0);this.raycaster.ray.direction.set(x,y,-1).normalize();
  for(let i=0;i<pieces.length;i++){
   const piece=pieces[i],g=this.geometries.get(piece.geometry)!;
   this.matrix.fromArray(piece.matrix);this.localRay.copy(this.raycaster.ray).applyMatrix4(this.inverses[i]);
   if(this.hit(g,this.tree(g,piece.bone)))return true; // No Intersection arrays; centre returns at first hit.
  }return false;
 }
 private fan(pieces:DiagnosticPiece[]):{angle:number;centreClear:boolean;rays:number}{
  this.rays=0;
  for(let i=0;i<pieces.length;i++){if(!this.inverses[i])this.inverses[i]=new Matrix4();this.inverses[i].fromArray(pieces[i].matrix).invert();}
  if(this.blocked(pieces,0,0))return {angle:0,centreClear:false,rays:this.rays};
  // 33 polar levels x 33 azimuths, including one shared centre probe: <=1057 rays.
  const step=35/32;
  for(let radius=1;radius<=32;radius++){
   const tangent=Math.tan(radius*step*Math.PI/180);
   for(let azimuth=0;azimuth<33;azimuth++){
    const angle=azimuth*Math.PI*2/33;
    if(this.blocked(pieces,tangent*Math.cos(angle),tangent*Math.sin(angle)))return {angle:(radius-1)*step*2,centreClear:true,rays:this.rays};
   }
  }return {angle:70,centreClear:true,rays:this.rays};
 }
 private draw(pieces:DiagnosticPiece[],aspect:number,height:number){
  const width=Math.round(height*aspect),count=width*height;if(this.mask.length<count)this.mask=new Uint8Array(count);this.mask.fill(0,0,count);
  const f=1/Math.tan(35*Math.PI/180);
  for(const piece of pieces){
   const g=this.geometries.get(piece.geometry)!,p=g.positions,index=g.index,xy=g.xy,e=piece.matrix;
   for(let i=0;i<p.length;i+=3){const x=p[i],y=p[i+1],z=p[i+2],vx=e[0]*x+e[4]*y+e[8]*z+e[12],vy=e[1]*x+e[5]*y+e[9]*z+e[13],vz=e[2]*x+e[6]*y+e[10]*z+e[14];
    xy[i/3*2]=(vx*f/aspect/-vz+1)*width/2;xy[i/3*2+1]=(1-vy*f/-vz)*height/2;
   }
   for(let t=0;t<index.length;t+=3){
    if(piece.bone>=0&&g.bones![index[t]]!==piece.bone)continue;
    const ai=index[t]*2,bi=index[t+1]*2,ci=index[t+2]*2,ax=xy[ai],ay=xy[ai+1],bx=xy[bi],by=xy[bi+1],cx=xy[ci],cy=xy[ci+1];
    const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<1e-10)continue;
    const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx))),minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
     const px=x+.5,py=y+.5,u=((bx-px)*(cy-py)-(by-py)*(cx-px))/area,v=((cx-px)*(ay-py)-(cy-py)*(ax-px))/area;
     if(u>=-1e-9&&v>=-1e-9&&u+v<=1+1e-9)this.mask[y*width+x]=1;
    }
   }
  }
  return {width,height,count};
 }
 measure(request:DiagnosticRequest){
  const started=performance.now();for(const g of request.geometries)if(!this.geometries.has(g.id))this.geometries.set(g.id,{...g,trees:new Map(),xy:new Float64Array(g.positions.length/3*2)});
  const fan=this.fan(request.opaque);let coverage:number|undefined,clearWidth:number|undefined,clearHeight:number|undefined;
  if(request.ads===0&&request.scope.length){const r=this.draw(request.scope,request.aspect,180);let n=0;for(let i=0;i<r.count;i++)n+=this.mask[i];coverage=n/r.count*100;}
  if(request.ads===1&&request.scope.length){
   const r=this.draw(request.opaque,16/9,720),{width,height}=r,cx=width>>1,cy=height>>1;let left=0,right=width,top=0,bottom=height;
   for(let x=cx-1;x>=0;x--)if(this.mask[cy*width+x]){left=x+1;break;}for(let x=cx;x<width;x++)if(this.mask[cy*width+x]){right=x;break;}
   for(let y=cy-1;y>=0;y--)if(this.mask[y*width+cx]){top=y+1;break;}for(let y=cy;y<height;y++)if(this.mask[y*width+cx]){bottom=y;break;}
   clearWidth=(right-left)/width;clearHeight=(bottom-top)/height;
  }
  return {token:request.token,key:request.key,ads:request.ads,...fan,coverage,clearWidth,clearHeight,workerMs:performance.now()-started,bvhBuilds:this.builds};
 }
}
