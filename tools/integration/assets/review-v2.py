#!/usr/bin/env python3
"""I01离线组合排版；不修改原图片，不生成运行包。"""
import json, hashlib, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[3]
QA=ROOT/'qa/sui-i01-20261030'
def load(p): return json.loads((ROOT/p).read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
M=load('qa/sui-i01-20261030/adoption-ledger.json')
B=load('docs/整合/bindings.json')
A={a['assetId']:a for a in M['records']}
OUT=QA/'static'; OUT.mkdir(exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',15)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',12)
ui=[(Image.open(ROOT/f'system/sui-u/png/{f}.png').convert('RGBA'),pos) for f,pos in [('message',(48,490)),('name',(76,442)),('menu-idle',(1104,24))]]
cache={}
def render(state,reading=False):
    im=Image.new('RGBA',(1280,720),(16,24,28,255))
    for p in [state['background'],*state['characters'],*state['props'],state['cg']]:
        if not p:continue
        a=A[p['assetId']]; key=(p['assetId'],p['scale'])
        if key not in cache:
            src=Image.open(ROOT/a['runtime']['path']).convert('RGBA')
            cache[key]=src.resize((round(src.width*p['scale']),round(src.height*p['scale'])),Image.Resampling.LANCZOS)
        im.alpha_composite(cache[key],(p['x'],p['y']))
    if reading:
        for t,pos in ui:im.alpha_composite(t,pos)
    return im.convert('RGB')
def sheet(kind,items,columns,per):
    records=[]
    for start in range(0,len(items),per):
        group=items[start:start+per];w,h=group[0][1].size
        s=Image.new('RGB',(w*columns,h*math.ceil(len(group)/columns)),(209,217,220))
        for j,(_,tile) in enumerate(group):s.paste(tile,((j%columns)*w,(j//columns)*h))
        p=OUT/f'{kind}-{start//per+1:02}.jpg';s.save(p,quality=91)
        records.append({'path':str(p.relative_to(ROOT)),'sha256':sha(p),'bindingIds':[id for id,_ in group]})
    return records
cgtiles=[];portraits=[];seen=set();geometry=[]
for b in B['bindings']:
    if b['cgId']:
        tile=Image.new('RGB',(1280,206),'#eef1f2');d=ImageDraw.Draw(tile)
        d.text((4,3),f"{b['cgId']} | BASE / CG+UI / FULL VIEW / RESTORE",font=font,fill='#10232b')
        for i,(s,r) in enumerate([(b['exit']['restore'],True),(b['enter'],True),(b['enter'],False),(b['exit']['restore'],True)]):tile.paste(render(s,r).resize((320,180)),(i*320,26))
        cgtiles.append((b['bindingId'],tile))
    if b['enter']['characters'] or b['enter']['props']:
        base=b['exit']['restore'];k=json.dumps(base,sort_keys=True)
        if k in seen:continue
        seen.add(k);tile=Image.new('RGB',(640,206),'#eef1f2');d=ImageDraw.Draw(tile)
        ids=[p['assetId'] for p in [*base['characters'],*base['props']]]
        d.text((4,3),' / '.join(ids)[:75],font=small,fill='#10232b')
        tile.paste(render(base,False).resize((320,180)),(0,26));tile.paste(render(base,True).resize((320,180)),(320,26))
        portraits.append((b['bindingId'],tile))
        for p in [*base['characters'],*base['props']]:
            a=A[p['assetId']];src=a.get('sourcePlacement') or {}; rect=src.get('criticalRect') or (src.get('criticalRects') or {}).get('face')
            if rect:
                dest=[p['x']+rect[0]*p['scale'],p['y']+rect[1]*p['scale'],rect[2]*p['scale'],rect[3]*p['scale']]
                geometry.append({'assetId':p['assetId'],'bindingId':b['bindingId'],'criticalRect':dest,'aboveMessage':dest[1]+dest[3]<=490})
sheets=sheet('cg-lifecycle',cgtiles,1,8)+sheet('portrait-composites',portraits,2,12)
report={'version':B['version'],'status':'rendered-awaiting-visual-review','cgFrames':len(cgtiles),'uniquePortraitStates':len(portraits),'sheets':sheets,'geometry':geometry,
 'pixelAndAlphaEvidence':{'path':'qa/sui-i01-20261029/static-checks.json','sha256':sha(ROOT/'qa/sui-i01-20261029/static-checks.json'),'method':'212图原字节未变，沿用原图/衍生RGBA实测及A11四底证据；本次新增连续场景组合，不宣称重复全量人工四底复核'},
 'limits':['本次为离线合成，非引擎截图','无数值关键框的CG须目视正文/全图两态，不能以空框计算称无遮挡','手机真机、原生和发布未测']}
(QA/'static-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'cg':len(cgtiles),'portraitStates':len(portraits),'sheets':len(sheets),'geometryFailures':[g for g in geometry if not g['aboveMessage']]}))
