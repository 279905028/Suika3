# -*- coding: utf-8 -*-
"""SUI-A06 制作包离线检查；保留原件，仅创建无损衍生与诊断预览。"""
from pathlib import Path
import json, hashlib, copy
from PIL import Image, ImageDraw, ImageFont, ImageChops, features
import PIL

ROOT=Path(__file__).resolve().parents[2]
QA=Path(__file__).resolve().parent
SRC=ROOT/'assets/sources/20261029/SUI-A06'
FONT=ROOT/'system/font/NotoSansCJK-Medium.ttc'
COLORS={'white':'#ffffff','black':'#000000','day':'#e5ece6','night':'#182c3b'}
ENC={'tool':'Pillow','version':PIL.__version__,'libwebp':features.version('webp'),'lossless':True,'method':6,'exact':True,'resize':False,'crop':False}

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,x): p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def xywh(b): return None if b is None else [b[0],b[1],b[2]-b[0],b[3]-b[1]]
def meta(p):
    with Image.open(p) as im:
        im.load(); a=im.getchannel('A'); hist=a.histogram()
        return {'path':str(p.relative_to(ROOT)), 'sha256':sha(p),'bytes':p.stat().st_size,
                'format':im.format,'width':im.width,'height':im.height,'mode':im.mode,'orientation':im.getexif().get(274,1),
                'iccEmbedded':bool(im.info.get('icc_profile')),'colorSpace':'未转换颜色；未嵌入ICC时保留生成器像素数值',
                'alpha':{'present':True,'range':list(a.getextrema()),'bbox':xywh(a.getbbox()),
                         'bboxAtAlpha16':xywh(a.point(lambda v:255 if v>=16 else 0).getbbox()),
                         'clearPixels':hist[0],'opaquePixels':hist[255],
                         'coordinateBasis':'源图像素；左上原点；[x,y,width,height]'},
                'rgbaDecodedBytes':im.width*im.height*4}

def label(im,text,xy=(20,12),size=25,fill='#edf2ef'):
    ImageDraw.Draw(im).text(xy,text,font=ImageFont.truetype(str(FONT),size),fill=fill)
def composite(im,color,limit=None):
    view=im.copy()
    if limit:view.thumbnail(limit,Image.Resampling.LANCZOS)
    bg=Image.new('RGBA',view.size,color);bg.alpha_composite(view)
    return bg.convert('RGB')
def intersect(a,b): return a[0]<b[0]+b[2] and a[0]+a[2]>b[0] and a[1]<b[1]+b[3] and a[1]+a[3]>b[1]

jobs=json.loads((QA/'generation-log.json').read_text())['jobs']
job_map={j['key']:j for j in jobs}
specs=[
    {'key':'orb-base','form':'orb','label':'球形 A · 基础','file':'selected/orb/char-huangqiuqiu-orb-base-neutral-v001.png','variant':'base-neutral','origin':'approved-base-copy'},
    *[{'key':j['key'],'form':j['form'],'label':{'orb-amused':'球形 · 笑意','orb-serious':'球形 · 认真','orb-downcast':'球形 · 低落','orb-wave':'球形 · 抬手'}[j['key']],
       'file':j['file'],'variant':j['variant'],'origin':'generated-variant'} for j in jobs if j['form']=='orb'],
    {'key':'human-toy-base','form':'human','label':'人形 B · 持玩偶','file':'selected/human/char-huangqiuqiu-human-toy-base-v001.png','variant':'toy-base','origin':'approved-base-copy'},
    *[{'key':j['key'],'form':j['form'],'label':{'human-neutral':'人形 · 空手平静','human-serious':'人形 · 认真','human-downcast':'人形 · 低落','human-tearful':'人形 · 含泪','human-chin':'人形 · 托腮'}[j['key']],
       'file':j['file'],'variant':j['variant'],'origin':'generated-variant'} for j in jobs if j['form']=='human']]
order=['orb-base','orb-amused','orb-serious','orb-downcast','orb-wave','human-toy-base','human-neutral','human-serious','human-downcast','human-tearful','human-chin']
specs.sort(key=lambda x:order.index(x['key']))
assert len(specs)==11 and len(jobs)==9
ui=json.loads((ROOT/'system/sui-u/integration.json').read_text())
usage=json.loads((QA/'story-usage.json').read_text());uses={x['key']:x for x in usage['items']}
for folder in ['composites','previews','ui-static']: (QA/folder).mkdir(exist_ok=True)
checks=[]; records=[]; geometry=[]; sourcefiles=[]; images={}
template=json.loads((ROOT/'qa/SUI-A01-20261028/resource-record.template.json').read_text())

for spec in specs:
    key=spec['key']; form=spec['form']; p=SRC/spec['file'];w=p.with_suffix('.webp')
    im=Image.open(p).convert('RGBA');images[key]=im
    assert im.size==((1254,1254) if form=='orb' else (1024,1536)),(key,im.size)
    if not w.exists():im.save(w,'WEBP',lossless=True,method=6,exact=True)
    dec=Image.open(w).convert('RGBA');equal=im.size==dec.size and im.tobytes()==dec.tobytes()
    a=meta(p);b=meta(w)
    assert equal and b['format']=='WEBP' and b['alpha']['clearPixels']>0 and b['orientation']==1,key
    if spec['origin']=='generated-variant':
        output=Path(job_map[key]['outputPath']); assert sha(output)==sha(p),key
    sourcefiles.extend([a,b])
    comps=[]
    for kind,color in COLORS.items():
        dest=QA/'composites'/f'{key}-{kind}.png';composite(im,color).save(dest)
        comps.append(str(dest.relative_to(ROOT)))
    sheet=Image.new('RGB',(1040,900),'#20323d')
    for i,(kind,color) in enumerate(COLORS.items()):
        v=composite(im,color,(482,390));x=(i%2)*520;y=(i//2)*450
        label(sheet,kind,(x+22,y+12),23);sheet.paste(v,(x+(520-v.width)//2,y+53))
    sheet.save(QA/'previews'/f'{key}-four-backgrounds.png')
    x,y,scale=(452,96,.30) if form=='orb' else (435,64,.40)
    critical={'face':[275,380,700,510],'hand':[625,890,385,310]} if form=='orb' else {'face':[280,245,365,350]}
    if key=='orb-wave':critical['hand']=[920,570,280,310]
    if key=='human-toy-base':critical['toy-hand']=[600,315,420,685]
    if key=='human-chin':critical['chin-hand']=[455,400,200,350]
    scaledrects={k:[round(x+i*scale),round(y+j*scale),round(wi*scale),round(he*scale)] for k,(i,j,wi,he) in critical.items()}
    masks={'message':ui['message']['rect'],'name':ui['name']['rect'],'menu':ui['menuRect']}
    overlaps={k:[n for n,r in masks.items() if intersect(z,r)] for k,z in scaledrects.items()}
    assert not any(overlaps.values()),(key,overlaps)
    canvas=Image.new('RGBA',(1280,720),'#253b43')
    canvas.alpha_composite(im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS),(x,y))
    for name,position in [('message.png',(48,490)),('name.png',(76,442)),('menu-idle.png',(1104,24))]:
        canvas.alpha_composite(Image.open(ROOT/'system/sui-u/png'/name).convert('RGBA'),position)
    label(canvas,'黄球球',(94,450),26);label(canvas,spec['label']+'  /  离线合成',(86,518),28)
    label(canvas,'仅核对比例与遮挡，不代表引擎运行验收。',(86,568),26)
    canvas.convert('RGB').save(QA/'ui-static'/f'{key}.png')
    # 同一源图坐标区域的alpha轮廓用于辅助比较，不冒充人脸关键点检测。
    probe=(160,40,720,580) if form=='human' else (50,50,1205,1215)
    am=im.getchannel('A').point(lambda v:255 if v>=16 else 0)
    probe_bbox=xywh(am.crop(probe).getbbox())
    geometry.append({'key':key,'canvasSize':list(im.size),'alpha16ProbeRect':xywh(probe),'probeBBoxLocal':probe_bbox,
                     'meaning':'固定局部区的alpha包围盒；需配合脸部对照人工核对，不是人脸识别',
                     'pivot':[im.width/2,im.height],'pivotMeaning':'源画布底中点；腰部截幅和球形均不是脚底锚点'})
    checks.append({'key':key,'source':a,'derivative':b,'decodedRgbaEqual':equal,'sourceOriginalPreserved':True,
                   'uiCriticalSourceRects':critical,'uiCriticalCanvasRects':scaledrects,'uiMaskOverlaps':overlaps,
                   'encoding':ENC,'compositeFiles':comps,'visualReview':'见visual-review.md，单独记录实际回看',
                   'engine':'未测','browser':'未测','physicalPhone':'未测','desktop':'未测','deployment':'未执行'})
    for metadata in [a,b]:
        r=copy.deepcopy(template)
        r.update({'assetId':'sui-a06-'+key+'-v001-'+metadata['format'].lower(),'kind':'character','ownerTask':'SUI-A06',
                  'characterOrSceneKey':'huangqiuqiu','form':form,'variant':spec['variant'],'version':'v001',
                  'status':'基础已定稿' if spec['origin']=='approved-base-copy' else '基于已定稿基础制作的差分',
                  'requirementKeys':['char-huangqiuqiu-'+form]+(['prop-huangqiuqiu-human-accessories'] if form=='human' else []),
                  'storyAnchors':[uses[key]['anchor']],'sourceFile':a['path'],'derivativeFile':metadata['path'],
                  'sha256Source':a['sha256'],'sha256Derivative':metadata['sha256'],'format':metadata['format'],
                  'width':metadata['width'],'height':metadata['height'],'bytes':metadata['bytes'],
                  'orientation':metadata['orientation'],'colorSpace':metadata['colorSpace'],'alpha':metadata['alpha'],
                  'sourceMetadata':a,'encoding':ENC if metadata['format']=='WEBP' else {'tool':'built-in image_gen','process':'原始PNG，未改写'},
                  'sources':job_map[key]['references'] if key in job_map else ['qa/SUI-A06-20261029/approval.json'],
                  'promptOrProcessRecord':'qa/SUI-A06-20261029/generation-log.json' if key in job_map else 'qa/SUI-A06-20261028/generation-log.json',
                  'placement':{'coordinateBasis':'源图像素，左上原点，[x,y,width,height]','pivot':[im.width/2,im.height],
                               'pivotMeaning':geometry[-1]['pivotMeaning'],'criticalRects':critical,'cropRect':None,
                               'previewXY':[x,y],'previewScale':scale,'uiMaskReference':'system/sui-u/integration.json','previewOnly':True}})
        r['approval']={'appearanceEvidence':['docs/人物/黄球球.md'],'imageEvidence':['qa/SUI-A06-20261029/approval.json'],
                       'approvalScope':'球形A与人形B基础；差分为本轮已授权制作，未声称用户逐张终审',
                       'currentProjectAdopted':False,'adoptionEvidence':None}
        r['binding'].update({'routeIds':['huangqiuqiu'],'condition':uses[key]['scope'],'enter':'按正文锚点由E/I接入',
                             'exitAndRestore':'随正文动作结束退出；读档和回退恢复当前形态、表情和道具；本包未绑定运行'})
        r['checks']={'metadata':'通过','decodedPixels':'PNG/WebP全部RGBA相同','compositeWhiteBlackDayNight':'离线回看见visual-review.md',
                     'engine':'未测','browser':'未测','physicalPhone':'未测','desktop':'未测','deployment':'未执行'}
        r['pending']=['A11独立复核与采用记录','SUI-I导入、E绑定、Q分端运行验收']
        records.append(r)

# 对照表和形态对照均为QA排版，未改写任何原画。
orbkeys=[k for k in order if k.startswith('orb')];humankeys=[k for k in order if k.startswith('human')]
orbboard=Image.new('RGB',(1600,450),'#1c303a')
for i,k in enumerate(orbkeys):
    label(orbboard,next(s['label'] for s in specs if s['key']==k),(i*320+20,18),23)
    v=composite(images[k],'#e5e9e4',(300,300));orbboard.paste(v,(i*320+10,65))
label(orbboard,'1254×1254 · 球形 A 基础＋4差分 · 原件与无损WebP分别保留',(24,396),25)
orbboard.save(QA/'previews/orb-overview.png')
humanboard=Image.new('RGB',(1440,1680),'#1c303a')
for i,k in enumerate(humankeys):
    x=(i%3)*480;y=(i//3)*840
    label(humanboard,next(s['label'] for s in specs if s['key']==k),(x+22,y+18),26)
    v=composite(images[k],'#e5e9e4',(458,740));humanboard.paste(v,(x+(480-v.width)//2,y+68))
humanboard.save(QA/'previews/human-overview.png')
faceboard=Image.new('RGB',(1500,420),'#20323d')
for i,k in enumerate(humankeys):
    v=composite(images[k].crop((295,255,650,590)),'#e5e9e4',(235,300))
    label(faceboard,next(s['label'] for s in specs if s['key']==k).replace('人形',''),(i*250+14,15),20)
    faceboard.paste(v,(i*250+8,65))
label(faceboard,'固定源图裁区 · 不重定位脸部 · 用于比较遮片、眉眼、嘴型和托腮手',(22,365),23)
faceboard.save(QA/'previews/human-faces.png')
formboard=Image.new('RGB',(1280,960),'#1c303a')
for i,k in enumerate(['orb-base','human-toy-base']):
    v=composite(images[k],'#e5e9e4',(590,735));formboard.paste(v,(i*640+(640-v.width)//2,110+(735-v.height)//2))
    label(formboard,'球形 A' if i==0 else '人形 B',(i*640+22,24),30)
    label(formboard,'正式相识后，至第55天17:00前' if i==0 else '第55天17:00起，两个结局均保留',(i*640+22,70),24)
label(formboard,'同一角色的两种形态；对照图不表示两者同时在场或真实体型比例。',(24,888),25)
formboard.save(QA/'previews/form-comparison.png')

uIBoard=Image.new('RGB',(1440,1224),'#1c303a')
for i,spec in enumerate(specs):
    x=(i%3)*480;y=(i//3)*306
    label(uIBoard,spec['label'],(x+16,y+5),21)
    v=Image.open(QA/'ui-static'/f"{spec['key']}.png").convert('RGB')
    v=v.resize((480,270),Image.Resampling.LANCZOS)
    uIBoard.paste(v,(x,y+36))
label(uIBoard,'1280×720 静态诊断',(976,984),25)
label(uIBoard,'原画包未导入运行',(976,1030),25)
uIBoard.save(QA/'previews/ui-overview.png')

# 六选项仅给出遮挡诊断，不宣称选择期可以直接照此演出。
choices=Image.open(QA/'ui-static/human-toy-base.png').convert('RGBA')
draw=ImageDraw.Draw(choices,'RGBA')
for i in range(6):
    cy=ui['choice']['firstY']+i*ui['choice']['stepY']
    draw.rectangle((120,cy,1160,cy+88),fill=(12,30,38,225),outline=(142,198,186,255))
    label(choices,f'选择项 {i+1}：遮挡诊断',(150,cy+24),24)
choices.convert('RGB').save(QA/'previews/six-choice-occlusion.png')

before=json.loads((QA/'input-before.json').read_text());protection=[]
for row in before['files']:
    p=Path(row['path']);cur=sha(p)
    protection.append({'path':str(p),'expected':row['sha256'],'current':cur,'unchanged':cur==row['sha256']})
for row in before['selectedCopies']:
    p=ROOT/row['copy'];assert sha(p)==row['copySha256']
assert all(r['unchanged'] for r in protection)
save(QA/'source-preservation.json',{'date':'2026-10-29','allUnchanged':True,'files':protection,'selectedCopies':before['selectedCopies']})
summary={'images':len(specs),'orbImages':5,'humanImages':6,'newlyGeneratedVariants':9,'selectedBaseCopies':2,
         'pngWebpPairsEqual':len(checks),'allCriticalRectsClear':True,'sourceFilesUnchanged':len(protection),
         'webpBytes':sum(r['derivative']['bytes'] for r in checks),'largestWebpBytes':max(r['derivative']['bytes'] for r in checks),
         'rgbaAllImagesBytes':sum(r['derivative']['rgbaDecodedBytes'] for r in checks),
         'rgbaEstimateMeaning':'全部图同时解码的理论像素量，不是实际峰值或手机负载测量','adoptedCount':0}
save(QA/'asset-check.json',{'date':'2026-10-29','scope':'离线资源检查','summary':summary,'files':checks})
save(QA/'geometry-check.json',{'sameCanvasPerForm':True,'files':geometry,'visualEvidence':'previews/human-faces.png；逐图四底合成','engineSwitching':'未测'})
save(SRC/'resource-records.json',{'schemaVersion':'SUI-A06-production-1','date':'2026-10-29','records':records,'adoptedCount':0})
save(QA/'output-manifest.json',{'date':'2026-10-29','summary':summary,'files':sourcefiles})
usage['date']='2026-10-29'
for item in usage['items']:
    item['production']='制作完成，包内检查见asset-check.json；运行未绑定'
    item['file']=str((SRC/next(x['file'] for x in specs if x['key']==item['key'])).relative_to(ROOT))
save(QA/'story-usage.json',usage)
save(QA/'package-candidates.json',{'task':'SUI-A06','status':'供A11复核，不是最终采用清单','approval':'qa/SUI-A06-20261029/approval.json',
                                 'files':[{'key':x['key'],'source':x['source']['path'],'webp':x['derivative']['path']} for x in checks],
                                 'adoptedInRuntime':False})
print(json.dumps(summary,ensure_ascii=False))
