from pathlib import Path
exec((Path(__file__).parent/'sprites.py').read_text().split("bands=")[0])
os.makedirs(root+'/audio',exist_ok=True);os.makedirs(root+'/fx',exist_ok=True)
names=['drill','thrust','ore-pickup','material-chime','gas-explosion','lava-sizzle','impact','fabricate','launch','death','alarm-fuel','alarm-core']
for i,name in enumerate(names):
 cfg=dict(sample_rate=22050,channels='mono',max_duration_ms=1800,seed=50+i,actions='/tmp/art/s-ops.json',preview='/tmp/art/s.png',wav=root+'/audio/'+name+'.wav')
 json.dump(cfg,open('/tmp/art/s.json','w'));base=['sfx-synth','--config','/tmp/art/s.json'];run(*base,'init')
 if name in ['ore-pickup','material-chime','fabricate','alarm-fuel','alarm-core']:
  for j,f in enumerate(([180,180] if name=='alarm-fuel' else [330,440,330,440] if name=='alarm-core' else [440,660,880]) if name!='material-chime' else [330,495,660,990]):run(*base,'add-voice','--name',str(j),'--wave','sine','--freq',str(f*(1.3 if name=='ore-pickup' else 1)),'--gain','-21','--start',str(j*75),'--dur','240')
 else:
  run(*base,'add-voice','--name','noise','--wave','noise','--gain','-24','--dur','900' if name in ['drill','thrust','launch'] else '400')
  run(*base,'add-voice','--name','bass','--wave','saw' if name=='drill' else 'sine','--freq',str(55+i*9),'--gain','-23','--dur','700')
  run(*base,'set-pitch','--voice','bass','--slide-to','25','--over','600')
 run(*base,'render')
cfg=dict(sample_rate=22050,channels='mono',max_duration_ms=16000,seed=42,actions='/tmp/art/m-ops.json',preview='/tmp/art/m.png',wav=root+'/audio/music.wav',mid=root+'/audio/music.mid')
json.dump(cfg,open('/tmp/art/m.json','w'));b=['music','--config','/tmp/art/m.json'];run(*b,'init');run(*b,'set-tempo','--bpm','80');run(*b,'define-track','--name','bed','--instrument','sine');run(*b,'define-track','--name','echo','--instrument','triangle')
for j,p in enumerate([38,38,41,36,38,45,41,36]):
 run(*b,'add-note','--track','bed','--pitch',str(p),'--t',str(j*2),'--dur','2','--velocity','45')
 run(*b,'add-note','--track','echo','--pitch',str(p+24),'--t',str(j*2+.5),'--dur','.7','--velocity','26')
run(*b,'render')
fx=['gas-seep','drill-debris','jetpack-exhaust','ore-sparkle','material-shimmer','gas-explosion','lava-embers','impact-dust','core-extract','core-detonation','launch-exhaust','death-burst']
for i,name in enumerate(fx):
 cfg=dict(width=240,height=240,duration_ms=1200,fps=30,seed=42+i,actions='/tmp/art/p-actions.json',preview='/tmp/art/p.png',system=root+'/fx/'+name+'.json')
 json.dump(cfg,open('/tmp/art/p.json','w'));b=['particle-2d','--config','/tmp/art/p.json'];run(*b,'init')
 gas=name=='gas-seep';blast='explosion' in name or 'detonation' in name
 run(*b,'add-emitter','--name','main','--shape','disc','--x','120','--y','120','--radius','22' if gas else '4','--burst','9' if gas else ('90' if blast else '25'),'--lifetime','1000' if gas else '600','--lifetime-spread','200','--speed','12' if gas else ('180' if blast else '65'),'--speed-spread','12','--dir-y','-1' if 'exhaust' in name else '1','--cone-angle','25' if gas or 'exhaust' in name else '180')
 c='#aac8b4' if gas else '#dca45e' if name in ['drill-debris','impact-dust'] else '#ff9c51' if blast or 'exhaust' in name else '#8eeee0'
 run(*b,'set-particle','--emitter','main','--size-from','3' if gas else '1','--size-to','5' if gas else '0','--opacity-from','.14' if gas else '.9','--opacity-to','0','--color-gradient',c+'@0,#536879@1')
 if blast:
  run(*b,'add-emitter','--name','flash','--shape','point','--x','120','--y','120','--burst','1','--lifetime','200','--speed','0')
  run(*b,'set-particle','--emitter','flash','--size-from','20','--size-to','0','--color-gradient','#ffecc4@0,#e75231@1')
 if blast:
  core=name=='core-detonation'
  run(*b,'add-emitter','--name','shockwave','--shape','point','--x','120','--y','120','--burst','200' if core else '120','--lifetime','650','--speed','650' if core else '250','--cone-angle','180')
  run(*b,'set-particle','--emitter','shockwave','--size-from','2.6' if core else '1.8','--size-to','0','--opacity-from','.7','--opacity-to','0','--color-gradient','#ffe1a6@0,#ea7854@1')
  run(*b,'add-emitter','--name','smoke','--shape','disc','--x','120','--y','120','--radius','10','--burst','40','--lifetime','1200','--speed','180' if core else '70','--cone-angle','180')
  run(*b,'set-particle','--emitter','smoke','--size-from','3','--size-to','8','--opacity-from','.35','--opacity-to','0','--color-gradient','#96765b@0,#3e5361@1')
 if name in ['drill-debris','impact-dust','death-burst']:
  run(*b,'set-forces','--gravity','-180','--drag','1')
 run(*b,'render','--frame','12')
print('audio and particles complete')
