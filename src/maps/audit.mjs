import fs from 'node:fs/promises';
import {createServer} from 'vite';
const stage=process.argv[2]??'after';
const vite=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{const {auditMap}=await vite.ssrLoadModule('../maps/audit.ts'),file=stage==='before'?'src/maps/baselines/m1-data.json':'src/maps/data/toy-town.json',data=JSON.parse(await fs.readFile(file,'utf8'));const result=auditMap(data);await fs.writeFile(`src/maps/reports/m2/${stage}.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,routes:result.routes.map(({points,...r})=>r),teamPaths:undefined,spawnSight:undefined,loot:result.loot.filter(p=>p.violation),spawnFacing:result.spawnFacing.filter(p=>p.violation),heatmap:{...result.heatmap,cells:undefined}},null,2));}finally{await vite.close();}
