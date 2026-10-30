import { weapons } from './weapons';

export interface ScopeOverlayOptions {accent?:string;background?:string}
const size=48,radius=size/2,diameter=.9,height=size/diameter;
const inside=(x:number,y:number)=>x>=0&&y>=0&&x<size&&y<size&&Math.hypot(x+.5-radius,y+.5-radius)<=radius;
const eroded=(x:number,y:number,n:number)=>{for(let dy=-n;dy<=n;dy++)for(let dx=-n;dx<=n;dx++)if(!inside(x+dx,y+dy))return false;return true;};
const cells:{x:number;y:number;layer:'accent'|'band'|'clear'}[]=[];
for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(inside(x,y))cells.push({x,y,layer:!eroded(x,y,1)?'accent':!eroded(x,y,3)?'band':'clear'});
/** Immutable stencil shared by DOM, PNG and contract checks. Each square is one grid cell. */
export const scopeOverlayGrid=Object.freeze({size,radius,diameter,height,cells:Object.freeze(cells.map(c=>Object.freeze(c))),gap:.6,lineWidth:.16});
const rect=(x:number,y:number,w=1,h=1)=>`M${x} ${y}h${w}v${h}h${-w}Z`;
let windowPath='',accentPath='',bandPath='';
for(let y=0;y<size;y++){
 const row=cells.filter(c=>c.y===y);windowPath+=rect(row[0].x-radius,y-radius,row.length);
}
for(const c of cells){if(c.layer==='accent')accentPath+=rect(c.x-radius,c.y-radius);else if(c.layer==='band')bandPath+=rect(c.x-radius,c.y-radius);}
const defaultAccent=weapons.find(w=>w.id==='sniper')!.palette.accent;
function svg(accent:string,background:string):string{
 if(!/^#[0-9a-f]{6}$/i.test(accent)||!/^#[0-9a-f]{6}$/i.test(background))throw new Error('Scope overlay colours must be six-digit hex');
 let ticks='';for(const t of [-18,-12,-6,6,12,18])ticks+=rect(t-.16,-.16,.32,.32)+rect(-.16,t-.16,.32,.32);
 // A very wide sliced viewBox fixes the scale to viewport HEIGHT, including portrait panes.
 return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="-10000 ${-height/2} 20000 ${height}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" data-grid="48" data-diameter="0.9" style="display:block;position:absolute;inset:0;pointer-events:none;overflow:hidden"><path fill="${background}" fill-rule="evenodd" d="${rect(-10000,-height/2,20000,height)}${windowPath}"/><path fill="${accent}" d="${accentPath}"/><path fill="${background}" opacity="0.35" d="${bandPath}"/><path data-crosshair="axes-0-0" fill="none" stroke="${background}" stroke-width="0.16" stroke-linecap="butt" d="M-24 0H-.6M.6 0H24M0 -24V-.6M0 .6V24"/><path fill="${background}" d="${ticks}"/></svg>`;
}
const cachedSvg=svg(defaultAccent,'#101116');
/** Safe, self-contained SVG markup for React dangerouslySetInnerHTML; no framework imports. */
export function scopeOverlaySvg():string{return cachedSvg;}
/** Build once per viewport. Later updates only set opacity and the zero-opacity visibility gate. */
export function createScopeOverlay(options:ScopeOverlayOptions={}):HTMLElement{
 const element=document.createElement('div');element.className='voxel-scope-overlay';element.setAttribute('aria-hidden','true');
 element.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:3;opacity:0;visibility:hidden;overflow:hidden';
 element.innerHTML=options.accent||options.background?svg(options.accent??defaultAccent,options.background??'#101116'):cachedSvg;
 return element;
}
export function scopeOverlayOpacity(ads:number):number{
 const t=Number.isFinite(ads)?Math.max(0,Math.min(1,(ads-.7)/.3)):0;return t*t*(3-2*t);
}
