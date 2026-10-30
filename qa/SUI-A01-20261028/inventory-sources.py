#!/usr/bin/env python3
"""SUI-A01：仅由人物直链、历史图库登记展开白名单，不遍历/复制历史目录。"""
from pathlib import Path
from collections import Counter
import json, hashlib, re, datetime
from PIL import Image
ROOT=Path('/Users/yipin/Desktop/Suika3')
HISTORY=Path('/Users/yipin/Desktop/cjb-v1.1-suika')
OUT=ROOT/'qa/SUI-A01-20261028'
files={}
def read_file(path, reason, owner=None, reference_copy=False):
 p=Path(path)
 key=str(p)
 if key in files:
  e=files[key]
  if reason not in e['reasons']:e['reasons'].append(reason)
  if owner and owner not in e['owners']:e['owners'].append(owner)
  e['referenceCopyEligible'] |= reference_copy
  return e
 e={'path':key,'reasons':[reason],'owners':[owner] if owner else [],'exists':p.is_file(),
    'permission':'read_only_audit','referenceCopyEligible':reference_copy,
    'referenceCopyGate':'仅在对应制作包确有依赖时复制单文件至本包 sources；保留来源指纹；不进入 current',
    'copyToCurrentAllowed':False,'adoptedInSuika3':False,'visualReviewThisBatch':False}
 files[key]=e
 if not p.is_file(): e['status']='missing';return e
 raw=p.read_bytes();e.update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),status='read')
 if p.suffix.lower() in ['.webp','.png','.jpg','.jpeg']:
  try:
   with Image.open(p) as im:
    im.load()
    a=im.getchannel('A') if 'A' in im.getbands() else None
    e['image']={'format':im.format,'width':im.width,'height':im.height,'mode':im.mode,'hasAlphaChannel':a is not None,
      'orientation':im.getexif().get(274),'orientationMeaning':'无EXIF方向时按存储像素方向；本轮不改写',
      'decoded':True,'alphaExtrema':list(a.getextrema()) if a else None,
      'nontransparentBBox':list(a.getbbox()) if a and a.getbbox() else None,
      'bboxCoordinateBasis':'源图像素；[left,top,right,bottom]，右/下边界不含；来自Pillow getbbox',
      'transparentPixels':a.histogram()[0] if a else 0,
      'rgbaDecodedBytes':im.width*im.height*4}
    e['extensionMatchesFormat']=p.suffix.lower() in {'WEBP':['.webp'],'PNG':['.png'],'JPEG':['.jpg','.jpeg']}.get(im.format,[])
  except Exception as ex:e['image']={'decoded':False,'error':str(ex)}
 return e
owners={'罗小满':'SUI-A02','周栀':'SUI-A03','孟遥':'SUI-A04','飘':'SUI-A05','黄球球':'SUI-A06','文文':'SUI-A07','叶岚':'SUI-A07','毛狼':'SUI-A07','师匠':'SUI-A07'}
for p in sorted((ROOT/'docs/人物').glob('*.md')):
 e=read_file(p,'当前人物资料',owners.get(p.stem))
 for link in re.findall(r'\]\((/Users/[^)]+)\)',p.read_text()):
  read_file(link,'当前人物页直接引用：'+str(p.relative_to(ROOT)),owners.get(p.stem),not '/qa/' in link)
for p in ['docs/CG当前选择.json','docs/CG调整清单.md','docs/美术资源规范.md']:
 read_file(ROOT/p,'当前任务依据')
for p in ['assets/README.md','assets/sources/README.md','assets/references/README.md','assets/manifests/current-art.json','assets/manifests/path-migration.json']:
 read_file(HISTORY/p,'美术规范 → 旧资源README → 分类索引；仅用于查阅和定位，旧脚本不运行')
art=json.loads((HISTORY/'assets/manifests/current-art.json').read_text())
assets=[]
for entry in art['assets']:
 e=read_file(HISTORY/entry['path'],'旧current-art逐项索引；历史采用不是本作采用')
 e['historicalIndex']={'id':entry['id'],'category':entry['category'],'character':entry.get('character'),'registered':entry.get('registered'),
      'sha256Matches':e.get('sha256')==entry.get('sha256'),'bytesMatch':e.get('bytes')==entry.get('bytes')}
 e['historicalIndex']['dimensionsMatch']=bool(e.get('image') and e['image']['width']==entry.get('width') and e['image']['height']==entry.get('height'))
 e['sourcesRecordedNotRead']=entry.get('sources',[])
 e['statusForSuika3']='待逐场景/人物复核；未采用'
 if entry['category']=='cg':e['statusForSuika3']='旧CG仅参考或排除证据；不是52个保留选择的已制成图'
 if entry.get('character')=='mengyao':e['statusForSuika3']='待新婚姻线复核；相机不得继承为职业道具'
 if entry.get('character')=='yelan':e['statusForSuika3']='仅普通队友群像候选；不得沿用恋爱/婚姻专属演出'
 if entry.get('character')=='huangqiuqiu' and 'human' in entry['id']:e['statusForSuika3']='旧人形成图/差分未由当前人物页批准；须与照片及待审基础重新核对'
 assets.append({'id':entry['id'],'label':entry['label'],'category':entry['category'],'character':entry.get('character'),'path':e['path'],'statusForSuika3':e['statusForSuika3']})
# 人物旧清单中的上游路径只经迁移表逐项解析，不把全表加入白名单。
migration=json.loads((HISTORY/'assets/manifests/path-migration.json').read_text())
map_paths={x['from']:x['to'] for x in migration['files']}
source_links=[]
for e in list(files.values()):
 p=Path(e['path'])
 if p.suffix!='.json' or 'current-art' in p.name or 'path-migration' in p.name or not e.get('exists'):continue
 try:d=json.loads(p.read_text())
 except Exception:continue
 for k in ['reference','source','adoptedReference']:
  s=d.get(k)
  if not isinstance(s,str) or not re.search(r'\.(png|webp|jpg|jpeg)$',s,re.I):continue
  if not s.startswith(('assets/','/Users/')):
   source_links.append({'fromManifest':str(p),'field':k,'originalPath':s,'resolution':'历史附件名称描述，不是本地路径；照片原件按人物页直链单独核验'})
   continue
  rel=s
  for old in ['/Users/yipin/Desktop/cjb/','/Users/yipin/Desktop/cjb-v1.1/','/Users/yipin/Desktop/cjb-v1.1-suika/']:
   if rel.startswith(old):rel=rel[len(old):];break
  mapped=map_paths.get(rel)
  if mapped:
   target=HISTORY/mapped
   read_file(target,'精确迁移映射：'+str(p)+' → '+k+'='+s,e['owners'][0] if e['owners'] else None,True)
   source_links.append({'fromManifest':str(p),'field':k,'originalPath':s,'mappingRecord':str(HISTORY/'assets/manifests/path-migration.json'),'mappingFrom':rel,'resolvedPath':str(target),'exists':target.exists(),'targetSha256':files[str(target)].get('sha256'),'declaredReferenceSha256':d.get('reference_sha256') or d.get('sourceSha256'),'declaredFingerprintMatches':(files[str(target)].get('sha256')==(d.get('reference_sha256') or d.get('sourceSha256'))) if (d.get('reference_sha256') or d.get('sourceSha256')) else None})
  else:source_links.append({'fromManifest':str(p),'field':k,'originalPath':s,'resolution':'未查到精确迁移映射；不猜路径、不复制'})
imgs=[x for x in files.values() if 'image'in x]
summary={'readFiles':len(files),'existingFiles':sum(x['exists'] for x in files.values()),'missingFiles':sum(not x['exists'] for x in files.values()),
 'inspectedImages':len(imgs),'decodedImages':sum(x['image']['decoded'] for x in imgs),
 'historicalCurrentImages':len(assets),'historicalCategories':dict(Counter(x['category'] for x in assets)),
 'historicalCharacters':dict(Counter(x['character'] for x in assets if x['category']=='characters')),
 'realFormats':dict(Counter(x['image'].get('format','ERROR') for x in imgs)),
 'historicalCurrentBytes':sum(files[x['path']]['bytes'] for x in assets),
 'historicalFingerprintsMatch':sum(files[x['path']]['historicalIndex']['sha256Matches'] for x in assets),
 'historicalDimensionsMatch':sum(files[x['path']]['historicalIndex']['dimensionsMatch'] for x in assets),
 'copiedFiles':0,'newImages':0,'suika3AdoptedImages':0}
result={'schemaVersion':1,'task':'SUI-A01','snapshotDate':'2026-10-28','historicalRoot':str(HISTORY),
 'policy':'本清单是精确只读盘点白名单；referenceCopyEligible只准对应制作任务按依赖复制参考，全部禁止自动进入current。原件未改写。sourcesRecordedNotRead仅保留历史清单指针，未实读，不属于已核验白名单。',
 'summary':summary,'assets':assets,'resolvedUpstreamReferences':source_links,'files':list(files.values())}
(OUT/'source-inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
