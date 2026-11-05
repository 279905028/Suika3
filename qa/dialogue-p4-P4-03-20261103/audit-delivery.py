"""交付封存：真实图像格式/无损像素、文档链接及输出指纹。"""
import hashlib, json, re
from pathlib import Path
from urllib.parse import unquote
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
QA=ROOT/'qa/dialogue-p4-P4-03-20261103'
DOC=ROOT/'docs/修订协作/P4-演出与美术/P4-03'
SRC=ROOT/'assets/sources/20261103/P4-03'
def read(p): return json.loads(p.read_text())
def fp(p): return {'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
def write(p,d):
 assert not p.exists(),f'不覆盖封存记录：{p}'
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
checks=[]
for r in read(DOC/'resource-records.json')['assets']:
 source=ROOT/r['source']['path'];webp=ROOT/r['archiveWebP']['path']
 with Image.open(source) as a,Image.open(webp) as b:
  a.load();b.load();assert a.format=='PNG' and b.format=='WEBP'
  assert a.size==b.size
  assert a.convert('RGBA').tobytes()==b.convert('RGBA').tobytes()
  assert a.getexif().get(274,1)==1
  alpha=a.getchannel('A') if 'A' in a.getbands() else None
  if r['type']=='character': assert alpha is not None and alpha.getextrema()[0]==0 and alpha.getextrema()[1]>240
  else: assert alpha is None
  assert b'VP8L' in webp.read_bytes()[:32],'必须为无损WebP'
  checks.append({'assetId':r['assetId'],'pngDecoded':True,'webpDecoded':True,'losslessHeader':True,'rgbaPixelEqual':True,'size':list(a.size),'alphaExtrema':list(alpha.getextrema()) if alpha else None})

manifestPath=QA/'output-manifest.json'
auditPath=QA/'delivery-audit.json'
files=sorted(p for base in [DOC,QA,SRC] for p in base.rglob('*') if p.is_file() and p not in [manifestPath,auditPath] and '__pycache__' not in p.parts)
write(manifestPath,{'taskId':'P4-03','date':'2026-11-03','scope':'仅P4-03独占交付与制作证据，含保留的初稿/中间记录；选定版本以resource-records.json为准。',
 'excluded':['本清单自身','delivery-audit.json（其内反向记录本清单指纹，避免循环）'],
 'fileCount':len(files),'files':[fp(p) for p in files],
 'coordinationUpdate':{'file':fp(ROOT/'TODO-v1.1.md'),'scope':'仅P4-03一行状态；非冻结输入，其他任务可继续更新'}})

links=[]
for p in list(DOC.glob('*.md'))+[QA/'交接.md',QA/'preview.html']:
 text=p.read_text()
 targets=re.findall(r'\[[^\]]*\]\(([^)]+)\)',text) if p.suffix=='.md' else re.findall(r'(?:href|src)="([^"]+)"',text)
 for t in targets:
  if t.startswith(('http:','https:','#')): continue
  target=(p.parent/unquote(t.split('#',1)[0])).resolve()
  assert target.exists() or target==auditPath,f'断链：{p}: {t}'
  links.append({'document':str(p.relative_to(ROOT)),'target':str(target.relative_to(ROOT))})
verification=read(QA/'verification-final.json')
assert verification['status']=='PASS_PRODUCER_DELIVERY_ONLY'
write(auditPath,{'taskId':'P4-03','date':'2026-11-03','status':'PASS_PRODUCER_ARTIFACT_AUDIT',
 'images':checks,'counts':{'imagePairs':len(checks),'transparentSprites':2,'localLinks':len(links),'outputFiles':len(files)},
 'localLinks':links,'outputManifest':fp(manifestPath),'verification':fp(QA/'verification-final.json'),
 'notPerformed':['P4-05独立复验','P4-02闭合/最终handoff','头盔正文重冻结','正式采用','引擎/浏览器/真机/原生/发布']})
print(json.dumps({'imagePairs':len(checks),'links':len(links),'outputFiles':len(files),'status':'PASS_PRODUCER_ARTIFACT_AUDIT'},ensure_ascii=False))
