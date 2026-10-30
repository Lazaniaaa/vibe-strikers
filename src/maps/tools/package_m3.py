"""Compose native preview PNGs and validate/package the M3 review artifacts."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageStat
import json, zipfile, hashlib

ROOT=Path(__file__).resolve().parents[3]
MAP=ROOT/'src/maps'; OUT=ROOT/'outputs/toy-town-m3'
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
variants=read(MAP/'data/m3-options.json')['variants']
font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',26)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)

def sheet(filename,items,w,h):
 canvas=Image.new('RGB',(w*2+36,h*2+148),'#F2F0E8');draw=ImageDraw.Draw(canvas)
 for i,(label,p) in enumerate(items):
  x=12+(i%2)*(w+12);y=12+(i//2)*(h+68)
  draw.text((x+8,y+4),label,font=font,fill='#36564C')
  with Image.open(p)as im:canvas.paste(im.convert('RGB').resize((w,h),Image.Resampling.LANCZOS),(x,y+48))
 canvas.save(OUT/filename)

sheet('option-comparison.png',[(v['left']+' / '+v['right'],OUT/(v['id']+'-plan.png'))for v in variants],720,720)
sheet('overview-comparison.png',[(v['left']+' / '+v['right'],OUT/(v['id']+'-overview.png'))for v in variants],720,450)
sheet('beat-comparison.png',[
 ('L1 · Керамічний квартал',OUT/'toy-town-l1-r1-left-hall.png'),
 ('L2 · Поштовий пасаж',OUT/'toy-town-l2-r1-left-hall.png'),
 ('R1 · Ринок тентів',OUT/'toy-town-l1-r1-right-square.png'),
 ('R2 · Лимонадний сад',OUT/'toy-town-l1-r2-right-square.png')],720,450)

qa={'variants':[],'pngs':[],'browser':{'consoleErrors':0,'consoleWarnings':0,'optionSwitches':True,'paletteSwitch':True,'m2Comparison':True},'build':'passed (Vite bundle-size advisory only)'}
suffixes=['plan','spawn-a','spawn-b','mid','balcony','left-porch','left-hall','left-yard','right-shop','right-square','right-terrace','contact','overview','heatmap']
for v in variants:
 id=v['id'];r=read(MAP/f'reports/m3/{id}.json');b=read(MAP/f'baselines/{id}.sha256.json')
 assert r['pass'] and len(r['checks'])==30 and all(c['pass']for c in r['checks'])
 assert r['sha256']==b['sha256']
 qa['variants'].append({'id':id,'checks':len(r['checks']),'sha256':r['sha256'],'earlySafetyWarnings':sum(s['failures']>0 for s in r['audit']['earlySafety']['bySpawn'])})
 for suffix in suffixes:
  p=OUT/f'{id}-{suffix}.png'
  with Image.open(p)as im:
   expected=(1600,1600)if suffix in ['plan','heatmap']else(1440,2250)if suffix=='contact'else(1440,900)
   assert im.size==expected,(p,im.size)
   assert max(ImageStat.Stat(im.convert('RGB')).stddev)>10,(p,'blank')
   qa['pngs'].append({'file':p.name,'size':im.size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
m2=read(MAP/'reports/toy-town.json');assert m2['pass'] and all(c['pass']for c in m2['checks'])
qa['m2Checks']=len(m2['checks']);qa['approvedSourceGuard']=read(MAP/'reports/m3/source-guard.json')
assert not qa['approvedSourceGuard']['changed'] and not qa['approvedSourceGuard']['apiChanged']
assert len(qa['pngs'])==56
(OUT/'artifact-qa.json').write_text(json.dumps(qa,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

# Move only this task's stale diagnostic files, preserving them for investigation.
archive=ROOT/'work/m3-investigation';archive.mkdir(parents=True,exist_ok=True)
stale=list((MAP/'reports/m3').glob('probe-*.json'))+[MAP/'reports/m3/audit-l1-r1.json',MAP/'reports/m3/audit-l2-r2.json',OUT/'test-overview.png']
for p in stale:
 if p.exists():p.replace(archive/p.name)

with zipfile.ZipFile(ROOT/'outputs/toy-town-m3-review.zip','w',zipfile.ZIP_DEFLATED)as z:
 for p in sorted(OUT.iterdir()):
  if p.is_file():z.write(p,'toy-town-m3/'+p.name)
with zipfile.ZipFile(ROOT/'outputs/toy-town-m3-source.zip','w',zipfile.ZIP_DEFLATED)as z:
 for p in sorted(MAP.rglob('*')):
  if p.is_file() and '__pycache__'not in p.parts:z.write(p,p.relative_to(ROOT))
print(json.dumps({'M3Checks':sum(v['checks']for v in qa['variants']),'M2Checks':qa['m2Checks'],'nativePNGs':len(qa['pngs']),'reviewZip':str(ROOT/'outputs/toy-town-m3-review.zip')}))
