"""The small M2 logic changes, separate from the render-only colour pass."""
import json,math
from colorize import ROOT,colorize
data=json.loads((ROOT/'baselines/m1-data.json').read_text())
result=[]
for b in data['boxes']:
 if abs(b['x'])==23 and b['d']==49.5 and b['collide']:
  for lo,hi in [(-24.75,-12.1),(-8.9,8.9),(12.1,24.75)]:
   result.append(dict(b,z=(lo+hi)/2,d=hi-lo))
  for z in [-10.5,10.5]:result.append(dict(b,y=4.156,z=z,h=1.696,d=3.196))
  continue
 if abs(b['x'])==23.414 and abs(b['z'])==8:b['z']=math.copysign(6,b['z'])
 if abs(b['x'])==23.424 and abs(b['z'])==8:b['z']=math.copysign(6,b['z'])
 if abs(b['x'])==23 and b['kind']=='decor' and b['h']==.004:b['y']=5.012
 if abs(b['x'])==23.412 and b['h']==.16 and b['d']==48.9:
  for lo,hi in [(-24.45,-12.1),(-8.9,8.9),(12.1,24.45)]:result.append(dict(b,z=(lo+hi)/2,d=hi-lo))
  continue
 if b['x']==0 and b['z']==0 and b['w']==1.2 and b['h']>2:
  bottom=b['y']-b['h']/2;b['h']=1.294-bottom;b['y']=(1.294+bottom)/2
 if b['x']==0 and b['z']==0 and b['w']==1.5 and b['h']==.106:b['y']=1.347
 if b['d']==.55 and b['w']>6 and abs(b['z'])==13:b['z']=math.copysign(8,b['z'])
 result.append(b)
for x in [-16,16]:
 for z in [-4,4]:result.append(dict(x=x,y=1.651,z=z,w=.6,h=3.31,d=3.196,color='stone',top='stoneTop',outline=False,kind='wall',collide=True,blocksShots=True))
data['boxes']=result
data['prefabs']['screen']=[
 dict(x=0,y=1.494,z=0,w=16.452,h=3,d=.4,color='sand',top='sandTop',outline=False,kind='wall',collide=True,blocksShots=True),
 dict(x=0,y=3.002,z=0,w=16.452,h=.004,d=.4,color='outline',top='outline',outline=False,kind='decor',collide=False,blocksShots=False),
]
for i in data['instances']:
 if i['prefab']=='bench' and i['z']==-29:i['z']=-30.3
 if i['prefab']=='barrel' and i['z']==26:i['z']=26.7
 if i['prefab']=='crate' and abs(i['x'])==18 and abs(i['z'])==20:i['prefab']='screen';i['x']=math.copysign(25.026,i['x'])
for spawn in data['spawns']:
 if spawn['team']!='ffa':continue
 if abs(spawn['x'])==20 and abs(spawn['z'])==8:spawn['z']=math.copysign(25,spawn['z'])
 elif abs(spawn['x'])==5 and spawn['z']==10:spawn['x']=math.copysign(28.5,spawn['x']);spawn['z']=-5
 elif abs(spawn['x'])==4.5 and spawn['z']==-8:spawn['x']=math.copysign(28.5,spawn['x']);spawn['z']=5
orientations=ROOT/'baselines/m2-spawn-yaws.json'
if orientations.exists():
 for spawn,yaw in zip(data['spawns'],json.loads(orientations.read_text())):spawn['yaw']=yaw
(ROOT/'baselines/m2-logic-only.json').write_text(json.dumps(data,indent=2)+'\n')
data,legacy=colorize(data)
(ROOT/'palettes/legacy.json').write_text(json.dumps(legacy,indent=2)+'\n')
(ROOT/'data/toy-town.json').write_text(json.dumps(data,indent=2)+'\n')
print('M2 logic: 4 spawn doors; fountain max1.4m; 4 props shifted.')

