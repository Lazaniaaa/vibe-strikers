import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
const [label,...stems]=process.argv.slice(2);
if(!label||!stems.length)throw new Error('Usage: node src/characters/recordBatch.mjs label stem... (after npm run verify passes)');
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {characters}=await server.ssrLoadModule('/characters.ts');
 const {createCharacter}=await server.ssrLoadModule('/createCharacter.ts');
 const configs=stems.map(stem=>{const c=characters.find(c=>c.id===stem||c.id==='vibe-vibers-'+stem);if(!c)throw new Error('Missing '+stem);return c;});
 const baseline=createCharacter(characters[0]).userData.bodyExtents;
 const path=new URL('./SURVEY.md',import.meta.url);let text=await readFile(path,'utf8');
 const ids=new Set(configs.map(c=>c.id));
 text=text.split('\n').map(line=>{const cells=line.split('|');if(cells.length===14&&ids.has(cells[1].trim().replaceAll('`',''))){cells[cells.length-2]=' done ';return cells.join('|');}return line;}).join('\n');
 const marker=`<!-- batch:${label} -->`;if(text.includes(marker))throw new Error('Already recorded '+label);
 text+=`\n\n${marker}\n## Фаза 2 — ${label}: verify PASS, ${characters.length} готових\n\n`;
 text+='Кольори зняті з оригіналів; H0/H1/P0 та індивідуальні прапорці залишаються. `done` означає побудовано й перевірено. Нижче — габарити БЕЗ extras, лише дані, без зміни форми.\n\n';
 text+='| id | body W / 01 | body D / 01 | head-box W / 01 | head-box D / 01 |\n|---|---:|---:|---:|---:|\n';
 for(const c of configs){const e=createCharacter(c).userData.bodyExtents;text+='| `'+c.id+'` | '+[e.total.width/baseline.total.width,e.total.depth/baseline.total.depth,e.headBox.width/baseline.headBox.width,e.headBox.depth/baseline.headBox.depth].map(n=>n.toFixed(4)+'×').join(' | ')+' |\n';}
 text+='\nПрапорці цієї пачки:\n\n';for(const c of configs)text+='- `'+c.id+'`: '+(c.flags??[]).join('; ')+'.\n';
 await writeFile(path,text);console.log(`Recorded ${label}: ${configs.length} rows; total ${characters.length}.`);
}finally{await server.close();}
