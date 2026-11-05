"""追加同一站台晚间变体，保存初次归档记录，不改任何图片原件。"""
import hashlib, json, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, features, __version__
ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/修订协作/P4-演出与美术/P4-03'
QA=ROOT/'qa/dialogue-p4-P4-03-20261103'
def read(p): return json.loads(p.read_text())
def write(p,d): p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def fp(p): return {'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def info(p):
 with Image.open(p) as im:
  im.load();a=im.getchannel('A') if 'A' in im.getbands() else None
  return dict(fp(p),bytes=p.stat().st_size,format=im.format,width=im.width,height=im.height,mode=im.mode,orientation=im.getexif().get(274,1),alphaExtrema=list(a.getextrema()) if a else None,nontransparentBBox=list(a.getbbox()) if a else None,visibleBBoxAlpha8=list(a.point(lambda x:255 if x>8 else 0).getbbox()) if a else None,iccProfileBytes=len(im.info.get('icc_profile',b'')))
spec=read(DOC/'production-spec-bus-evening.json')
d=ROOT/'assets/sources/20261103/P4-03/guiyang-bus-stop-day'
source=d/'bg-guiyang-bus-stop-evening-v001.png';assert not source.exists()
generated=Path('/Users/yipin/.codex/generated_images/01a19ff9-5794-7763-98a8-617da53e663c/exec-bec2798a-460f-43a9-a001-0d9b2f345bd1.png')
shutil.copy2(generated,source)
spec.update(tool='built-in imagegen',generatedPath=str(generated),savedPath=str(source.relative_to(ROOT)),sha256=fp(source)['sha256'],reason='T-PI-000393_1明确“那个晚上没见成”，AA候车段不得使用白昼版。')
write(d/'generation-evening.json',spec)
webp=source.with_suffix('.lossless.webp')
with Image.open(source) as im:
 im.save(webp,'WEBP',lossless=True,method=6,exact=True)
 with Image.open(webp) as out: assert im.convert('RGBA').tobytes()==out.convert('RGBA').tobytes()
r={'resourceKey':spec['key'],'assetId':spec['assetId'],'type':'background','origin':'generated-this-batch','version':'v001','source':info(source),'archiveWebP':info(webp),'productionEvidence':fp(d/'generation-evening.json'),'references':[fp(ROOT/p) for p in spec['refs']],'encoding':{'tool':'Pillow/libwebp','Pillow':__version__,'libwebp':features.version('webp'),'lossless':True,'method':6,'exact':True,'resized':False,'profile':'源无ICC；不作像素转换','rgbaPixelEqual':True},'needIds':spec['needIds'],'reviewStatus':'pending','producerStatus':'selected-candidate-awaiting-P4-05','authorizationBasis':'用户要求完成P4-03；按冻结正文明确晚间补同地点时段版，不等于逐图批准或正式采用。','adoption':'P4-05独立复验与运行衍生、P4-02逐节点闭合、P4-07正式采用均另行进行。','candidateUse':'docs/修订协作/P4-演出与美术/P4-03/decisions.json#guiyang-bus-stop-day'}
for name in ['resource-records.json','resources.candidate.json']:
 backup=QA/(name.removesuffix('.json')+'-initial.json');assert not backup.exists();shutil.copy2(DOC/name,backup)
records=read(DOC/'resource-records.json');records['assets'].append(r);records['counts']={'selected':15,'newOrRepaired':14,'sourceReuse':1,'background':13,'character':2};write(DOC/'resource-records.json',records)
catalog=read(DOC/'resources.candidate.json');catalog['assets'].append({'assetId':r['assetId'],'type':'background','source':fp(source),'runtime':fp(webp),'reviewStatus':'pending','approvalEvidence':None,'checkEvidence':None});write(DOC/'resources.candidate.json',catalog)
preview=QA/'delivery-previews';thumb=Image.open(source).convert('RGB');thumb.thumbnail((640,380));thumb.save(preview/'bg-guiyang-bus-stop-evening.jpg',quality=94)
index=read(QA/'delivery-preview-index.json');index['previews'].append({'assetId':r['assetId'],'preview':str((preview/'bg-guiyang-bus-stop-evening.jpg').relative_to(ROOT))})
# 第二版坐姿示意将底部截幅落到舞台外；保留第一版诊断图。
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
stage=Image.open(ROOT/'assets/current/SUI-A08/bg-noodle-shop-day.webp').convert('RGBA').resize((1279,720),Image.Resampling.LANCZOS)
canvas=Image.new('RGBA',(1280,720),'black');canvas.alpha_composite(stage)
sprite=Image.open(ROOT/'assets/sources/20261103/P4-03/piao-seated-base-common-d36/piao-seated-base-v001.png').convert('RGBA')
size=(round(sprite.width*650/sprite.height),650);sprite=sprite.resize(size,Image.Resampling.LANCZOS);canvas.alpha_composite(sprite,(80,105))
overlay=Image.new('RGBA',canvas.size);draw=ImageDraw.Draw(overlay)
draw.rectangle((48,490,1232,696),fill=(16,24,32,200),outline=(240,211,145,255),width=2)
draw.rectangle((76,442,316,490),fill=(16,24,32,200),outline=(240,211,145,255),width=2)
draw.text((80,520),'OFFLINE GEOMETRY PREVIEW / NOT AN ENGINE SCREENSHOT',fill='white',font=font)
p=preview/'piao-seated-base-ui-guide-v002.jpg';Image.alpha_composite(canvas,overlay).convert('RGB').save(p,quality=96)
for item in index['layoutGuides']:
 if item['assetId']=='piao-seated-base': item.update(preview=str(p.relative_to(ROOT)),spriteRect=[80,105,*size],supersedes='delivery-previews/piao-seated-base-ui-guide.jpg')
write(QA/'delivery-preview-index.json',index)
print(json.dumps({'selected':15,'newOrRepaired':14,'reusedSource':1,'pendingCatalog':241},ensure_ascii=False))
