import { AdditiveBlending, BoxGeometry, Color, DoubleSide, DynamicDrawUsage, Group, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, Vector3, type Scene } from 'three';

export interface EffectPoint { readonly x:number;readonly y:number;readonly z:number }
/** Static axis-aligned map boxes, provided once by the caller. Never mutated or raycast in an update. */
export interface PaintSurfaceBox { readonly min:EffectPoint;readonly max:EffectPoint }
export interface WeaponEffectsOptions { surfaceBoxes?:readonly PaintSurfaceBox[] }
export const EFFECT_LIMITS={beams:4,trails:32,particles:96,decals:128,decalsPerBurst:24,surfaceScan:4096,
  railSeconds:.5,bounceSeconds:.14,paintSeconds:.16,sparkSeconds:.18,decalLift:.006,decalLayerStep:.00001,beamWidth:.025} as const;
const EMPTY:readonly PaintSurfaceBox[]=[];
const Y=new Vector3(0,1,0),Z=new Vector3(0,0,1);
interface Trail { active:boolean;age:number;life:number;ax:number;ay:number;az:number;bx:number;by:number;bz:number;width:number;r:number;g:number;b:number }
interface Particle extends Trail { kind:number;arc:number;radius:number }
const record=():Trail=>({active:false,age:0,life:1,ax:0,ay:0,az:0,bx:0,by:0,bz:0,width:0,r:1,g:1,b:1});

/** Three instanced draws, owned by this pool. Construction allocates; updates/spawns reuse fixed slots. */
export class WeaponEffects {
  readonly group=new Group();
  readonly caps=EFFECT_LIMITS;
  readonly trails:InstancedMesh;readonly particles:InstancedMesh;readonly decals:InstancedMesh;
  private readonly dummy=new Object3D();private readonly direction=new Vector3();private readonly tint=new Color();
  private readonly origin=new Vector3();private readonly landing=new Vector3();
  private readonly beamData=Array.from({length:EFFECT_LIMITS.beams},record);
  private readonly trailData=Array.from({length:EFFECT_LIMITS.trails},record);
  private readonly particleData=Array.from({length:EFFECT_LIMITS.particles},()=>({...record(),kind:0,arc:0,radius:0}));
  private trailCursor=0;private particleCursor=0;private decalCursor=0;private decalTotal=0;private disposed=false;
  private readonly surfaces:readonly PaintSurfaceBox[];
  constructor(parent:Scene|Group,options:WeaponEffectsOptions={}){
    this.surfaces=options.surfaceBoxes??EMPTY;this.group.name='weapon-effects';
    const cube=new BoxGeometry(1,1,1),quad=new PlaneGeometry(1,1);
    const light=new MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false,blending:AdditiveBlending,toneMapped:false});
    const paint=new MeshBasicMaterial({color:0xffffff,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,side:DoubleSide,toneMapped:false});
    this.trails=new InstancedMesh(cube,light,EFFECT_LIMITS.beams+EFFECT_LIMITS.trails);
    this.particles=new InstancedMesh(cube,paint,EFFECT_LIMITS.particles);
    this.decals=new InstancedMesh(quad,paint,EFFECT_LIMITS.decals);
    this.trails.name='toy-trails';this.particles.name='paint-and-sparks';this.decals.name='paint-decals';
    this.group.add(this.trails,this.particles,this.decals);parent.add(this.group);
    for(const mesh of [this.trails,this.particles,this.decals]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(DynamicDrawUsage);for(let i=0;i<mesh.instanceMatrix.count;i++){this.hide(mesh,i);mesh.setColorAt(i,this.tint);}}
    this.clear();
  }
  private hide(mesh:InstancedMesh,index:number):void {this.dummy.scale.setScalar(0);this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);}
  private colour(slot:Trail,color:string|number):void {this.tint.set(color);slot.r=this.tint.r;slot.g=this.tint.g;slot.b=this.tint.b;}
  private line(mesh:InstancedMesh,index:number,s:Trail,fade:number):void {
    const dx=s.bx-s.ax,dy=s.by-s.ay,dz=s.bz-s.az,length=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(length<1e-6){this.hide(mesh,index);return;}
    this.dummy.position.set((s.ax+s.bx)/2,(s.ay+s.by)/2,(s.az+s.bz)/2);
    this.direction.set(dx/length,dy/length,dz/length);this.dummy.quaternion.setFromUnitVectors(Y,this.direction);
    this.dummy.scale.set(s.width,length,s.width);this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);
    this.tint.setRGB(s.r*fade,s.g*fade,s.b*fade);mesh.setColorAt(index,this.tint);
  }
  /** Persistent beam slot [0..3]. Call again to move it; caller explicitly hides it on stop. */
  beam(start:EffectPoint,end:EffectPoint,color:string|number='#71FFFF',width:number=EFFECT_LIMITS.beamWidth,slot=0):void {
    if(this.disposed)return;slot=Math.max(0,Math.min(EFFECT_LIMITS.beams-1,slot|0));const s=this.beamData[slot];
    s.active=true;s.ax=start.x;s.ay=start.y;s.az=start.z;s.bx=end.x;s.by=end.y;s.bz=end.z;s.width=Math.max(.001,width);this.colour(s,color);
    this.trails.visible=true;this.line(this.trails,slot,s,1);this.upload();
  }
  hideBeam(slot=0):void {slot=Math.max(0,Math.min(EFFECT_LIMITS.beams-1,slot|0));this.beamData[slot].active=false;this.hide(this.trails,slot);this.trails.instanceMatrix.needsUpdate=true;}
  private trail(start:EffectPoint,end:EffectPoint,color:string|number,width:number,life:number):void {
    const s=this.trailData[this.trailCursor];this.trailCursor=(this.trailCursor+1)%EFFECT_LIMITS.trails;
    s.active=true;s.age=0;s.life=Math.max(.001,life);s.ax=start.x;s.ay=start.y;s.az=start.z;s.bx=end.x;s.by=end.y;s.bz=end.z;s.width=width;this.colour(s,color);
  }
  /** Up to three segments; four short sparks at each internal bounce. */
  bouncer(points:readonly EffectPoint[],color:string|number='#FFD53D'):void {
    if(this.disposed)return;const count=Math.min(4,points.length);for(let i=1;i<count;i++){
      this.trail(points[i-1],points[i],color,.025,EFFECT_LIMITS.bounceSeconds);
      if(i<count-1)this.sparks(points[i],color,4,.18);
    }
  }
  rail(start:EffectPoint,end:EffectPoint,color:string|number='#FFA9EB'):void {if(!this.disposed)this.trail(start,end,color,.075,EFFECT_LIMITS.railSeconds);}
  private particle(start:EffectPoint,end:EffectPoint,color:string|number,life:number,width:number,kind:number,arc=0,radius=0):void {
    const s=this.particleData[this.particleCursor];this.particleCursor=(this.particleCursor+1)%EFFECT_LIMITS.particles;
    s.active=true;s.age=0;s.life=Math.max(.001,Number.isFinite(life)?life:.2);s.ax=start.x;s.ay=start.y;s.az=start.z;s.bx=end.x;s.by=end.y;s.bz=end.z;
    s.kind=kind;s.arc=arc;s.radius=radius;s.width=width;this.colour(s,color);
  }
  /** Moving paint cube, with an automatic small splash on arrival. */
  splat(start:EffectPoint,hit:EffectPoint,color:string|number,duration:number=EFFECT_LIMITS.paintSeconds):void {
    if(!this.disposed)this.particle(start,hit,color,duration,.075,1);
  }
  /** Purely visual parabola over caller-provided duration. No collision, damage, prediction or physics. */
  grenadeArc(hand:EffectPoint,landing:EffectPoint,duration:number,color:string|number,arcHeight=1.5,paintRadius=1.4):void {
    if(!this.disposed)this.particle(hand,landing,color,duration,.18,2,Math.max(0,arcHeight),Math.max(0,paintRadius));
  }
  private sparks(at:EffectPoint,color:string|number,count:number,radius:number):void {
    this.origin.copy(at);
    for(let i=0;i<count;i++){const angle=(i*.61803398875+.17)*Math.PI*2;
      this.landing.set(at.x+Math.cos(angle)*radius,at.y+(.25+(i%3)*.18)*radius,at.z+Math.sin(angle)*radius);
      this.particle(this.origin,this.landing,color,EFFECT_LIMITS.sparkSeconds+(i%3)*.02,.035+(i%2)*.012,0);
    }
  }
  paintSplash(at:EffectPoint,color:string|number):void {if(!this.disposed)this.sparks(at,color,8,.26);}
  /** Burst + persistent instanced square patches on supplied nearby box faces. */
  paintBurst(at:EffectPoint,radius:number,color:string|number):void {
    if(this.disposed)return;this.sparks(at,color,16,Math.max(.1,radius)*.65);this.tint.set(color);
    let emitted=0;const limit=Math.min(EFFECT_LIMITS.surfaceScan,this.surfaces.length),r=Math.max(0,radius);
    for(let i=0;i<limit&&emitted<EFFECT_LIMITS.decalsPerBurst;i++){
      const box=this.surfaces[i],lo=box.min,hi=box.max;
      for(let face=0;face<6&&emitted<EFFECT_LIMITS.decalsPerBurst;face++){
        const axis=face>>1,sign=face%2?1:-1;
        let x=Math.max(lo.x,Math.min(hi.x,at.x)),y=Math.max(lo.y,Math.min(hi.y,at.y)),z=Math.max(lo.z,Math.min(hi.z,at.z));
        if(axis===0)x=sign>0?hi.x:lo.x;else if(axis===1)y=sign>0?hi.y:lo.y;else z=sign>0?hi.z:lo.z;
        const dx=x-at.x,dy=y-at.y,dz=z-at.z;if(dx*dx+dy*dy+dz*dz>r*r)continue;
        // Reject faces pointing away from the burst, including the back of a thin wall.
        if((axis===0?dx:axis===1?dy:dz)*sign>1e-5)continue;
        const faceWidth=axis===0?hi.z-lo.z:hi.x-lo.x,faceHeight=axis===1?hi.z-lo.z:hi.y-lo.y;
        const size=Math.min(.36+r*.15,faceWidth*.8,faceHeight*.8);if(size<.015)continue;
        for(let patch=0;patch<4&&emitted<EFFECT_LIMITS.decalsPerBurst;patch++){
          const u=(patch%2?1:-1)*size*.32,v=(patch<2?-1:1)*size*.32,half=size*.22;
          const px=axis===0?x:Math.max(lo.x+half,Math.min(hi.x-half,x+u));
          const py=axis===1?y:Math.max(lo.y+half,Math.min(hi.y-half,y+v));
          const pz=axis===0?Math.max(lo.z+half,Math.min(hi.z-half,z+u)):axis===1?Math.max(lo.z+half,Math.min(hi.z-half,z+v)):z;
          const qx=px-at.x,qy=py-at.y,qz=pz-at.z;if(qx*qx+qy*qy+qz*qz>r*r)continue;
          this.direction.set(axis===0?sign:0,axis===1?sign:0,axis===2?sign:0);
          const lift=EFFECT_LIMITS.decalLift+this.decalCursor*EFFECT_LIMITS.decalLayerStep;
          this.dummy.position.set(px+this.direction.x*lift,py+this.direction.y*lift,pz+this.direction.z*lift);
          this.dummy.quaternion.setFromUnitVectors(Z,this.direction);this.dummy.scale.set(size*(patch%2?.38:.44),size*(patch<2?.44:.38),1);this.dummy.updateMatrix();
          this.decals.setMatrixAt(this.decalCursor,this.dummy.matrix);this.decals.setColorAt(this.decalCursor,this.tint);
          this.decalCursor=(this.decalCursor+1)%EFFECT_LIMITS.decals;this.decalTotal=Math.min(EFFECT_LIMITS.decals,this.decalTotal+1);emitted++;
        }
      }
    }
    this.decals.count=this.decalTotal;this.decals.visible=this.decalTotal>0;this.decals.instanceMatrix.needsUpdate=true;if(this.decals.instanceColor)this.decals.instanceColor.needsUpdate=true;
  }
  /** Bounded by 32 trails + 96 particles. All scratch and records were allocated in the constructor. */
  update(dt:number):void {
    if(this.disposed)return;const delta=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
    let trails=false,particles=false;for(let i=0;i<EFFECT_LIMITS.beams;i++)if(this.beamData[i].active)trails=true;
    for(let i=0;i<EFFECT_LIMITS.trails;i++){const s=this.trailData[i];if(!s.active)continue;s.age+=delta;
      if(s.age>=s.life){s.active=false;this.hide(this.trails,i+EFFECT_LIMITS.beams);}else{trails=true;this.line(this.trails,i+EFFECT_LIMITS.beams,s,1-s.age/s.life);}
    }
    for(let i=0;i<EFFECT_LIMITS.particles;i++){const s=this.particleData[i];if(!s.active)continue;s.age+=delta;
      if(s.age>=s.life){s.active=false;this.hide(this.particles,i);if(s.kind){
        this.origin.set(s.bx,s.by,s.bz);this.tint.setRGB(s.r,s.g,s.b);const color=this.tint.getHex();
        if(s.kind===2)this.paintBurst(this.origin,s.radius,color);else this.paintSplash(this.origin,color);
      }continue;}
      particles=true;const t=s.age/s.life;this.dummy.position.set(s.ax+(s.bx-s.ax)*t,s.ay+(s.by-s.ay)*t+4*s.arc*t*(1-t),s.az+(s.bz-s.az)*t);
      this.dummy.rotation.set(t*3,t*2,t);this.dummy.scale.setScalar(s.width*(s.kind?1:1-t));this.dummy.updateMatrix();this.particles.setMatrixAt(i,this.dummy.matrix);
      this.tint.setRGB(s.r,s.g,s.b);this.particles.setColorAt(i,this.tint);
    }
    this.trails.visible=trails;this.particles.visible=particles;this.upload();
  }
  private upload():void {this.trails.instanceMatrix.needsUpdate=true;this.particles.instanceMatrix.needsUpdate=true;
    if(this.trails.instanceColor)this.trails.instanceColor.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;}
  clear():void {
    for(let i=0;i<this.beamData.length;i++)this.beamData[i].active=false;
    for(let i=0;i<this.trailData.length;i++)this.trailData[i].active=false;
    for(let i=0;i<this.particleData.length;i++)this.particleData[i].active=false;
    for(let i=0;i<this.trails.instanceMatrix.count;i++)this.hide(this.trails,i);
    for(let i=0;i<this.particles.instanceMatrix.count;i++)this.hide(this.particles,i);
    this.decalCursor=this.decalTotal=0;this.decals.count=0;this.trails.visible=this.particles.visible=this.decals.visible=false;this.upload();
  }
  dispose():void {
    if(this.disposed)return;this.clear();this.disposed=true;this.group.removeFromParent();
    this.trails.geometry.dispose();this.decals.geometry.dispose();(this.trails.material as MeshBasicMaterial).dispose();(this.decals.material as MeshBasicMaterial).dispose();
    this.trails.dispose();this.particles.dispose();this.decals.dispose();
  }
}
export function createWeaponEffects(parent:Scene|Group,options:WeaponEffectsOptions={}):WeaponEffects{return new WeaponEffects(parent,options);}
