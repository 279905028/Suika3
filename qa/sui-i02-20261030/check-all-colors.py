from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,re,sys,hashlib
root=Path(__file__).resolve().parents[2];version=sys.argv[1];qa=Path(__file__).parent/version;src=root/'build'/version/'input'
assets={a['assetId']:a for a in json.loads((src/'assets/current/manifest.json').read_text())['assets']};bindings=json.loads((src/'docs/整合/bindings.json').read_text())['bindings'];cg={b['cgId']:b['enter']['cg']['assetId'] for b in bindings if b['cgId']}
bg=Image.open(src/'system/sui-u/png/gallery-view.png').convert('RGBA')
def reference(asset):
 im=Image.open(src/assets[asset]['runtimePath']).convert('RGBA');scale=min(1280/im.width,720/im.height);w,h=round(im.width*scale),round(im.height*scale);im=im.resize((w,h),Image.Resampling.BILINEAR);out=bg.copy();out.alpha_composite(im,((1280-w)//2,(720-h)//2));return np.array(out.convert('RGB')).astype(float)
def check(asset,file,kind):
 expected=reference(asset);im=Image.open(file).convert('RGB')
 if kind=='naturalCG':
  # Desktop suite locks 1440x900; shell has 48px header and 24px status. Canvas is centered 1440x810.
  assert im.size==(1440,900);im=im.crop((0,57,1440,867)).resize((1280,720),Image.Resampling.BILINEAR)
 assert im.size==(1280,720);actual=np.array(im).astype(float);candidates=[]
 for y in range(54,670,28):
  for x in range(54,1230,28):
   roi=expected[y-6:y+6,x-6:x+6];mean=roi.mean((0,1));noise=roi.std((0,1)).mean();color=abs(mean[0]-mean[2]);candidates.append((color/(1+.25*noise),x,y))
 points=[]
 for _,x,y in sorted(candidates,reverse=True):
  if all((x-a)**2+(y-b)**2>100**2 for a,b in points):points.append((x,y))
  if len(points)==8:break
 rows=[]
 for x,y in points:
  e=expected[y-6:y+6,x-6:x+6].mean((0,1));a=actual[y-6:y+6,x-6:x+6].mean((0,1));err=float(abs(e-a).mean());swap=float(abs(e[::-1]-a).mean());rows.append({'center':[x,y],'error':round(err,4),'swappedError':round(swap,4),'pass':err<=8})
 return {'assetId':asset,'kind':kind,'screenshot':str(file.relative_to(root)),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'probes':rows,'pass':all(r['pass'] for r in rows)}
checks=[]
probe=json.loads((qa/'asset-probe/report.json').read_text());assert probe['status']=='pass'
for a in probe['assets']:checks.append(check(a['assetId'],qa/'asset-probe'/a['screenshot'],'isolatedAsset'))
shots=sorted((qa/'routes/screenshots').glob('*-CG*-full.png'))
selected={}
for f in shots:selected.setdefault(re.search(r'-(CG\d+)-full.png$',f.name)[1],f)
shots=[selected[k] for k in sorted(selected)]
for file in shots:
 id=re.search(r'-(CG\d+)-full.png$',file.name)[1];checks.append(check(cg[id],file,'naturalCG'))
report={'version':version,'scope':'212资源独立探针及正式候选自然CG全图截图的颜色比对；备用图未声称剧情出场','method':'仅从来源图选择8个分散且颜色明显的12×12区域，对照GPU渲染均值；每探针MAE≤8/255；透明图按实际底板合成','checks':checks,'pass':all(c['pass'] for c in checks),'assetCount':len(probe['assets']),'naturalCGCount':len(set(re.search(r'-(CG\d+)-full.png$',p.name)[1] for p in shots))}
(qa/'all-colors.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pass':report['pass'],'assets':report['assetCount'],'naturalCG':report['naturalCGCount'],'failed':[(c['assetId'],c['kind'],max(r['error'] for r in c['probes'])) for c in checks if not c['pass']]},ensure_ascii=False))
for start in range(0,len(shots),20):
 sheet=Image.new('RGB',(1040,5*170),(22,28,34));d=ImageDraw.Draw(sheet)
 for i,f in enumerate(shots[start:start+20]):
  im=Image.open(f).crop((0,57,1440,867));im.thumbnail((260,146));x=(i%4)*260;y=(i//4)*170;sheet.paste(im,(x,y));d.text((x+8,y+149),re.search(r'-(CG\d+)-full.png$',f.name)[1],fill='white')
 sheet.save(qa/('cg-sheet-'+str(start//20+1)+'.jpg'),quality=90)
sys.exit(0 if report['pass'] else 1)
