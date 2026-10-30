import town from './data/toy-town.json';
import l1r1 from './data/toy-town-l1-r1.json';
import l1r2 from './data/toy-town-l1-r2.json';
import l2r1 from './data/toy-town-l2-r1.json';
import l2r2 from './data/toy-town-l2-r2.json';
import type { MapData,Team } from './types';
import { expandedBoxes,mergeColliders } from './boxes';
export { buildMap,disposeMapResources } from './buildMap';
export type { MapData,MapBox,MapInstance,SpawnPoint,ColliderBox,MapKind,Team,MapStats } from './types';
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
const maps=freeze(Object.fromEntries([town,l1r1,l1r2,l2r1,l2r2].map(d=>[d.id,d as MapData])));
export const mapIds=Object.freeze(Object.keys(maps));
export function loadMapData(id:string):MapData{const data=Object.hasOwn(maps,id)?maps[id]:undefined;if(!data)throw new Error('Unknown map: '+id);return data;}
export function mapColliders(data:MapData){return {boxes:mergeColliders(expandedBoxes(data))};}
export function mapShotBlockers(data:MapData){return {boxes:mergeColliders(expandedBoxes(data),true)};}
export function spawnPoints(data:MapData,team:Team){return data.spawns.filter(s=>s.team===team).map(s=>({...s}));}
