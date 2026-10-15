import json,subprocess,os,random,math
random.seed(42)
from pathlib import Path
root=str(Path(__file__).resolve().parents[1])
os.makedirs('/tmp/art',exist_ok=True)
def run(*a):
 r=subprocess.run(a,capture_output=True,text=True)
 if r.returncode: raise Exception(str(a)+r.stderr)
def rect(x,y,w,h,c):return dict(op='fill_rect',x=int(x),y=int(y),width=max(1,int(w)),height=max(1,int(h)),color=c)
def line(x,y,x2,y2,c):return dict(op='line',x0=int(x),y0=int(y),x1=int(x2),y1=int(y2),color=c)
def circle(x,y,r,c):return dict(op='fill_circle',cx=int(x),cy=int(y),r=int(r),color=c)
def save(path,a,w=80,h=80,sheet=False):
 p=f'{root}/{path}.png';os.makedirs(os.path.dirname(p),exist_ok=True)
 json.dump(a,open('/tmp/art/ops.json','w'))
 run('draw-sheet' if sheet else 'draw','render','--actions','/tmp/art/ops.json','--out',p,'--width',str(w),'--height',str(h),'--no-layers')
bands=['topsoil','rockbed','deepstone','coreshell'];pal=[['#473f38','#51483e','#5d5144','#675a49'],['#39434b','#414e56','#4b5761','#59656b'],['#252d3c','#2e3747','#3c4555','#454e5c'],['#3c2935','#48303a','#56373e','#664044']]
for band,colors in zip(bands,pal):
 for n in range(3):
  a=[rect(0,0,80,80,colors[0])]
  for i in range(650):
   x=random.randrange(80);y=random.randrange(80);a.append(rect(x,y,random.choice([1,2,3,4]),1,random.choice(colors)))
  for i in range(9):
   x=random.randrange(80);y=random.randrange(80);a.append(line(x,y,x+random.randrange(4,14),y-2,colors[1]))
  save(f'tiles/{band}-{n}',a)
save('tiles/tunnel',[rect(0,0,80,80,'#101b23')]+[rect(random.randrange(80),random.randrange(80),2,1,'#18252c') for _ in range(100)])
for n in range(2):
 a=[rect(0,0,80,80,'#26333b')]
 for y in range(6,74):
  inset=int(9+8*math.sin(y/74*math.pi+n*.6));a.append(rect(inset,y,80-inset*2,1,'#53616a' if y<50 else '#35434e'))
 a += [line(22,16,56,12,'#9caeb0'),line(17,20,22,16,'#9caeb0'),line(55,55,64,48,'#1b2934')]
 save(f'tiles/stone-{n}',a)
save('tiles/bedrock',[rect(0,0,80,80,'#17232c')]+[rect(x+2,y+2,35,16,'#34414b') for x in range(-20,90,40) for y in range(0,80,20)])
colors=['#bb7e63','#cfb975','#ed9661','#b5d0d4','#609fc4','#c5dc75','#af9ed7','#ff8356','#e6be8b','#c6eff3','#6ce1aa','#ef8bba','#ffe8a0']
ores=['ferron','marlite','cuprite','argenite','cobaltine','voltite','halcite','pyronium','cindrite','adamite','verdite','roselite','aurite']
for k,(name,c) in enumerate(zip(ores,colors)):
 a=[]
 if k<10:
  for x in range(0,80,2):
   y=int(40+9*math.sin(x*math.pi/80)+4*math.sin(x*math.pi/40));a += [rect(x,y+random.randrange(-5,5),3,random.randrange(3,10),c+'b0'),rect(x,y,1,1,c)]
  for i in range(65):
   x=random.randrange(80);y=int(40+9*math.sin(x*math.pi/80)+4*math.sin(x*math.pi/40))+random.randrange(-15,15);a.append(rect(x,y,random.choice([2,3,5]),2,c+'80'))
 else:
  for y in range(18,64):
   t=abs(y-35);a.append(rect(40-int(24-t*.65),y,int(48-t*1.3),1,c))
  a += [rect(30,25,20,16,'#e2fff2'),line(20,35,40,60,'#35556e'),line(60,35,40,60,'#35556e'),line(40,60,38,40,'#ffffff'),rect(28,17,3,14,'#ffffff'),rect(23,22,13,3,'#ffffff')]
 save('ore/'+name,a)
for name,c in [('resonite','#65e5ca'),('cryenite','#afa0ff'),('core','#ff9b57'),('core-sample','#ffcc83')]:
 a=[]
 for x,y,h in [(18,32,29),(34,16,47),(52,28,32)]:
  a += [rect(x,y,12,h,'#213d49'),rect(x+2,y+3,8,h-5,c),rect(x+2,y+3,2,h-9,'#e7ffff')]
 a += [rect(12,61,56,5,'#33484e')];save('materials/'+name,a)
for state,frames in [('idle',2),('walk',4),('drill-down',3),('drill-side',3),('jetpack',3),('fall',2),('hurt',2),('fuel-out',2)]:
 for f in range(frames):
  bob=(f%2)*2;dy=5+bob if state=='fuel-out' else -3+bob if state=='jetpack' else bob
  a=[]
  # heavily outlined pressure suit, oxygen pack, helmet, glass and work boots
  def R(x,y,w,h,c):a.append(rect(x,y+dy,w,h,c))
  R(9,31,15,28,'#10212d');R(11,33,10,22,'#5f7b7c');R(12,35,4,15,'#a5b6ab')
  if state=='jetpack':
   R(12,56,8,13+f*3,'#f39a49');R(14,56,4,8+f*2,'#fff3b0')
  step=6 if state=='walk' and f%2 else 0
  R(26-step,54,12,17,'#172835');R(42+step,54,12,17,'#172835');R(25-step,66,16,7,'#8a9da0');R(41+step,66,16,7,'#8a9da0')
  R(23,28,34,32,'#182933');R(26,29,28,25,'#c18442');R(29,31,9,20,'#e6b25f');R(27,52,27,6,'#566767');R(39,35,11,10,'#ebd9a1');R(42,37,4,4,'#79d9cf')
  R(23,6,32,25,'#162937');R(25,7,28,21,'#e5b464');R(30,12,25,14,'#29414b');R(32,13,21,7,'#75c1c1');R(46,13,6,3,'#d2f1dd');R(48,5,10,7,'#6f7c75' if state=='fuel-out' else '#f7edb2' if f%2 else '#e9d98f');R(51,6,5,5,'#8c9f92' if state=='fuel-out' else '#ffffff' if f%2 else '#f7edb2')
  if state=='drill-down':
   R(46,42,14,12,'#dba75a');R(46,52,14,10,'#749296');R(49+f%2,62,8,13,'#cedad1')
  else:
   R(47,36,12,12,'#e5ad62');R(54,42+f%2,17,10,'#66858d');R(68,44+f%2,10,6,'#d1d9c8');R(59,51,7,7,'#1c303b')
  if state=='hurt':R(22-f*3,28,6,16,'#ffdfb0')
  if state=='fall':R(20,48,6,13,'#e7b76a')
  save(f'miner/{state}/frame{f:02}',a,sheet=True)
for f in range(2):
 a=[rect(0,0,80,80,'#bd482d')]
 for y in range(2,80,4):
  for x in range(0,80,4):
   a.append(rect(x,y,4,3,random.choice(['#e86832','#f99b42','#ffcc6c','#ab392c'])))
 for x in range(0,80,2):a.append(rect(x,20+int(8*math.sin(x/11+f)),3,3,'#ffe4a0'))
 save(f'hazards/lava/frame{f:02}',a,sheet=True)
for f in range(4):
 a=[]
 for j in range(f+2):
  x=40;y=35
  for i in range(4):
   xx=x+random.randrange(-17,18);yy=y+random.randrange(-18,19);a.append(line(x,y,xx,yy,'#0a121be0'));x=xx;y=yy
 save(f'tiles/crack/frame{f:02}',a,sheet=True)
# Wide original landscape: layered distant spoil heaps, stars and industrial silhouettes.
a=[rect(0,0,1280,480,'#101d29')]
for i in range(190):a.append(rect(random.randrange(1280),random.randrange(300),1,1,random.choice(['#4c6975','#738182','#294554'])))
for x in range(0,1280,3):
 h=70+int(28*math.sin(x/90)+15*math.sin(x/41));a.append(rect(x,480-h,3,h,'#1d303a'))
for x in range(0,1280,4):
 h=30+int(17*math.sin(x/49));a.append(rect(x,480-h,4,h,'#263a42'))
save('surface/sky',a,1280,480)
save('surface/ground',[rect(0,0,80,16,'#536161'),rect(0,3,80,3,'#b0a077')]+[rect(i,9,6,4,'#263940') for i in range(0,80,12)])
ids=['fuel-depot','ore-market','save-pad','upgrade-shop','supply-depot','launch-pad','cave-mouth']
for k,name in enumerate(ids):
 a=[rect(3,104,194,16,'#182a33'),rect(10,99,180,5,'#b6a071')]
 if k==6:
  a += [rect(40,22,120,80,'#3d4c4f'),rect(52,32,96,70,'#0c1823'),rect(44,22,112,7,'#a79567')]
 elif k==5:
  a += [rect(35,85,130,13,'#536469'),rect(40,5,7,81,'#5b7479'),rect(40,15,106,5,'#5b7479')]
 elif k==2:
  a += [rect(35,83,130,13,'#5f8c87'),rect(55,15,90,64,'#344e58'),rect(61,21,78,48,'#172d38'),rect(70,30,60,25,'#75d4bf'),rect(82,36,36,4,'#d5edc7')]
 else:
  a += [rect(22,28,156,72,'#21353e'),rect(27,32,146,63,'#57646a'),rect(20,24,160,9,'#a89568'),rect(31,45,54,33,'#142c35'),rect(34,48,48,5,'#83b8ad'),rect(104,53,39,43,'#283c45'),rect(110,59,26,28,'#172a34')]
  for x in range(29,170,16):a += [rect(x,33,2,61,'#6c7977')]
  c=['#e8b76b','#86cbb7','#92b4c9','#e1a266'][k if k<2 else k-1]
  a += [rect(40,8,120,14,'#1d313b'),rect(45,12,110,5,c)]
  if k==0:a += [rect(152,45,20,44,'#ba7a44'),rect(156,49,12,20,'#f3ce86')]
  if k==3:a += [rect(48,57,30,8,'#d9ae61'),rect(57,47,11,29,'#d9ae61')]
  if k==4:a += [rect(38,64,32,20,'#b29a69'),rect(51,64,5,20,'#526b66')]
 for x in range(12,190,18):a.append(rect(x,105,9,3,'#bd9e57'))
 save('surface/'+name,a,200,120)
for n in range(6):
 a=[rect(0,145,160,15,'#3f5960'),rect(12,138,136,7,'#b39d6a')]
 if n:
  a += [rect(62,34,36,104,'#263f4c'),rect(66,36,28,98,'#b5c4bc'),rect(68,38,8,92,'#e6dfbd'),rect(64,100,32,10,'#c4894c')]
 if n>=2:a += [rect(47,88,14,50,'#718e91'),rect(99,88,14,50,'#718e91')]
 if n>=3:a += [rect(71,53,19,22,'#25444f'),rect(75,56,12,11,'#8dd8ce')]
 if n>=4:a += [rect(63,128,34,10,'#243942'),rect(56,136,48,4,'#e0b879')]
 if n>=5:
  for y in range(10,34):a.append(rect(80-(y-9)//2,y,max(2,y-9),1,'#e4d9b6'))
 save(f'rocket/stage{n}',a,160,160)
for i,name in enumerate(['fuel','hull','cargo','credits','depth','resonite','cryenite','core-sample']):
 c=['#e4b265','#e28975','#99bbc1','#e7d18c','#a8bbb8','#72e6cc','#bda4f0','#ffa764'][i]
 a=[rect(5,4,14,16,'#233b47'),rect(7,6,10,12,c),rect(9,8,3,7,'#e9efd2')]
 if i==4:a += [rect(11,2,2,19,c),rect(8,17,8,3,c)]
 save('icons/'+name,a,24,24)
print('sprites complete')
