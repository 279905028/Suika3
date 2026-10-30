"""SUI-A03 包内格式、来源锚点及静态合成检查；不运行游戏。"""
from pathlib import Path
import hashlib
import json
import shutil
import html
import re
from PIL import Image, ImageDraw, ImageFont, features
import PIL

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent
SOURCE = ROOT / 'assets/sources/20261028/SUI-A03'
STORY = 'scenario/周栀-十一点四十七分.md'
FONT = str(ROOT / 'system/font/NotoSansCJK-Medium.ttc')

def digest(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def save_json(p, data):
    Path(p).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def rect(bbox):
    if bbox is None:
        return None
    x, y, r, b = bbox
    return [x, y, r-x, b-y]

def font(n):
    return ImageFont.truetype(FONT, n)

def metadata(p):
    with Image.open(p) as im:
        im.load()
        a = im.convert('RGBA').getchannel('A')
        hist = a.histogram()
        return {
            'format': im.format, 'width': im.width, 'height': im.height,
            'mode': im.mode, 'bytes': p.stat().st_size, 'sha256': digest(p),
            'orientation': im.getexif().get(274, 1),
            'colorSpace': '未嵌入ICC；未执行色彩转换',
            'iccProfileEmbedded': bool(im.info.get('icc_profile')),
            'alpha': {'present': 'A' in im.getbands(), 'range': list(a.getextrema()),
                      'bbox': rect(a.getbbox()), 'transparentPixels': hist[0],
                      'bboxAtAlpha16': rect(a.point(lambda x: 255 if x >= 16 else 0).getbbox()),
                      'coordinateBasis': '源图像素；左上原点；[x,y,width,height]'},
            'rgbaDecodedBytes': im.width * im.height * 4,
        }

def anchor(quote, path=STORY):
    p = ROOT/path
    lines = p.read_text().splitlines()
    matches = [(i, s) for i, s in enumerate(lines) if quote in s]
    assert len(matches) == 1, (path, quote, len(matches))
    i, s = matches[0]
    headings = [t for t in lines[:i+1] if t.startswith('## ')]
    nodes = [t for t in lines[:i+1] if t.startswith('<!-- NODE ')]
    return {'path': path, 'line': i+1, 'quote': quote, 'heading': headings[-1] if headings else None,
            'nearestDeclaredNode': nodes[-1] if nodes else None, 'sha256': digest(p)}

specs = [
    {'key':'base', 'label':'B 基础', 'file':'option-b/char-zhouzhi-human-base-neutral-v001.png',
     'outfit':'青衬衫 / 深色长裤 / 披发', 'variant':'neutral',
     'condition':'所选当前路线正文允许的普通交谈；不表示已确立恋爱',
     'quote':'她今天本来就没上班。', 'requirements':['char-zhouzhi'], 'approval':'user_selected_base'},
    {'key':'smile', 'label':'私人 · 自然笑', 'file':'variants/char-zhouzhi-human-base-smile-v001.png',
     'outfit':'青衬衫 / 深色长裤 / 披发', 'variant':'smile',
     'condition':'第三章自发笑意或适用私人相处；不得把笑容本身编码成恋爱状态',
     'quote':'她笑得直往沙发里陷。', 'requirements':['char-zhouzhi']},
    {'key':'serious', 'label':'私人 · 认真', 'file':'variants/char-zhouzhi-human-base-serious-v001.png',
     'outfit':'青衬衫 / 深色长裤 / 披发', 'variant':'serious',
     'condition':'第24天撤单后的边界交谈等；工作裙装场景改用work-serious',
     'quote':'你这张单子不是问。', 'requirements':['char-zhouzhi']},
    {'key':'downcast', 'label':'私人 · 低落', 'file':'variants/char-zhouzhi-human-base-downcast-v001.png',
     'outfit':'青衬衫 / 深色长裤 / 披发', 'variant':'downcast',
     'condition':'第60天非AA组合的离别；AB/BA/BB表情可共用，动作和对白按各支分别处理',
     'quote':'今天不答应了。', 'requirements':['char-zhouzhi']},
    {'key':'tied-tired-cup', 'label':'第36天 · 扎发持杯', 'file':'variants/char-zhouzhi-human-casual-tied-tired-cup-v001.png',
     'outfit':'青衬衫 / 深色长裤 / 松扎长发', 'variant':'tired-cup',
     'condition':'仅第36天超市拿起蓝沿白杯的当拍；进入同节街边吃洋芋前退出；不能默认读成已买杯后的饮水动作',
     'quote':'她拿起蓝沿白杯，问不好看吗。',
     'requirements':['char-zhouzhi','prop-zhouzhi-blue-rim-cup','prop-zhouzhi-personal-box'],
     'actionRect':[290,590,420,300]},
    {'key':'planning', 'label':'第45天 · 采购单', 'file':'variants/char-zhouzhi-human-base-planning-v001.png',
     'outfit':'青衬衫 / 深色长裤 / 披发', 'variant':'planning',
     'condition':'第45天在网吧讨论采购单；接电话时退出持纸动作；未制作可读正面、金额或采购数量',
     'quote':'第45天，她拿着一张采购单来网吧。',
     'requirements':['char-zhouzhi','prop-zhouzhi-planning'], 'actionRect':[100,600,620,430]},
    {'key':'work-neutral', 'label':'工作 · 裙装', 'file':'variants/char-zhouzhi-human-work-skirt-neutral-v001.png',
     'outfit':'青衬衫 / 素深色半裙 / 披发', 'variant':'neutral',
     'condition':'第46天另接短班；朴素裙装为本批视觉设计，不新增正文服装色款设定；职业礼貌不是恋人承诺',
     'quote':'她换了裙子，头发重新弄过，耳饰是306里找回来的那只。',
     'requirements':['char-zhouzhi','prop-zhouzhi-personal-box']},
    {'key':'work-serious', 'label':'工作 · 说清边界', 'file':'variants/char-zhouzhi-human-work-skirt-serious-v001.png',
     'outfit':'青衬衫 / 同版深色半裙 / 披发', 'variant':'serious',
     'condition':'第46天接班解释，回声停业不表示职业停止；由work-neutral单独派生',
     'quote':'我没跟你保证过不做了。', 'requirements':['char-zhouzhi']},
    {'key':'prep-apron', 'label':'备菜 · 围裙', 'file':'variants/char-zhouzhi-human-prep-apron-neutral-v001.png',
     'outfit':'青衬衫 / 深色长裤 / 深色腰围裙 / 松扎长发', 'variant':'neutral',
     'condition':'第75天摊前当面见面，仅ZZ06-01=A & ZZ08-01=A；摘下围裙后切回无围裙图；其他分支不得用此图制造当面团聚',
     'quote':'周栀应了一声，替最后一桌收完东西，摘下围裙。', 'requirements':['char-zhouzhi']},
]

for job in json.loads((QA/'generation-log.json').read_text())['jobs']:
    if job.get('generatedPath'):
        dst = SOURCE/'variants'/job['file']
        if not dst.exists():
            shutil.copyfile(job['generatedPath'], dst)
        assert digest(dst) == digest(job['generatedPath'])

composite_dir = QA/'composites'
ui_dir = QA/'ui-static'
composite_dir.mkdir(exist_ok=True)
ui_dir.mkdir(exist_ok=True)
template = json.loads((ROOT/'qa/SUI-A01-20261028/resource-record.template.json').read_text())
integration = json.loads((ROOT/'system/sui-u/integration.json').read_text())
gen = {x['key']:x for x in json.loads((QA/'generation-log.json').read_text())['jobs'] if x['status']=='generated'}

def background(kind, size):
    if kind in ['white','black']:
        return Image.new('RGBA',size,'white' if kind=='white' else 'black')
    a,b = ((227,233,227),(181,198,192)) if kind=='day' else ((31,47,55),(13,23,29))
    im = Image.new('RGBA',size)
    d = ImageDraw.Draw(im)
    for y in range(size[1]):
        t=y/max(size[1]-1,1)
        c=tuple(round(x*(1-t)+z*t) for x,z in zip(a,b))+(255,)
        d.line((0,y,size[0],y),fill=c)
    return im

records=[]
all_specs = specs + [{'key':'option-a','label':'A 比较留存（未选）','file':'option-a/char-zhouzhi-human-base-neutral-v001.png','variant':'neutral','outfit':'原质感比较','condition':'未选用；不进入待采用集合','requirements':['char-zhouzhi'],'quote':'她今天本来就没上班。','approval':'unselected_option'}]
for s in all_specs:
    p=SOURCE/s['file']; im=Image.open(p).convert('RGBA')
    assert im.size==(1024,1536), s['key']
    out=p.with_suffix('.webp')
    if not out.exists():
        im.save(out,format='WEBP',lossless=True,method=6,exact=True)
    wi=Image.open(out).convert('RGBA')
    assert im.tobytes()==wi.tobytes(),s['key']
    sm,wm=metadata(p),metadata(out)
    assert sm['alpha']['range'][0]==0 and sm['alpha']['transparentPixels']>0
    assert sm['orientation']==1 and wm['orientation']==1
    a=anchor(s['quote'])
    r=json.loads(json.dumps(template))
    r.update({'assetId':'char-zhouzhi-human-'+('option-a-base' if s['key']=='option-a' else s['key']),
              'kind':'character','ownerTask':'SUI-A03','characterOrSceneKey':'zhouzhi','form':'human',
              'variant':s['variant'],'version':'v001','status':'比较留存（未选）' if s['key']=='option-a' else '制作完成；待A11/I',
              'requirementKeys':s['requirements'],'storyAnchors':[a],
              'sources':[{'path':'assets/sources/20261028/SUI-A03/references/zhouzhi-face-v2-base-reference.webp','sha256':digest(SOURCE/'references/zhouzhi-face-v2-base-reference.webp')},
                         {'path':'assets/sources/20261028/SUI-A03/option-b/char-zhouzhi-human-base-neutral-v001.png','sha256':digest(SOURCE/'option-b/char-zhouzhi-human-base-neutral-v001.png')}],
              'sourceFile':str(p.relative_to(ROOT)), 'derivativeFile':str(out.relative_to(ROOT)),
              'sha256Source':sm['sha256'],'sha256Derivative':wm['sha256'],
              'format':wm['format'],'width':wm['width'],'height':wm['height'],'bytes':wm['bytes'],
              'orientation':wm['orientation'],'colorSpace':wm['colorSpace'],'alpha':wm['alpha'],
              'sourceMetadata':sm,
              'encoding':{'tool':'Pillow/libwebp','version':PIL.__version__+'/'+features.version('webp'),'lossless':True,'method':6,'exact':True,'quality':None},
              'promptOrProcessRecord':'qa/SUI-A03-20261028/'+('prompts.json' if s['key'] in ['base','option-a'] else 'generation-log.json'),
              'wardrobe':s['outfit'], 'label':s['label'], 'packageKey':s['key'],
              'placement':{'coordinateBasis':'源图像素；左上原点；[x,y,width,height]',
                           'pivot':[512,1536],'pivotMeaning':'大腿截幅底部中心；不是脚底；不是NovelML ch参数',
                           'criticalRect':[340,115,350,310],'criticalRectMethod':'制作人员手动包围脸部；见脸部校验图',
                           'actionRect':s.get('actionRect'), 'cropRect':[0,0,1024,1536],
                           'uiMaskReference':'system/sui-u/integration.json',
                           'previewPlacement':{'canvas':[1280,720],'x':435,'y':64,'scale':0.4,'frozenForRuntime':False}},
              'binding':{'routeIds':['zhouzhi'],'sceneNodeIds':[], 'condition':s['condition'],
                         'enter':'由SUI-E/I按storyAnchors和逐拍演出映射；本记录不自动绑定',
                         'exitAndRestore':'道具/衣装场景结束即退出；CG进出、回退和读档由E/I/Q恢复相应快照；A03未执行运行绑定'},
              'approval':{'appearanceEvidence':['docs/人物/周栀.md 已确认face-v2、深色长发、青衬衫'],
                          'imageEvidence':['qa/SUI-A03-20261028/approval.json'] if s['key']!='option-a' else [],
                          'baseApproval':s.get('approval','approved_base_derivative_author_review'),
                          'currentProjectAdopted':False,'adoptionEvidence':None},
              'checks':{'metadata':'通过','decodedPixels':'PNG/WebP全部RGBA逐字节一致','compositeWhiteBlackDayNight':'本批人工回看通过；见visual-review.md',
                        'engine':'未测','browser':'未测','physicalPhone':'未测','desktop':'未测','deployment':'未执行'},
              'pending':['A11格式复核与待采用交接','SUI-I正式资源绑定','SUI-Q引擎/网页/真机/桌面验收'],
              'supersedes':None,
              'rgbaDecodedBytes':wm['rgbaDecodedBytes'],
              'sizeReviewFlags':{'over2MiB':wm['bytes']>2*1024*1024,'longEdgeOver2048':max(wm['width'],wm['height'])>2048}})
    if s['key'] in ['base','option-a']:
        r['sources'] = r['sources'][:1]
    if s['key']=='work-serious':
        r['sources'].append({'path':gen['work-serious']['reference'].removeprefix(str(ROOT)+'/'),'sha256':digest(ROOT/gen['work-serious']['reference'])})
    board=Image.new('RGB',(1440,600),'#ebece8');d=ImageDraw.Draw(board)
    sample=wi.resize((352,528),Image.Resampling.LANCZOS)
    for i,kind in enumerate(['white','black','day','night']):
        bg=background(kind,sample.size);bg.alpha_composite(sample)
        board.paste(bg.convert('RGB'),(i*360+4,60))
        d.text((i*360+12,12),s['label']+' / '+{'white':'白','black':'黑','day':'诊断昼','night':'诊断夜'}[kind],font=font(18),fill='#213a39')
    board.save(composite_dir/(s['key']+'.png'))
    records.append(r)

adoptable=[r for r in records if r['packageKey']!='option-a']
save_json(SOURCE/'resource-records.json',{'schemaVersion':'SUI-A03-package-1','task':'SUI-A03','scope':'本包记录；不是最终采用清单','selectedOption':'B','records':records})
save_json(QA/'story-usage.json',{'task':'SUI-A03','runtimeBindingsWritten':False,'specs':[{**s,'anchors':[anchor(s['quote'])]} for s in specs]})

overview=Image.new('RGB',(1800,2070),'#ebe8e2');d=ImageDraw.Draw(overview)
d.text((32,15),'周栀 · B基础与8张必要差分',font=font(28),fill='#213b3b')
faces=Image.new('RGB',(1260,1320),'#eae7e1');fd=ImageDraw.Draw(faces)
for i,r in enumerate(adoptable):
    im=Image.open(ROOT/r['sourceFile']).convert('RGBA')
    x=(i%3)*600;y=70+(i//3)*660
    d.rounded_rectangle((x+12,y,x+588,y+644),radius=14,fill='#f8f7f3')
    d.text((x+32,y+12),r['label'],font=font(24),fill='#26413f')
    sample=im.resize((392,588),Image.Resampling.LANCZOS)
    overview.paste(sample,(x+104,y+48),sample)
    x2=(i%3)*420;y2=(i//3)*440
    crop=im.crop((310,80,730,500))
    bg=Image.new('RGBA',crop.size,'#f4f3ee');bg.alpha_composite(crop)
    faces.paste(bg.convert('RGB'),(x2,y2))
    fd.rectangle((x2,y2+403,x2+420,y2+439),fill='#eae7e1')
    fd.text((x2+15,y2+407),r['label'],font=font(18),fill='#26413f')
overview.save(QA/'character-overview.png')
faces.save(QA/'faces-contact.png')

hands=Image.new('RGB',(1920,640),'#f5f3ef');hd=ImageDraw.Draw(hands)
for i,key in enumerate(['tied-tired-cup','planning','work-neutral','prep-apron']):
    r=next(r for r in records if r['packageKey']==key)
    im=Image.open(ROOT/r['sourceFile']).convert('RGBA')
    crop=im.crop((80,560,960,1450));crop.thumbnail((460,560),Image.Resampling.LANCZOS)
    hands.paste(crop,(i*480+(480-crop.width)//2,60),crop)
    hd.text((i*480+12,14),r['label']+' · 手部/道具',font=font(20),fill='#23413e')
hands.save(QA/'hands-props-contact.png')

def intersects(a,b):
    return a[0]<b[0]+b[2] and b[0]<a[0]+a[2] and a[1]<b[1]+b[3] and b[1]<a[1]+a[3]

ui_results=[]
for r in adoptable:
    bg=background('night',(1280,720))
    im=Image.open(ROOT/r['derivativeFile']).convert('RGBA').resize((410,614),Image.Resampling.LANCZOS)
    bg.alpha_composite(im,(435,64))
    # x/y分别平移；宽高只缩放。关键区为手动测量，不能当作自动人脸识别。
    face=[571,110,140,124]
    action=r['placement']['actionRect']
    projected_action=[435+action[0]*0.4,64+action[1]*0.4,action[2]*0.4,action[3]*0.4] if action else None
    actual_masks=[integration['message']['rect'],integration['name']['rect'],integration['menuRect']]
    assert not any(intersects(face,m) for m in actual_masks)
    if projected_action:
        assert not any(intersects(projected_action,m) for m in actual_masks),r['packageKey']
    overlay=Image.new('RGBA',bg.size,(0,0,0,0));od=ImageDraw.Draw(overlay)
    for k in ['message','name']:
        x,y,w,h=integration[k]['rect'];od.rounded_rectangle((x,y,x+w,y+h),radius=8,fill=(13,29,34,229),outline=(100,154,149,180),width=1)
    x,y,w,h=integration['menuRect'];od.rounded_rectangle((x,y,x+w,y+h),radius=8,fill=(19,43,46,220))
    od.text((110,450),'周栀',font=font(25),fill='#f1eee5')
    od.text((84,520),'静态遮挡检查；此图不代表引擎运行验收。',font=font(26),fill='#f1eee5')
    od.text((24,20),r['label']+' / 1280×720 / 诊断夜色底',font=font(18),fill='#c8ddd7')
    bg.alpha_composite(overlay);bg.convert('RGB').save(ui_dir/(r['packageKey']+'.png'))
    ui_results.append({'key':r['packageKey'],'faceRect':face,'faceRectMethod':'人工选区投影','actionRect':projected_action,'readingMasksIntersection':False,'sixChoicesOccludeCharacter':True,'runtimeTested':False})

# 六选项会遮挡立绘；显式展示，不把这种状态误报为关键动作可见。
choice=background('night',(1280,720));im=Image.open(SOURCE/'option-b/char-zhouzhi-human-base-neutral-v001.webp').convert('RGBA').resize((410,614),Image.Resampling.LANCZOS);choice.alpha_composite(im,(435,64))
cd=ImageDraw.Draw(choice)
for i in range(6):
    x=integration['choice']['x'];y=integration['choice']['firstY']+i*integration['choice']['stepY'];w=integration['choice']['width'];h=integration['choice']['height']
    cd.rounded_rectangle((x,y,x+w,y+h),radius=8,fill=(17,36,41,240),outline=(117,160,153,255))
    cd.text((x+26,y+20),'选项遮挡示意 '+str(i+1)+'（诊断标签）',font=font(25),fill='#e9eee7')
choice.convert('RGB').save(ui_dir/'six-choices-occlusion.png')

before=json.loads((QA/'input-before.json').read_text())
changes=[]
for entry in before['files']:
    p=Path(entry['path'])
    if digest(p)!=entry['sha256']:
        changes.append({'path':str(p),'before':entry['sha256'],'after':digest(p)})
save_json(QA/'asset-check.json',{
    'task':'SUI-A03','pillow':PIL.__version__,'libwebp':features.version('webp'),
    'generatedImageCount':len(records),'selectedSetCount':len(adoptable),'comparisonOnlyCount':1,
    'pngCount':len(records),'webpCount':len(records),'rgbaEqualityPassCount':len(records),
    'alphaAndOrientationPassCount':len(records),'storyAnchorResolutionPassCount':len(records),
    'webpBytesAll':sum(r['bytes'] for r in records),'webpBytesSelectedSet':sum(r['bytes'] for r in adoptable),
    'rgbaBytesSelectedSetIfAllDecodedSimultaneously':sum(r['rgbaDecodedBytes'] for r in adoptable),
    'theoreticalDecodedBytesAreNotPeakMemory':True,
    'uiStaticResults':ui_results,'changedInputFiles':changes,
    'actualVisualReview':'另见visual-review.md；本脚本不作视觉质量和身份自动判定',
    'icc':'工具输出未嵌入ICC；本轮保留原像素，不声称嵌入sRGB配置；交A11显式确认',
    'engine':'未运行','browser':'未运行','physicalPhone':'未测','desktopRuntime':'未测','published':False,
    'currentAssetsImported':0,
})
print(json.dumps({'selectedSet':len(adoptable),'retainedOptionA':1,'rgbaExactPass':len(records),'staticReadingMasksPass':len(ui_results),'changedInputs':len(changes),'webpMiBSelectedSet':round(sum(r['bytes'] for r in adoptable)/1048576,2)},ensure_ascii=False))
