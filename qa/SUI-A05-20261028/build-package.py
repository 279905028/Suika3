#!/usr/bin/env python3
"""SUI-A05 包内编码、透明合成与交接检查；不修改正文或运行资源。"""
import hashlib
import html
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, features

QA = Path(__file__).resolve().parent
ROOT = QA.parent.parent
SOURCE = ROOT / 'assets/sources/20261028/SUI-A05'
PREVIEW = QA / 'previews'
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'
TONES = {'white': (255, 255, 255, 255), 'black': (0, 0, 0, 255),
         'day': (221, 230, 225, 255), 'night': (21, 34, 41, 255)}


def read(p):
    return json.loads(Path(p).read_text())


def write(p, obj):
    Path(p).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def rel(p):
    return str(Path(p).relative_to(ROOT))


def rect(box):
    return [box[0], box[1], box[2]-box[0], box[3]-box[1]] if box else None


def info(p):
    with Image.open(p) as im:
        im.load()
        alpha = im.convert('RGBA').getchannel('A')
        histogram = alpha.histogram()
        return {'path': rel(p), 'sha256': sha(p), 'bytes': p.stat().st_size,
                'format': im.format, 'mode': im.mode, 'size': list(im.size),
                'orientation': im.getexif().get(274, 1),
                'iccProfilePresent': bool(im.info.get('icc_profile')),
                'colorHandling': '保留解码色值；无ICC时如实记为untagged，未擅自改色',
                'alpha': {'present': 'A' in im.getbands(), 'range': list(alpha.getextrema()),
                          'bbox': rect(alpha.getbbox()),
                          'bboxAbove127': rect(alpha.point(lambda v: 255 if v > 127 else 0).getbbox()),
                          'transparentPixels': histogram[0], 'partialPixels': sum(histogram[1:255]),
                          'opaquePixels': histogram[255]},
                'rgbaDecodedBytes': im.width*im.height*4}


def compare(a, b):
    im1 = Image.open(a).convert('RGBA')
    im2 = Image.open(b).convert('RGBA')
    if im1.size != im2.size:
        return {'passed': False, 'dimensionsEqual': False}
    channels = ImageChops.difference(im1, im2).split()
    counts = [sum(c.histogram()[1:]) for c in channels]
    return {'passed': not any(counts), 'dimensionsEqual': True,
            'differentPixelsByRGBAChannel': counts, 'exactRGBAEqual': not any(counts)}


def composite(im, color):
    canvas = Image.new('RGBA', im.size, color)
    canvas.alpha_composite(im)
    return canvas


def intersects(a, b):
    return (a[0] < b[0]+b[2] and b[0] < a[0]+a[2]
            and a[1] < b[1]+b[3] and b[1] < a[1]+a[3])


def ui_preview(im, spec, target):
    canvas = Image.open(ROOT/'system/sui-u/png/reading-backdrop.png').convert('RGBA')
    sprite = im.copy()
    sprite.thumbnail((448, 608), Image.Resampling.LANCZOS)
    xy = ((1280-sprite.width)//2, 36)
    canvas.alpha_composite(sprite, xy)
    for name, pos in [('message', (48, 490)), ('name', (76, 442)), ('menu-idle', (1104, 24))]:
        canvas.alpha_composite(Image.open(ROOT/f'system/sui-u/png/{name}.png').convert('RGBA'), pos)
    draw = ImageDraw.Draw(canvas)
    draw.text((100, 452), '飘', font=ImageFont.truetype(FONT, 26), fill='#efece5')
    draw.text((84, 516), '离线构图检查：' + spec['label'], font=ImageFont.truetype(FONT, 26), fill='#efece5')
    draw.text((84, 566), '色底与界面合成预览；非引擎运行截图。', font=ImageFont.truetype(FONT, 23), fill='#a7c9bd')
    canvas.convert('RGB').save(target)
    scale = sprite.height/im.height
    regions = []
    for name, box in spec.get('criticalRects', {}).items():
        transformed = [round(box[0]*scale+xy[0], 2), round(box[1]*scale+xy[1], 2),
                       round(box[2]*scale, 2), round(box[3]*scale, 2)]
        regions.append({'name': name, 'sourceRect': box, 'screenRect': transformed,
                        'overlapsMessage': intersects(transformed, [48, 490, 1184, 206]),
                        'overlapsName': intersects(transformed, [76, 442, 240, 48]),
                        'overlapsMenu': intersects(transformed, [1104, 24, 128, 56])})
    return {'preview': rel(target), 'scale': scale, 'spriteRect': [*xy, *sprite.size],
            'criticalRegions': regions, 'coordinateStatus': '仅1280×720离线建议；非NovelML绑定',
            'choiceMenuTested': False}


def sheet(entries, name, cols=5, cell=(300, 500), tone='day'):
    board = Image.new('RGB', (cols*cell[0], ((len(entries)+cols-1)//cols)*cell[1]), '#e7ebe8')
    draw = ImageDraw.Draw(board)
    font = ImageFont.truetype(FONT, 19)
    for i, (p, label) in enumerate(entries):
        x, y = (i%cols)*cell[0], (i//cols)*cell[1]
        im = Image.open(p).convert('RGBA')
        im.thumbnail((cell[0]-24, cell[1]-62), Image.Resampling.LANCZOS)
        tile = composite(im, TONES[tone]).convert('RGB')
        board.paste(tile, (x+(cell[0]-im.width)//2, y+10))
        draw.text((x+12, y+cell[1]-42), label, font=font, fill='#1d3436')
    board.save(PREVIEW/name)


def build():
    specs = read(QA/'asset-specs.json')
    PREVIEW.mkdir(exist_ok=True)
    records, checks = [], []
    for spec in specs:
        path = ROOT/spec['file']
        if not path.exists():
            raise FileNotFoundError(path)
        original = Image.open(path).convert('RGBA')
        webp = path.with_suffix('.webp')
        original.save(webp, format='WEBP', lossless=True, method=6, exact=True)
        equality = compare(path, webp)
        source_info, out_info = info(path), info(webp)
        previews = {}
        for tone, color in TONES.items():
            preview = composite(original, color)
            preview.thumbnail((512, 768), Image.Resampling.LANCZOS)
            dest = PREVIEW/f"{spec['id']}-{tone}.png"
            preview.convert('RGB').save(dest)
            previews[tone] = rel(dest)
        placement = None
        if spec['kind'] == 'character':
            placement = ui_preview(original, spec, PREVIEW/f"{spec['id']}-ui.png")
        record = {**spec, 'ownerTask': 'SUI-A05', 'sourceMetadata': source_info,
                  'derivativeMetadata': out_info, 'pixelComparison': equality,
                  'encoding': {'tool': 'Pillow', 'version': Image.__version__, 'codec': 'libwebp',
                               'codecVersion': features.version('webp'), 'lossless': True,
                               'method': 6, 'exact': True, 'resized': False, 'colorConversion': 'none'},
                  'coordinateBasis': '源像素、左上原点、[x,y,width,height]；原图不裁透明边',
                  'cropRect': [0, 0, *original.size], 'pivot': [original.width/2, original.height],
                  'pivotMeaning': '截幅下边中心，非脚底、非运行坐标' if spec['kind']=='character' else '道具画布下边中心，非手持绑定点',
                  'previews': previews, 'offlineUI': placement,
                  'runtimeBound': False, 'adoptedInSuika3': False}
        records.append(record)
        def check(name, passed, detail=None):
            checks.append({'id': spec['id']+':'+name, 'passed': bool(passed), 'detail': detail})
        check('true-formats', source_info['format']=='PNG' and out_info['format']=='WEBP')
        check('real-alpha', source_info['alpha']['present'] and source_info['alpha']['transparentPixels']>0)
        check('lossless-rgba', equality['passed'], equality)
        check('orientation', source_info['orientation']==1 and out_info['orientation']==1)
        check('prompt-exists', (ROOT/spec['prompt']).is_file())
        for anchor in spec.get('anchors', []):
            text = (ROOT/anchor['path']).read_text()
            check('anchor-'+str(anchor['line']), anchor['quote'] in text, anchor)
        if placement:
            check('face-and-action-clear-of-ui', all(not any(r[k] for k in ['overlapsMessage','overlapsName','overlapsMenu']) for r in placement['criticalRegions']), placement['criticalRegions'])
    write(QA/'resource-records.json', records)
    write(QA/'verification.json', {'task':'SUI-A05', 'date':'2026-10-29', 'batch':'20261028', 'assetCount':len(records),
                                 'passed':all(x['passed'] for x in checks),
                                 'passCount':sum(x['passed'] for x in checks), 'checkCount':len(checks),
                                 'checks':checks, 'scope':'包内格式/像素/锚点及离线矩形；视觉判断另记，未运行引擎'})
    write(QA/'pixel-comparison.json', [{'id':r['id'], **r['pixelComparison']} for r in records])
    candidates = [{'id':r['id'], 'png':r['file'], 'webp':r['derivativeMetadata']['path'],
                   'status':r['approvalStatus'], 'requirements':r['requirements'], 'usage':r['usage'],
                   'runtimeBound':False, 'adoptedInSuika3':False} for r in records if r['group']!='option-a']
    write(QA/'package-candidates.json', {'owner':'SUI-A05', 'finalAdoptionList':False, 'items':candidates})
    chars = [(ROOT/r['file'], r['label']) for r in records if r['kind']=='character' and r['group']!='option-a']
    props = [(ROOT/r['file'], r['label']) for r in records if r['kind']=='prop']
    opts = [(ROOT/r['file'], r['label']) for r in records if r['id'] in ['piao-option-a','piao-base']]
    sheet(chars, 'piao-selected-b-sheet.png')
    sheet(props, 'piao-props-sheet.png', cols=3, cell=(420, 480))
    sheet(opts, 'piao-options-a-b.png', cols=2, cell=(512, 840))
    for tone in TONES:
        sheet([(ROOT/r['file'], r['label']) for r in records], f'edge-review-{tone}.png', cols=5, tone=tone)
    for kind, region in [('faces', (300, 140, 700, 500)), ('hands', (120, 400, 920, 1100))]:
        entries=[]
        for r in records:
            if r['kind']!='character' or r['group']=='option-a':
                continue
            p=PREVIEW/f"{r['id']}-{kind}-detail.png"
            im=Image.open(ROOT/r['file']).convert('RGBA').crop(region)
            composite(im, TONES['night']).convert('RGB').save(p)
            entries.append((p,r['label']))
        sheet(entries, f'piao-{kind}-detail-sheet.png', cols=5, cell=(360,440))
    make_gallery(records)
    print(json.dumps({'assets':len(records), 'checks':len(checks), 'passed':all(x['passed'] for x in checks)}, ensure_ascii=False))


def make_gallery(records):
    def link(p):
        import os
        return html.escape(os.path.relpath(ROOT/p, QA))
    cards=[]
    for r in records:
        cards.append(f'''<article data-group="{r['group']}"><a class="picture" href="{link(r['file'])}" target="_blank"><img loading="lazy" src="{link(r['file'])}" alt="{html.escape(r['label'])}"></a><h3>{html.escape(r['label'])}</h3><p>{html.escape(r['usage'])}</p><nav><a href="{link(r['file'])}">PNG原件</a><a href="{link(r['derivativeMetadata']['path'])}">无损WebP</a></nav></article>''')
    body='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SUI-A05 · 飘</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f0f2ee;color:#213638;font:16px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1340px;margin:auto;padding:40px 28px}h1{font-size:40px;line-height:1.2;margin:10px 0 20px}h2{font-size:24px}p{margin:10px 0}.kicker{letter-spacing:.12em;color:#577370;font-size:13px}header{border-bottom:1px solid #becbc5;padding-bottom:24px}.toolbar{position:sticky;top:0;padding:14px 0;background:#f0f2eef2;z-index:2;display:flex;flex-wrap:wrap;gap:8px}button{padding:8px 14px;border:1px solid #bccbc3;background:white;border-radius:4px;font:inherit;cursor:pointer}button.active{background:#284b47;color:white}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}article{background:white;border:1px solid #d4ded8;padding:12px}article h3{margin:14px 0 8px}article p{font-size:14px;min-height:68px;color:#4d6261}.picture{display:flex;height:430px;background:var(--art-bg,#dde6e1);align-items:center;justify-content:center}.picture img{max-width:100%;max-height:100%;object-fit:contain}nav{display:flex;gap:18px}a{color:#26625c;text-underline-offset:4px}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:24px 0}.comparison img{width:100%;display:block}.note{border-left:3px solid #53867d;padding-left:16px}.meta{font-size:14px;color:#526661}.hidden{display:none}@media(max-width:600px){main{padding:24px 16px}.comparison{grid-template-columns:1fr}h1{font-size:32px}}
    </style><main><header><div class="kicker">SUIKA3 / SUI-A05 / 批次20261028 · 收尾2026-10-29</div><h1>飘 · 已确认的 Option B</h1><p>20岁，返乡待业，学习摄影。保留低马尾、双侧浅酒窝、滚边白衬衫、黑裤、金耳钉与红绳。</p><p class="note">A为本轮呈现对照；B沿用人物资料已有选型。本页展示制作交接图，正式采用、演出与运行验收由A11/I/E/Q接续。</p><nav><a href="交接.md">交接</a><a href="visual-review.md">实际检查</a><a href="branch-usage.json">分支与道具状态</a><a href="../../docs/美术/SUI-A05.md">任务文档</a></nav></header><h2>A / B 独立比较</h2><div class="comparison"><section><h3>Option A · 较平滑的绘制呈现</h3><a href="../../assets/sources/20261028/SUI-A05/option-a/char-piao-human-base-painterly-v001.png"><img src="previews/piao-option-a-day.png" alt="Option A"></a><p class="meta">仅比较呈现；未改写B选型，不混入B差分。</p></section><section><h3>Option B · 保留已确认自然质感</h3><a href="../../assets/sources/20261028/SUI-A05/selected-b/char-piao-human-base-v001.png"><img src="previews/piao-base-day.png" alt="Option B"></a><p class="meta">基础与9张既有差分按原件复制；新增动作引用同一基础图。</p></section></div><h2>逐张查看</h2><div class="toolbar"><button class="filter active" data-filter="all">全部</button><button class="filter" data-filter="selected-b">B基础与差分</button><button class="filter" data-filter="props">独立道具</button><span>底色</span><button data-tone="white">白</button><button data-tone="black">黑</button><button data-tone="day">昼</button><button data-tone="night">夜</button></div><div class="grid">'''
    tail='''</div><p class="meta">照片成片、外套/裙装/围巾、双人亲密、婚礼及其他CG见交接中的依赖，不从这些通用单人图推定完成。</p></main><script>
    const tones={white:'#fff',black:'#000',day:'#dde6e1',night:'#152229'};
    document.querySelectorAll('[data-tone]').forEach(b=>b.onclick=()=>document.documentElement.style.setProperty('--art-bg',tones[b.dataset.tone]));
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('article').forEach(a=>a.classList.toggle('hidden',b.dataset.filter!=='all'&&a.dataset.group!==b.dataset.filter));});
    </script></html>'''
    (QA/'gallery.html').write_text(body+''.join(cards)+tail)


if __name__ == '__main__':
    build()
