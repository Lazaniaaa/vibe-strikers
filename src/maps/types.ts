export type MapKind='floor'|'wall'|'prop'|'stair'|'glass'|'decor';
export type Team='A'|'B'|'ffa';
export interface MapBox {x:number;y:number;z:number;w:number;h:number;d:number;color:string;top?:string;outline?:boolean;kind:MapKind;collide:boolean;blocksShots:boolean}
export interface MapInstance {prefab:string;x:number;y:number;z:number;/** Radians, multiples of PI/2. */yaw:number}
export interface SpawnPoint {team:Team;x:number;y:number;z:number;/** Radians, facing -Z at zero. */yaw:number}
export interface ColliderBox {x:number;y:number;z:number;w:number;h:number;d:number}
export interface MapData {
 id:string;name:string;bounds:{x:number;z:number};killY:number;
 sky:{color:string;/** Art-directed horizon; fog uses this colour. */horizon?:string};fog:{color:string;near:number;far:number};
 light:{sun:{direction:readonly [number,number,number];color:string;intensity:number};ambient:{color:string;intensity:number};hemisphere?:{sky:string;ground:string;intensity:number}};
 palette:Record<string,string>;prefabs:Record<string,readonly MapBox[]>;boxes:readonly MapBox[];instances:readonly MapInstance[];
 spawns:readonly SpawnPoint[];lootSpots:readonly {x:number;y:number;z:number;tier:'low'|'mid'|'high'}[];
 zones:readonly {name:string;x:number;z:number;w:number;d:number}[];
}
export interface MapStats {boxes:number;renderBoxes:number;triangles:number;drawCalls:number;chunks:number;instancedPrefabs:number;instances:number;shadowChunks:number}
