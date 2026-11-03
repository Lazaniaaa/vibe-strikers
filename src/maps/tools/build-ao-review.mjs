// Build an unbaked comparison without changing game files or the final source default.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const mode=process.argv[2];if(mode!=='off'&&mode!=='on')throw Error('Usage: node src/maps/tools/build-ao-review.mjs off|on');
const file='src/maps/buildMap.ts',original=fs.readFileSync(file,'utf8'),needle='options?.bakedAo??true';if(!original.includes(needle))throw Error('Unexpected builder default; do not overwrite it');
try{if(mode==='off')fs.writeFileSync(file,original.replace(needle,'options?.bakedAo??false'));const run=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','vite.game.config.ts'],{stdio:'inherit'});if(run.status!==0)process.exitCode=run.status??1;}finally{fs.writeFileSync(file,original);}
console.log('Review build: '+mode+'; source default restored to ON.');
