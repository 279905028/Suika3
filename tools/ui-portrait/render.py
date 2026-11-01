from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, shutil

# Portrait (720x1280) variant of the cinema UI. Same palette and naming as
# tools/ui-cinema/render.py; textures the portrait build references by the
# cinema name are redrawn here or copied unchanged from the approved cinema set.
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'system/sui-portrait'
SRC=ROOT/'assets/sources/20261101-portrait-ui'
OUT=ROOT/'assets/current/ui-portrait'
CINEMA=ROOT/'assets/current/ui-cinema/png'
for p in [BASE/'gui',SRC/'png',SRC/'webp',OUT/'png',OUT/'webp']:p.mkdir(parents=True,exist_ok=True)
FONT=ROOT/'system/font/NotoSansCJK-Medium.ttc'
W,H=720,1280
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
  records.append({'path':str((OUT/ext/p.name).relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':im.width,'height':im.height,'alpha':im.getchannel('A').getextrema()})
def image(name):return 'assets/current/ui-portrait/png/'+name+'.png'
def button(name,label,size,active=False,center=False):
 for state in ['idle','hover','press']:
  im,d=new(size,SURFACE if state!='press' else '#2e3d48')
  if state!='idle' or active:
   if center:d.rectangle((0,0,size[0]-1,2),fill=GOLD)
   else:d.rectangle((0,0,2,size[1]-1),fill=GOLD)
  d.line((0,size[1]-1,size[0]-1,size[1]-1),fill=LINE)
  if center:txt(d,(size[0]//2,size[1]//2),label,22,GOLD if active else INK,anchor='mm')
  else:txt(d,(24,size[1]//2),label,26,GOLD if active else INK,anchor='lm')
  save(name+'-'+state,im)

# Unchanged cinema textures (sizes already fit a 720-wide canvas).
for stem in ['advance-1','advance-2','auto','skip','name','menu-idle','menu-hover','menu-press','slider-knob','scroll-idle','scroll-knob']+[k+'-'+s for k in ['back','previous','next','tab-save','tab-load','reset','fullscreen','confirm','cancel','start','continue','settings','gallery'] for s in ['idle','hover','press']]:
 save(stem,Image.open(CINEMA/(stem+'.png')).convert('RGBA'))

# Reading layer: stage 0-720, name y=736, message 24,792 672x440.
im,d=new((672,440));d.rounded_rectangle((0,0,671,439),radius=3,fill=(17,26,44,238),outline=(100,126,137,210));d.rectangle((36,0,140,2),fill=GOLD);save('message',im)
im,d=new((672,48),BG);save('notice-backdrop',im)
for state in ['idle','hover']:
 im,d=new((672,76),SURFACE if state=='hover' else BG)
 d.line((0,75,671,75),fill=LINE)
 if state=='hover':d.rectangle((0,8,3,67),fill=GOLD);txt(d,(644,38),'›',30,GOLD,anchor='mm')
 save('choice-'+state,im)
im,d=new((672,64),BG);txt(d,(24,32),'做出选择',28,GOLD,anchor='lm');save('choice-heading',im)
im,d=new((672,76));d.rectangle((0,0,671,75),outline=GOLD,width=2);save('choice-keyboard',im)

# System pages: header 0-140, content, bottom navigation y=1136.
nav=[('menu','阅读菜单','M'),('load','存读档','L'),('history','阅读回顾','H'),('config','阅读设置','C'),('gallery','图鉴','G')]
NAV_Y=1136
def nav_x(i):return 8+i*142
for key,label,_ in nav:button('nav-'+key,label,(136,72),center=True)
for key,label in [('auto','自动阅读'),('skip','快进已读'),('rollback','回到上一选择'),('title','返回标题'),('resume','继续阅读')]:button('action-'+key,label,(672,88))
def panel(name,title,subtitle,active):
 im,d=new((W,H),BG)
 txt(d,(24,40),title,36);txt(d,(24,94),subtitle,20,MUTED)
 d.line((24,140,696,140),fill=LINE)
 d.rectangle((0,NAV_Y-16,W-1,H-1),fill='#16232e');d.line((0,NAV_Y-16,W-1,NAV_Y-16),fill=LINE)
 # Active navigation is also visible when a native renderer covers its buttons.
 for i,(key,label,_) in enumerate(nav):
  if key==active:d.rectangle((nav_x(i),NAV_Y-6,nav_x(i)+135,NAV_Y-3),fill=GOLD)
 save(name,im)
for args in [('save','保存进度','1 个自动档 · 3 个手动档；保存将覆盖所选手动档。','load'),('load','读取进度','选择一个已保存的片刻，继续阅读。','load'),('history','阅读回顾','回顾从当前读档位置开始累计。','history'),('config','阅读设置','声音、文字与自动阅读速度。','config'),('sysmenu','阅读菜单','把故事暂时放在这里。','menu'),('gallery-base','图鉴','未解锁画面不显示标题与缩略图。','gallery')]:panel(*args)
im=Image.open(OUT/'png/config.png');d=ImageDraw.Draw(im)
txt(d,(24,164),'声音',20,GOLD);txt(d,(24,512),'阅读',20,GOLD)
for y,label in [(200,'背景音乐'),(300,'操作音效'),(400,'语音'),(548,'文字显示速度'),(648,'自动阅读间隔')]:txt(d,(24,y),label,24)
save('config',im)
for state in ['idle','hover','press']:
 im,d=new((672,200),SURFACE);d.rectangle((0,0,671,199),outline=GOLD if state!='idle' else LINE)
 for n in range(4):
  item=im.copy();dd=ImageDraw.Draw(item);txt(dd,(24,16),'自动档' if n==0 else '手动档 '+str(n),22,GOLD);save('save-item-'+str(n)+'-'+state,item)
im,d=new((672,200),SURFACE);d.rectangle((0,0,671,199),outline=LINE);txt(d,(24,22),'自动存档',26,GOLD);txt(d,(24,88),'随阅读进度更新',24);txt(d,(24,140),'请在「读取」页恢复',20,MUTED);save('auto-save',im)
for state in ['idle','hover','press']:
 im,d=new((672,208),SURFACE);d.line((0,207,671,207),fill=LINE);save('history-item-'+state,im)
for state in ['idle','hover']:
 im,d=new((672,48));d.line((0,24,672,24),fill=LINE,width=4);save('slider-'+state,im)
im,d=new((672,96),SURFACE);d.line((0,0,0,95),fill=GOLD,width=2);save('preview',im)
im,d=new((328,184),SURFACE);d.rectangle((0,0,327,183),outline=LINE);txt(d,(164,92),'尚未解锁',22,MUTED,anchor='mm');save('cg-locked',im)
im,d=new((328,184));d.rectangle((0,0,327,183),outline=GOLD,width=3);save('cg-focus',im)
im,d=new((W,H),(17,28,47,255));save('gallery-view',im)

# Title confirmation: the approved landscape dialog, centred on a portrait canvas.
src=Image.open(CINEMA/'title-confirm.png').convert('RGBA')
im,d=new((W,H),src.getpixel((5,5)));DLG=(350,218,931,503)
im.alpha_composite(src.crop(DLG),((W-(DLG[2]-DLG[0]))//2,(H-(DLG[3]-DLG[1]))//2));save('title-confirm',im)
CONFIRM=((W-(DLG[2]-DLG[0]))//2+396-DLG[0],(H-(DLG[3]-DLG[1]))//2+398-DLG[1])

# Title: the adopted B cover's centre as a square stage, fading into the menu area.
cover=Image.open(ROOT/'assets/current/title/cover-b-base.png').convert('RGBA')
im,d=new((W,H),BG);im.alpha_composite(cover.crop((490,0,1210,720)),(0,0))
fade=Image.new('RGBA',(W,200));fd=ImageDraw.Draw(fade)
for y in range(200):fd.line((0,y,W-1,y),fill=(17,27,36,int(255*y/199)))
im.alpha_composite(fade,(0,560))
d=ImageDraw.Draw(im);txt(d,(48,772),'毕节，雨停之前',64,INK);d.line((48,868,312,868),fill=GOLD,width=2)
save('title',im)

layout=json.loads((SRC/'choice-layout.json').read_text(encoding='utf-8'));choicefiles={};measured=[]
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
  im,d=new((672,76),BG);d.line((0,75,671,75),fill=LINE);lines=wrap(o['text'],604,26)
  assert len(lines)<=2,(choice['id'],lines)
  if o['action']:
   display_name=o['text'].split('｜')[0].split('|')[0].strip()
   txt(d,(24,8),display_name,27);txt(d,(24,44),o['action'],20,MUTED)
  else:
   y=21 if len(lines)==1 else 4
   for j,line in enumerate(lines):txt(d,(24,y+j*34),line,26)
  save(name,im);choicefiles[choice['id']].append({'value':o['value'],'path':image(name)})
  measured.append({'choice':choice['id'],'value':o['value'],'text':o['text'],'lines':lines,'widths':[font(26).getlength(s) for s in lines],'fits':True})

def block(name,id,typ,x,y,img=None,**extra):
 attrs={'id':id,'type':typ,'x':x,'y':y}
 if img:
  for s in ['idle','hover','press']:attrs['image-'+s]=image(img+'-'+s)
 attrs.update({k.replace('_','-'):v for k,v in extra.items()})
 return name+' {\n'+''.join('    '+k+': '+str(v)+';\n' for k,v in attrs.items())+'}\n'
def head(cancel=True,slots=True):
 return 'global {\n    fadein: 0.12;\n    fadeout: 0.12;\n    clickcancel: no;\n    escapecancel: '+('yes' if cancel else 'no')+';\n    rightcancel: '+('yes' if cancel else 'no')+';\n'+('    saveslots: 4;\n' if slots else '')+'}\n'
def gui(name,active,content='',cancel=True):
 s=head(cancel)
 s+=block('BASE',32,'noaction',0,0,image_idle=image(name if name!='gallery' else 'gallery-base'))
 for i,(key,label,action) in enumerate(nav):
  selected={'image_idle':image('nav-'+key+'-hover')} if key==active else {}
  s+=block('NAV_'+key.upper(),20+i,'char',nav_x(i),NAV_Y,'nav-'+key,var='e_action',msg=action,max=1,**selected)
 s+=block('BACK',30,'cancel',496,40,'back')+content
 (BASE/'gui'/(name+'.gui')).write_text(s,encoding='utf-8')
SLOT_Y=236;SLOT_STEP=208
for mode in ['save','load']:
 s=block('TAB_SAVE',11,'char',24,156,'tab-save',var='e_action',msg='V',max=1)+block('TAB_LOAD',12,'char',232,156,'tab-load',var='e_action',msg='L',max=1)
 for n in range(4):
  x=24;y=SLOT_Y+n*SLOT_STEP
  if n==0 and mode=='save':s+=block('AUTO',10,'noaction',x,y,image_idle=image('auto-save'));continue
  s+=block('SLOT'+str(n),n+1,'char',x,y,'save-item-'+str(n),var='e_action',msg=({0:'A',1:'1',2:'2',3:'3'} if mode=='load' else {1:'S',2:'D',3:'F'})[n],max=1,index=n,thumb_width=192,thumb_height=108)
 gui(mode,'load',s)
s=''
for id,typ,y in [(1,'bgmvol',236),(2,'sevol',336),(3,'voicevol',436),(4,'textspeed',584),(5,'autospeed',684)]:s+=block(typ.upper(),id,typ,24,y,image_idle=image('slider-idle'),image_hover=image('slider-hover'),image_knob=image('slider-knob'))
s+=block('PREVIEW',6,'preview',24,768,image_idle=image('preview'),msg='"文字正以你习惯的速度显现。"',**{'msg-zh-cn':'"文字正以你习惯的速度显现。"'},margin_left=18,margin_top=14,margin_right=18,margin_bottom=14)
s+=block('RESET',7,'default',24,896,'reset')+block('FULLSCREEN',8,'fullscreen',248,896,'fullscreen',image_disable=image('fullscreen-press'))
gui('config','config',s)
gui('history','history')
gui('gallery','gallery',cancel=False)
s=''
for id,key,typ,y in [(1,'auto','auto',168),(2,'skip','skip',272),(3,'rollback','char',376),(4,'title','gui',480),(5,'resume','cancel',584)]:
 extra={'var':'e_action','msg':'R','max':1} if key=='rollback' else {'file':'system/sui-u/gui/confirm-title.gui'} if key=='title' else {}
 s+=block('ACTION_'+key.upper(),id,typ,24,y,'action-'+key,**extra)
gui('sysmenu','menu',s)
# Title: same actions as the landscape build after its cinema/title adaptations.
s=head(False,False)+block('BASE',32,'noaction',0,0,image_idle=image('title'))
s+=block('START',1,'goto',208,940,'start',label='sui_start')
s+=block('CONTINUE',2,'char',208,1024,'continue',var='e_action',msg='L',max=1)
s+=block('SETTINGS',3,'char',208,1108,'settings',var='e_action',msg='C',max=1)
s+=block('GALLERY',4,'char',368,1108,'gallery',var='e_action',msg='G',max=1)
(BASE/'gui/title.gui').write_text(s,encoding='utf-8')
s=head(True,False)+block('BASE',32,'noaction',0,0,image_idle=image('title-confirm'))
s+=block('YES',1,'title',CONFIRM[0],CONFIRM[1],'confirm',file='start.novel')+block('NO',2,'cancel',CONFIRM[0]+264,CONFIRM[1],'cancel')
(BASE/'gui/confirm-title.gui').write_text(s,encoding='utf-8')

records=list({r['path']:r for r in records}.values())
m={'schemaVersion':1,'canvas':[W,H],'style':'电影侧栏 · 竖版','approval':{'status':'approved','date':'2026-11-01','instruction':'竖版：上方舞台＋下方文字；横竖版存档互通'},
 'layout':{'stage':[0,0,720,720],'name':[40,736],'message':[24,792,672,440],'menu':[568,24,128,56],'choice':{'heading':[24,716],'x':24,'firstY':792,'stepY':80,'width':672,'height':76},'notice':{'reading':[24,88],'panel':[24,1068]},'nav':{'y':NAV_Y,'x':[nav_x(i) for i in range(5)],'size':[136,72]},'back':[496,40],'slots':{'x':24,'firstY':SLOT_Y,'stepY':SLOT_STEP},'history':{'x':24,'firstY':160,'stepY':216,'rows':4},'gallery':{'x':[24,368],'firstY':168,'stepY':240,'cell':[328,184]},'pager':{'previous':[24,1040],'next':[520,1040],'label':[296,1058]}},
 'resources':records,'choices':choicefiles,'gui':{p.name:'system/sui-portrait/gui/'+p.name for p in sorted((BASE/'gui').glob('*.gui'))},'runtimeEncoding':'PNG用于当前SDK；保留等像素无损WebP','contentBuildId':layout['contentBuildId']}
(BASE/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(SRC/'choice-measurements.json').write_text(json.dumps(measured,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'resources':len(records),'options':len(measured),'allFit':all(x['fits'] for x in measured)}))
