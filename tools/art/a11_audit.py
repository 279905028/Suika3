#!/usr/bin/env python3
"""SUI-A11: read upstream only; write exclusively to the supplied A11 output root.
python3 tools/art/a11_audit.py --project /Users/yipin/Desktop/Suika3 --output /path/to/stage
Dependencies: Python 3, Pillow, numpy. No generation service or game runtime is invoked.
"""
import argparse, hashlib, json, pathlib, struct, math, sys
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import numpy as np
from PIL import Image, ImageOps, ImageDraw, features, __version__ as pillow_version
P=argparse.ArgumentParser();P.add_argument('--project',required=True);P.add_argument('--output',required=True);P.add_argument('--verify-only',action='store_true');args=P.parse_args()
ROOT=pathlib.Path(args.project).resolve();OUT=pathlib.Path(args.output).resolve()
QA=OUT/'qa/SUI-A11-20261029';DEST=OUT/'assets/sources/20261029/SUI-A11'
QA.mkdir(parents=True,exist_ok=True);DEST.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def dump(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def load(p):return json.loads(p.read_text())
def pathrel(p):
 try:return str(p.relative_to(OUT))
 except ValueError:return str(p.relative_to(ROOT))
def rect(b):return [b[0],b[1],b[2]-b[0],b[3]-b[1]] if b else None
def chunks(p):
 b=p.read_bytes();a=[];i=12
 if b[:4]!=b'RIFF' or b[8:12]!=b'WEBP':return a
 while i+8<=len(b):
  k=b[i:i+4].decode('ascii');n=struct.unpack('<I',b[i+4:i+8])[0];a.append(k);i+=8+n+(n%2)
 return a
def meta(p):
 with Image.open(p) as im:
  im.load();v=np.asarray(im.convert('RGBA'));a=v[:,:,3];b=im.convert('RGBA').getchannel('A').getbbox();ori=im.getexif().get(274,1);icc=im.info.get('icc_profile')
  return {'path':pathrel(p),'sha256':sha(p),'bytes':p.stat().st_size,'format':im.format,'mode':im.mode,'width':im.width,'height':im.height,'orientation':ori,'direction':'landscape' if im.width>im.height else 'portrait' if im.width<im.height else 'square','iccEmbedded':bool(icc),'iccSha256':hashlib.sha256(icc).hexdigest() if icc else None,'colorHandling':'profile preserved' if icc else 'untagged; pixel values retained; sRGB interpretation at integration is explicit, no conversion','alpha':{'channelPresent':'A' in im.getbands(),'range':[int(a.min()),int(a.max())],'bboxXYWH':rect(b),'bboxAlpha16XYWH':rect(Image.fromarray((a>=16).astype('uint8')*255).getbbox()),'coordinateBasis':'source pixels, top-left origin, x/y/width/height','transparentPixels':int((a==0).sum()),'partialPixels':int(((a>0)&(a<255)).sum()),'opaquePixels':int((a==255).sum()),'canvasEdgeAlphaAbove127':{'top':int((a[0,:]>127).sum()),'bottom':int((a[-1,:]>127).sum()),'left':int((a[:,0]>127).sum()),'right':int((a[:,-1]>127).sum())}},'rgbaBytesTheoretical':im.width*im.height*4,'webpChunks':chunks(p) if im.format=='WEBP' else [],'reviewFlags':{'over2MiB':p.stat().st_size>2*1024*1024,'longEdgeOver2048':max(im.size)>2048}}
def compare(p,q):
 with Image.open(p) as im:a=np.asarray(im.convert('RGBA'))
 with Image.open(q) as im:b=np.asarray(im.convert('RGBA'))
 if a.shape!=b.shape:return {'passed':False,'reason':'dimensions differ'}
 delta=np.any(a[:,:,:3]!=b[:,:,:3],axis=2);vis=(a[:,:,3]>0)|(b[:,:,3]>0)
 return {'passed':bool(np.array_equal(a,b)),'exactRGBAEqual':bool(np.array_equal(a,b)),'visibleRGBDifferentPixels':int((delta&vis).sum()),'hiddenRGBDifferentPixels':int((delta&~vis).sum()),'alphaDifferentPixels':int((a[:,:,3]!=b[:,:,3]).sum())}
packages=[('SUI-A02','assets/sources/20261028/SUI-A02/resource-records.json'),('SUI-A03','assets/sources/20261028/SUI-A03/resource-records.json'),('SUI-A04','qa/SUI-A04-20261028/resource-records.json'),('SUI-A05','qa/SUI-A05-20261028/resource-records.json'),('SUI-A06','assets/sources/20261029/SUI-A06/resource-records.json'),('SUI-A07','assets/sources/20261029/SUI-A07/resource-records.json'),('SUI-A08','assets/sources/20261029/SUI-A08/resource-records.json')]
packages += [(p.parent.name,str(p.relative_to(ROOT))) for p in sorted(ROOT.glob('assets/sources/20261029/SUI-A10-*/resource-records.json'))]
packages += [('PREFLIGHT','assets/sources/20261029-cg-preflight/resource-records.json')]
records=[];excluded=[];seen=set()
for pkg,recordfile in packages:
 d=load(ROOT/recordfile);arr=d if isinstance(d,list) else d['records']
 for index,r in enumerate(arr):
  source=r.get('sourceFile') or r.get('sourceMetadata',{}).get('path') or r.get('png',{}).get('path') or r.get('file')
  webp=r.get('derivativeFile') or r.get('derivativeMetadata',{}).get('path') or r.get('webp',{}).get('path')
  if webp and webp.endswith('.png'):
   webp=str(pathlib.Path(source).with_suffix('.webp'))
   r=dict(r);pair=next((v for v in arr if v.get('derivativeFile')==webp),None)
   r['sha256Derivative']=pair.get('sha256Derivative') if pair else None
  if not source:raise ValueError((pkg,index,'missing source'))
  if source in seen:continue
  seen.add(source)
  status=r.get('status',r.get('approvalStatus',''))
  aid=r.get('assetId',r.get('id',r.get('key')))
  selected=not (r.get('selectedForPackage') is False or '未选' in status or status=='superseded-not-for-production')
  ref=pkg=='PREFLIGHT' or r.get('referenceOnly',False) or (pkg=='SUI-A07' and aid=='wenwen-base')
  current={'assetId':aid.removesuffix('-png') if aid else pathlib.Path(source).stem,'ownerTask':r.get('ownerTask',r.get('owner',pkg)),'package':pkg,'sourceFile':source,'existingWebP':webp,'upstreamRecord':recordfile,'upstreamRecordIndex':index,'expectedSourceSha256':r.get('sha256Source',r.get('sourceSha256',r.get('sourceMetadata',r.get('png',{})).get('sha256'))),'expectedWebPSha256':r.get('sha256Derivative',r.get('derivativeSha256',r.get('derivativeMetadata',r.get('webp',{})).get('sha256'))),'role':'reference_only' if ref else 'pending_adoption_review','selected':selected,'upstreamStatus':status,'upstreamApproval':r.get('approval',r.get('approvalStatus',{})),'upstreamEncoding':r.get('encoding',{}),'placement':r.get('placement',{'pivot':r.get('pivot'),'pivotMeaning':r.get('pivotMeaning'),'cropRect':r.get('cropRect')}),'usage':r.get('usage',r.get('useRestriction',r.get('condition',r.get('usageNotes')))),'binding':r.get('binding',{}),'conditions':r.get('conditions'),'lifecycle':r.get('lifecycle'),'displayPolicy':r.get('displayPolicy'),'anchors':r.get('storyAnchors',r.get('anchors',[r['source']] if isinstance(r.get('source'),dict) and 'quote' in r['source'] else [])),'requiresApproval':True,'adoptionApproved':False,'runtimeAdopted':False}
  (records if selected else excluded).append(current)
assert len(records)==242, len(records)
assert Counter(r['role'] for r in records)=={'pending_adoption_review':212,'reference_only':30}
# Protect all files in narrowly owned production packages, including originals, history and references.
owned=[ROOT/'assets/sources/20261028'/f'SUI-A{n:02d}' for n in range(2,7)] + [ROOT/'assets/sources/20261029'/f'SUI-A{n:02d}' for n in range(6,9)] + list(ROOT.glob('assets/sources/20261029/SUI-A10-*'))+[ROOT/'assets/sources/20261029-cg-preflight']
inputs=set(p for d in owned for p in d.rglob('*') if p.is_file())
inputs.update(ROOT/p for _,p in packages)
inputs.update(ROOT/p for p in ['AGENTS.md','docs/美术资源规范.md','docs/美术/SUI-A01.md','tools/runtime/build.cjs','SDK/wasm/index.html'])
for n in range(2,11):
 if n==9:continue
 inputs.add(ROOT/f'docs/美术/SUI-A{n:02d}.md')
for p in ROOT.glob('qa/SUI-A*/approval.json'):inputs.add(p)
for r in records+excluded:
 for a in r['anchors']:
  if a.get('path') and (ROOT/a['path']).is_file():inputs.add(ROOT/a['path'])
if args.verify_only:
 before=load(QA/'input-before.json');changed=[x['path'] for x in before if not (ROOT/x['path']).is_file() or sha(ROOT/x['path'])!=x['sha256']]
 candidate=load(QA/'pending-adoption.json')['records'];bad=[]
 for r in candidate:
  for key in ['sourceMetadata','webpMetadata','pngCompatibilityMetadata']:
   m=r.get(key)
   if not m:continue
   p=(OUT/m['path']) if (OUT/m['path']).exists() else ROOT/m['path']
   if not p.is_file() or sha(p)!=m['sha256']:bad.append(m['path'])
 dump(QA/'source-preservation.json',{'protectedCount':len(before),'changed':changed,'assetFingerprintFailures':bad,'passed':not changed and not bad});print(json.dumps({'protected':len(before),'changed':changed,'bad':bad}));sys.exit(bool(changed or bad))
if (QA/'input-before.json').exists():
 baseline=load(QA/'input-before.json')
 assert all((ROOT/x['path']).is_file() and sha(ROOT/x['path'])==x['sha256'] for x in baseline), 'Protected input changed; do not overwrite baseline'
else:dump(QA/'input-before.json',[{'path':str(p.relative_to(ROOT)),'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(inputs)])
dump(QA/'excluded-records.json',excluded)
print('Selected 242 assets; 212 adoption-review candidates, 30 references; auditing...',flush=True)
# Decode every protected production bitmap, including nonselected originals, separately from current candidate status.
bitmaps=[p for p in sorted(inputs) if p.suffix.lower() in ['.png','.webp','.jpg','.jpeg']]
def safe_meta(p):
 try:return meta(p)
 except Exception as e:return {'path':pathrel(p),'status':'返修','error':str(e)}
with ThreadPoolExecutor(max_workers=4) as pool:inventory=list(pool.map(safe_meta,bitmaps))
dump(QA/'all-source-image-inventory.json',inventory)
cache={x['path']:x for x in inventory}
# All source records retained verbatim by pointer; modern current-anchor evidence is recorded separately.
def audit(r):
 s=ROOT/r['sourceFile'];w=ROOT/r['existingWebP'];sm=cache.get(r['sourceFile']) or meta(s);wm=cache.get(r['existingWebP']) or meta(w)
 r['sourceMetadata']=sm;r['webpMetadata']=wm;r['pixelComparison']=compare(s,w)
 r['checks']={'trueFormat':'通过' if sm.get('format')=='PNG' and wm.get('format')=='WEBP' else '返修','losslessBitstream':'通过' if 'VP8L' in wm.get('webpChunks',[]) else '返修','orientation':'通过' if sm.get('orientation')==wm.get('orientation')==1 else '返修','dimensions':'通过' if [sm.get('width'),sm.get('height')]==[wm.get('width'),wm.get('height')] else '返修','pixelsAndAlpha':'通过' if r['pixelComparison']['passed'] else '返修','sourceFingerprint':'通过' if r['expectedSourceSha256'] in (None,sm['sha256']) else '返修','webpFingerprint':'通过' if r['expectedWebPSha256'] in (None,wm['sha256']) else '返修','fourBackgroundVisual':'未测' if sm['alpha']['range'][0]<255 else '不适用','engine':'未测','gameBrowser':'未测','phone':'未测','nativeDesktop':'未测','deployment':'未执行'}
 if r['role']=='pending_adoption_review':
  out=DEST/'png-compat'/r['ownerTask']/s.name;out.parent.mkdir(parents=True,exist_ok=True)
  with Image.open(s) as im:
   im.load();kw={'compress_level':6}
   if im.info.get('icc_profile'):kw['icc_profile']=im.info['icc_profile']
   elif r['package']=='SUI-A02':
    with Image.open(w) as wi:kw['icc_profile']=wi.info['icc_profile']
   im.save(out,format='PNG',**kw)
  r['pngCompatibilityMetadata']=meta(out);r['pngCompatibilityComparison']=compare(s,out)
  r['pngCompatibilityEncoding']={'tool':'Pillow','version':pillow_version,'format':'PNG','compress_level':6,'resize':False,'crop':False,'alphaModified':False,'colorConversion':'none','icc':'A02沿上游已记录sRGB解释，复用WebP的ICC；其余保留已有ICC，无ICC继续untagged','runtimeVerified':False}
  r['checks']['pngCompatibilityPixels']='通过' if r['pngCompatibilityComparison']['passed'] else '返修'
 r['currentAnchors']=[]
 for a in r['anchors']:
  p=ROOT/a.get('path','');quote=a.get('quote','')
  if not p.is_file():r['currentAnchors'].append({'path':a.get('path'),'status':'missing'});continue
  txt=p.read_text();lines=txt.splitlines();hits=[i+1 for i,l in enumerate(lines) if quote and quote in l];expected=a.get('sha256',a.get('sourceSha256'));current=sha(p)
  r['currentAnchors'].append({'path':a['path'],'upstreamSha256':expected,'currentSha256':current,'fingerprintDrift':expected is not None and expected!=current,'quotePresent':quote in txt if quote else None,'currentLineMatches':hits,'upstreamLine':a.get('line'),'note':'保留原记录；当前定位不是剧情运行验收'})
 r['formatStatus']='返修' if '返修' in r['checks'].values() else '通过'
 return r
with ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(audit,records))
dump(QA/'pending-adoption.json',{'schemaVersion':'SUI-A11-1','scope':'离线格式与待采用审议；不是最终采用白名单','adoptionApprovedCount':0,'records':records})
print('Pixel and encoding audit done; creating new composites...',flush=True)
# Four backgrounds: true source assets for day/night, white and black. These are offline evidence only.
day=ROOT/'assets/sources/20261029/SUI-A08/bg-old-netcafe-yard/bg-old-netcafe-yard-door-closed-morning-v001.png'
night=ROOT/'assets/sources/20261029/SUI-A08/bg-old-netcafe-yard/bg-old-netcafe-yard-door-ajar-night-v002.png'
backs=[Image.new('RGB',(240,360),'white'),Image.new('RGB',(240,360),'black')]
for p in [day,night]:
 with Image.open(p) as im:backs.append(ImageOps.fit(im.convert('RGB'),(240,360),method=Image.Resampling.LANCZOS))
transparent=[r for r in records if r['sourceMetadata']['alpha']['range'][0]<255]
sheets=[]
for page in range(math.ceil(len(transparent)/4)):
 group=transparent[page*4:(page+1)*4];sheet=Image.new('RGB',(960,len(group)*395+25),'#c6c6c6');draw=ImageDraw.Draw(sheet)
 for col,label in enumerate(['WHITE','BLACK','DAY','NIGHT']):draw.text((col*240+5,5),label,fill='black')
 for j,r in enumerate(group):
  draw.text((5,j*395+28),r['assetId'],fill='black')
  with Image.open(ROOT/r['sourceFile']) as im:
   art=im.convert('RGBA');art.thumbnail((230,350),Image.Resampling.LANCZOS)
   for col,bg in enumerate(backs):
    comp=bg.convert('RGBA');comp.alpha_composite(art,((240-art.width)//2,(360-art.height)//2));sheet.paste(comp.convert('RGB'),(col*240,j*395+55))
  r['fourBackgroundSheet']=f'qa/SUI-A11-20261029/four-backgrounds/sheet-{page+1:02d}.jpg'
 path=QA/'four-backgrounds'/f'sheet-{page+1:02d}.jpg';path.parent.mkdir(exist_ok=True);sheet.save(path,quality=94,subsampling=0)
 sheets.append({'path':pathrel(path),'sha256':sha(path),'assetIds':[r['assetId'] for r in group]})
dump(QA/'four-background-index.json',{'backgrounds':[{'path':pathrel(p),'sha256':sha(p)} for p in [day,night]],'method':'四底缩览，等比完整图；原尺寸alpha边缘数据另列；没有修图/裁边/改alpha','sheets':sheets})
dump(QA/'pending-adoption.json',{'schemaVersion':'SUI-A11-1','scope':'离线格式与待采用审议；不是最终采用白名单','adoptionApprovedCount':0,'records':records})
summary={'currentAssets':len(records),'mainSelection':223,'preflightReferences':19,'roles':dict(Counter(r['role'] for r in records)),'packages':dict(Counter(r['package'] for r in records)),'formatStatuses':dict(Counter(r['formatStatus'] for r in records)),'allProtectedImages':len(inventory),'imageDecodeFailures':[x for x in inventory if x.get('error')],'transparentCurrentAssets':len(transparent),'fourBackgroundSheets':len(sheets),'webpReused':len(records),'webpGenerated':0,'pngCompatibilityGenerated':212,'adoptionApproved':0,'runtimeAdopted':0,'webpBytes':sum(r['webpMetadata']['bytes'] for r in records),'candidateWebpBytes':sum(r['webpMetadata']['bytes'] for r in records if r['role']=='pending_adoption_review'),'candidatePngBytes':sum(r.get('pngCompatibilityMetadata',{}).get('bytes',0) for r in records),'rgbaBytesTheoreticalSumNotPeak':sum(r['sourceMetadata']['rgbaBytesTheoretical'] for r in records),'over2MiBWebP':sum(r['webpMetadata']['reviewFlags']['over2MiB'] for r in records),'longEdgeOver2048':sum(r['webpMetadata']['reviewFlags']['longEdgeOver2048'] for r in records),'toolchain':{'python':sys.version,'Pillow':pillow_version,'libwebp':features.version('webp')},'stage':'format complete, current visual review pending'}
dump(QA/'summary.json',summary);print(json.dumps(summary,ensure_ascii=False),flush=True)
