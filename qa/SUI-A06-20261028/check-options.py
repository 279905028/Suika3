"""SUI-A06：无损格式衍生、离线合成及输入保护检查；不修改原画、不运行游戏。"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont, features
import PIL

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent
SRC = ROOT / 'assets/sources/20261028/SUI-A06'
FONT = ROOT / 'system/font/NotoSansCJK-Medium.ttc'
COLORS = {'white':'#ffffff', 'black':'#000000', 'day':'#e5ece6', 'night':'#182c3b'}

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def save(p, data):
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')

def xywh(box):
    return None if box is None else [box[0], box[1], box[2]-box[0], box[3]-box[1]]

def info(p):
    with Image.open(p) as im:
        im.load()
        a=im.getchannel('A'); hist=a.histogram()
        return {'path':str(p.relative_to(ROOT)), 'sha256':sha(p), 'bytes':p.stat().st_size,
                'format':im.format, 'size':list(im.size), 'mode':im.mode,
                'orientation':im.getexif().get(274,1), 'iccEmbedded':bool(im.info.get('icc_profile')),
                'colorHandling':'没有执行色彩转换；没有嵌入ICC时仅保留生成器数值',
                'alphaRange':list(a.getextrema()), 'clearPixels':hist[0], 'opaquePixels':hist[255],
                'alphaBBox':xywh(a.getbbox()),
                'alpha16BBox':xywh(a.point(lambda v:255 if v>=16 else 0).getbbox()),
                'rectBasis':'图像像素，左上原点，[x,y,width,height]',
                'rgbaDecodedBytes':im.width*im.height*4}

def label(im, text, xy=(24,18), n=25, color='#eaf0ed'):
    ImageDraw.Draw(im).text(xy,text,font=ImageFont.truetype(str(FONT),n),fill=color)

def composite(im, color, limit=None):
    view=im.copy()
    if limit: view.thumbnail(limit, Image.Resampling.LANCZOS)
    bg=Image.new('RGBA',view.size,color); bg.alpha_composite(view)
    return bg.convert('RGB')

def intersects(a,b):
    return a[0]<b[0]+b[2] and a[0]+a[2]>b[0] and a[1]<b[1]+b[3] and a[1]+a[3]>b[1]

ui=json.loads((ROOT/'system/sui-u/integration.json').read_text())
rows=[]
(QA/'previews').mkdir(exist_ok=True)
(QA/'composites').mkdir(exist_ok=True)
for form in ['orb','human']:
    for opt in ['a','b']:
        key=f'{form}-{opt}'
        p=SRC/f'option-{opt}'/f'char-huangqiuqiu-{form}-base-neutral-v001.png'
        im=Image.open(p).convert('RGBA'); w=p.with_suffix('.webp')
        if not w.exists(): im.save(w,'WEBP',lossless=True,method=6,exact=True)
        decoded=Image.open(w).convert('RGBA')
        identical=im.size==decoded.size and im.tobytes()==decoded.tobytes()
        assert identical, key
        inp=info(p); out=info(w)
        assert out['format']=='WEBP' and out['alphaRange'][0]==0 and out['clearPixels']>0
        assert out['orientation']==1
        if form=='orb': assert im.width==im.height
        else: assert im.size==(1024,1536)
        previews=[]
        for kind,color in COLORS.items():
            dest=QA/'composites'/f'{key}-{kind}.png'
            composite(im,color).save(dest)
            previews.append(str(dest.relative_to(ROOT)))
        sheet=Image.new('RGB',(1024,850),'#26363e')
        for i,(kind,color) in enumerate(COLORS.items()):
            v=composite(im,color,(476,368))
            ox=(i%2)*512; oy=(i//2)*425
            label(sheet,kind,(ox+22,oy+10),22)
            sheet.paste(v,(ox+(512-v.width)//2,oy+50))
        sheet.save(QA/'previews'/f'{key}-four-backgrounds.png')
        scale=0.30 if form=='orb' else 0.40
        x,y=(452,96) if form=='orb' else (435,64)
        critical={'face':[275,390,700,500], 'hand':[625,890,385,310]} if form=='orb' else {'face':[280,245,365,350], 'toy-and-hand':[615,315,397,685]}
        canvas=Image.new('RGBA',(1280,720),'#253b43')
        scaled=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        canvas.alpha_composite(scaled,(x,y))
        for fname,xy in [('message.png',(48,490)),('name.png',(76,442)),('menu-idle.png',(1104,24))]:
            f=ROOT/'system/sui-u/png'/fname
            if f.exists(): canvas.alpha_composite(Image.open(f).convert('RGBA'),xy)
        dr=ImageDraw.Draw(canvas)
        if not (ROOT/'system/sui-u/png/name.png').exists():dr.rounded_rectangle((76,442,316,490),12,fill='#14232b')
        label(canvas,'黄球球',(94,450),26)
        label(canvas,f'{form.upper()} · Option {opt.upper()}  /  离线摆放预览',(86,516),28)
        label(canvas,'此图仅核对摆放与遮挡，不代表引擎验收。',(86,567),26)
        canvas.convert('RGB').save(QA/'previews'/f'{key}-ui.png')
        critical_canvas={k:[round(x+a*scale),round(y+b*scale),round(c*scale),round(d*scale)] for k,(a,b,c,d) in critical.items()}
        hits={k:[mask for mask,r in {'message':ui['message']['rect'],'name':ui['name']['rect'],'menu':ui['menuRect']}.items() if intersects(rect,r)] for k,rect in critical_canvas.items()}
        assert not any(hits.values()), (key,hits)
        row={'key':key,'form':form,'option':opt.upper(),'status':'awaiting_user_selection','source':inp,'derivative':out,
             'encoding':{'tool':'Pillow','version':PIL.__version__,'libwebp':features.version('webp'),'lossless':True,'method':6,'exact':True,'resize':False,'crop':False},
             'checks':{'decodedRgbaEqual':identical,'actualAlpha':True,'metadata':'pass','composites':'generated; visual review recorded separately','uiCriticalOverlap':hits,'engine':'not_run','browser':'not_run','physicalPhone':'not_run','desktop':'not_run','deployment':'not_run'},
             'placement':{'previewOnly':True,'pivot':[im.width/2,im.height],'pivotMeaning':'球形画布底中心，非人体脚底' if form=='orb' else '腰部截幅底中心，非脚底','criticalSourceRects':critical,'previewScale':scale,'previewXY':[x,y],'criticalCanvasRects':critical_canvas},
             'previewFiles':previews,'approval':{'selected':False,'adoptedInSuika3':False}}
        rows.append(row)
    # A/B独立文件不变；比较页仅供审阅。
    board=Image.new('RGB',(1280,1060 if form=='human' else 800),'#1c303a')
    for i,opt in enumerate(['a','b']):
        im=Image.open(SRC/f'option-{opt}'/f'char-huangqiuqiu-{form}-base-neutral-v001.png').convert('RGBA')
        v=composite(im,'#e6e8e3',(565,870 if form=='human' else 565))
        ox=i*640
        label(board,f'Option {opt.upper()}',(ox+38,26),34)
        caption=('细节与光泽更清晰' if opt=='a' else '笔触与反光更柔和')
        label(board,caption,(ox+38,78),24)
        board.paste(v,(ox+(640-v.width)//2,135))
    label(board,'人形｜保留照片特征 · 腰部截幅' if form=='human' else '球形｜保留圆球、深眉、圆眼、红嘴与托腮手',(38,board.height-48),24)
    board.save(QA/'previews'/f'{form}-options-ab.png')

before=json.loads((QA/'input-before.json').read_text())
preserved=[]
for row in before['files']:
    p=Path(row['path']); preserved.append({'path':str(p),'expected':row['sha256'],'current':sha(p),'unchanged':sha(p)==row['sha256']})
for row in before['historicalFiles']:
    p=Path(row['source']); copy=ROOT/row['copy']
    preserved.append({'path':str(p),'copy':row['copy'],'expected':row['sha256'],'current':sha(p),'unchanged':sha(p)==row['sha256'],'copyIdentical':sha(copy)==row['sha256']})
save(QA/'source-preservation.json',{'allUnchanged':all(x['unchanged'] and x.get('copyIdentical',True) for x in preserved),'files':preserved})
save(QA/'option-checks.json',{'scope':'四张基础方案，离线资源检查，不是运行验收','files':rows,'totalPairs':len(rows),'allRgbaEqual':all(r['checks']['decodedRgbaEqual'] for r in rows),'allUiCriticalRectsClear':all(not any(r['checks']['uiCriticalOverlap'].values()) for r in rows)})
print(json.dumps({'pairs':len(rows),'allRgbaEqual':True,'inputFiles':len(preserved),'sourcesUnchanged':all(x['unchanged'] for x in preserved),'previewDirectory':str(QA/'previews')},ensure_ascii=False))
