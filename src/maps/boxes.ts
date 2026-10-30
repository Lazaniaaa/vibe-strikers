import type { ColliderBox,MapBox,MapData } from './types';

export function expandedBoxes(data:MapData):MapBox[]{
 const result=data.boxes.map(b=>({...b}));
 for(const instance of data.instances){
  const quarter=((Math.round(instance.yaw/(Math.PI/2))%4)+4)%4;
  for(const b of data.prefabs[instance.prefab]){
   let x=b.x,z=b.z;if(quarter===1){x=b.z;z=-b.x;}else if(quarter===2){x=-b.x;z=-b.z;}else if(quarter===3){x=-b.z;z=b.x;}
   result.push({...b,x:x+instance.x,y:b.y+instance.y,z:z+instance.z,w:quarter%2?b.d:b.w,d:quarter%2?b.w:b.d});
  }
 }return result;
}
const num=(v:number)=>Math.round(v*1e7)/1e7;
export const boxKey=(b:ColliderBox)=>[b.x,b.y,b.z,b.w,b.h,b.d].map(num).join(',');
/** Union only collinear boxes with identical cross sections; never bridge intentional gaps. */
export function mergeColliders(boxes:readonly MapBox[],shotOnly=false):ColliderBox[]{
 const groups=[false,true].map(blocks=>boxes.filter(b=>b.collide&&b.blocksShots===blocks&&(!shotOnly||blocks)).map(({x,y,z,w,h,d})=>({x,y,z,w,h,d})));
 for(const list of groups)for(let pass=0;pass<2;pass++)for(const [axis,size,others]of [['x','w',['y','z','h','d']],['z','d',['x','y','w','h']],['y','h',['x','z','w','d']]] as const){
  const buckets=new Map<string,ColliderBox[]>();for(const b of list){const key=others.map(k=>num(b[k])).join(',');let bucket=buckets.get(key);if(!bucket)buckets.set(key,bucket=[]);bucket.push(b);}
  list.length=0;
  for(const bucket of buckets.values()){
   bucket.sort((a,b)=>a[axis]-a[size]/2-(b[axis]-b[size]/2));let last:ColliderBox|undefined;
   for(const b of bucket){const lo=b[axis]-b[size]/2,hi=b[axis]+b[size]/2;
    if(last&&lo<=last[axis]+last[size]/2+1e-8){const start=last[axis]-last[size]/2,end=Math.max(hi,last[axis]+last[size]/2);last[axis]=(start+end)/2;last[size]=end-start;}
    else {last={...b};list.push(last);}
   }
  }
 }
 return groups.flat().sort((a,b)=>boxKey(a).localeCompare(boxKey(b)));
}
