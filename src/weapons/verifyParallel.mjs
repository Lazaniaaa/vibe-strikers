import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

/** Optional test runner only: identical row oracle in four independent Node processes. */
export async function verifyHoldsParallel(characterCount){
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const jobs=['pistol','rifle','sniper','shotgun'];
 await mkdir(new URL('../../work/',import.meta.url),{recursive:true});
 let next=0;
 const results=[];
 async function worker(){
  while(next<jobs.length){
   const key=jobs[next++],stem=key;
   const resultURL=new URL(`../../work/round5-shard-${stem}.json`,import.meta.url);
   await rm(resultURL,{force:true});
   const chunks=[];
   const exit=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(new URL('./verify.mjs',import.meta.url)),`--hold-weapon=${key}`],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',chunk=>chunks.push(chunk));child.stderr.on('data',chunk=>chunks.push(chunk));
    child.on('error',reject);child.on('close',resolve);
   });
   await writeFile(new URL(`../../work/round5-shard-${stem}.txt`,import.meta.url),Buffer.concat(chunks));
   const result=JSON.parse(await readFile(resultURL,'utf8'));
   assert.ok(result.complete,`${key}: incomplete shard`);
   assert.equal(result.rows.length,1);assert.equal(result.rows[0].weapon,key);
   results.push({key,exit,result});
   console.log(`ROUND5 SHARD ${key}: exit ${exit}; poses ${result.checked}; failures ${result.failures.length}`);
  }
 }
 await Promise.all(Array.from({length:4},worker));
 results.sort((a,b)=>jobs.indexOf(a.key)-jobs.indexOf(b.key));
 const all={complete:true,checked:0,requiredCombinations:characterCount*4*6*5*2,phaseSamples:4,viewChecks:0,rayChecks:0,rows:[],thirdPerson:[],firstPerson:[],lengths:[],failures:[],limits:results[0].result.limits,execution:'four-process weapon shards; HIP only'};
 for(const {result} of results){
  all.checked+=result.checked;all.viewChecks+=result.viewChecks;all.rayChecks+=result.rayChecks;
  for(const field of ['rows','thirdPerson','firstPerson','lengths','failures'])all[field].push(...result[field]);
 }
 assert.equal(all.rows.length,4);assert.equal(all.checked,all.requiredCombinations*4);assert.equal(all.lengths.length,characterCount);assert.equal(all.thirdPerson.length,characterCount*4);assert.equal(all.firstPerson.length,24);assert.equal(all.rayChecks,characterCount*4*2*3*8);
 const grouped={};
 for(const c of all.thirdPerson){const r=grouped[c.character]??={character:c.character,maxFistError:0,minClearance:Infinity,failedCases:0};r.maxFistError=Math.max(r.maxFistError,c.maxRightError,c.maxLeftError);r.minClearance=Math.min(r.minClearance,c.minClearance);r.failedCases+=c.failedCases;}
 all.worst=Object.values(grouped).sort((a,b)=>a.minClearance-b.minClearance).slice(0,5);
 all.failedCombinations=all.failures.length;
 await writeFile(new URL('./round5-check-results.json',import.meta.url),JSON.stringify(all,null,2)+'\n');
 await writeFile(new URL('./round5-summary.json',import.meta.url),JSON.stringify({checked:all.checked,failedCombinations:all.failedCombinations,rows:all.rows,firstPerson:all.firstPerson,worst:all.worst},null,2)+'\n');
 await writeFile(new URL('./round5-arm-lengths.json',import.meta.url),JSON.stringify(all.lengths,null,2)+'\n');
 console.table(all.rows.map(({weapon,maxRightError,maxLeftError,minClearance,failedCases})=>({weapon,maxRightError,maxLeftError,minClearance,failedCases})));
 assert.ok(results.every(r=>r.exit===0)&&all.failures.length===0,`ROUND 5 ACCEPTANCE FAILED: ${all.failures.length} cases; full list in src/weapons/round5-check-results.json`);
 return all;
}
