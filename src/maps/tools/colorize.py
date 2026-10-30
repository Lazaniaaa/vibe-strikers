"""M2 render-only colour pass. Every original collision box is preserved exactly."""
from pathlib import Path
import json,colorsys,copy
ROOT=Path(__file__).resolve().parents[1]
OLD=json.loads((ROOT/'baselines/m1-data.json').read_text())['palette']
ZONES={
 'Spawn A':(17,.38,.60),'Spawn B':(183,.38,.52),
 'West Gallery':(39,.40,.57),'East Gallery':(213,.38,.57),
 'Mid Square':(43,.32,.68),'North House':(12,.52,.55),
 'Market Court':(204,.52,.53),'Balcony A':(15,.55,.60),
 'Balcony B':(200,.48,.72),'Crouch Passage':(46,.55,.60),
}
def hexh(h,s,l):return '#'+''.join(f'{round(c*255):02X}' for c in colorsys.hls_to_rgb(h/360,l,s))
def zone(x,z):
 if abs(x)>23:return 'Spawn A' if x<0 else 'Spawn B'
 if abs(x)>12.5:return 'West Gallery' if x<0 else 'East Gallery'
 if abs(x)<1.51 and abs(z+16.5)<1.6:return 'Crouch Passage'
 if 4.9<abs(x)<9.6 and 4<z<8.1:return 'Balcony A' if x<0 else 'Balcony B'
 if z>11.5:return 'North House'
 if z< -14:return 'Market Court'
 return 'Mid Square'
def colorize(source):
 data=copy.deepcopy(source);p=data['palette'];legacy=dict(OLD)
 def colour(key,value,old):p[key]=value;legacy[key]=OLD.get(old,old);return key
 def paint(old,zname,top=False):
  h,s,l=ZONES[zname];role=old.removesuffix('Top')
  if role=='outline':return 'outline'
  if role=='glass':h,s,l=194,.38,.76
  elif role=='leaf':h,s,l=133,.42,.51
  elif role=='water':h,s,l=188,.45,.58
  elif role=='cream':s,l=(.42,.74) if zname=='North House' else (.30,.82)
  elif role=='wood':s,l=min(.55,s+.07),.52
  elif role=='gold':h,s,l=44,.60,.57
  elif role=='blue':s,l=max(.42,s),max(.50,l-.06)
  elif role=='stone':s,l=.28,l-.03
  elif role=='clay':s,l=min(.54,s+.05),l-.04
  if top:l=min(.91,l+.09)
  return colour('zone:'+zname+':'+old,hexh(h,s,l),old)
 for b in data['boxes']:
  name=zone(b['x'],b['z']);old=b['color'];b['color']=paint(old,name);b['top']=paint(b.get('top',old),name,True)
 # 14 prefab groups keep the map at 50 draw calls; geometry remains shared per side.
 prefabs={}
 for name,boxes in source['prefabs'].items():
  for side,zname in [('A','Spawn A'),('B','Spawn B')]:
   arr=copy.deepcopy(boxes)
   for i,b in enumerate(arr):
    old=b['color'];b['color']=paint(old,zname);b['top']=paint(b.get('top',old),zname,True)
    if name in ['tree','hedge'] and old=='leaf':
     h,s,l=(136,.44,.50) if i%2 else (103,.42,.56)
     b['color']=colour('green:'+str(i%2),hexh(h,s,l),'leaf');b['top']=colour('green:'+str(i%2)+':top',hexh(h,s,l+.10),'leafTop')
    if name=='bench' and old=='wood':b['color']=colour('bench:'+side,hexh(17 if side=='A' else 185,.62,.53),'wood')
   prefabs[name+side]=arr
 for i in data['instances']:i['prefab']+='A' if i['x']<0 else 'B'
 data['prefabs']=prefabs
 def decor(x,y,z,w,h,d,key,outline=False):
  data['boxes'].append(dict(x=round(x,6),y=round(y,6),z=round(z,6),w=round(w,6),h=round(h,6),d=round(d,6),color=key,top=key,outline=outline,kind='decor',collide=False,blocksShots=False))
 # The named palette entries also provide the per-zone legend without changing MapData's shape.
 for name,(h,s,l) in ZONES.items():
  colour('legend:'+name,hexh(h,s,l),'sand')
  fh,fs,fl=(h,.30,.83) if name not in ['Mid Square','Crouch Passage'] else (43,.28,.85)
  for v in [-1,1]:colour('floor:'+name+':'+str(v),hexh(fh,fs,fl*(1+.04*v)),'stoneTop')
  colour('path:'+name,hexh(fh,.36,fl*.92),'sandTop')
  colour('accent:'+name,hexh(h,min(.68,s+.14),.54),'blue')
 # Symmetric 4m cells; only the two boundary strips are 3m wide. Never collidable.
 edges=[-35]+list(range(-32,33,4))+[35]
 for ix,(x0,x1) in enumerate(zip(edges,edges[1:])):
  for iz,(z0,z1) in enumerate(zip(edges,edges[1:])):
   x,z=(x0+x1)/2,(z0+z1)/2;name=zone(x,z)
   decor(x,.008,z,x1-x0,.002,z1-z0,'floor:'+name+':'+str(1 if (ix+iz)%2 else -1))
 for x in [-28.5,-14.5,14.5,28.5]:
  for z in range(-30,31,4):decor(x,.012,z,.7,.002,2,'path:'+zone(x,z))
 for x in range(-9,10,3):decor(x,.012,-3.8,1.2,.002,.45,'path:Mid Square')
 # Red stepped roof and blue market stripes, always on existing non-walkable tops.
 red=colour('roof:terracotta',hexh(10,.55,.53),'blueTop');redlight=colour('roof:terracottaLight',hexh(16,.52,.65),'blueTop')
 for b in source['boxes']:
  if b['z']==17.5 and b['y']>4.7 and b['kind']=='wall':
   n=round(b['w']/1.3);width=b['w']/n
   for i in range(n):decor(-b['w']/2+(i+.5)*width,b['y']+b['h']/2+.009,b['z'],width,.01,b['d'],red if i%2 else redlight)
 awning=colour('awning:blue',hexh(204,.58,.50),'blueTop');awninglight=colour('awning:cream',hexh(44,.40,.86),'creamTop')
 for side in ['A','B']:
  for i in range(7):data['prefabs']['stall'+side].append(dict(x=(i-3)*.6,y=4.635,z=0,w=.6,h=.01,d=2.6,color=awning if i%2 else awninglight,top=awning if i%2 else awninglight,outline=False,kind='decor',collide=False,blocksShots=False))
 # Two small yellow clocks on the existing solid terminal kiosks, with box-only hands.
 yellow=colour('clock:yellow',hexh(43,.58,.59),'gold');face=colour('clock:face',hexh(43,.35,.88),'creamTop')
 for sign in [-1,1]:
  x=sign*10.199
  decor(x,5.65,28.5,1.6,2.2,1.6,yellow,True)
  decor(x,5.75,27.68,1.25,1.25,.035,face,True)
  decor(x,5.86,27.655,.075,.52,.02,'outline')
  decor(x+sign*.16,5.63,27.65,.39,.075,.025,'outline')
  decor(x,6.83,28.5,1.95,.13,1.95,yellow,True)
 # Flags/signs are attached to existing faces, avoiding all doorway volumes.
 for sign in [-1,1]:
  side='A' if sign<0 else 'B';name='Spawn '+side
  decor(sign*23.435,3.85,0,.022,.8,2.2,'accent:'+name,True)
  gallery='West Gallery' if sign<0 else 'East Gallery'
  decor(sign*16.325,3.8,0,.02,.55,1.8,'accent:'+gallery,True)
  decor(sign*4.5,4.02,11.785,2.3,.38,.025,'accent:North House',True)
  decor(sign*7.5,3.05,7.802,2.4,.36,.02,'accent:Balcony '+side,True)
  decor(sign*6.9,4.95,-27.0,.85,.9,.035,'accent:Market Court',True)
 for z in [-9,9]:decor(0,4.32,z-.29,2.4,.28,.018,'accent:Mid Square',True)
 decor(0,1.85,-14.985,2.3,.32,.018,'accent:Crouch Passage',True)
 # Calm backdrop in four hues, all still within the original bounds.
 backs=[(24,.30,.75),(44,.30,.77),(182,.30,.72),(211,.30,.74)]
 for b in data['boxes']:
  if abs(b['x'])>34.3 and b['h']>7:
   index=[-24,-9,8,24].index(b['z']);h,s,l=backs[index]
   b['color']=b['top']=colour('backdrop:'+str(index),hexh(h,s,l),source['boxes'][data['boxes'].index(b)]['color'] if data['boxes'].index(b)<len(source['boxes']) else 'blue')
 # Colour both halves of the long end walls using attached render-only panels.
 # Their original one-piece colliders remain untouched in the colour-only stage.
 for zsign in [-1,1]:
  for face_z in [zsign*33.246,zsign*34.254]:
   for sign,name in [(-1,'Spawn A'),(1,'Spawn B')]:
    decor(sign*17.124,3.25,face_z,34.24,6.44,.006,paint('sand',name))
 return data,legacy
if __name__=='__main__':
 data,legacy=colorize(json.loads((ROOT/'baselines/m1-data.json').read_text()))
 (ROOT/'palettes').mkdir(exist_ok=True)
 (ROOT/'palettes/legacy.json').write_text(json.dumps(legacy,indent=2)+'\n')
 (ROOT/'baselines/m2-colors-only.json').write_text(json.dumps(data,indent=2)+'\n')
 (ROOT/'data/toy-town.json').write_text(json.dumps(data,indent=2)+'\n')
 print('M2 colours only:',len(data['boxes']),'static boxes;',len(data['prefabs']),'prefabs')

