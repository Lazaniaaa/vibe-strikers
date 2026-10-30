import type {MapData} from './types';
import legacy from './palettes/legacy.json';
/** Preview comparison only: same geometry, one shared Lambert material, cached on load. */
export function oldPaletteData(data:MapData):MapData{return {...data,palette:{...data.palette,...legacy}};}
export function zoneLegend(data:MapData){return data.zones.map(z=>({name:z.name,color:data.palette['legend:'+z.name]??data.palette.sand}));}
