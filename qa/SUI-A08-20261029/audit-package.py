# -*- coding: utf-8 -*-
"""A08离线交接：保留原件、无损WebP、等比画布、UI遮挡与四底检查。"""
from pathlib import Path
import copy, hashlib, html, json, math, sys
import PIL
from PIL import Image, ImageOps, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
QA=Path(__file__).resolve().parent
SOURCE=ROOT/'assets/sources/20261029/SUI-A08'
PLAN=QA/'production-plan.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

def meta(p):
 with Image.open(p) as im:
  im.load();a=im.getchannel('A') if 'A' in im.getbands() else None
  box=a.getbbox() if a else None
  return {'format':im.format,'width':im.width,'height':im.height,'bytes':p.stat().st_size,
   'orientation':im.getexif().get(274,1),'mode':im.mode,'colorSpace':'RGB；'+('含ICC，未做色域实测' if im.info.get('icc_profile') else '未附ICC；未做色域实测'),
   'alpha':{'present':a is not None,'range':list(a.getextrema()) if a else None,
   'bbox':[box[0],box[1],box[2]-box[0],box[3]-box[1]] if box else None,
   'coordinateBasis':'当前文件像素；左上原点；[x,y,width,height]'},
   'rgbaDecodedBytes':im.width*im.height*4,'sha256':sha(p)}

def choose(job):
 base=ROOT/job['outputDirectory']/job['assetId']
 versions=[4,3,1] if job['assetId']=='bg-huisheng-306-operating-night-v001' else [4,3,2,1]
 for version in versions:
  path=base.with_name(base.name.replace('v001',f'v{version:03d}')).with_suffix('.png')
  if path.exists():return path,version
 return None,None

def normalized(im,size=(1280,720)):
 rgba=im.convert('RGBA');fit=ImageOps.contain(rgba,size,Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',size,(0,0,0,0) if 'A' in im.getbands() else (21,28,31,255))
 pos=((size[0]-fit.width)//2,(size[1]-fit.height)//2)
 canvas.alpha_composite(fit,pos)
 return canvas,{'canvas':list(size),'scaledSize':list(fit.size),'offset':list(pos),'operation':'等比contain；不裁切，不拉伸，保留原件','sourceRect':[0,0,im.width,im.height]}

def main():
 plan=json.loads(PLAN.read_text());template=json.loads((ROOT/'qa/SUI-A01-20261028/resource-record.template.json').read_text())
 records=[];summary=[];missing=[];manifest=[]
 for sub in ['ui-composites','alpha-composites','sheets']:(QA/sub).mkdir(exist_ok=True)
 gui=ROOT/'system/sui-u/png/message.png'
 if not gui.exists():gui=ROOT/'system/sui-u/png/reading-backdrop.png'
 for job in plan['generation']:
  src,version=choose(job)
  if src is None:missing.append(job['assetId']);continue
  sm=meta(src);assert sm['format']=='PNG' and sm['orientation']==1
  with Image.open(src) as im:
   rgba=im.convert('RGBA');webp=src.with_suffix('.webp')
   if not webp.exists():rgba.save(webp,format='WEBP',lossless=True,method=6,exact=True)
   with Image.open(webp) as wp:equal=wp.convert('RGBA').tobytes()==rgba.tobytes()
   assert equal,src
   wm=meta(webp);preview,transform=normalized(im)
   ui=preview.copy()
   if gui.exists():
    layer=Image.open(gui).convert('RGBA')
    if layer.size==(1280,720):ui.alpha_composite(layer)
    elif layer.size==(1184,206):ui.alpha_composite(layer,(48,490))
    else:ImageDraw.Draw(ui).rounded_rectangle((48,490,1232,696),radius=16,fill=(15,28,32,224))
   else:ImageDraw.Draw(ui).rounded_rectangle((48,490,1232,696),radius=16,fill=(15,28,32,224))
   ImageDraw.Draw(ui).rounded_rectangle((76,442,316,490),radius=8,fill=(20,34,37,230))
   ImageDraw.Draw(ui).rounded_rectangle((1104,24,1232,80),radius=10,fill=(20,34,37,230))
   ui.convert('RGB').save(QA/'ui-composites'/(job['assetId']+'.jpg'),quality=90)
   composites=[]
   if sm['alpha']['present'] and sm['alpha']['range'][0]<255:
    board=Image.new('RGB',(1280,720),'#243137')
    for index,(name,color) in enumerate([('white','#ffffff'),('black','#000000'),('day','#b7c4bd'),('night','#18242d')]):
     bg=Image.new('RGBA',(640,360),color);thumb=ImageOps.contain(rgba,(620,330),Image.Resampling.LANCZOS)
     bg.alpha_composite(thumb,((640-thumb.width)//2,(360-thumb.height)//2));board.paste(bg.convert('RGB'),((index%2)*640,(index//2)*360));composites.append(name)
    board.save(QA/'alpha-composites'/(job['assetId']+'.jpg'),quality=94)
   req=next(x for x in plan['coverage'] if x['requirementId']==job['requirementId'])
   r=copy.deepcopy(template);r.update({'assetId':job['assetId'].removesuffix('-v001'),'kind':'background' if job['requirementId'].startswith('bg-') else 'shared-prop',
    'ownerTask':'SUI-A08','characterOrSceneKey':job['requirementId'],'variant':job['state'],'version':version,'status':'制作完成；包内离线检查；待A11复核与I采用',
    'requirementKeys':[job['requirementId']],'storyAnchors':req['sourceAnchors'],'sources':[{'type':'generated','tool':'built-in image_gen'}],
    'sourceFile':str(src.relative_to(ROOT)),'derivativeFile':str(webp.relative_to(ROOT)),'sha256Source':sm['sha256'],'sha256Derivative':wm['sha256'],
    **{k:wm[k] for k in ['format','width','height','bytes','orientation','colorSpace','alpha']},'sourceMetadata':sm,
    'encoding':{'tool':'Pillow/libwebp','version':PIL.__version__,'lossless':True,'quality':None,'method':6,'exact':True},
    'promptOrProcessRecord':str(src.with_suffix('.generation.json').relative_to(ROOT)),
    'supersedes':job['outputDirectory']+'/'+job['assetId']+'.png' if version>1 else None})
   if not (ROOT/r['promptOrProcessRecord']).exists():r['promptOrProcessRecord']=job['promptFile'];r['pending'].append('首张母图完整提示词补录见本任务生成记录')
   r['placement'].update({'pivot':[sm['width']/2,sm['height']/2],'cropRect':[0,0,sm['width'],sm['height']],
    'uiMaskReference':'system/sui-u/integration.json','scale':transform})
   r['binding'].update({'condition':req['constraints'],'enter':'由SUI-E/I逐拍绑定；本包不自动入场','exitAndRestore':'由E/I恢复背景键、状态、道具层与分支；本包未运行验证'})
   r['checks'].update({'metadata':'通过','decodedPixels':'原PNG与无损WebP全部RGBA像素一致','compositeWhiteBlackDayNight':'四底文件已生成，需视觉记录确认' if composites else '不透明图，不适用四底透明检查'})
   r['pending']+=['A11最终复核','SUI-I正式采用','E演出及读档恢复','Q网页/真机/桌面','发布']
   r['runtimeReady']=False;r['approval']['currentProjectAdopted']=False
   records.append(r);summary.append({'assetId':job['assetId'],'selectedVersion':version,'sourceFile':r['sourceFile'],'file':r['derivativeFile'],'metadata':'pass','losslessRGBAEqual':equal,'alphaComposites':composites,'transform':transform})
   manifest.append({'path':r['sourceFile'],'sha256':sm['sha256']});manifest.append({'path':r['derivativeFile'],'sha256':wm['sha256']})
   job['sourceFile']=r['sourceFile'];job['derivativeFile']=r['derivativeFile'];job['selectedVersion']=version;job['status']='offline-format-checked'
 for start in range(0,len(records),12):
  board=Image.new('RGB',(1280,840),'#202a2e');d=ImageDraw.Draw(board)
  for index,r in enumerate(records[start:start+12]):
   im=Image.open(ROOT/r['sourceFile']).convert('RGBA');base=Image.new('RGBA',im.size,'#c8ceca');base.alpha_composite(im);thumb=ImageOps.contain(base.convert('RGB'),(312,176),Image.Resampling.LANCZOS)
   x=(index%4)*320;y=(index//4)*280;board.paste(thumb,(x+(312-thumb.width)//2,y));d.text((x+3,y+181),r['assetId'].replace('bg-','').replace('prop-','')[:46],fill='white');d.text((x+3,y+199),'v'+str(r['version']),fill='#94c5bb')
  board.save(QA/'sheets'/f'selected-{start//12+1:02d}.jpg',quality=93)
  uiboard=Image.new('RGB',(1280,840),'#202a2e');ud=ImageDraw.Draw(uiboard)
  for index,r in enumerate(records[start:start+12]):
   jobid=r['assetId']+'-v001'
   thumb=ImageOps.contain(Image.open(QA/'ui-composites'/(jobid+'.jpg')),(312,176),Image.Resampling.LANCZOS)
   x=(index%4)*320;y=(index//4)*280;uiboard.paste(thumb,(x,y));ud.text((x+3,y+181),r['assetId'][:46],fill='white')
  uiboard.save(QA/'sheets'/f'ui-{start//12+1:02d}.jpg',quality=93)
 (SOURCE/'resource-records.json').write_text(json.dumps({'schemaVersion':'SUI-A01-review-2','task':'SUI-A08','adoptedCount':0,'records':records},ensure_ascii=False,indent=2)+'\n')
 (QA/'resource-check.json').write_text(json.dumps({'generatedCount':len(records),'plannedCount':len(plan['generation']),'missing':missing,'allPresent':not missing,'formatAndPixelsPass':all(x['losslessRGBAEqual'] for x in summary),'checks':summary,'engine':'未测','browser':'未测','physicalPhone':'未测','desktop':'未测','deployment':'未执行'},ensure_ascii=False,indent=2)+'\n')
 (QA/'output-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 PLAN.write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
 cards=[]
 for r in records:
  path='../../'+r['derivativeFile'];cards.append(f'<article><a href="{html.escape(path)}"><img loading="lazy" src="{html.escape(path)}"></a><p>{html.escape(r["assetId"])} · v{r["version"]}</p><small>{html.escape(r["binding"]["condition"])}</small></article>')
 (QA/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>SUI-A08 场景与道具预览</title><style>body{margin:32px;background:#19262b;color:#e4eee9;font:15px system-ui}h1{font-size:24px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}article{background:#24363b;padding:12px;border-radius:12px}img{width:100%;aspect-ratio:16/9;object-fit:contain;background:#b5bdb8}p{overflow-wrap:anywhere}small{color:#bbd0cb}@media(max-width:900px){main{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><h1>SUI-A08 场景与道具</h1><p>本地素材预览；尚未运行采用。点击图片查看原尺寸WebP。</p><main>'+''.join(cards)+'</main>')
 print(json.dumps({'selected':len(records),'missing':missing,'alphaAssets':sum(bool(x['alphaComposites']) for x in summary),'webpBytes':sum(x['bytes'] for x in records)},ensure_ascii=False))

if __name__=='__main__':main()
