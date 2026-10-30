from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, shutil

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'system/sui-cinema'
SRC=ROOT/'assets/sources/20261030-cinema-ui'
OUT=ROOT/'assets/current/ui-cinema'
for p in [BASE/'gui',SRC/'png',SRC/'webp',OUT/'png',OUT/'webp']:p.mkdir(parents=True,exist_ok=True)
FONT=ROOT/'system/font/NotoSansCJK-Medium.ttc'
BG='#111b24'; SURFACE='#1d2c38'; INK='#f2eee8'; MUTED='#b6c0c7'; LINE='#4b5a65'; GOLD='#dcc9a4'
records=[]
def font(size):return ImageFont.truetype(str(FONT),size)
def txt(d,xy,s,size=24,color=INK,anchor='lt'):d.text(xy,s,font=font(size),fill=color,anchor=anchor)
def new(size,color=(0,0,0,0)):
 im=Image.new('RGBA',size,color);return im,ImageDraw.Draw(im)
def save(name,im):
 for ext in ['png','webp']:
  p=SRC/ext/(name+'.'+ext)
  if ext=='webp':im.save(p,'WEBP',lossless=True,exact=True,method=6)
  else:im.save(p,optimize=True)
  shutil.copyfile(p,OUT/ext/p.name)
  got=Image.open(p).convert('RGBA');assert got.size==im.size and got.tobytes()==im.tobytes()
  records.append({'path':str((OUT/ext/p.name).relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':im.width,'height':im.height,'alpha':im.getchannel('A').getextrema()})
def image(name):return 'assets/current/ui-cinema/png/'+name+'.png'
def button(name,label,size=(200,64),active=False):
 for state in ['idle','hover','press']:
  im,d=new(size,SURFACE if state!='press' else '#2e3d48')
  if state!='idle' or active:d.rectangle((0,0,2,size[1]-1),fill=GOLD)
  d.line((0,size[1]-1,size[0]-1,size[1]-1),fill=LINE)
  txt(d,(20,size[1]//2),label,24,GOLD if active else INK,anchor='lm');save(name+'-'+state,im)

# Derive existing ancillary GUI textures without changing their originals.
for p in sorted((ROOT/'system/sui-u/png').glob('*.png')):
 im=Image.open(p).convert('RGBA');out=[]
 for r,g,b,a in im.getdata():
  if r>140 and g>r+12 and g>b:rgb=(220,201,164)
  elif max(r,g,b)<145:rgb=(max(0,r-2),max(0,g-8),min(255,b+4))
  else:rgb=(r,g,b)
  out.append((*rgb,a))
 im.putdata(out);save(p.stem,im)
nav=[('menu','阅读菜单','M'),('load','存读档','L'),('history','阅读回顾','H'),('config','阅读设置','C'),('gallery','图鉴','G')]
for key,label,_ in nav:button('side-'+key,label,(200,64))
for key,label in [('back','返回阅读'),('previous','← 上一页'),('next','下一页 →'),('tab-save','保存'),('tab-load','读取'),('reset','重置阅读速度'),('fullscreen','全屏阅读')]:button(key,label,(176,64) if key in ['previous','next'] else (200,64))
button('menu','菜单  ≡',(128,56))
for key,label in [('auto','自动阅读'),('skip','快进已读'),('rollback','回到上一选择'),('title','返回标题'),('resume','继续阅读')]:button('action-'+key,label,(400,88))
for state in ['idle','hover']:
 im,d=new((480,80),SURFACE if state=='hover' else BG)
 d.line((0,79,479,79),fill=LINE)
 if state=='hover':d.rectangle((0,8,3,71),fill=GOLD);txt(d,(452,40),'›',30,GOLD,anchor='mm')
 save('choice-'+state,im)
im,d=new((320,72),BG);txt(d,(24,32),'做出选择',28,GOLD,anchor='lm');save('choice-heading',im)
im,d=new((960,48),BG);save('notice-backdrop',im)
im,d=new((480,80));d.rectangle((0,0,479,79),outline=GOLD,width=2);save('choice-keyboard',im)

def panel(name,title,subtitle,active):
 im,d=new((1280,720),BG)
 d.rectangle((0,0,240,719),fill='#16232e');d.line((240,32,240,688),fill=LINE)
 txt(d,(32,48),'雨停之前',26,GOLD);txt(d,(32,91),'阅读与记录',18,MUTED)
 txt(d,(272,44),title,36);txt(d,(272,98),subtitle,20,MUTED)
 d.line((272,132,1232,132),fill=LINE);d.line((272,658,1232,658),fill=LINE)
 txt(d,(272,678),'Esc 返回  ·  左侧切换分类',18,MUTED)
 # Active navigation is also visible when a native renderer covers its buttons.
 for i,(key,label,_) in enumerate(nav):
  if key==active:d.rectangle((32,160+i*80,35,223+i*80),fill=GOLD)
 save(name,im)
for args in [('save','保存进度','1 个自动档 · 3 个手动档；保存将覆盖所选手动档。','load'),('load','读取进度','选择一个已保存的片刻，继续阅读。','load'),('history','阅读回顾','回顾从当前读档位置开始累计。','history'),('config','阅读设置','声音、文字与自动阅读速度。','config'),('sysmenu','阅读菜单','把故事暂时放在这里。','menu'),('gallery-base','图鉴','未解锁画面不显示标题与缩略图。','gallery')]:panel(*args)

im=Image.open(OUT/'png/config.png');d=ImageDraw.Draw(im)
txt(d,(272,160),'声音',20,GOLD);txt(d,(776,160),'阅读',20,GOLD)
for x,y,label in [(272,201,'背景音乐'),(272,325,'操作音效'),(272,449,'语音'),(776,201,'文字显示速度'),(776,325,'自动阅读间隔')]:txt(d,(x,y),label,24)
save('config',im)
for state in ['idle','hover','press']:
 im,d=new((456,216),SURFACE);d.rectangle((0,0,455,215),outline=GOLD if state!='idle' else LINE);save('save-item-'+state,im)
 for n in range(4):
  item=im.copy();dd=ImageDraw.Draw(item);txt(dd,(24,16),'自动档' if n==0 else '手动档 '+str(n),22,GOLD);save('save-item-'+str(n)+'-'+state,item)
im,d=new((456,216),SURFACE);d.rectangle((0,0,455,215),outline=LINE);txt(d,(24,22),'自动存档',26,GOLD);txt(d,(24,88),'随阅读进度更新',24);txt(d,(24,140),'请在「读取」页恢复',20,MUTED);save('auto-save',im)
for state in ['idle','hover','press']:
 im,d=new((880,208),SURFACE);d.line((0,207,879,207),fill=LINE);save('history-item-'+state,im)
for state in ['idle','hover']:
 im,d=new((440,48));d.line((0,24,440,24),fill=LINE,width=4);save('slider-'+state,im)
im,d=new((32,48));d.rounded_rectangle((5,10,27,38),radius=4,fill=GOLD);save('slider-knob',im)
im,d=new((440,96),SURFACE);d.line((0,0,0,95),fill=GOLD,width=2);save('preview',im)
im,d=new((288,184),SURFACE);d.rectangle((0,0,287,183),outline=LINE);txt(d,(144,92),'尚未解锁',22,MUTED,anchor='mm');save('cg-locked',im)
im,d=new((288,184));d.rectangle((0,0,287,183),outline=GOLD,width=3);save('cg-focus',im)

layout=json.loads((SRC/'choice-layout.json').read_text());choicefiles={};measured=[]
def wrap(s,maxwidth,size):
 lines=[];line=''
 for c in s:
  if font(size).getlength(line+c)>maxwidth:
   lines.append(line);line=''
  line+=c
 if line:lines.append(line)
 return lines
for choice in layout['choices']:
 choicefiles[choice['id']]=[]
 for n,o in enumerate(choice['options']):
  name='option-'+choice['id'].lower()+'-'+str(n)
  im,d=new((480,80),BG);d.line((0,79,479,79),fill=LINE);lines=wrap(o['text'],412,26)
  assert len(lines)<=2,(choice['id'],lines)
  if o['action']:
   display_name=o['text'].split('｜')[0].split('|')[0].strip()
   txt(d,(24,10),display_name,27);txt(d,(24,46),o['action'],20,MUTED)
  else:
   y=23 if len(lines)==1 else 8
   for j,line in enumerate(lines):txt(d,(24,y+j*34),line,26)
  save(name,im);choicefiles[choice['id']].append({'value':o['value'],'path':image(name)})
  measured.append({'choice':choice['id'],'value':o['value'],'text':o['text'],'lines':lines,'widths':[font(26).getlength(s) for s in lines],'fits':True})

def block(name,id,typ,x,y,img=None,**extra):
 attrs={'id':id,'type':typ,'x':x,'y':y}
 if img:
  for s in ['idle','hover','press']:attrs['image-'+s]=image(img+'-'+s)
 attrs.update({k.replace('_','-'):v for k,v in extra.items()})
 return name+' {\n'+''.join('    '+k+': '+str(v)+';\n' for k,v in attrs.items())+'}\n'
def gui(name,active,content='',cancel=True):
 s='global {\n    fadein: 0.12;\n    fadeout: 0.12;\n    clickcancel: no;\n    escapecancel: '+('yes' if cancel else 'no')+';\n    rightcancel: '+('yes' if cancel else 'no')+';\n    saveslots: 4;\n}\n'
 s+=block('BASE',32,'noaction',0,0,image_idle=image(name if name!='gallery' else 'gallery-base'))
 for i,(key,label,action) in enumerate(nav):
  selected={'image_idle':image('side-'+key+'-hover')} if key==active else {}
  s+=block('NAV_'+key.upper(),20+i,'char',32,160+i*80,'side-'+key,var='e_action',msg=action,max=1,**selected)
 s+=block('BACK',30,'cancel',32,592,'back')+content
 (BASE/'gui'/(name+'.gui')).write_text(s)
for mode in ['save','load']:
 s=block('TAB_SAVE',11,'char',792,60,'tab-save',var='e_action',msg='V',max=1)+block('TAB_LOAD',12,'char',1016,60,'tab-load',var='e_action',msg='L',max=1)
 for n in range(4):
  x=272+(n%2)*480;y=150+(n//2)*240
  if n==0 and mode=='save':s+=block('AUTO',10,'noaction',x,y,image_idle=image('auto-save'));continue
  s+=block('SLOT'+str(n),n+1,'char',x,y,'save-item-'+str(n),var='e_action',msg=({0:'A',1:'1',2:'2',3:'3'} if mode=='load' else {1:'S',2:'D',3:'F'})[n],max=1,index=n,thumb_width=192,thumb_height=108)
 gui(mode,'load',s)
s=''
for id,typ,x,y in [(1,'bgmvol',272,237),(2,'sevol',272,361),(3,'voicevol',272,485),(4,'textspeed',776,237),(5,'autospeed',776,361)]:s+=block(typ.upper(),id,typ,x,y,image_idle=image('slider-idle'),image_hover=image('slider-hover'),image_knob=image('slider-knob'))
s+=block('PREVIEW',6,'preview',776,441,image_idle=image('preview'),msg='"文字正以你习惯的速度显现。"',**{'msg-zh-cn':'"文字正以你习惯的速度显现。"'},margin_left=18,margin_top=14,margin_right=18,margin_bottom=14)
s+=block('RESET',7,'default',776,566,'reset')+block('FULLSCREEN',8,'fullscreen',272,566,'fullscreen',image_disable=image('fullscreen-press'))
gui('config','config',s)
gui('history','history')
gui('gallery','gallery',cancel=False)
s=''
for id,key,typ,x,y in [(1,'auto','auto',272,166),(2,'skip','skip',752,166),(3,'rollback','char',272,302),(4,'title','gui',752,302),(5,'resume','cancel',272,438)]:
 extra={'var':'e_action','msg':'R','max':1} if key=='rollback' else {'file':'system/sui-u/gui/confirm-title.gui'} if key=='title' else {}
 s+=block('ACTION_'+key.upper(),id,typ,x,y,'action-'+key,**extra)
gui('sysmenu','menu',s)

# Deduplicate overridden texture records and retain the exact final fingerprints.
records=list({r['path']:r for r in records}.values())
m={'schemaVersion':1,'canvas':[1280,720],'style':'电影侧栏','approval':{'status':'approved','date':'2026-10-30','instruction':'使用方案三'},'resources':records,'choices':choicefiles,'gui':{p.name:'system/sui-cinema/gui/'+p.name for p in (BASE/'gui').glob('*.gui')},'runtimeEncoding':'PNG用于当前SDK；保留等像素无损WebP','contentBuildId':layout['contentBuildId']}
(BASE/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
(ROOT/'qa/ui-cinema-20261030/choice-measurements.json').write_text(json.dumps(measured,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'resources':len(records),'options':len(measured),'allFit':all(x['fits'] for x in measured)}))
