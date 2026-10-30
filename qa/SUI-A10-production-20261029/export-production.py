# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont, features
import PIL,json,hashlib,html,math,concurrent.futures
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
dec=json.loads((OUT/'visual-decisions.json').read_text());jobs=json.loads((OUT/'jobs.json').read_text());ui=json.loads((ROOT/'system/sui-u/integration.json').read_text())
assert json.loads((OUT/'input-recheck-before-export.json').read_text())['pass']
for name in ['previews','ui-reading','sheets','packages']:(OUT/name).mkdir(exist_ok=True)
fonts=[Path('/System/Library/Fonts/PingFang.ttc'),Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')]
fontpath=next(p for p in fonts if p.exists());font=ImageFont.truetype(str(fontpath),30);small=ImageFont.truetype(str(fontpath),22);label=ImageFont.truetype(str(fontpath),18)
ui_assets=[('message',ui['message']['rect']),('name',ui['name']['rect']),('menu-idle',ui['menuRect'])]
layers=[(name,Image.open(ROOT/'system/sui-u/png'/f'{name}.png').convert('RGBA'),rect) for name,rect in ui_assets]
def wrapped(txt,n=36):return [txt[i:i+n] for i in range(0,len(txt),n)]
def make(j):
 i=j['id'];source=ROOT/dec['selected'][i];im=Image.open(source);im.load();rgba=im.convert('RGBA');gen=json.loads(source.with_suffix('.generation.json').read_text())
 assert sha(source)==gen['sourceSha256'],i
 for r in gen['references']:assert sha(ROOT/r['path'])==r['sha256'],r['path']
 target=source.with_suffix('.webp')
 if not target.exists():im.save(target,'WEBP',lossless=True,quality=100,method=6,exact=True)
 check=Image.open(target);check.load();assert check.format=='WEBP' and check.size==im.size and check.convert('RGBA').tobytes()==rgba.tobytes(),i
 fit=ImageOps.contain(rgba,(1280,720),Image.Resampling.LANCZOS);xy=((1280-fit.width)//2,(720-fit.height)//2)
 canvas=Image.new('RGBA',(1280,720),(0,0,0,255));canvas.alpha_composite(fit,xy);preview=OUT/'previews'/f'{i}.png';canvas.convert('RGB').save(preview)
 reading=canvas.copy()
 for name,layer,rect in layers:reading.alpha_composite(layer,(rect[0],rect[1]))
 d=ImageDraw.Draw(reading);d.text((94,450),'旁白',font=small,fill='#f7f2e8')
 quote=j['shot']['source']['quote']
 for n,line in enumerate(wrapped(quote)[:3]):d.text((84,514+44*n),line,font=font,fill='#f7f2e8')
 reading_path=OUT/'ui-reading'/f'{i}.png';reading.convert('RGB').save(reading_path)
 alpha=rgba.getchannel('A').getextrema()
 rec={'assetId':source.stem.rsplit('-',1)[0],'cgId':i,'kind':'cg','ownerTask':j['package'],'version':gen['version'],'status':'制作包成品；包内视觉/格式及静态UI检查；待A11汇总复核与I采用','runtimeAdopted':False,'sourceFile':str(source.relative_to(ROOT)),'derivativeFile':str(target.relative_to(ROOT)),'sha256Source':sha(source),'sha256Derivative':sha(target),'format':check.format,'width':im.width,'height':im.height,'bytes':target.stat().st_size,'alpha':{'present':'A' in im.getbands(),'range':list(alpha),'expected':'完整CG不透明','pass':alpha==(255,255)},'colorSpace':'RGB；不声明色域实测','encoding':{'tool':'Pillow/libwebp','pillow':PIL.__version__,'libwebp':features.version('webp'),'lossless':True,'quality':100,'method':6,'exact':True},'decodedRGBAEqual':True,'preview':{'path':str(preview.relative_to(ROOT)),'sha256':sha(preview),'canvas':[1280,720],'fitSize':list(fit.size),'offset':list(xy),'process':'等比contain；最多1像素余边补黑；无静默裁切或拉伸'},'uiReadingPreview':str(reading_path.relative_to(ROOT)),'promptOrProcessRecord':str(source.with_suffix('.generation.json').relative_to(ROOT)),'promptFile':str(source.with_suffix('.prompt.txt').relative_to(ROOT)),'generatedOriginal':gen['generatedSource'],'tool':'built-in image_gen','productionReferenceKeys':j['shot']['productionReferenceKeys'],'directReferences':gen['references'],'source':j['shot']['source'],'conditions':j['shot']['conditions'],'lifecycle':j['shot']['lifecycle'],'wardrobeAndForm':j['shot']['wardrobeAndForm'],'propState':j['shot']['propState'],'internalWorkItems':j['shot']['internalWorkItems'],'visualNote':dec['notes'][i],'displayPolicy':'A10-CG-REVEAL-v1','runtimeEncodingDecision':'WebP为交付衍生；当前SDK使用PNG，E接入时确认，不宣称WebP已能运行。'}
 assert rec['alpha']['pass'],i
 return rec
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(make,jobs))
records.sort(key=lambda r:r['cgId'])
dump(OUT/'resource-records.json',{'task':'SUI-A10','selectedCount':len(records),'generatedOriginals':len(records)+len(dec['excluded']),'supersededCount':len(dec['excluded']),'adoptedCount':0,'records':records,'excluded':dec['excluded']})
pkgs=['SUI-A10-COMMON','SUI-A10-XM','SUI-A10-ZZ','SUI-A10-MY','SUI-A10-PI','SUI-A10-HQ','SUI-A10-FR']
for pkg in pkgs:
 rows=[r for r in records if r['ownerTask']==pkg];folder=ROOT/'assets/sources/20261029'/pkg
 dump(folder/'resource-records.json',{'task':pkg,'count':len(rows),'adoptedCount':0,'records':rows})
 for mode,sub in [('full','previews'),('reading','ui-reading')]:
  sheet=Image.new('RGB',(1296,math.ceil(len(rows)/3)*272),(20,24,28));d=ImageDraw.Draw(sheet)
  for n,r in enumerate(rows):
   x=(n%3)*432;y=(n//3)*272;tile=Image.open(OUT/sub/(r['cgId']+'.png')).resize((432,243),Image.Resampling.LANCZOS);sheet.paste(tile,(x,y+29));d.text((x+8,y+5),r['cgId']+' '+r['version'],font=label,fill='white')
  sheet.save(OUT/'sheets'/(pkg+'-'+mode+'.jpg'),quality=94)
 text='# '+pkg+' 制作包\n\n'+str(len(rows))+'镜，均有原PNG、无损WebP、1280×720预览、提示词和来源记录。运行采用0；静态UI合成不等于引擎运行。\n\n| 编号 | 镜头 | 版本 | 原图 | WebP |\n| --- | --- | --- | --- | --- |\n'
 for r in rows:
  j=next(j for j in jobs if j['id']==r['cgId']);text+=f"| {r['cgId']} | {j['title']} | {r['version']} | [PNG](../../../{r['sourceFile']}) | [WebP](../../../{r['derivativeFile']}) |\n"
 text+='\n逐镜条件、单段进退场和回退/读档恢复按[制作登记](../resource-records.json)原样交接；CG全图查看需隐藏遮挡界面，见[展示约定](../display-policy.json)。\n'
 (OUT/'packages'/(pkg+'.md')).write_text(text)
dump(OUT/'format-check.json',{'pass':True,'count':len(records),'webpDecodedRGBAEqual':sum(r['decodedRGBAEqual'] for r in records),'opaque':sum(r['alpha']['pass'] for r in records),'preview1280x720':len(records),'totalWebPBytes':sum(r['bytes'] for r in records),'over2MiB':[r['cgId'] for r in records if r['bytes']>2*1024*1024],'encoding':records[0]['encoding'],'evidence':'本次真实解码及逐像素比较；不包含引擎加载或设备性能测试'})
dump(OUT/'display-policy.json',{'policy':'A10-CG-REVEAL-v1','scope':'A10交接给E的逐镜展示要求；未实现运行绑定','canvas':[1280,720],'artReveal':{'message':'hidden','name':'hidden','menu':'hidden','cg':'full-frame contain','purpose':'无界面遮挡查看整幅动作与道具；文本仍在同一A09段页中阅读，不新增剧情页、选项或时序。'},'reading':{'use':'SUI-U已交付正文/姓名/菜单','messageRect':ui['message']['rect'],'nameRect':ui['name']['rect'],'menuRect':ui['menuRect'],'note':'静态合成已生成；关键物件有遮挡时不得作为唯一观图状态。'},'lifecycle':'A09-ONE-PARAGRAPH-v1 unchanged','loadRollback':'复核原段条件及来源，恢复CG编号、页相位、进入前快照；临时界面显隐由E验证，不改剧情变量。','shots':[{'id':r['cgId'],'source':r['sourceFile'],'fullFrame':r['preview']['path'],'readingOverlay':r['uiReadingPreview'],'displayRequirement':'支持同段隐藏正文/姓名/菜单查看完整CG；离开原段即清CG并恢复原场景'} for r in records],'uiEvidence':{'interfacePath':'system/sui-u/integration.json','interfaceSha256':sha(ROOT/'system/sui-u/integration.json'),'assets':[{'path':'system/sui-u/png/'+n+'.png','sha256':sha(ROOT/'system/sui-u/png'/f'{n}.png'),'rect':rect} for n,rect in ui_assets]}})
cards=[]
for r in records:
 j=next(j for j in jobs if j['id']==r['cgId']);i=r['cgId'];href='../../'+r['sourceFile']
 cards.append(f'''<article data-pkg="{r['ownerTask']}" data-id="{i}"><div class="head"><b>{i} · {html.escape(j['title'])}</b><span>{r['version']} · {r['ownerTask'].replace('SUI-A10-','')}</span></div><a href="{href}" target="_blank"><img loading="lazy" src="previews/{i}.png" data-full="previews/{i}.png" data-reading="ui-reading/{i}.png" alt="{html.escape(j['title'])}"></a><p>{html.escape(r['visualNote'])}</p><details><summary>正文与交接条件</summary><blockquote>{html.escape(r['source']['quote'])}</blockquote><p>{html.escape(json.dumps(r['conditions'],ensure_ascii=False))}</p><p>{html.escape(r['lifecycle']['policy'])}，单段进退场、读档/回退恢复按制作登记。</p><a href="../../{r['derivativeFile']}">WebP</a> · <a href="../../{r['promptOrProcessRecord']}">来源与提示记录</a></details></article>''')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SUI-A10 · 60镜CG制作</title><style>*{box-sizing:border-box}body{margin:0;background:#10191b;color:#e9eeeb;font:16px/1.65 system-ui,sans-serif}header{padding:32px 4vw 22px;background:#182729;position:sticky;top:0;z-index:2;border-bottom:1px solid #365151}h1{font-size:28px;margin:0 0 4px}header p{margin:4px 0;color:#b8c9c6}nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}button,select,input{font:inherit;background:#233b3d;color:#fff;border:1px solid #50716d;border-radius:8px;padding:8px 12px}main{padding:24px 4vw;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px}article{background:#192628;border:1px solid #344b4b;border-radius:10px;overflow:hidden}article .head{padding:12px 16px;display:flex;justify-content:space-between;gap:14px}span{color:#9cb8af;font-size:13px}img{width:100%;height:auto;display:block}article p,details{margin:12px 16px}summary{cursor:pointer;color:#a9d6c7}blockquote{margin:12px 0;padding-left:12px;border-left:2px solid #6c9488;color:#c4cecb}a{color:#aad4c7}footer{padding:20px 4vw 50px;color:#b8c9c6}@media(max-width:850px){main{grid-template-columns:1fr}header{position:static}}</style><header><h1>SUI-A10 · 60镜 / 7包</h1><p>制作包浏览 · 原PNG与无损WebP已保留 · 运行采用0</p><p>可切换实际UI叠层检查遮挡。全图查看需隐藏正文、姓名与菜单；这是离线合成，A11终审、正式接入与运行验收另行进行。</p><nav><select id="pkg"><option value="">全部制作包</option>'''+''.join(f'<option value="{p}">{p.replace("SUI-A10-","")}</option>' for p in pkgs)+'''</select><input id="q" placeholder="查找编号或镜头"><button id="toggle">显示正文框遮挡</button><a href="交接.md">交接记录</a> · <a href="resource-records.json">完整登记</a><span id="count">60 / 60</span></nav></header><main>'''+''.join(cards)+'''</main><footer>原文分支及A09单段进退场约定保留；未绑定图鉴，未修改玩家存档，未发布。</footer><script>const pkg=document.getElementById('pkg'),q=document.getElementById('q'),cards=[...document.querySelectorAll('article')];function filter(){let n=0;cards.forEach(c=>{const ok=(!pkg.value||c.dataset.pkg===pkg.value)&&c.textContent.toLowerCase().includes(q.value.toLowerCase());c.hidden=!ok;if(ok)n++});document.getElementById('count').textContent=n+' / 60'}pkg.onchange=filter;q.oninput=filter;let reading=false;document.getElementById('toggle').onclick=function(){reading=!reading;document.querySelectorAll('img').forEach(im=>im.src=reading?im.dataset.reading:im.dataset.full);this.textContent=reading?'显示完整CG':'显示正文框遮挡'}</script></html>'''
(OUT/'CG总览.html').write_text(page)
print(json.dumps({'selected':len(records),'packages':len(pkgs),'originals':len(records)+len(dec['excluded']),'webpBytes':sum(r['bytes'] for r in records),'gallery':str((OUT/'CG总览.html').relative_to(ROOT))},ensure_ascii=False))
