import { generateSkinTraits, skinMetadata, SKIN_RARITIES, type SkinRarity } from './skinTraits';
import { weaponIds } from './weaponIds';
import { renderSkinImage, renderBaseWeaponImage, disposeSkinImageRenderer } from './renderSkinImage';
import './skinLab.css';
import {checkSkinRenders}from'./skinLabChecks';

const tierColours=['#8B9BB4','#4DC9A9','#4F9FE8','#AC7DE0','#FFB83D','#FF6C9B'];
const root=document.querySelector<HTMLElement>('#skin-lab')!;
root.innerHTML=`<header><div><h1>VOXEL LAB / SKIN GENERATOR</h1><p>Candy & Toys · tier silhouettes / reserved finishes · cosmetics only</p></div><label>SEED <input id="seed" type="number" value="1234" min="0" max="4294967295" step="1"></label><button id="generate">Generate</button><button id="contact">Contact sheet · 3 seeds</button></header><p id="status" aria-live="polite">Preparing deterministic traits…</p><div class="table-wrap"><table><thead><tr><th>Weapon</th><th>Base</th>${SKIN_RARITIES.map((r,i)=>`<th style="color:${tierColours[i]}">${r}</th>`).join('')}</tr></thead><tbody id="rows"></tbody></table></div><section id="sample"><details><summary>Metadata / recipe (click an image)</summary><pre id="metadata"></pre></details></section><section id="contact-output"></section><footer>No minting, chain code, drop rates or gameplay values. Identical seeds are reproducible; simple low-tier looks are finite, so minting must deduplicate appearance keys.</footer>`;
const rows=document.querySelector('#rows')!,seedInput=document.querySelector<HTMLInputElement>('#seed')!,status=document.querySelector<HTMLElement>('#status')!,metadata=document.querySelector<HTMLElement>('#metadata')!;
const checks=document.createElement('button');checks.textContent='GPU checks · VM / far';document.querySelector('header')!.append(checks);
const lod=document.createElement('select');lod.id='lod';lod.setAttribute('aria-label','Model detail');lod.innerHTML='<option value="near">Near · detail kits</option><option value="far">Far · one draw</option>';document.querySelector('header')!.append(lod);
const png=document.createElement('button');png.textContent='Selected · PNG 512';document.querySelector('header')!.append(png);
let selected=generateSkinTraits({weapon:'rifle',rarity:'mythic',seed:1234});
png.onclick=async()=>{png.disabled=true;try{const a=document.createElement('a');a.id='skin-512';a.download=`${selected.weapon}-${selected.rarity}-512.png`;a.href=await renderSkinImage(selected,512);a.textContent='Download selected skin · 512 × 512';document.querySelector('#sample')!.append(a);}finally{png.disabled=false;}};
checks.onclick=async()=>{checks.disabled=true;try{const r=await checkSkinRenders(text=>{status.textContent=text;});const pre=document.createElement('pre');pre.id='gpu-results';pre.textContent=JSON.stringify(r,null,2);document.querySelector('#sample')!.append(pre);status.textContent=`GPU assets ${r.assetPass?'PASS':'FAIL'} · ${r.cases} VM masks · max extra ${r.maxExtraPixels} pixels · world+shadows budget ${r.budgetPass?'PASS':'FAIL'} (${r.frame.shadowFrame.calls}/120 draws)`;status.dataset.gpu=r.pass?'pass':'fail';}catch(e){status.textContent='GPU check failed: '+String(e);status.dataset.gpu='fail';console.error(e);}finally{checks.disabled=false;}};
let generation=0;
const cells:HTMLImageElement[]=[],captions:HTMLElement[]=[],links:HTMLAnchorElement[]=[];
for(const weapon of weaponIds){const row=document.createElement('tr');row.innerHTML=`<td class="weapon-name"><strong>${weapon}</strong></td><td><article style="--tier:#25364B"><img id="base-${weapon}" alt="${weapon} base weapon"><p>Original · no skin</p></article></td>`;for(let i=0;i<SKIN_RARITIES.length;i++){const cell=document.createElement('td');cell.innerHTML=`<article style="--tier:${tierColours[i]}"><img alt="${weapon} ${SKIN_RARITIES[i]} procedural skin"><p>…</p><a download="${weapon}-${SKIN_RARITIES[i]}.png">PNG</a></article>`;cells.push(cell.querySelector('img')!);captions.push(cell.querySelector('p')!);links.push(cell.querySelector('a')!);row.append(cell);}rows.append(row);}
const pause=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
async function generate():Promise<void>{const token=++generation,seed=Number(seedInput.value);if(!Number.isInteger(seed)||seed<0||seed>0xffffffff){status.textContent='Seed must be a uint32 integer.';return;}
 let index=0;status.dataset.ready='false';status.textContent='Rendering 0 / 66…';
 for(const weapon of weaponIds){if(token!==generation)return;const image=document.querySelector<HTMLImageElement>('#base-'+weapon)!;if(!image.src)image.src=await renderBaseWeaponImage(weapon,160);}
 for(const weapon of weaponIds)for(const rarity of SKIN_RARITIES){if(token!==generation)return;const i=index++,traits=generateSkinTraits({weapon,rarity,seed});
  const url=await renderSkinImage(traits,160,{lod:lod.value==='far'?'far':'near'});if(token!==generation)return;cells[i].src=url;links[i].href=url;captions[i].textContent=`${traits.silhouette.name} · ${traits.finish}`;
  cells[i].onclick=()=>{selected=traits;metadata.textContent=JSON.stringify({traits,metadata:skinMetadata(traits,'preview')},null,2);};status.textContent=`Rendered ${index} / 66 · seed ${seed}`;if(index%3===0)await pause();
 }status.dataset.ready='true';status.textContent=`66 / 66 · seed ${seed} · same input = same traits JSON`;}
document.querySelector('#generate')!.addEventListener('click',()=>void generate());seedInput.addEventListener('change',()=>void generate());
lod.addEventListener('change',()=>void generate());
document.querySelector('#contact')!.addEventListener('click',async()=>{const button=document.querySelector<HTMLButtonElement>('#contact')!;button.disabled=true;const seed=Number(seedInput.value)>>>0;
 try{const weapons=['rifle','beam','paintGrenade'] as const,size=112,label=22,baseRow=144,head=24,canvas=document.createElement('canvas');canvas.width=size*7;canvas.height=baseRow+head+(size+label)*9;const c=canvas.getContext('2d')!;
  c.fillStyle='#FFF8E9';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#25364B';c.font='bold 12px system-ui';c.fillText('BASE WEAPONS · fixed camera and scale',8,15);
  const load=async(url:string)=>{const image=new Image();image.src=url;await image.decode();return image;};
  const originals=await Promise.all(weapons.map(async weapon=>load(await renderBaseWeaponImage(weapon,size))));
  for(let i=0;i<3;i++){const x=i*canvas.width/3+(canvas.width/3-size)/2;c.drawImage(originals[i],x,23);c.fillStyle='#25364B';c.fillText(weapons[i],x,baseRow-3);}
  for(const [i,name]of['BASE',...SKIN_RARITIES].entries()){c.fillStyle=i===0?'#25364B':tierColours[i-1];c.fillRect(i*size,baseRow,size,4);c.fillStyle='#25364B';c.font='bold 10px system-ui';c.fillText(name,i*size+5,baseRow+17);}
  for(let wi=0;wi<3;wi++)for(let si=0;si<3;si++){const row=wi*3+si,value=(seed+si)>>>0,y=baseRow+head+row*(size+label);c.fillStyle='#25364B';c.font='10px system-ui';c.fillText(`${weapons[wi]} · seed ${value}`,5,y+15);c.drawImage(originals[wi],0,y+label);
   for(let tier=0;tier<6;tier++){const traits=generateSkinTraits({weapon:weapons[wi],rarity:SKIN_RARITIES[tier],seed:value});c.drawImage(await load(await renderSkinImage(traits,size)),(tier+1)*size,y+label);}await pause();
  }
  const output=document.querySelector('#contact-output')!;output.replaceChildren();
  const show=(canvas:HTMLCanvasElement,id:string,text:string)=>{const image=new Image();image.src=canvas.toDataURL('image/png');image.id=id==='contact-png'?'skin-contact-sheet':id+'-image';image.alt=text;const link=document.createElement('a');link.id=id;link.href=image.src;link.download=id+'.png';link.textContent=text;output.append(link,image);};
  show(canvas,'contact-png','Contact sheet · base row + base / six tiers side by side · 112px');
  const tiny=document.createElement('canvas'),tc=tiny.getContext('2d')!;tiny.width=7*64;tiny.height=24+weaponIds.length*82;tc.fillStyle='#FFF8E9';tc.fillRect(0,0,tiny.width,tiny.height);tc.fillStyle='#25364B';tc.font='9px system-ui';['BASE',...SKIN_RARITIES].forEach((s,i)=>tc.fillText(s,i*64+2,16));
  for(let row=0;row<weaponIds.length;row++){const weapon=weaponIds[row],y=24+row*82;tc.fillStyle='#25364B';tc.fillText(weapon,3,y+12);tc.drawImage(await load(await renderBaseWeaponImage(weapon,64)),0,y+18);for(let tier=0;tier<6;tier++)tc.drawImage(await load(await renderSkinImage(generateSkinTraits({weapon,rarity:SKIN_RARITIES[tier],seed}),64)),(tier+1)*64,y+18);await pause();}
  show(tiny,'thumbnail-png','Distance strip · all eleven weapons · 64px');
  const mythic=generateSkinTraits({weapon:'rifle',rarity:'mythic',seed}),low=await renderSkinImage(mythic,160,{time:0}),high=await renderSkinImage(mythic,160,{time:1}),pulse=document.createElement('div');pulse.className='mythic-pulse';pulse.innerHTML=`<img alt="Mythic glow low" src="${low}"><img alt="Mythic glow high" src="${high}">`;output.append(pulse);
 }finally{button.disabled=false;}});
void generate();
if(import.meta.hot)import.meta.hot.dispose(()=>{generation++;void disposeSkinImageRenderer();});
