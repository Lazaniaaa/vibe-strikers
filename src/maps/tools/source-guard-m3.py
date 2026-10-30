from pathlib import Path
import json,zipfile,hashlib,re
ROOT=Path(__file__).resolve().parents[3]
changed=[];protected=0;api_changed=[]
with zipfile.ZipFile(ROOT/'outputs/weapons-stage-a-round9-source.zip') as z:
 for name in z.namelist():
  if name.endswith('/') or name=='vite.config.js':continue
  p=ROOT/name
  protected+=1
  if not p.exists() or p.read_bytes()!=z.read(name):changed.append(name)
with zipfile.ZipFile(ROOT/'outputs/toy-town-m2-source.zip') as z:
 for name in ['src/maps/types.ts','src/maps/buildMap.ts','src/maps/boxes.ts','vite.config.js']:
  if (ROOT/name).read_bytes()!=z.read(name):api_changed.append(name)
 old=z.read('src/maps/index.ts').decode();new=(ROOT/'src/maps/index.ts').read_text(encoding='utf-8')
 for function in ['mapColliders','mapShotBlockers','spawnPoints']:
  pattern=r'export function '+function+r'\([^\n]+'
  if re.search(pattern,old).group()!=re.search(pattern,new).group():api_changed.append('index.ts:'+function)
out={'protectedFiles':protected,'changed':changed,'apiChanged':api_changed,'registryOnly':not api_changed,'note':'index.ts registers four additional ids; signatures, data schema and geometry builder are unchanged.'}
(ROOT/'src/maps/reports/m3/source-guard.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
print(json.dumps(out))
raise SystemExit(bool(changed or api_changed))
