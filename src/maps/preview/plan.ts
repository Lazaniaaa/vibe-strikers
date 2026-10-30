import type { MapData } from '../types';
import { expandedBoxes } from '../boxes';
type Route={id:string;color:string;points:{x:number;z:number}[]};
type Heat={max:number;cells:{ix:number;iz:number;count:number}[];walkableRows:{iz:number;runs:number[]}[]};
/** Canvas plan and exports share the same draw operation. Never used by input sliders. */
export function planPainter(data:MapData,routes:Route[],interior=false,beats:{x:number;z:number;label:string}[]=[]){
 const boxes=expandedBoxes(data).filter(b=>b.y+b.h/2>(interior?.001:.1)&&(!interior||b.y-b.h/2<3)).sort((a,b)=>a.y+a.h/2-b.y-b.h/2);
 return (ctx:CanvasRenderingContext2D,size:number,reference?:{x:number;z:number},exportLabels=false,heat?:Heat)=>{
  const pad=size*.045,scale=(size-2*pad)/70,X=(x:number)=>pad+(x+35)*scale,Z=(z:number)=>pad+(35-z)*scale;
  ctx.clearRect(0,0,size,size);ctx.fillStyle='#E6E9DF';ctx.fillRect(0,0,size,size);ctx.fillStyle=data.palette.stoneTop;ctx.fillRect(X(-33.25),Z(33.25),66.5*scale,66.5*scale);
  ctx.strokeStyle='#C8D0C1';ctx.lineWidth=Math.max(.4,size/1600);for(let p=-30;p<=30;p+=5){ctx.beginPath();ctx.moveTo(X(p),Z(33.25));ctx.lineTo(X(p),Z(-33.25));ctx.moveTo(X(-33.25),Z(p));ctx.lineTo(X(33.25),Z(p));ctx.stroke();}
  for(const b of boxes){const top=b.y+b.h/2;ctx.fillStyle=data.palette[b.top??b.color];ctx.fillRect(X(b.x-b.w/2),Z(b.z+b.d/2),b.w*scale,b.d*scale);if(b.kind!=='decor'){ctx.strokeStyle=top>=4?'#68716B':'#818B7D';ctx.lineWidth=Math.max(.5,size/1250);ctx.strokeRect(X(b.x-b.w/2),Z(b.z+b.d/2),b.w*scale,b.d*scale);}}
  if(heat){
   ctx.fillStyle='#E4E7DE';for(const row of heat.walkableRows)for(let i=0;i<row.runs.length;i+=2){const a=row.runs[i],b=row.runs[i+1];ctx.fillRect(X(-35+a*.25),Z(-35+(row.iz+1)*.25),(b-a)*.25*scale,.25*scale+.1);}
   const ramp=['#ACC8CC','#6A9EB6','#DDCB87','#D99564','#B95343'];for(const cell of heat.cells){const t=Math.log1p(cell.count)/Math.log1p(heat.max);ctx.fillStyle=ramp[Math.min(4,Math.floor(t*5))];ctx.fillRect(X(-35+cell.ix*.25),Z(-35+(cell.iz+1)*.25),.25*scale+.15,.25*scale+.15);}
  }else for(const r of routes){ctx.lineWidth=size*.0032;ctx.lineCap='square';ctx.lineJoin='miter';ctx.strokeStyle=r.color;ctx.globalAlpha=.85;ctx.beginPath();r.points.forEach((p,i)=>i?ctx.lineTo(X(p.x),Z(p.z)):ctx.moveTo(X(p.x),Z(p.z)));ctx.stroke();}ctx.globalAlpha=1;
  const labelSize=size*(exportLabels ? .011 : .017);ctx.font=`600 ${labelSize}px "Segoe UI",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  for(const zone of data.zones){const title=zone.name.toUpperCase(),x=X(zone.x),z=Z(zone.z),w=ctx.measureText(title).width+size*.014;ctx.fillStyle='#F7F4EBDD';ctx.fillRect(x-w/2,z-labelSize*.75,w,labelSize*1.5);ctx.fillStyle='#5E705A';ctx.fillText(title,x,z);}
  if(interior)for(const b of beats){const x=X(b.x),z=Z(b.z),w=size*.05;ctx.fillStyle='#F8F5ECF0';ctx.fillRect(x-w/2,z-labelSize*.8,w,labelSize*1.6);ctx.fillStyle=b.x<0?'#A85D42':'#377E95';ctx.fillText(b.label,x,z);}
  for(const p of data.lootSpots){ctx.fillStyle='#A69459';const x=X(p.x),z=Z(p.z),s=size*.005;ctx.beginPath();ctx.moveTo(x,z-s*1.3);ctx.lineTo(x+s,z);ctx.lineTo(x,z+s*1.3);ctx.lineTo(x-s,z);ctx.closePath();ctx.fill();}
  for(const p of data.spawns){const x=X(p.x),z=Z(p.z),r=size*(p.team==='ffa'?.0045:.006);ctx.beginPath();ctx.arc(x,z,r,0,Math.PI*2);ctx.lineWidth=Math.max(1,size*.001);if(p.team==='ffa'){ctx.strokeStyle='#F3F3E9';ctx.stroke();ctx.beginPath();ctx.arc(x,z,r*.8,0,Math.PI*2);ctx.strokeStyle='#6D7F63';ctx.stroke();}else{ctx.fillStyle=p.team==='A'?'#B86546':'#45889F';ctx.fill();ctx.strokeStyle='#F5F2E8';ctx.stroke();}}
  for(const p of data.spawns){const x=X(p.x),z=Z(p.z),r=size*.011,dx=-Math.sin(p.yaw),dz=Math.cos(p.yaw);ctx.strokeStyle=p.team==='A'?'#AD5739':p.team==='B'?'#32708A':'#657B60';ctx.lineWidth=Math.max(1,size*.001);ctx.beginPath();ctx.moveTo(x+dx*r*.5,z+dz*r*.5);ctx.lineTo(x+dx*r*1.6,z+dz*r*1.6);ctx.stroke();}
  if(reference){const x=X(reference.x),z=Z(reference.z),s=size*.006;ctx.fillStyle='#C43B96';ctx.fillRect(x-s,z-s,s*2,s*2);ctx.strokeStyle='#FCF5E8';ctx.lineWidth=size*.001;ctx.strokeRect(x-s,z-s,s*2,s*2);}
  ctx.font=`600 ${size*.013}px "Segoe UI",sans-serif`;ctx.fillStyle='#687B60';ctx.textAlign='right';ctx.fillText('N ↑',size-pad,pad*.57);ctx.textAlign='left';ctx.fillText(heat?data.name+' / HEAT · 756 SPAWN PAIRS':data.name+' / '+(interior?'ПЛАН БЕЗ ДАХІВ':'70 × 70 M'),pad,size-pad*.35);
  if(heat){const ramp=['#E4E7DE','#ACC8CC','#6A9EB6','#DDCB87','#D99564','#B95343'],left=size*.65,y=size-pad*.55,w=size*.045;for(let i=0;i<ramp.length;i++){ctx.fillStyle=ramp[i];ctx.fillRect(left+i*w,y,w,size*.009);}ctx.fillStyle='#53664F';ctx.font=`600 ${size*.009}px "Segoe UI",sans-serif`;ctx.fillText('0',left,y-size*.006);ctx.textAlign='right';ctx.fillText('LOG · '+heat.max+' PATHS',left+w*6,y-size*.006);}
 };
}
