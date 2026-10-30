#!/usr/bin/env python3
"""Deterministic, editable GUI source. Only writes system/sui-u generated files."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import hashlib, json, math, random

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE.parents[1]
OUT = BASE / 'png'
WEBP = BASE / 'webp'
GUI = BASE / 'gui'
ANIME = BASE / 'anime'
for p in (OUT, WEBP, GUI, ANIME): p.mkdir(exist_ok=True)
FONT = ROOT / 'system/font/NotoSansCJK-Medium.ttc'
SERIF = Path('/System/Library/Fonts/Supplemental/Songti.ttc')
FG = '#eeeae0'
MUTED = '#a8b9b9'
ACCENT = '#a9d0c3'
EDGE = '#435d60'
assets = []

def font(size, serif=False):
    return ImageFont.truetype(str(SERIF if serif else FONT), size)

def text(d, xy, s, size=24, color=FG, serif=False, anchor='lt'):
    d.text(xy, s, font=font(size, serif), fill=color, anchor=anchor)

def new(size, color=(0,0,0,0)):
    im=Image.new('RGBA', size, color)
    return im, ImageDraw.Draw(im)

def save(im, name):
    im.save(OUT / (name+'.png'), optimize=True)
    im.save(WEBP / (name+'.webp'), 'WEBP', lossless=True, exact=True, method=6)
    assert Image.open(WEBP / (name+'.webp')).convert('RGBA').tobytes() == im.tobytes()
    assets.append({'name':name,'width':im.width,'height':im.height,
                   'alpha':list(im.getchannel('A').getextrema())})
    return 'system/sui-u/png/'+name+'.png'

def button(name, label, size, primary=False, align='center'):
    for state in ['idle','hover','press']:
        im,d=new(size)
        color = {'idle':(30,49,53,242),'hover':(47,77,78,255),'press':(65,95,93,255)}[state]
        if primary:
            color = {'idle':(167,204,191,255),'hover':(194,224,210,255),'press':(137,184,170,255)}[state]
        d.rounded_rectangle((0,0,size[0]-1,size[1]-1),radius=5,fill=color,outline=ACCENT if state!='idle' else EDGE,width=1)
        if align=='left': text(d,(28,size[1]//2),label,24,'#172b2e' if primary else FG,anchor='lm')
        else: text(d,(size[0]//2,size[1]//2),label,24,'#172b2e' if primary else FG,anchor='mm')
        save(im,name+'-'+state)

def background(title=False, rain=False):
    im,d=new((1280,720),(19,33,39,255))
    for y in range(720):
        v=y/720
        d.line((0,y,1280,y),fill=(int(20-5*v),int(37-9*v),int(44-10*v),255))
    if title or rain:
        # Abstract rain on glass. No location, character, or production art is inferred.
        glow=Image.new('RGBA',im.size)
        gd=ImageDraw.Draw(glow)
        gd.ellipse((855,100,1250,580),fill=(94,131,124,65))
        gd.ellipse((1000,360,1170,540),fill=(189,158,104,70))
        glow=glow.filter(ImageFilter.GaussianBlur(70))
        im=Image.alpha_composite(im,glow);d=ImageDraw.Draw(im)
        d.rectangle((716,72,1214,598),outline=(45,69,73,255),width=1)
        d.line((966,72,966,598),fill=(42,65,68,255),width=1)
        d.line((716,424,1214,424),fill=(42,65,68,255),width=1)
        rng=random.Random(20261028)
        for _ in range(150):
            x=rng.randint(720,1210);y=rng.randint(76,588);length=rng.randint(8,45)
            v=rng.randint(0,12)
            d.line((x,y,x-5,min(598,y+length)),fill=(43+v,66+v,70+v,255),width=1)
    if title:
        d.line((64,664,1216,664),fill=EDGE,width=1)
        text(d,(88,80),'毕节，雨停之前',18,MUTED)
        text(d,(84,137),'毕节，',66,FG,True)
        text(d,(84,210),'雨停之前',80,FG,True)
        d.line((88,316,140,316),fill=ACCENT,width=2)
        text(d,(88,626),'重返故事，从这场雨开始。',20,MUTED)
        text(d,(88,682),'Enter 继续  ·  Esc 返回',16,MUTED)
    return im

def panel(name,title,subtitle,footer='Esc 返回  ·  也可点击右上角返回'):
    im=background();d=ImageDraw.Draw(im)
    d.line((64,120,1216,120),fill=EDGE,width=1)
    d.line((64,656,1216,656),fill=EDGE,width=1)
    d.rectangle((64,45,68,84),fill=ACCENT)
    text(d,(88,40),title,36,FG,True)
    text(d,(90,91),subtitle,18,MUTED)
    text(d,(64,677),footer,16,MUTED)
    save(im,name)

def state_panel(name,size,label=None):
    for state in ['idle','hover','press']:
        im,d=new(size,(24,42,47,255))
        d.rounded_rectangle((0,0,size[0]-1,size[1]-1),radius=4,fill=(26,44,49,255) if state=='idle' else (38,61,64,255),outline=EDGE if state=='idle' else ACCENT)
        if label: text(d,(22,24),label,22,MUTED)
        save(im,name+'-'+state)

save(background(True),'title')
save(background(rain=True),'reading-backdrop')
button('start','开始阅读',(304,64),True)
button('continue','继续阅读',(304,64))
button('settings','设置',(144,56))
button('gallery','图鉴',(144,56))
button('back','返回',(136,56))
button('menu','菜单  ≡',(128,56))
button('previous','←  上一页',(176,56))
button('next','下一页  →',(176,56))
button('confirm','确认返回标题',(224,64),True)
button('cancel','继续阅读',(224,64))
button('reset','重置阅读速度',(200,56))
button('fullscreen','全屏阅读',(200,56))

im,d=new((1184,206))
d.rounded_rectangle((0,0,1183,205),radius=5,fill=(19,34,40,238),outline=(102,134,133,210))
d.line((36,1,140,1),fill=ACCENT,width=2)
save(im,'message')
im,d=new((240,48));d.rounded_rectangle((0,0,239,47),radius=3,fill=(25,45,49,245))
d.line((0,46,240,46),fill=ACCENT,width=2);save(im,'name')
for i,a in [(1,255),(2,120)]:
    im,d=new((24,24));d.polygon([(5,5),(19,12),(5,19)],fill=(169,208,195,a));save(im,'advance-'+str(i))
for mode,label in [('auto','自动阅读中'),('skip','快进已读内容')]:
    im,d=new((240,48));d.rounded_rectangle((0,0,239,47),radius=4,fill=(23,43,47,244),outline=EDGE)
    text(d,(120,24),label,22,ACCENT,anchor='mm');save(im,mode)
for state in ['idle','hover']:
    im,d=new((1040,88));d.rounded_rectangle((0,0,1039,87),radius=4,fill=(24,43,49,247) if state=='idle' else (46,77,78,255),outline=EDGE if state=='idle' else ACCENT,width=1)
    if state=='hover':d.rectangle((0,12,4,76),fill=ACCENT)
    save(im,'choice-'+state)

panel('save','保存进度','自动档随阅读更新；点击手动档保存，已有进度将被覆盖。')
panel('load','读取进度','选择一个已保存的片刻，继续阅读。')
panel('history','阅读回顾','拖动右侧滚动条翻阅；点击有语音的条目可重听。')
panel('config','阅读设置','调整声音、文字与自动阅读速度。')
panel('sysmenu','阅读菜单','把故事暂时放在这里。')
panel('gallery-base','图鉴','未解锁的画面将在阅读后显现。')
panel('gallery-view','图鉴','点击画面或按 Esc 返回图鉴。')

state_panel('save-item',(556,220))
for idx in range(4):
    for state in ['idle','hover','press']:
        im=Image.open(OUT/('save-item-'+state+'.png')).convert('RGBA');d=ImageDraw.Draw(im)
        text(d,(84,14),'自动档' if idx==0 else '手动存档',22,ACCENT)
        save(im,'save-item-'+str(idx)+'-'+state)
im,d=new((556,220),(23,40,46,255));d.rectangle((0,0,555,219),outline=EDGE)
text(d,(24,28),'自动存档',26,ACCENT)
text(d,(24,90),'随阅读进度自动更新',24)
text(d,(24,142),'请在「读取进度」中恢复',20,MUTED)
save(im,'auto-save')
state_panel('history-item',(1080,208))
im,d=new((24,424));d.line((12,12,12,412),fill=EDGE,width=4);save(im,'scroll-idle')
im,d=new((24,424));d.line((12,12,12,412),fill=ACCENT,width=4);save(im,'scroll-hover')
im,d=new((24,44));d.rounded_rectangle((5,0,19,43),radius=6,fill=ACCENT);save(im,'scroll-knob')
for state,color in [('idle',EDGE),('hover',ACCENT)]:
    im,d=new((440,48));d.line((16,24,424,24),fill=color,width=3);save(im,'slider-'+state)
im,d=new((32,48));d.rounded_rectangle((5,9,27,39),radius=5,fill=ACCENT);save(im,'slider-knob')
im,d=new((440,112),(24,42,47,255));d.rectangle((0,0,439,111),outline=EDGE);save(im,'preview')
im=Image.open(OUT/'config.png').convert('RGBA');d=ImageDraw.Draw(im)
for x,y,label in [(88,169,'背景音乐'),(88,293,'操作音效'),(88,417,'语音'),(710,169,'文字显示速度'),(710,293,'自动阅读间隔')]:
    text(d,(x,y),label,26)
for x,y,l,r in [(88,257,'安静','响亮'),(88,381,'安静','响亮'),(88,505,'安静','响亮'),(710,257,'慢','快'),(710,381,'短','长')]:
    text(d,(x,y),l,16,MUTED);text(d,(x+440,y),r,16,MUTED,anchor='rt')
# Re-export edited source image; the title remains programmatic, not a flattened external design.
assets[:]=[a for a in assets if a['name']!='config'];save(im,'config')
for name,label in [('save','保存进度'),('load','读取进度'),('history','阅读回顾'),('auto','自动阅读'),('skip','快进已读'),('config','阅读设置'),('title','返回标题')]:
    button('nav-'+name,label,(328,80))
im,d=new((1280,720),(12,25,30,248));d.rounded_rectangle((350,218,930,502),radius=6,fill=(26,46,51,255),outline=EDGE)
text(d,(640,266),'返回标题？',36,FG,True,anchor='mt')
text(d,(640,325),'未保存的阅读进度将丢失。',23,MUTED,anchor='mt')
save(im,'title-confirm')
im,d=new((352,184),(25,43,49,255));d.rectangle((0,0,351,183),outline=EDGE)
d.arc((161,58,191,88),180,360,fill=MUTED,width=2);d.rounded_rectangle((157,75,195,105),radius=3,outline=MUTED,width=2)
text(d,(176,134),'尚未解锁',22,MUTED,anchor='mm');save(im,'cg-locked')
im,d=new((352,184));d.rectangle((0,0,351,183),outline=ACCENT,width=3);save(im,'cg-focus')

def block(name,id,typ,x,y,image=None,**attrs):
    pairs={'id':id,'type':typ,'x':x,'y':y}
    if image:
        for state in ['idle','hover','press']:
            pairs['image-'+state]='system/sui-u/png/'+image+'-'+state+'.png'
    pairs.update(attrs)
    return name+' {\n'+''.join('    '+k.replace('_','-')+': '+str(v)+';\n' for k,v in pairs.items())+'}\n'

def base(name):return block('BASE',32,'noaction',0,0,image_idle='system/sui-u/png/'+name+'.png')
def gui(name,content,global_extra='',cancel=True):
    s='# SUI-U · generated from source/build.py\n'
    s+='global {\n    fadein: 0.12;\n    fadeout: 0.12;\n    clickcancel: no;\n    escapecancel: '+('yes' if cancel else 'no')+';\n    rightcancel: '+('yes' if cancel else 'no')+';\n'+global_extra+'}\n\n'
    (GUI/(name+'.gui')).write_text(s+content)
def back():return block('BACK',30,'cancel',1080,32,'back')
gui('title',base('title')+
    block('START',1,'goto',88,354,'start',label='sui_start')+
    block('CONTINUE',2,'gui',88,434,'continue',file='system/sui-u/gui/load.gui')+
    block('SETTINGS',3,'gui',88,514,'settings',file='system/sui-u/gui/config.gui')+
    block('GALLERY',4,'goto',248,514,'gallery',label='sui_gallery'),cancel=False)
for mode in ['save','load']:
    s=base(mode)+back()
    coords=[(64,146),(660,146),(64,388),(660,388)]
    for idx,(x,y) in enumerate(coords):
        if mode=='save' and idx==0:
            s+=block('AUTO',10,'noaction',x,y,image_idle='system/sui-u/png/auto-save.png');continue
        s+=block('SLOT'+str(idx),idx+1,mode,x,y,'save-item-'+str(idx),index=idx,
                 index_x=20,index_y=12,date_x=232,date_y=16,
                 thumb_x=20,thumb_y=78,thumb_width=192,thumb_height=108,
                 chapter_x=232,chapter_y=72,msg_x=232,msg_y=112,margin_right=20,margin_bottom=20)
    gui(mode,s,'    saveslots: 4;\n')
s=base('history')+block('BACK',1,'cancel',1080,32,'back')
gui('history',s)
s=base('config')+back()
for id,typ,x,y in [(1,'bgmvol',88,211),(2,'sevol',88,335),(3,'voicevol',88,459),(4,'textspeed',710,211),(5,'autospeed',710,335)]:
    s+=block(typ.upper(),id,typ,x,y,image_idle='system/sui-u/png/slider-idle.png',image_hover='system/sui-u/png/slider-hover.png',image_knob='system/sui-u/png/slider-knob.png')
s+=block('PREVIEW',6,'preview',710,425,image_idle='system/sui-u/png/preview.png',msg='"文字会以你习惯的速度，慢慢显现。"',**{'msg-zh-cn':'"文字会以你习惯的速度，慢慢显现。"'},margin_left=18,margin_top=16,margin_right=18,margin_bottom=16)
s+=block('RESET',7,'default',710,566,'reset')
s+=block('FULLSCREEN',8,'fullscreen',88,566,'fullscreen',image_disable='system/sui-u/png/fullscreen-press.png')
gui('config',s)
s=base('sysmenu')+back()
for id,name,x,y in [(1,'save',96,190),(2,'load',476,190),(3,'history',856,190),(4,'auto',96,334),(5,'skip',476,334),(6,'config',856,334),(7,'title',96,518)]:
    if name=='history':s+=block('HISTORY',id,'char',x,y,'nav-history',var='sui_ui_action',msg='H',max=1)
    elif name in ['auto','skip']:s+=block(name.upper(),id,name,x,y,'nav-'+name)
    else:s+=block(name.upper(),id,'gui',x,y,'nav-'+name,file='system/sui-u/gui/'+('confirm-title' if name=='title' else name)+'.gui')
gui('sysmenu',s)
gui('confirm-title',base('title-confirm')+
    block('YES',1,'title',396,398,'confirm',file='start.novel')+
    block('NO',2,'cancel',660,398,'cancel'))

patch={
 'game.locale':'zh-cn','game.novel':'false',
 'msgbox.image':'system/sui-u/png/message.png','msgbox.x':'48','msgbox.y':'490',
 'msgbox.margin.left':'36','msgbox.margin.right':'36','msgbox.margin.top':'24','msgbox.margin.bottom':'40',
 'msgbox.margin.line':'44','msgbox.font.size':'30','msgbox.font.r':'238','msgbox.font.g':'234','msgbox.font.b':'224',
 'msgbox.skip_unseen':'false','msgbox.font.outline.width':'0',
 'namebox.image':'system/sui-u/png/name.png','namebox.x':'76','namebox.y':'442',
 'namebox.margin.top':'8','namebox.margin.left':'16','namebox.centering':'false','namebox.font.size':'26',
 'namebox.font.r':'169','namebox.font.g':'208','namebox.font.b':'195',
 'click.x':'1170','click.y':'653','click.interval':'0.8',
 'click.image1':'system/sui-u/png/advance-1.png','click.image2':'system/sui-u/png/advance-2.png',
 'sysbtn.enable':'false','sysbtn.idle':'system/sui-u/png/menu-idle.png','sysbtn.hover':'system/sui-u/png/menu-hover.png',
 'sysbtn.x':'1104','sysbtn.y':'24','sysbtn.width':'128','sysbtn.height':'56',
 'save.thumb.width':'192','save.thumb.height':'108',
 'choose.font.size':'28','choose.font.idle.r':'238','choose.font.idle.g':'234','choose.font.idle.b':'224',
 'choose.font.hover.r':'208','choose.font.hover.g':'234','choose.font.hover.b':'224',
 'automode.image':'system/sui-u/png/auto.png','automode.x':'48','automode.y':'24',
 'skipmode.image':'system/sui-u/png/skip.png','skipmode.x':'48','skipmode.y':'24',
 'gui.history.name.font.size':'22','gui.history.text.font.size':'26','gui.history.text.margin.line':'36',
 'gui.history.name.margin.line':'32','gui.history.text.font.outline.width':'0','gui.history.name.font.outline.width':'0',
 'gui.save.index.font.size':'24','gui.save.index.margin.char':'0','gui.save.date.font.size':'19','gui.save.date.margin.char':'0',
 'gui.save.chapter.font.size':'23','gui.save.msg.font.size':'22','gui.save.msg.margin.line':'30',
 'gui.save.chapter.font.outline.width':'0','gui.save.msg.font.outline.width':'0','gui.preview.font.size':'26'
}
def fade_block(name,layer,a,b,x='r0',y='r0'):
    return f'{name} {{\n    layer: {layer};\n    start: 0.0;\n    end: 0.12;\n    from-x: {x};\n    from-y: {y};\n    to-x: {x};\n    to-y: {y};\n    from-a: {a};\n    to-a: {b};\n}}\n'
for prefix in ['msgbox','namebox','automode','skipmode']:
    for action in ['hide','show']:
        key=prefix+'.anime.'+action
        filename={'msgbox':'msgbox','namebox':'namebox','automode':'auto','skipmode':'skip'}[prefix]+'-'+action+'.anime'
        layer={'msgbox':'msgbox','namebox':'namebox','automode':'$0','skipmode':'$0'}[prefix]
        a,b=(0,255) if action=='show' else (255,0)
        (ANIME/filename).write_text(fade_block(action,layer,a,b))
        patch[key]='system/sui-u/anime/'+filename
for action in ['out','fadein','appear','hover','fadeout']:
    idle=0 if action in ['out','fadeout','hover'] else 255
    hover=255 if action=='hover' else 0
    content=fade_block('idle','sysbtn-idle',idle,idle,1104,24)+fade_block('hover','sysbtn-hover',hover,hover,1104,24)
    (ANIME/('sysbtn-'+action+'.anime')).write_text(content)
    patch['sysbtn.anime.'+action]='system/sui-u/anime/sysbtn-'+action+'.anime'
for state in ['idle','hover']:
    (ANIME/('choice-'+state+'.anime')).write_text(fade_block('idle','$0',255,255)+fade_block('hover','$1',255,255))
for i in range(1,9):
    patch.update({f'choose.box{i}.idle':'system/sui-u/png/choice-idle.png',f'choose.box{i}.hover':'system/sui-u/png/choice-hover.png',
                  f'choose.box{i}.x':'120',f'choose.box{i}.y':str(104+(min(i,6)-1)*96),
                  f'choose.box{i}.margin.top':'24',f'choose.box{i}.idle_anime':'system/sui-u/anime/choice-idle.anime',f'choose.box{i}.hover_anime':'system/sui-u/anime/choice-hover.anime'})
for group in ['gui.history.text','gui.history.name','gui.save.index','gui.save.date','gui.save.chapter','gui.save.msg','gui.preview']:
    for c,v in zip(['r','g','b'],[238,234,224]):patch[group+'.font.'+c]=str(v)
(BASE/'config.patch.json').write_text(json.dumps(patch,ensure_ascii=False,indent=2)+'\n')
cg=json.loads((ROOT/'docs/CG当前选择.json').read_text())
(BASE/'gallery.registry.json').write_text(json.dumps({'schemaVersion':1,'orderSource':'docs/CG当前选择.json#activeSelectedIds',
 'items':[{'id':id,'unlockVariable':'sui_cg_'+id,'file':None} for id in cg['activeSelectedIds']]},ensure_ascii=False,indent=2)+'\n')
(BASE/'gallery-order.ray').write_text('// Generated from activeSelectedIds; no retired-route CG.\nvar suiCGOrder = '+json.dumps(cg['activeSelectedIds'])+';\n')
for a in assets:
    a['files']=[]
    for folder,ext in [(OUT,'png'),(WEBP,'webp')]:
        p=folder/(a['name']+'.'+ext)
        a['files'].append({'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(BASE/'asset-manifest.json').write_text(json.dumps({'schemaVersion':1,'canvas':[1280,720],
 'style':'用户选定：雨夜青灰，横屏优先','runtimeEncoding':'PNG：当前Wasm的WebP红蓝通道问题；无损WebP逐像素相等，暂不接入GUI',
 'generator':'system/sui-u/source/build.py','assets':assets},ensure_ascii=False,indent=2)+'\n')
print(f'{len(assets)} UI资源 / {len(list(GUI.glob("*.gui")))} GUI / {len(cg["activeSelectedIds"])} 个未绑定图鉴位')
