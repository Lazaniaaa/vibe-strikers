"""Authoring helper only. Runtime/game consumes the single checked-in MapData JSON."""
from pathlib import Path
import json,math
import sys,runpy
# M2 is the default authoring path; the frozen M1 source is available explicitly.
if __name__=="__main__" and "--legacy-m1" not in sys.argv:
 runpy.run_path(str(Path(__file__).with_name("logic_m2.py")),run_name="__main__")
 raise SystemExit(0)
root=Path(__file__).resolve().parents[1]
palette={'outline':'#5D6565','sand':'#C8BDA7','sandTop':'#DED5C3','stone':'#B3BAB7','stoneTop':'#CFD4CD','blue':'#8E9FA8','blueTop':'#B6C3C8','clay':'#B99B88','clayTop':'#D7BAA3','wood':'#AC9576','woodTop':'#CFBA9A','leaf':'#94A68D','leafTop':'#BAC5AE','glass':'#C4D8D7','glassTop':'#E0EBE4','water':'#9BBCC0','waterTop':'#C9DDDB','cream':'#D6CEBA','creamTop':'#E8E1D1','gold':'#B8AB83','goldTop':'#D7CCAA'}
def box(x,y,z,w,h,d,color='stone',top=None,outline=False,kind='prop',collide=True,blocksShots=None):
 return dict(x=round(x,6),y=round(y,6),z=round(z,6),w=round(w,6),h=round(h,6),d=round(d,6),color=color,top=top or color+'Top',outline=outline,kind=kind,collide=collide,blocksShots=collide if blocksShots is None else blocksShots)
boxes=[];instances=[];wall_index=0
def add(*args,**kw): b=box(*args,**kw);boxes.append(b);return b
def pair(*args,**kw):
 b=box(*args,**kw);boxes.append(b)
 if b['x']!=0: boxes.append(dict(b,x=-b['x']))
 return b
def wallpair(x,z,w,d,h=5,color='sand'):
 # Distinct millimetre bottom planes at intersecting walls avoid coplanar faces.
 global wall_index;wall_index+=1
 bottom=-.002*wall_index;b=pair(x,bottom+h/2,z,w,h,d,color,kind='wall')
 decorpair(x,bottom+h+.004,z,w,.004,d,'outline',top='outline')
 return b
def decorpair(x,y,z,w,h,d,color='outline',top=None):return pair(x,y,z,w,h,d,color,top=top or color,kind='decor',collide=False)
def instpair(prefab,x,z,y=0,yaw=0):
 instances.append(dict(prefab=prefab,x=x,y=y,z=z,yaw=yaw))
 if x:instances.append(dict(prefab=prefab,x=-x,y=y,z=z,yaw=-yaw))
# Actual playable interior 66.5m; backdrop facades occupy the strip OUTSIDE the solid wall but INSIDE bounds.
add(0,-.45,0,70,.9,70,'stone',kind='floor')
for x in [-33.75,33.75]:add(x,3.252,0,1,6.5,66.504,'sand',kind='wall')
for z in [-33.75,33.75]:add(0,3.254,z,68.496,6.5,1,'sand',kind='wall')
for x in [-33.75,33.75]:add(x,6.506,0,1,.004,66.5,'outline',top='outline',kind='decor',collide=False)
for z in [-33.75,33.75]:add(0,6.508,z,68.49,.004,1,'outline',top='outline',kind='decor',collide=False)
for z,h,col in [(-24,9,'blue'),(-9,11,'cream'),(8,8,'clay'),(24,10,'stone')]:
 decorpair(34.65,h/2,z,.5,h,7,col,top=col+'Top')
# Spawn shields: north and south exits. Inner screens force the return to the three-route hub.
wallpair(23,0,.8,49.5)
wallpair(12,18.8,.8,29.6);wallpair(12,-18.8,.8,29.6)
# Five staggered screens in the rear lane. The 3m clear tips are deliberate.
for z in [-26,0,26]:wallpair(31.626,z,3.252,.55,color='blue')
for z in [-13,13]:wallpair((23.398+30.25)/2,z,30.25-23.398,.55,color='clay')
# Return alleys: alternating tips prevent a long straight sight line.
# A cross-door removes the blind pockets on both sides of this screen.
wallpair(20.802,0,3.6,.6,color='stone')
pair(17.651,4.156,0,2.698,1.696,.6,'stone',kind='wall')
# Two 3.2m cross-doors keep the return alleys from becoming long dead ends.
for z,d in [(-7.8,4.4),(0,4.8),(7.8,4.4)]:wallpair(16,z,.6,d,color='stone')
for z in [-4,4]:pair(16,4.156,z,.6,1.696,3.196,'stone',kind='wall')
for z in [-14,14]:wallpair((12.398+19)/2,z,19-12.398,.6,color='blue')
for z in [-28.1,28.1]:wallpair((18+25)/2,z,25-18,.6,color='stone')
# Side screens meet balcony shoulders; their 3m tips break the north/south sight corridor.
for z in [-6,6]:wallpair(10.449,z,3.898,.55,color='clay')
# Calm facade panels/edge trims on the two long shields.
for z in [-16,-8,0,8,16]:
 pair(23.414,2.3,z,.024,1.35,2.0,'glass',outline=True,kind='glass')
 decorpair(23.424,1.52,z,.05,.09,2.2,'cream',top='creamTop')
decorpair(23.412,.55,0,.024,.16,48.9,'blue',top='blueTop')
decorpair(23.412,4.96,0,.025,.12,48.9,'cream',top='creamTop')
# Central square paving and generous north/south arch clearances (>=4m).
add(0,.003,0,22,.004,17,'sand',kind='decor',collide=False)
for z in [-9,9]:add(0,4.3,z,23.15,.596,.55,'blue',outline=False,kind='wall')
for x in [-10.95,10.95]:
 for z in [-9,9]:add(x,2.0,z,.32,3.992,.55,'stone',kind='wall')
# Walk-through north house. Side doorways 3.8m wide x3.3m high; room height4.6m.
add(0,2.304,23,16,4.6,.38,'cream',kind='wall')
add(0,2.304,12,5.996,4.6,.38,'cream',kind='wall')
for x in [-7,7]:add(x,2.304,12,1.996,4.6,.38,'cream',kind='wall')
for x in [-4.5,4.5]:add(x,3.956,12,2.996,1.296,.38,'cream',kind='wall')
for x in [-7.81,7.81]:
 for z in [13.775,21.225]:add(x,2.306,z,.38,4.6,3.166,'sand',kind='wall')
 add(x,3.956,17.5,.38,1.296,3.796,'sand',kind='wall')
add(0,4.783,17.5,16.8,.348,11.8,'blue',kind='wall')
add(0,5.135,17.5,13.0,.348,8.8,'blue',kind='wall')
add(0,5.487,17.5,9.2,.348,5.8,'blue',kind='wall')
# Building corners and glass only: the large surfaces stay flat.
for x in [-7.94,7.94]:
 for z in [12,23]:add(x,2.308,z,.19,4.6,.5,'stone',outline=True,kind='decor',collide=False)
for x in [-5,0,5]:
 if x==0:add(x,2.3,11.79,2.0,1.5,.035,'glass',outline=True,kind='glass')
 add(x,2.3,23.21,2.0,1.5,.035,'glass',outline=True,kind='glass')
# North terminal kiosks cut the diagonal sight lane from the market stairs.
pair(10.199,2.256,28.5,4.398,4.5,3,'clay',kind='wall')
decorpair(10.199,4.518,28.5,4.6,.02,3.25,'blue',top='blueTop')
pair(9.5,2.3,26.979,1.4,1.3,.035,'glass',outline=True,kind='glass')
# Fountain: stepped basin, low1.0m cover. Curves remain square/stepped.
add(0,.127,0,4.8,.25,4.8,'stone',outline=True)
for z in [-1.9,1.9]:add(0,.627,z,4.4,.746,.4,'cream',outline=True)
for x in [-2,2]:add(x,.627,0,.4,.746,3.396,'cream',outline=True)
add(0,.306,0,3.59,.1,3.39,'water',kind='decor',collide=False)
add(0,1.4775,0,1.2,2.445,2.0,'stone',outline=True)
add(0,2.755,0,1.5,.106,2.2,'water',outline=True,kind='decor',collide=False)
# Symmetric outdoor sniper plinths. No low indoor ceiling beneath them.
for x in [-7.5,7.5]:
 add(x,1.177,6.002,4,2.346,4,'clay',kind='wall')
 add(x,2.426,6.002,4,.148,4,'cream',kind='floor')
 for sx in [-1,1]:add(x+sx*1.9,3.002,6.002,.18,.996,3.8,'blue',kind='wall')
 add(x,3.002,7.912,3.616,.996,.18,'blue',kind='wall')
wallpair(9.999,-22,3.198,1.8,h=4,color='blue')
# Market deck +2.5m with an intentional outdoor1.3m crouch-through passage.
for x in [-5.05,5.05]:add(x,1.177,-16.502,7.1,2.346,3,'clay',kind='wall')
add(0,1.826,-16.502,2.996,1.048,3,'clay',kind='wall')
add(0,2.426,-16.502,17.2,.148,3,'cream',kind='floor')
for x in [-6.05,6.05]:add(x,3.002,-17.912,5,.996,.18,'blue',kind='wall')
add(0,3.002,-17.912,7.096,.996,.18,'blue',kind='wall')
# Four flights,10 treads each. Actual tread boxes <=.25h and >=.40d.
for x in [-7.5,7.5]:
 for start,direction in [(-.5,1),(-10.5,-1)]:
  stair_x=x if direction==1 else x/7.5*7
  for i in range(10):
   top=(i+1)*.25;z=start+direction*(i+.5)*.45
   add(stair_x,top-.124,z,3.2,.248,.448,'stone',kind='stair')
   if i:add(stair_x,(top-.25+.004)/2,z,3.2,top-.25-.004,.448,'sand',kind='wall')
   add(stair_x,top+.003,z-direction*.207,3.1,.002,.028,'outline',top='outline',kind='decor',collide=False)
# Prefabs. Every definition is locally X-symmetric, so yaw reflection is exact.
prefabs={
 'crate':[box(0,.502,0,1,1,1,'wood',outline=True),box(0,.5,-.508,.12,.88,.012,'stone',kind='decor',collide=False),box(0,.5,.508,.12,.88,.012,'stone',kind='decor',collide=False)],
 'barrel':[box(0,.13,0,.72,.252,.72,'blue',outline=True),box(0,.58,0,.88,.644,.88,'wood',outline=True),box(0,.98,0,.72,.148,.72,'blue',outline=True)],
 'tree':[box(0,.9,0,.38,1.792,.38,'wood',outline=True),box(0,2.35,0,1.8,1.1,1.8,'leaf',outline=True),box(0,3.3,0,1.25,.796,1.25,'leaf',outline=True)],
 'bench':[box(0,.54,0,1.8,.176,.65,'wood',outline=True),box(-.65,.225,0,.18,.442,.45,'stone'),box(.65,.225,0,.18,.442,.45,'stone'),box(0,1.0,.27,1.8,.74,.12,'wood',outline=True)],
 'lamp':[box(0,1.8,0,.17,3.592,.17,'stone'),box(0,3.85,0,.6,.496,.6,'cream',outline=True),box(0,4.15,0,.76,.096,.76,'blue',kind='decor',collide=False)],
 'hedge':[box(0,.5,0,1.6,.992,.8,'leaf',outline=True)],
 'stall':[box(0,.5,.6,3.2,.992,.9,'wood',outline=True),box(-1.9,2.1,0,.18,4.192,.18,'stone'),box(1.9,2.1,0,.18,4.192,.18,'stone'),box(0,4.4,0,4.2,.396,2.6,'blue',outline=True),box(0,4.61,0,3.2,.02,2.2,'cream',kind='decor',collide=False)]
}
for x,z in [(17,24),(17,-24),(30,29),(30,-29)]:instpair('tree',x,z)
for x,z in [(28.5,8),(28.5,-8),(15,4),(15,-4),(9.8,-26)]:instpair('lamp',x,z)
for x,z,yaw in [(26.5,8,math.pi/2),(26.5,-8,math.pi/2),(2.5,27,0),(3.4,-29,0)]:instpair('bench',x,z,yaw=yaw)
for x,z in [(5,-25),(7.7,-22),(3.8,-3.2),(2.8,8.8),(18,20),(18,-20),(28,30)]:instpair('crate',x,z)
instpair('crate',3.8,-3.2,y=1.004)
for x,z in [(8,-29),(4,26),(17,6),(17,-6)]:instpair('barrel',x,z)
for x,z in [(10,-30),(26,30),(26,-30),(18,30),(18,-30)]:instpair('hedge',x,z)
instpair('stall',5,-27,yaw=0)
spawns=[]
for team,sign in [('A',-1),('B',1)]:
 for z in [-5,-3,-1,1,3,5]:spawns.append(dict(team=team,x=sign*28.5,y=.01,z=z,yaw=-sign*-math.pi/2))
for x,z in [(20,-22),(20,-8),(20,8),(20,22),(30.5,9.5),(30.5,-9.5),(5,10),(4.5,-8)]:
 for s in [-1,1]:spawns.append(dict(team='ffa',x=s*x,y=.01,z=z,yaw=-s*math.pi/2))
loot=[]
for x,z in [(20,22),(20,-22),(14.5,8),(14.5,-8),(10,25),(10,-25),(4,-22),(4,10)]:
 for s in [-1,1]:loot.append(dict(x=s*x,y=.05,z=z,tier='low' if abs(x)>12 else 'mid'))
for x in [-7.5,7.5]:loot.append(dict(x=x,y=2.55,z=6,tier='high'));loot.append(dict(x=x,y=2.55,z=-16.5,tier='high'))
zones=[dict(name='Spawn A',x=-28.5,z=0,w=9,d=18),dict(name='Spawn B',x=28.5,z=0,w=9,d=18),dict(name='Mid Square',x=0,z=0,w=22,d=18),dict(name='North House',x=0,z=17.5,w=16,d=11),dict(name='Market Court',x=0,z=-23,w=22,d=18),dict(name='West Gallery',x=-18,z=0,w=10,d=60),dict(name='East Gallery',x=18,z=0,w=10,d=60),dict(name='Balcony A',x=-7.5,z=6,w=4,d=4),dict(name='Balcony B',x=7.5,z=6,w=4,d=4),dict(name='Crouch Passage',x=0,z=-16.5,w=3,d=3)]
data=dict(id='toy-town',name='Toy Town',bounds=dict(x=35,z=35),killY=-15,sky=dict(color='#DCE5E1'),fog=dict(color='#DCE5E1',near=160,far=300),light=dict(sun=dict(direction=[-.6,1,.35],color='#FFF2DB',intensity=1.8),ambient=dict(color='#EBEFE4',intensity=1.8)),palette=palette,prefabs=prefabs,boxes=boxes,instances=instances,spawns=spawns,lootSpots=loot,zones=zones)
(root/'data/toy-town.json').write_text(json.dumps(data,indent=2)+'\n')
print('Authored',len(boxes),'static boxes,',len(instances),'instances,',sum(len(prefabs[i['prefab']]) for i in instances),'expanded prefab boxes')

















