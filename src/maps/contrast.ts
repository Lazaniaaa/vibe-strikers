import type {MapData} from './types';
import {expandedBoxes} from './boxes';
/** sRGB → CIELAB, D65; distance is CIE76 (no display-lighting transform). */
export function lab(hex:string):[number,number,number]{
 const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const f=(v:number)=>v>216/24389?Math.cbrt(v):(24389/27*v+16)/116;
 const x=f((c[0]*.4124564+c[1]*.3575761+c[2]*.1804375)/.95047),y=f(c[0]*.2126729+c[1]*.7151522+c[2]*.072175),z=f((c[0]*.0193339+c[1]*.119192+c[2]*.9503041)/1.08883);
 return [116*y-16,500*(x-y),200*(y-z)];
}
export function deltaE(a:string,b:string){const x=lab(a),y=lab(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);}
export function contrastReport(data:MapData,characters:readonly {id:string;name:string;colors:Readonly<Record<string,string>>}[]){
 const boxes=expandedBoxes(data),zones=data.zones.map(zone=>{
  const area=new Map<string,number>(),add=(color:string,n:number)=>area.set(color,(area.get(color)??0)+n);
  for(const b of boxes){
   if((b.kind==='floor'&&b.y<0)||(b.kind==='decor'&&b.w===22&&b.d===17))continue;
   const w=Math.max(0,Math.min(b.x+b.w/2,zone.x+zone.w/2)-Math.max(b.x-b.w/2,zone.x-zone.w/2)),d=Math.max(0,Math.min(b.z+b.d/2,zone.z+zone.d/2)-Math.max(b.z-b.d/2,zone.z-zone.d/2));if(!w||!d)continue;
   add(data.palette[b.top??b.color],w*d);add(data.palette[b.color],2*b.h*(w+d));
  }
  return {name:zone.name,colors:[...area].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([hex,surfaceArea])=>({hex,surfaceArea}))};
 });
 const rows=characters.flatMap(c=>zones.map(z=>({id:c.id,name:c.name,body:c.colors.body,zone:z.name,pairs:z.colors.map(color=>({hex:color.hex,deltaE:deltaE(c.colors.body,color.hex),lowContrast:deltaE(c.colors.body,color.hex)<15}))})));
 const flags=rows.flatMap(r=>r.pairs.filter(p=>p.lowContrast).map(p=>({id:r.id,zone:r.zone,body:r.body,mapColor:p.hex,deltaE:p.deltaE}))).sort((a,b)=>a.deltaE-b.deltaE);
 return {method:'CIE76 / D65 sRGB; top 3 unique colours by clipped box top + side area, excluding hidden base floor; unlit colour data',threshold:15,zones,rows,flags};
}
