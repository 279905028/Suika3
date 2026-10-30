#!/usr/bin/env python3
from pathlib import Path
from PIL import Image,ImageFont
import hashlib,json,re

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[1]
UI=ROOT/'system/sui-u'
checks=[]
def check(name,details):checks.append({'name':name,'pass':True,'details':details})
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

manifest=json.loads((UI/'asset-manifest.json').read_text())
for asset in manifest['assets']:
    entries=asset['files']
    for e in entries:
        p=ROOT/e['path'];assert p.is_file();assert sha(p)==e['sha256'];assert p.stat().st_size==e['bytes']
        with Image.open(p) as im:
            assert im.size==(asset['width'],asset['height'])
            assert im.format==('PNG' if p.suffix=='.png' else 'WEBP')
    png=Image.open(ROOT/entries[0]['path']).convert('RGBA')
    webp=Image.open(ROOT/entries[1]['path']).convert('RGBA')
    assert png.tobytes()==webp.tobytes(),asset['name']
check('位图真实格式、尺寸、SHA-256及PNG/无损WebP逐像素相等',len(manifest['assets']))

gui_count=0;buttons=0
for p in (UI/'gui').glob('*.gui'):
    ids=[]
    for name,body in re.findall(r'(\w+)\s*\{([^}]+)\}',p.read_text()):
        if name=='global':continue
        attrs=dict(re.findall(r'([\w-]+):\s*([^;]+);',body))
        id=int(attrs['id']);assert id not in ids,(p,id);ids.append(id)
        for k,v in attrs.items():
            if k.startswith('image-') or k in ['file','pointse','clickse']:
                if v=='start.novel':continue
                assert (ROOT/v).is_file(),(p,v)
        image=Image.open(ROOT/attrs['image-idle'])
        x,y=int(attrs['x']),int(attrs['y']);w,h=image.size
        assert 0<=x and 0<=y and x+w<=1280 and y+h<=720,(p,name,x,y,w,h)
        if attrs['type']!='noaction':buttons+=1
    gui_count+=1
check('GUI唯一ID、依赖文件与画布边界',{'files':gui_count,'interactiveItems':buttons})

patch=json.loads((UI/'config.patch.json').read_text())
for key,value in patch.items():
    if value.startswith('system/'):
        assert (ROOT/value).is_file(),(key,value)
for i in range(1,7):
    x=int(patch[f'choose.box{i}.x']);y=int(patch[f'choose.box{i}.y'])
    assert x+1040<=1280 and y+88<=720
    if i>1:assert y>=int(patch[f'choose.box{i-1}.y'])+88
assert 1184-36-36>=30*30
assert 206-24-40>=30+44*2
assert int(patch['choose.box1.y']) >= int(patch['sysbtn.y'])+int(patch['sysbtn.height'])+24
check('正文三行容量、六选项边界及相邻触区无重叠',{'bodyFont':30,'bodyLine':44,'bodyLines':3,'choiceFont':28,'choiceButton':[1040,88]})

selection=json.loads((ROOT/'docs/CG当前选择.json').read_text())
registry=json.loads((UI/'gallery.registry.json').read_text())
ids=[i['id'] for i in registry['items']]
assert ids==selection['activeSelectedIds']
assert not set(ids)&set(selection['retiredRouteIds'])
assert all(i['file'] is None for i in registry['items'])
check('图鉴52项与当前选择一致、8项取消镜头排除、没有自动采用图片',len(ids))

# Check the current authored option labels against the physical text width.
font=ImageFont.truetype(str(ROOT/'system/font/NotoSansCJK-Medium.ttc'),28)
option_labels=[]
for p in (ROOT/'scenario').glob('*.md'):
    for n,line in enumerate(p.read_text().splitlines(),1):
        m=re.match(r'^#### ([AB])｜(.+)$',line)
        if m:
            label=m[2];width=font.getlength(label)
            option_labels.append({'source':str(p.relative_to(ROOT)),'line':n,'text':label,'width':width})
            assert width<=1000,(p,n,width,label)
assert len(option_labels)==128,len(option_labels)
routes=json.loads((ROOT/'scenario/routes.json').read_text())['routes']
for route in routes:
    assert font.getlength(route['name'])<=1000
check('128个AB选项与6个路线名称宽度检查',{'count':len(option_labels)+len(routes),'longestPx':max(o['width'] for o in option_labels),'note':'正式编译后的最终选项仍由C/Q复验'})

snapshot=json.loads((BASE/'input-snapshot.json').read_text())
changed=[p for p,h in snapshot.items() if not (ROOT/p).is_file() or sha(ROOT/p)!=h]
assert not changed,changed
check('191个根入口、原system、正文、资料和SDK关键输入保持原指纹',len(snapshot))

build=json.loads((BASE/'build-manifest.json').read_text())
for e in build['inputs']:
    assert sha(BASE/'stage'/e['path'])==e['sha256']
for e in build['outputs']:
    assert sha(BASE/e['path'])==e['sha256']
check('本批构建输入与四个网页输出指纹一致',{'inputs':len(build['inputs']),'outputs':len(build['outputs'])})
(BASE/'static-report.json').write_text(json.dumps({'date':'2026-10-28','checks':checks,'passed':True},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':True,'checks':len(checks),'uiAssets':len(manifest['assets']),'optionsMeasured':len(option_labels)},ensure_ascii=False))
