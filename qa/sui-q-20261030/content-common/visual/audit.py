import hashlib, json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
groups=['COMMON','XM','ZZ','FR']
manifest=json.loads((ROOT/'assets/current/manifest.json').read_text())
assets={x['assetId']:x for x in manifest['assets']}
shots={x['id']:x for x in json.loads((ROOT/'qa/SUI-A09-release-20261029/shot-queue.json').read_text())['shots']}
records=[x for x in json.loads((ROOT/'qa/SUI-A10-production-20261029/resource-records.json').read_text())['records'] if x['ownerTask'] in ['SUI-A10-'+g for g in groups]]
bindings=json.loads((ROOT/'docs/整合/bindings.json').read_text())['bindings']
candidate=json.loads((ROOT/'dist/sui-i02-20261030-v7/candidate-manifest.json').read_text())
frozen={x['path']:x for x in candidate['inputs']}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'candidate':candidate['version'],'reviewBasis':'当前采用WebP新解码、新联系表；逐镜独立目视结论另见审查.md','status':'running','records':[]}
for r in records:
    a=assets[r['assetId']];p=ROOT/a['runtimePath'];s=shots[r['cgId']]
    assert sha(p)==a['runtimeSha256']==frozen[a['runtimePath']]['sha256']
    assert sha(ROOT/a['sourcePath'])==a['sourceSha256']
    assert a['sourcePath']==r['sourceFile']
    im=Image.open(p).convert('RGBA');original=Image.open(ROOT/a['sourcePath']).convert('RGBA')
    assert im.size==original.size and im.tobytes()==original.tobytes()
    b=[x for x in bindings if x.get('cgId')==r['cgId']]
    assert b and all(x['enter']['cg']['assetId']==a['assetId'] for x in b)
    source=(ROOT/s['source']['path']).read_text().splitlines()
    assert source[s['source']['line']-1].strip()==s['source']['quote']
    report['records'].append({'cgId':r['cgId'],'assetId':a['assetId'],'runtimePath':a['runtimePath'],'sha256':a['runtimeSha256'],'size':list(im.size),'sourcePixelsEqual':True,'source':s['source'],'wardrobe':s['wardrobeAndForm'],'composition':s['composition'],'propState':s['propState'],'conditions':s['conditions'],'bindingConditions':[x['condition'] for x in b],'bindingIds':[x['bindingId'] for x in b],'restriction':s['reviewNotes']})
for g in groups:
    rr=[r for r in records if r['ownerTask']=='SUI-A10-'+g]
    canvas=Image.new('RGB',(1296,math.ceil(len(rr)/3)*274),(22,26,30));d=ImageDraw.Draw(canvas)
    for i,r in enumerate(rr):
        x=i%3*432;y=i//3*274;im=Image.open(ROOT/assets[r['assetId']]['runtimePath']).convert('RGB');im.thumbnail((432,243))
        canvas.paste(im,(x,y+27));d.text((x+8,y+6),r['cgId']+' CURRENT '+r['version'],fill='white')
    canvas.save(OUT/(g+'-current.jpg'),quality=95)
report['status']='pass';report['counts']={'assets':len(records),'newSheets':4};(OUT/'asset-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'counts':report['counts']},ensure_ascii=False))
