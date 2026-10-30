"""Four complete MapData alternatives. M2 remains an immutable comparison map.

L/R refer to the north/south M2 routes, not to the mirrored team halves.
All new geometry is generated once; no runtime procedural generation.
"""
from pathlib import Path
import json,copy,math,hashlib
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'baselines/m2-data.json').read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sig(b):return json.dumps(b,sort_keys=True,separators=(',',':'))

DESIGNS={
 'L1':{'name':'Керамічний квартал','lines':['Кімнатні майстерні, теракотові печі й кремові галереї.','Короткий шлях іде крізь майстерню, обхід — через двір доставки.','Впізнавані місця: ґанок, зал гончарів, двір високих ящиків.']},
 'L2':{'name':'Поштовий пасаж','lines':['Поштові зали зі східчастими ліхтарями та кольоровими посилками.','Наскрізний коридор і дві бічні брами утворюють петлю навколо сортування.','Впізнавані місця: експедиція, сортувальна зала, задній поштовий двір.']},
 'R1':{'name':'Ринок тентів','lines':['Відкритий базар із синьо-кремовими тентами та візками.','Прилавки розривають простріли, обхід проходить уздовж зовнішнього двору.','Впізнавані місця: вхідна крамниця, площа тентів, низька сцена.']},
 'R2':{'name':'Лимонадний сад','lines':['Тихий сад із павільйоном розливу, ящиками пляшок і зеленими острівцями.','Критий павільйон змінюється відкритою терасою з двома обходами.','Впізнавані місця: кіоск, зала розливу, тераса лимонадного саду.']},
}

def protected(b):
 # The complete approved centre, including roof stripes, both stair systems,
 # fountain, plaza archways, the big northern house and the original market.
 if abs(b['x'])<11.6 and abs(b['z'])<24:return True
 # Team spawn rooms, both shield doorways, outer bounds, and the original floor.
 if abs(b['x'])>23.3 and abs(b['z'])<=9.1:return True
 if abs(b['x'])==23 and abs(b['z'])<=11.0:return True
 if b['kind']=='floor' or (b['kind']=='decor' and b['y']<.03):return True
 if abs(b['x'])>33.3 or abs(b['z'])>33.3:return True
 return False

def build(left,right):
 d=copy.deepcopy(BASE);d['id']='toy-town-'+left.lower()+'-'+right.lower();d['name']='Toy Town · '+left+' / '+right
 added=[];meta={'id':d['id'],'left':left,'right':right,'rooms':[],'doors':[],'loops':[],'beats':[],'covers':[],'stairs':[],'connections':[],'nooks':[]}
 # Preserve the central return spine and the spawn-room baffles; replace side
 # fins, end screens and their attached decoration with inhabitable buildings.
 keep=[]
 for b in d['boxes']:
  x,z=abs(b['x']),b['z']
  if protected(b):keep.append(b);continue
  if abs(z)<10.01:
   # Shorten the return spine by .9m at each end: the new porch leaves >=3m.
   if x==16 and abs(z)>5 and b['kind']=='wall':
    lo,hi=sorted([z-b['d']/2,z+b['d']/2]);lo=max(lo,-9.8);hi=min(hi,9.8)
    if hi>lo:keep.append(dict(b,z=(lo+hi)/2,d=hi-lo))
   elif x==16 and abs(z)>5 and b['kind']=='decor':continue
   else:keep.append(b)
   continue
  # Keep north clocks and original centre attachments selected above. Everything
  # beyond the galleries is replaced, never moved into a protected spawn circle.
 d['boxes']=keep
 d['instances']=[i for i in d['instances'] if (abs(i['x'])<11.6 and abs(i['z'])<24) or (abs(i['x'])>23.3 and abs(i['z'])<=9.1)]
 seq=0
 def box(x,y,z,w,h,depth,col,kind='wall',outline=True,collide=True,top=None):
  nonlocal seq
  seq+=1
  if collide:w-=seq*.000001;h-=seq*.000001;depth-=seq*.000001
  b=dict(x=round(x,6),y=round(y,6),z=round(z,6),w=round(w,6),h=round(h,6),d=round(depth,6),color=col,top=top or col,outline=outline,kind=kind,collide=collide,blocksShots=collide)
  added.append(b);return b
 def solid(x,z,w,depth,height,col,kind='wall',outline=True):
  # Unequal embedded bottoms avoid coincident internal faces at box junctions.
  e=.010+seq*.000031;top=height+(seq*.000037 if kind=='wall' else 0)
  return box(x,(top-e)/2,z,w,top+e,depth,col,kind,outline)
 def decor(x,y,z,w,h,depth,col,outline=False):return box(x,y,z,w,h,depth,col,'decor',outline,False)
 def part(x,z,w,depth,height,col):return solid(x,z,w,depth,height,col,'wall' if height>1.2 else 'prop')
 def wall_x(x,lo,hi,col,doors=(),height=4.5):
  cuts=sorted([(max(lo,c-s/2),min(hi,c+s/2),c,s) for c,s in doors]);p=lo
  for a,b,c,s in cuts:
   if a>p:solid(x,(a+p)/2,.8,a-p-.008,height,col)
   box(x,(3.308+height)/2,c,.8,height-3.308,s-.012,col)
   meta['doors'].append({'x':x,'z':c,'axis':'z','width':s,'height':3.308})
   p=b
  if p<hi:solid(x,(p+hi)/2,.8,hi-p-.008,height,col)
 def wall_z(z,lo,hi,col,doors=(),height=4.5):
  p=lo
  for c,s in sorted(doors):
   a,b=c-s/2,c+s/2
   if a>p:solid((p+a)/2,z,a-p-.008,.8,height,col)
   box(c,(3.308+height)/2,z,s-.012,height-3.308,.8,col)
   meta['doors'].append({'x':c,'z':z,'axis':'x','width':s,'height':3.308});p=b
  if p<hi:solid((p+hi)/2,z,hi-p-.008,.8,height,col)
 def roof(x,z,w,depth,col,y=4.65):
  box(x,y,z,w,.25,depth,col,'wall',True)
 def step_platform(x,z,w,depth,col,front=1):
  # Three .20m risers, .45m treads. The landing remains below the 2.5m balcony.
  part(x,z,w,depth,.6,col)
  for i in range(3):
   zz=z+front*(depth/2+.225+(2-i)*.45)
   b=box(x,(i+1)*.2-.099,zz,w,.198,.448,col,'stair',True)
   if i:solid(x,zz,w,.448,i*.2-.003,col,'wall',False)
  meta['stairs'].append({'x':x,'z':z,'rise':.2,'tread':.448,'steps':3,'top':.6})
 def stripe_canopy(x,z,w,depth,col,y=4.25):
  roof(x,z,w,depth,col,y)
  for i in range(5):
   stripe='awning:cream' if i%2 else col
   decor(x-w/2+(i+.5)*w/5,y+.133,z,w/5-.006,.012,depth-.03,stripe)
   for face in [-1,1]:decor(x-w/2+(i+.5)*w/5,y-.06,z+face*(depth/2+.016),w/5-.006,.27,.024,stripe)
 def crate(x,z,size,height,col):
  b=part(x,z,size,size,height,col);meta['covers'].append({'x':x,'z':z,'height':height,'w':size,'d':size})
  # The small straps use the same palette and merged static geometry.
  decor(x,b['y']+b['h']/2+.01,z,size*.17,.012,size-.07,'zone:Mid Square:cream')
 def stall(x,z,w,depth,col):
  part(x,z,w,1.0,1.6,col)
  for dx in [-w/2+.12,w/2-.12]:solid(x+dx,z+.2,.24,depth,4.2,col)
  stripe_canopy(x,z+.2,w+.12,depth,col)
  meta['covers'].append({'x':x,'z':z,'height':1.6,'w':w,'d':1})
 def window(x,z,axis,col):
  # Toy inset glazing, not an unlabelled low crawl opening.
  if axis=='x':decor(x,2.15,z,.026,1.3,2.1,col,True)
  else:decor(x,2.15,z,2.1,1.3,.026,col,True)
 def mirrored(sign,opt,north):
  # All authored coordinates are +X and +Z; the two team halves are exact mirrors.
  nonlocal seq
  seq=0
  start=len(added);mstarts={k:len(meta[k]) for k in ['rooms','doors','loops','beats','covers','stairs','connections','nooks']}
  warm=sign<0
  col='zone:'+('West Gallery' if warm else 'East Gallery')+':sand'
  trim='accent:'+('Spawn A' if warm else 'Spawn B')
  cream='zone:'+('Spawn A' if warm else 'Spawn B')+':cream'
  roofcol='roof:terracotta' if warm else 'zone:East Gallery:blue'
  awning='accent:Spawn A' if warm else 'awning:blue'
  leaf='green:0' if warm else 'green:1'
  # Existing shield remains solid through the porch; the new doors are farther
  # from the spawn room and open both the internal and outer circulation loops.
  if north:
   wall_x(12,4.0,33.6,col,[(21.8,5.8),(28.5,3.2)])
   wall_x(23,12.1,27.0,col,[(22.5,3.2)])
   wall_z(12.9,12.404,23.396,col,[(20.8,3.6)])
   wall_z(27.0,12.404,23.396,col,[(20.0,3.2)])
   if opt=='L1':wall_z(19.35,12.404,22.602,col,[(16.6,3.2)])
   wall_z(23.5,12.404,22.602,col,[(20.0,3.2)])
   roof(17.5,19.5,11.1,14.5,roofcol)
   # Two roof blocks leave the toy silhouette solid, with no game walkable roof.
   roof(17.5,19.5,8.5,11.7,roofcol if opt=='L1' else cream,4.98)
   for z in [14.8,25.5]:window(23.416,z,'x','zone:Spawn B:glass')
   decor(20.8,3.7,12.484,3.05,.25,.026,trim,True)
   decor(15.0,2.5,12.484,2.4,1.4,.026,cream,True)
   if opt=='L1':
    decor(13.5,2.3,19.766,1.8,1.2,.026,cream,True)
    for x in [13.0,13.5,14.0]:decor(x,2.3,19.79,.16,.65,.026,trim,True)
    for y,w in [(2.2,1.1),(2.6,.85),(2.9,.55)]:decor(15,y,12.455,w,.32,.025,roofcol,True)
   else:
    decor(15,2.5,12.455,1.65,.8,.025,trim,True)
    decor(15,2.6,12.43,1.5,.13,.025,cream)
   if opt=='L1':
    # Two chunky kiln towers live against the north wall. Spawn circles stay free.
    solid(14.6,24.3,2.8,2.6,2.4,roofcol)
    decor(14.6,1.3,22.982,1.5,1.0,.026,'outline',True)
    box(14.6,5.7,23.8,1.4,1.4,1.5,roofcol,'wall',True)
    crate(13.2,18.1,1.6,1.0,cream)
    crate(26.0,29.6,2.0,2.4,cream)
   else:
    # Parcel sorting island: two ways around; the rear room remains uncluttered.
    part(14.0,19.1,3.2,2.0,1.0,cream)
    for x,z,c in [(13.4,18.6,trim),(14.5,19.5,roofcol)]:
     box(x,1.3,z,.7,.6,.7,c,'prop',True)
    box(17.5,5.38,19.5,5.5,.6,4.4,cream,'wall',True)
    for z in [17.284,21.716]:decor(17.5,5.38,z,4.4,.35,.026,'zone:Spawn B:glass',True)
    crate(26.0,29.6,2.0,2.4,roofcol)
    part(14.6,25.0,2.8,2.0,2.4,trim)
    decor(14.6,1.4,23.984,2.3,.15,.026,cream)
    decor(12.416,2.4,16.0,.026,1.3,3.0,cream,True)
    for z in [15.1,16.0,16.9]:decor(12.44,2.4,z,.026,.6,.65,trim,True)
   meta['rooms'] += ([dict(x=17.5,z=16.125,w=10.2,d=5.65,ceiling=4.525),dict(x=17.5,z=21.425,w=10.2,d=3.35,ceiling=4.525)] if opt=='L1' else [dict(x=17.5,z=18.2,w=10.2,d=9.8,ceiling=4.525)])+[dict(x=17.5,z=25.25,w=10.2,d=2.7,ceiling=4.525)]
   meta['beats'] += [dict(id='porch',x=20.3,z=11.2,lookX=20.3,lookZ=16),dict(id='hall',x=20.2,z=22,lookX=14.3,lookZ=20.3 if opt=='L1' else 18.8),dict(id='yard',x=19.8,z=28.3,lookX=15.5,lookZ=31)]
   meta['loops'].append(dict(a=dict(x=20,z=22),b=dict(x=20,z=29),viaA=dict(x=20,z=26.5),viaB=dict(x=26,z=23)))
   meta['connections'] += [dict(x=12,z=0,w=8.0),dict(x=12,z=21.8,w=5.8),dict(x=12,z=28.5,w=3.2)]
   solid(18.8,31.5,7.6,3.0,4.4,col)
   roof(18.8,31.5,7.8,3.1,roofcol,4.6)
  else:
   wall_x(12,4.0,33.6,col,[(19.2,3.2)])
   wall_x(23,12.1,33.6,col,[(21.5,3.2),(30.0,3.2)])
   # An actual corner shop, not a freestanding slab across the street.
   solid(14.8,14.7,4.8,4.4,4.5,col)
   roof(14.8,14.7,5.1,4.5,roofcol)
   window(17.216,14.8,'x','zone:Spawn B:glass')
   decor(14.8,2.3,12.484,3.2,1.3,.026,cream,True)
   for i in range(3):decor(13.9+i*.9,2.3,12.455,.38,.8,.025,awning if opt=='R1' else leaf,True)
   if opt=='R1':
    # Stalls are irregular but all walking gaps are at least 3.0m.
    stall(13.9,22.0,3.0,2.0,awning)
    stall(20.9,28.7,3.0,2.0,awning)
    step_platform(20.6,31.7,3.2,2.6,cream,front=-1)
    decor(16,4.8,28.7,4.0,.6,.12,awning,True)
   else:
    # The narrow pavilion has a roof, tall open ends and a .6m terrace outside.
    wall_x(15.5,16.4,27.6,col,[(20.5,3.2)],height=4.65)
    wall_z(16.4,15.5,23.0,col,[(18.3,3.2)],height=4.65)
    wall_z(27.6,15.5,23.0,col,[(20.3,3.2)],height=4.65)
    roof(19.0,22.0,8.0,11.7,cream,4.75)
    box(20,4.98,23.1,3.8,.35,7.0,leaf,'wall',True)
    part(14.6,22.5,3.2,2.0,1.0,leaf)
    crate(16.5,17.0,1.2,1.0,trim)
    step_platform(20.5,31.6,3.2,2.8,cream,front=-1)
    crate(14.6,29.2,2.0,2.4,col)
    meta['rooms'].append(dict(x=20,z=23.1,w=5.2,d=8.2,ceiling=4.525))
   meta['beats'] += [dict(id='shop',x=20.5,z=11.0,lookX=15.6,lookZ=14.4),dict(id='square',x=20,z=23,lookX=15,lookZ=22),dict(id='terrace',x=20.5,y=.6,z=31.5,lookX=20,lookZ=23)]
   meta['loops'].append(dict(a=dict(x=20,z=22),b=dict(x=20,z=30),viaA=dict(x=20,z=27.3),viaB=dict(x=26,z=24)))
   meta['connections'] += [dict(x=12,z=0,w=8.0),dict(x=12,z=19.2,w=3.2)]
   # Covered bend on the outer courtyard: a real 2.7m-wide gallery, open at
   # both ends, makes the side gate turn rather than fire through a second gate.
   solid(26.5,21.45,.8,7.5,4.5,col)
   roof(24.8,21.45,4.3,7.6,awning)
   solid(27.9,21.0,2.0,2.0,4.5,col)
   roof(27.4,21.2,3.2,2.8,awning,4.9)
   solid(30.07,18.5,6.26,1.0,4.5,col)
   roof(30.07,18.5,6.26,1.2,awning,4.9)
   solid(31.6,17.8,3.2,.8,4.5,col)
   meta['rooms'].append(dict(x=24.75,z=22.3,w=2.7,d=5.8,ceiling=4.525))
   solid(15.7,31.5,6.6,3.48,4.4,col)
   roof(15.7,31.5,6.8,3.48,awning,4.6)
   solid(15.6,26.575,6.4,5.65,4.4,col)
   roof(15.6,26.575,6.6,5.65,awning,4.6)
   solid(15.95,23.5,7.1,.5,4.4,col)
   window(18.816,27.0,'x','zone:Spawn B:glass')
  # A boundary-attached utility house forces a corner immediately after the
  # spawn-room exit. It also caps the long back-alley sightline on each half.
  solid(31.0 if north else 31.6,14.5 if north else 14.45,4.48 if north else 3.2,6.0 if north else 5.9,4.6,col)
  roof(31 if north else 31.6,14.5 if north else 14.45,4.48 if north else 3.2,6.2 if north else 6.1,roofcol,4.78)
  window(28.734 if north else 29.984,14.7 if north else 14.45,'x','zone:Spawn B:glass')
  # A low lean-to and chimney make this a landmark with a protected yard.
  box(31,5.35,15.5,1.6,.85,2.4,cream,'wall',True)
  crate(32.25,23.5,2.0,1.6,col)
  part(31.5,28.82,3.48,8.84,2.4,leaf)
  if north:part(24.7,15.8,2.6,1.0,1.6,col)
  else:part(28.7,13.5,2.6,1.0,1.6,col)
  if not north and opt=='R1':
   solid(23.8,15.2,.8,1.0,4.4,col)
   roof(26.7,15.2,6.6,1.2,awning)
  # The canopy starts above 3.2m: its underside never creates an accidental
  # low passage. Two flat greens read as a toy tree, without a new material.
  tz=22.0 if north else 28.5
  solid(26.5,tz,1.0,1.0,1.0,cream)
  solid(26.5,tz,.35,.35,3.35,'zone:Spawn A:wood' if warm else 'zone:Spawn B:wood')
  decor(26.5,3.8,tz,2.0,1.1,2.0,leaf,True)
  decor(26.5,4.55,tz,1.35,.4,1.35,'green:1' if warm else 'green:0',True)
  # Two different corners on the shared return arcade, one per route. These
  # chunky 2.4m cover cabinets replace the empty central run, not spawn geometry.
  if north:
   crate(21.1,6.5,3.0,2.4,col)
   part(18.1,14.0,3.6,3.0,2.4,col)
   solid(21.1,20.0,3.0,1.0,4.4,col)
  else:
   part(17.8,6.5,3.6,1.0,2.4,col)
   part(21.4,15.3,2.4,1.0,2.4,col)
   part(20.8,20.0,3.6,1.0,2.4,col)
   solid(19.45,10.1,1.1,1.0,4.4,col)
   roof(19.45,10.1,6.3,1.2,awning)
  # All additions and their audit metadata are mirrored with exactly the same
  # box dimensions; only the palette differs across team halves.
  for b in added[start:]:b['x']=round(sign*b['x'],6);b['z']=round((1 if north else -1)*b['z'],6)
  def transform(v):
   if isinstance(v,dict):
    if 'x'in v:v['x']*=sign
    if 'z'in v:v['z']*=1 if north else -1
    if 'lookX'in v:v['lookX']*=sign
    if 'lookZ'in v:v['lookZ']*=1 if north else -1
    for k,x in v.items():
     if isinstance(x,(dict,list)):transform(x)
   elif isinstance(v,list):
    for x in v:transform(x)
  for k,startmeta in mstarts.items():
   for v in meta[k][startmeta:]:transform(v);v['lane']='LEFT' if north else 'RIGHT';v['half']='A' if sign<0 else 'B'
 for north,opt in [(True,left),(False,right)]:
  for s in [-1,1]:mirrored(s,opt,north)
 # Cross-lane route is the existing 3.3m return arcade; never passes through MID.
 meta['crossLane']=[{'x':s*14.25,'fromZ':-11.6,'toZ':11.6,'width':3.3} for s in [-1,1]]
 for zz,depth in [(27.05,7.1),(-28.3,9.8)]:
  solid(0,zz,4.0 if zz>0 else 6.0,depth,4.6,'zone:Mid Square:clay')
  roof(0,zz,4.3 if zz>0 else 6.3,depth+.1,'zone:Mid Square:cream',4.8)
 for zz,depth in [(29.6,7.2),(-22.15,8.3)]:
  pair_seq=seq
  for xx in ([-6.5,6.5] if zz>0 else [-7.0,7.0]):
   seq=pair_seq
   solid(xx,zz,2.6,depth,4.4,'zone:Mid Square:clay')
   roof(xx,zz,2.8,depth+.2,'zone:Mid Square:cream',4.6)
 # A pair of small open arches behind the approved house. Their north/south
 # opening is 2.6m; solid side cheeks stop shots across the back street.
 gate_seq=seq
 for s in [-1,1]:
  seq=gate_seq
  for x in [8.55,11.45]:solid(s*x,26.4,.3,1.2,4.4,'zone:Mid Square:clay')
  roof(s*10,26.4,3.2,1.4,'zone:Mid Square:cream',4.6)
 d['boxes']+=added
 # All original spawn and loot positions are retained, and protected geometry
 # is compared byte-for-byte by verify-m3 before any new baseline is accepted.
 meta['protectedCount']=sum(protected(b) for b in BASE['boxes'])
 meta['protectedHash']=hashlib.sha256(''.join(sig(b) for b in BASE['boxes'] if protected(b)).encode()).hexdigest()
 meta['addedCount']=len(added)
 meta['covers']=[dict(x=b['x'],z=b['z'],w=b['w'],d=b['d'],height=b['y']+b['h']/2,lane='LEFT' if b['z']>0 else 'RIGHT',half='A' if b['x']<0 else 'B') for b in added if b['collide'] and b['y']-b['h']/2<.01 and min(abs(b['y']+b['h']/2-h) for h in [1,1.6,2.4])<.02]
 # These are full MapData files, one for each independent lane combination.
 save(ROOT/'data'/f"{d['id']}.json",d)
 save(ROOT/'reports/m3'/f"{d['id']}-design.json",meta)
 return d,meta

if __name__=='__main__':
 variants=[]
 for l in ['L1','L2']:
  for r in ['R1','R2']:
   d,m=build(l,r);variants.append({'id':d['id'],'left':l,'right':r,'name':d['name']})
 save(ROOT/'data/m3-options.json',{'designs':DESIGNS,'variants':variants})
 print('Generated four independent full MapData alternatives; M2 data unchanged.')
