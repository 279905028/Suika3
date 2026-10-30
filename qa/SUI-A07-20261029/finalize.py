"""本包格式、来源、条件与离线合成检查。不会运行游戏或导入 current。"""
from pathlib import Path
import json, hashlib, math, html
from PIL import Image, ImageDraw, ImageFont, features
import PIL
from catalog import ASSETS, EXTRA_GROUPS, SOURCE as SOURCE_REL

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent
SOURCE = ROOT / SOURCE_REL
FONT = str(ROOT / 'system/font/NotoSansCJK-Medium.ttc')
def digest(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def dump(p,v): Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def font(n): return ImageFont.truetype(FONT,n)
def anchor(path,quote):
    lines=(ROOT/path).read_text().splitlines()
    hits=[i for i,s in enumerate(lines) if quote in s]
    assert len(hits)==1,(path,quote,hits)
    i=hits[0]
    headings=[s for s in lines[:i+1] if s.startswith('#')]
    return dict(path=path,line=i+1,quote=quote,heading=headings[-1] if headings else '',sha256=digest(ROOT/path))
def meta(p):
    with Image.open(p) as im:
        im.load();a=im.convert('RGBA').getchannel('A');hist=a.histogram()
        return dict(path=str(p.relative_to(ROOT)),format=im.format,mode=im.mode,width=im.width,height=im.height,
                    bytes=p.stat().st_size,sha256=digest(p),orientation=im.getexif().get(274,1),
                    iccEmbedded=bool(im.info.get('icc_profile')),alphaRange=list(a.getextrema()),
                    alphaBoundingBoxLTRB=list(a.getbbox()),transparentPixels=hist[0],
                    alpha16BoundingBoxLTRB=list(a.point(lambda v:255 if v>=16 else 0).getbbox()),
                    decodedRgbaBytes=im.width*im.height*4)
def background(kind,size):
    colors={'white':('#ffffff','#ffffff'),'black':('#000000','#000000'),
            'day':('#e2e9e4','#becfc6'),'night':('#23373f','#0e1a21')}
    def rgb(s):return tuple(int(s[i:i+2],16) for i in (1,3,5))
    a,b=map(rgb,colors[kind]);im=Image.new('RGBA',size);d=ImageDraw.Draw(im)
    for y in range(size[1]):
        t=y/max(size[1]-1,1);d.line((0,y,size[0],y),fill=tuple(round(x*(1-t)+z*t) for x,z in zip(a,b))+(255,))
    return im
def flat(im,color='#e7ebe6'):
    bg=Image.new('RGBA',im.size,color);bg.alpha_composite(im);return bg.convert('RGB')
def intersects(a,b):return a[0]<b[0]+b[2] and b[0]<a[0]+a[2] and a[1]<b[1]+b[3] and b[1]<a[1]+a[3]

for name in ['composites','ui-static','previews']: (QA/name).mkdir(exist_ok=True)
jobs={j['key']:j for j in json.loads((QA/'generation-jobs.json').read_text())}
records=[]
for s in ASSETS:
    p=SOURCE/s['file']
    if s.get('inherited'):
        original=SOURCE/s['inherited'];p.parent.mkdir(parents=True,exist_ok=True)
        if not p.exists():Image.open(original).convert('RGBA').save(p)
        assert Image.open(original).convert('RGBA').tobytes()==Image.open(p).convert('RGBA').tobytes()
    assert p.exists(),p
    im=Image.open(p).convert('RGBA');w=p.with_suffix('.webp')
    if not w.exists():im.save(w,format='WEBP',lossless=True,method=6,exact=True)
    assert im.tobytes()==Image.open(w).convert('RGBA').tobytes(),f'无损像素不一致: {w}'
    m,n=meta(p),meta(w)
    assert m['format']=='PNG' and n['format']=='WEBP'
    assert (m['width'],m['height'])==(1024,1536)
    assert m['alphaRange'][0]==0 and m['alphaRange'][1]>0 and m['transparentPixels']>0
    assert m['orientation']==1
    anc=anchor(s['anchorPath'],s['quote'])
    if s.get('inherited'):
        provenance={'type':'既有确认外形等像素参考衍生','reference':str(original.relative_to(ROOT)),
                    'referenceSha256':digest(original),'newImageGenerated':False}
    else:
        j=jobs[s['key']];assert digest(p)==digest(j['generatedPath'])
        provenance={'type':'image_gen生成原件','generatedPath':j['generatedPath'],'inputs':j['input'],
                    'inputFingerprints':[{'path':p,'sha256':digest(ROOT/p)} for p in j['input']],
                    'promptFile':f'{SOURCE_REL}/{s["character"]}/prompts/{s["key"]}.txt','newImageGenerated':True}
    rec={**s,'png':m,'webp':n,'source':provenance,'anchors':[anc],
         'rgbaPixelsIdentical':True,'encoding':dict(format='WebP',lossless=True,method=6,exact=True),
         'colorHandling':'原始未嵌入ICC像素保留；未做色彩转换，未宣称已嵌入sRGB。交A11确认。',
         'placement':{'pivot':[512,1536],'pivotType':'大腿截幅下边中心，非脚底','coordinateBasis':'源图像素',
                      'headScaleAndPose':'同尺寸完整图替换；不是可叠加面部图层。视觉核对另记。'},
         'selectedForPackage':not s.get('comparisonOnly',False),'runtimeAdopted':False}
    records.append(rec)
    sheet=Image.new('RGB',(1536,620),'#e3e6e2');d=ImageDraw.Draw(sheet)
    for j,kind in enumerate(['white','black','day','night']):
        small=im.resize((384,576),Image.Resampling.LANCZOS);bg=background(kind,small.size);bg.alpha_composite(small)
        sheet.paste(bg.convert('RGB'),(j*384,44));d.text((j*384+12,10),kind,font=font(21),fill='#243a3c')
    sheet.save(QA/'composites'/f'{s["key"]}.jpg',quality=95)

selected=[r for r in records if r['selectedForPackage']]
integration=json.loads((ROOT/'system/sui-u/integration.json').read_text());ui=[]
for r in selected:
    im=Image.open(ROOT/r['png']['path']).convert('RGBA');bg=background('night',(1280,720))
    scale=.34;px=466;py=60;bg.alpha_composite(im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS),(px,py))
    transform=lambda box:[px+box[0]*scale,py+box[1]*scale,box[2]*scale,box[3]*scale]
    face=transform(r['face']);action=transform(r['action']) if r.get('action') else None
    masks=[integration['message']['rect'],integration['name']['rect'],integration['menuRect']]
    assert not any(intersects(face,m) for m in masks),(r['key'],'face')
    if action:assert not any(intersects(action,m) for m in masks),(r['key'],'action')
    overlay=Image.new('RGBA',bg.size);d=ImageDraw.Draw(overlay)
    for rect in masks:
        x,y,w,h=rect;d.rounded_rectangle((x,y,x+w,y+h),radius=8,fill=(13,30,36,230),outline=(110,165,157,180))
    d.text((24,20),r['label']+' · 离线遮挡示意',font=font(24),fill='#d9e7e0')
    d.text((84,520),'1280×720 静态合成；不是引擎运行截图。',font=font(28),fill='#eeeae2')
    d.text((84,567),'所示摆放仅供接入核对，六选项期间另行处理遮挡。',font=font(24),fill='#cbd7d1')
    bg.alpha_composite(overlay);bg.convert('RGB').save(QA/'ui-static'/f'{r["key"]}.jpg',quality=95)
    ui.append({'key':r['key'],'previewTransform':{'x':px,'y':py,'scale':scale},'manualFaceRectProjected':face,
               'manualActionRectProjected':action,'messageNameMenuIntersection':False,'sixChoicesOcclude':True,'runtimeTested':False})

# 清晰可读的逐人物全组及汇总预览，均为QA合成而非新制作素材。
for group in ['all','wenwen','maolang','shijiang','yelan','chensheng']:
    group_records=selected if group=='all' else [r for r in selected if r['character']==group]
    columns=5 if group=='all' else min(4,len(group_records));rows=math.ceil(len(group_records)/columns)
    width=columns*360;sheet=Image.new('RGB',(width,rows*575+60),'#e5eae5');d=ImageDraw.Draw(sheet)
    d.text((20,15),'SUI-A07 · '+('五人交付总览' if group=='all' else group),font=font(26),fill='#203b3b')
    for i,r in enumerate(group_records):
        x=(i%columns)*360;y=60+(i//columns)*575
        d.rectangle((x+6,y+2,x+354,y+568),fill='#f5f6f0');d.text((x+16,y+12),r['label'],font=font(18),fill='#24413f')
        im=Image.open(ROOT/r['png']['path']).convert('RGBA').resize((344,516),Image.Resampling.LANCZOS)
        sheet.paste(im,(x+8,y+48),im)
    sheet.save(QA/'previews'/f'{group}.jpg',quality=95)

faces=Image.new('RGB',(1500,math.ceil(len(selected)/5)*350),'#e7ebe6');fd=ImageDraw.Draw(faces)
for i,r in enumerate(selected):
    x=(i%5)*300;y=(i//5)*350;a,b,w,h=r['face']
    im=Image.open(ROOT/r['png']['path']).convert('RGBA').crop((a,b,a+w,b+h));im.thumbnail((290,300))
    faces.paste(flat(im),(x+(300-im.width)//2,y));fd.text((x+8,y+310),r['key'],font=font(16),fill='#28413d')
faces.save(QA/'previews/faces.jpg',quality=95)

requirements=json.loads((QA/'requirements-input.json').read_text());decisions=[]
for req in requirements:
    anchors=[anchor(s['path'],s['quote']) for s in req['sources']]
    links=[r['key'] for r in selected if req['id'] in r['requirementIds']]
    is_char=req['kind']=='character'
    status='本轮人物/持物参考已交付，逐镜演出另定' if links else ('用户明确延后，按文字或画外表现' if is_char else '道具连续性已登记；独立特写随A09镜头另定')
    decisions.append({'id':req['id'],'name':req['name'],'status':status,'assets':links,'constraints':req['constraints'],
                      'anchors':anchors,'separateCharacters':[{'key':k,'name':n,'appearance':'未设，本轮不制作'} for k,n in EXTRA_GROUPS.get(req['id'],[])]})
dump(QA/'requirement-decisions.json',decisions)
dump(SOURCE/'resource-records.json',{'schemaVersion':1,'task':'SUI-A07','scope':'包内资源记录，非最终采用清单','records':records})
dump(QA/'story-usage.json',{'runtimeBindingsWritten':False,'assets':[{k:r[k] for k in ['key','character','condition','exitRule','anchors','requirementIds','selectedForPackage']} for r in records]})

before=json.loads((QA/'input-before.json').read_text())['files'];pres=[];observed=[]
review_path=QA/'concurrent-input-review.json'
reviews={r['path']:r for r in json.loads(review_path.read_text())['changes']} if review_path.exists() else {}
for s in before:
    p=Path(s['path']);now=digest(p)
    if p.name=='TODO-v1.1.md':observed.append({'path':s['path'],'baselineSha256':s['sha256'],'currentSha256':now,'note':'共享进度文件；本任务只定点更新A07'})
    else:
        review=reviews.get(str(p))
        accounted=bool(review and review['baselineSha256']==s['sha256'] and review['reviewedSha256']==now)
        pres.append({'path':s['path'],'before':s['sha256'],'after':now,'unchanged':now==s['sha256'],
                     'concurrentChangeReviewed':accounted,'reviewRecord':'concurrent-input-review.json' if accounted else None})
assert all(s['unchanged'] or s['concurrentChangeReviewed'] for s in pres),'受保护输入出现未复核变更'
dump(QA/'source-preservation.json',{'protected':pres,'sharedObserved':observed,'baselineUnchanged':sum(s['unchanged'] for s in pres),
     'concurrentChangesReviewed':sum(not s['unchanged'] and s['concurrentChangeReviewed'] for s in pres)})
dump(QA/'verification.json',{'task':'SUI-A07','date':'2026-10-29','pillow':PIL.__version__,'libwebp':features.version('webp'),
     'assetPairs':len(records),'selectedAssets':len(selected),'retainedComparisonAssets':len(records)-len(selected),
     'generatedOriginals':sum(r['source']['newImageGenerated'] for r in records),'inheritedReferences':sum(not r['source']['newImageGenerated'] for r in records),
     'generationCallsIncludingRepair':len(jobs),'retainedRejectedOriginals':sum(j.get('status','').startswith('rejected') for j in jobs.values()),
     'formatDimensionsAlphaOrientationPassed':len(records),'exactRgbaEqualityPassed':len(records),
     'requirementFamilies':len(decisions),'requirementAnchorsResolved':sum(len(d['anchors']) for d in decisions),
     'assetAnchorsResolved':len(records),'protectedInputsUnchanged':sum(s['unchanged'] for s in pres),
     'concurrentInputsRevalidated':sum(not s['unchanged'] and s['concurrentChangeReviewed'] for s in pres),'uiStaticResults':ui,
     'selectedWebpBytes':sum(r['webp']['bytes'] for r in selected),'allSelectedDecodedRgbaBytes':sum(r['webp']['decodedRgbaBytes'] for r in selected),
     'memoryIsTheoreticalNotPeak':True,'visualInspection':'见 visual-review.md，脚本不判断形象或手部质量',
     'currentAssetsImported':0,'engine':'未测','browser':'未测','physicalPhone':'未测','nativeDesktop':'未测','published':False})
cards=[]
for r in records:
    rel='../../'+r['png']['path'];der='../../'+r['webp']['path']
    cards.append(f'<article><h2>{html.escape(r["label"])}</h2><img src="{rel}"><p>{html.escape(r["condition"])}</p><p><a href="{rel}">PNG</a> · <a href="{der}">无损WebP</a> · <a href="composites/{r["key"]}.jpg">四底</a></p></article>')
(QA/'index.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SUI-A07 五人资源</title><style>body{background:#e8eee9;color:#233934;font:16px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{background:#f7f8f3;border-radius:12px;padding:20px}h2{font-size:20px}img{width:100%;height:500px;object-fit:contain}a{color:#2b6c62}p{line-height:1.65}</style><h1>SUI-A07 主角与配角</h1><p>15项交付候选＋2项未选比较稿；独立文件可下载。仅包内资源与静态检查，运行采用为0。</p><main>'+''.join(cards)+'</main></html>')
print(json.dumps({'pairs':len(records),'selected':len(selected),'newGenerations':sum(r['source']['newImageGenerated'] for r in records),'requirements':len(decisions),'protectedUnchanged':sum(s['unchanged'] for s in pres),'concurrentRevalidated':sum(not s['unchanged'] and s['concurrentChangeReviewed'] for s in pres),'ui':len(ui)},ensure_ascii=False))
