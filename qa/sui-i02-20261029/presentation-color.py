from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib,sys
ROOT=Path(__file__).resolve().parents[2];base=Path(__file__).resolve().parent
version=sys.argv[1] if len(sys.argv)>1 else 'diag-v004';out=base/('presentation-'+version)
manifest=json.loads((base/'fixture/manifest.json').read_text());bindings=json.loads((base/'fixture/bindings.json').read_text())['bindings'];assets={a['assetId']:a for a in manifest['assets']}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def img(asset):return Image.open(ROOT/assets[asset]['runtimePath']).convert('RGBA')
def place(canvas,p):
    image=img(p['assetId']);image=image.resize((round(image.width*p['scale']),round(image.height*p['scale'])),Image.Resampling.BILINEAR);canvas.alpha_composite(image,(p['x'],p['y']))
def scene(state):
    canvas=Image.new('RGBA',(1280,720),(0,0,0,255))
    for p in [state['background'],*state['characters'],*state['props'],state['cg']]:
        if p:place(canvas,p)
    return np.array(canvas.convert('RGB')).astype(float)
char=bindings[0]['enter']['characters'][0];charMask=Image.new('RGBA',(1280,720));place(charMask,char);alpha=np.array(charMask)[:,:,3]
expect=scene(bindings[0]['enter']);cg=img(bindings[1]['enter']['cg']['assetId']);full=np.array(cg.resize((1280,720),Image.Resampling.BILINEAR).convert('RGB')).astype(float)
gallery=np.zeros((720,1280,3),dtype=float);gallery[132:642,187:1093]=np.array(cg.resize((906,510),Image.Resampling.BILINEAR).convert('RGB')).astype(float)
# Select opaque, chromatically informative regions from the reference only, before seeing output.
def probes(expected,kind):
    candidates=[]
    for y in range(145,461,16):
        for x in range(40,1241,16):
            if kind=='character' and np.min(alpha[y-6:y+6,x-6:x+6])<250:continue
            if kind=='background' and np.max(alpha[y-6:y+6,x-6:x+6])>0:continue
            ref=expected[y-6:y+6,x-6:x+6];mean=ref.mean((0,1));separation=abs(mean[0]-mean[2]);noise=ref.std((0,1)).mean()
            if separation>=14:candidates.append((separation/(1+noise*.2),x,y))
    selected=[]
    for _,x,y in sorted(candidates,reverse=True):
        if all((x-a)**2+(y-b)**2>45**2 for a,b in selected):selected.append((x,y))
        if len(selected)>=6:return selected
    assert len(selected)>=3,(kind,len(selected));return selected
checks=[]
for kind,expected,names in [('background',expect,['03-character','09-character-loaded']),('character',expect,['03-character','09-character-loaded']),('cg',full,['05-cg-full','08-cg-loaded-full','11-cg-reopened-full']),('gallery',gallery,['13-gallery-detail'])]:
    pts=probes(expected,kind)
    for name in names:
        file=out/(name+'.png');actual=np.array(Image.open(file).convert('RGB')).astype(float);assert actual.shape==(720,1280,3),actual.shape
        rows=[]
        for x,y in pts:
            e=expected[y-6:y+6,x-6:x+6].mean((0,1));a=actual[y-6:y+6,x-6:x+6].mean((0,1));err=np.abs(e-a).mean();swap=np.abs(e[::-1]-a).mean()
            rows.append({'center':[x,y],'referenceRGB':e.round(3).tolist(),'actualRGB':a.round(3).tolist(),'rgbMAE':round(float(err),4),'swappedMAE':round(float(swap),4),'pass':bool(err<=7 and err<swap)})
        checks.append({'kind':kind,'screenshot':str(file.relative_to(ROOT)),'sha256':sha(file),'probes':rows,'pass':all(r['pass'] for r in rows)})
# Same crop before/after load catches changed transforms and missing layers, beyond sparse colors.
for a,b in [('03-character','09-character-loaded'),('05-cg-full','08-cg-loaded-full'),('05-cg-full','11-cg-reopened-full')]:
    x=np.array(Image.open(out/(a+'.png')).convert('RGB'));y=np.array(Image.open(out/(b+'.png')).convert('RGB'));crop=(slice(145,465),slice(40,1240));d=np.abs(x[crop].astype(float)-y[crop].astype(float));checks.append({'kind':'restore-pixel','before':a,'after':b,'crop':[40,145,1240,465],'meanError':float(d.mean()),'maxError':float(d.max()),'pass':bool(d.mean()<.2)})
report={'scope':'当前诊断候选三张真实WebP在Wasm舞台/CG及读档重开的颜色探针；不是全资源、手机或桌面验收','version':version,'method':'Source-only opaque/chromatic 12x12 ROI selection; rendered affine reference; compare RGB and reversed R/B, threshold MAE <= 7. Source art unchanged.','checks':checks,'pass':all(c['pass'] for c in checks)}
(out/'color-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'pass':report['pass'],'checks':len(checks),'probeCount':sum(len(c.get('probes',[])) for c in checks)},ensure_ascii=False));sys.exit(0 if report['pass'] else 1)
