#!/usr/bin/env python3
"""渲染采用资源的离线排版证据；不修改图片，不模拟引擎运行。"""
import json, hashlib, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
ROOT=Path(__file__).resolve().parents[3]
QA=ROOT/'qa/sui-i01-20261029'
M=json.loads((ROOT/'assets/current/manifest.json').read_text())
B=json.loads((ROOT/'docs/整合/bindings.json').read_text())
OUT=QA/'static'
OUT.mkdir(exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',12)
message=Image.open(ROOT/'system/sui-u/png/message.png').convert('RGBA')
name=Image.open(ROOT/'system/sui-u/png/name.png').convert('RGBA')
menu=Image.open(ROOT/'system/sui-u/png/menu-idle.png').convert('RGBA')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def overlap(a,b):
    return max(0,min(a[0]+a[2],b[0]+b[2])-max(a[0],b[0]))*max(0,min(a[1]+a[3],b[1]+b[3])-max(a[1],b[1]))>0
def regions(r):
    p=r.get('sourcePlacement') or {}
    out={}
    if p.get('criticalRect'): out['face']=p['criticalRect']
    for k,v in (p.get('criticalRects') or r.get('criticalRegions') or {}).items():
        if isinstance(v,list) and len(v)==4:out[k]=v
    if p.get('criticalPropRect'):out['prop']=p['criticalPropRect']
    if p.get('actionRect'):out['action']=p['actionRect']
    return out
rows=[];tiles={'character':[],'prop':[],'background':[],'cg':[]}
for r in M['records']:
    src=Image.open(ROOT/r['source']['path']).convert('RGBA')
    im=Image.open(ROOT/r['runtime']['path']);fmt=im.format;im=im.convert('RGBA')
    assert fmt=='WEBP' and src.size==im.size
    assert src.tobytes()==im.tobytes(),r['assetId']
    assert sha(ROOT/r['runtime']['path'])==r['runtime']['sha256']
    p=r['placement'];x,y=round(p['x']),round(p['y']);w,h=round(p['width']),round(p['height'])
    base=Image.new('RGBA',(1280,720),(16,24,28,255));base.alpha_composite(im.resize((w,h),Image.Resampling.LANCZOS),(x,y))
    reading=base.copy();reading.alpha_composite(message,(48,490));reading.alpha_composite(name,(76,442));reading.alpha_composite(menu,(1104,24))
    blockers=[];rects={}
    for key,rect in regions(r).items():
        a=[p['x']+rect[0]*p['scale'],p['y']+rect[1]*p['scale'],rect[2]*p['scale'],rect[3]*p['scale']];rects[key]=a
        for zone,b in {'message':[48,490,1184,206],'name':[76,442,240,48],'menu':[1104,24,128,56]}.items():
            if overlap(a,b):blockers.append({'region':key,'ui':zone})
    # 全图/正文两种预览并列，不额外裁切人物原图；透明源保持原alpha。
    tile=Image.new('RGB',(640,206),(232,235,236));tile.paste(base.convert('RGB').resize((320,180)),(0,26));tile.paste(reading.convert('RGB').resize((320,180)),(320,26))
    d=ImageDraw.Draw(tile);d.text((5,2),r['assetId'][:54],font=font,fill='#17272f');d.text((465,4),'BOUND' if r['bindingIds'] else 'RESERVE',font=small,fill='#17272f')
    tiles[r['type']].append((r['assetId'],tile))
    rows.append({'assetId':r['assetId'],'format':fmt,'size':list(im.size),'sourceRGBAEqualsRuntime':True,'runtimeSha256':r['runtime']['sha256'],'alphaRange':list(im.getchannel('A').getextrema()),'placement':p,'criticalRectsOnCanvas':rects,'criticalOcclusions':blockers,'readingPolicy':'同段可隐藏正文/姓名/菜单；CG完整contain；不新增页','fourBackgroundEvidence':'逐项沿用A11同字节图的白/黑/昼/夜目视记录；本批不伪称再次全量四底审阅'})
sheets=[]
for kind,items in tiles.items():
    for i in range(0,len(items),12):
        group=items[i:i+12];sheet=Image.new('RGB',(1280,206*math.ceil(len(group)/2)),(210,216,220))
        for j,(_,tile) in enumerate(group):sheet.paste(tile,((j%2)*640,(j//2)*206))
        file=OUT/f'{kind}-{i//12+1:02}.jpg';sheet.save(file,quality=90)
        sheets.append({'path':str(file.relative_to(ROOT)),'sha256':sha(file),'assetIds':[id for id,_ in group]})
(QA/'static-checks.json').write_text(json.dumps({'status':'pixel-and-geometry-pass','images':len(rows),'actualHumanVisualReview':'另见visual-review.json，生成联系表本身不是目视通过','rows':rows,'sheets':sheets},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'images':len(rows),'sheets':len(sheets),'criticalOcclusions':sum(bool(r['criticalOcclusions']) for r in rows)}))
