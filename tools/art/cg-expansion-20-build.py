"""CG110～129本批无损转码、离线预览与计划绑定交付。封存后不再重跑本批。"""
import hashlib, html, json, os
from collections import Counter
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, features

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'assets/sources/20261103/CG-expansion-20'
DOC=ROOT/'docs/修订协作/P4-演出与美术/CG扩充20张'
QA=ROOT/'qa/cg-expansion-20-20261103'
BASE=DOC.parent/'P4-01'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p):return str(p.relative_to(ROOT))
def fp(p):return {'path':rel(p),'sha256':sha(p),'bytes':p.stat().st_size}
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(v if isinstance(v,str) else json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def href(p):return html.escape(os.path.relpath(p,QA))
prompts=read(SRC/'prompts.json')
nodes={n['nodeId']:n for n in read(BASE/'node-map.json')['nodes']}
existing=read(DOC.parent/'P4-04/cg-review.json')['records']
old_nodes={n for r in existing for n in r['proposedNodeIds']}
old_ids={r['cgId'] for r in existing}
selection=read(ROOT/'docs/CG当前选择.json')
protected=read(QA/'protected-inputs.json')
for f in protected:assert sha(ROOT/f['path'])==f['sha256'],f['path']
assert len(prompts)==20 and len({r['cgId'] for r in prompts})==20
assert {r['cgId'] for r in prompts}=={f'CG{i}' for i in range(110,130)}
assert not old_ids&{r['cgId'] for r in prompts}
assert not set(selection['retiredRouteIds'])&{r['cgId'] for r in prompts}
fontpath=ROOT/'system/font/NotoSansCJK-Medium.ttc'
font=ImageFont.truetype(str(fontpath),30)
small=ImageFont.truetype(str(fontpath),22)
config=read(ROOT/'system/sui-u/config.patch.json')
msg=Image.open(ROOT/config['msgbox.image']).convert('RGBA')
namebox=Image.open(ROOT/config['namebox.image']).convert('RGBA')
notes={
 'CG110':'三把钥匙与通知袋；底部两把钥匙需查看全图。',
 'CG111':'独自读通知，纸面朝向角色，无虚构日期金额；纸张下部需全图。',
 'CG112':'小满裙装与文文合照；拍摄者在画外，未变成自拍。背后轻掐细节由正文补足。',
 'CG113':'小满与行李箱；车票仅露一角，不承担文字阅读；须查看全图确认票与剪刀包。',
 'CG114':'文文与新人理发师，镜中反射合理，小满不在场。',
 'CG115':'两半大小不同的烧饼，两个面碗，递饼动作清楚。',
 'CG116':'周栀与阿英搬箱，关闭卷帘门；按正文营业结束后的夜景。02旧候选底图为阴天街道，接入时须一起核准退出底层时段。',
 'CG117':'清晨台阶、豆浆与保持距离的两人；没有把普通对话画成复合。',
 'CG118':'教室讨论入职材料；两项收入区与折角，文字不作可读承诺。',
 'CG119':'贴单和垫箱角，书箱与虚化同事；未加入相机或亲密动作。',
 'CG120':'借书放前台，两人保持距离；MY07=B，BA也不重启亲密。',
 'CG121':'HIGH短住房安排，文文记录、飘确认；未把地址具体化为新剧情。',
 'CG122':'作为收到的照片显示，两本册子、一杯、一纸片；无现场人物。见面时间由正文解释，不从模糊纸片读数。',
 'CG123':'LOW朋友结局，毛狼与飘对日程，大片空白；文文未被画成恋人。',
 'CG124':'采用v002，刀切面已换成剥开的橘瓣；球形、蓝凳与调收音机动作保留。',
 'CG125':'采用v002，门内电脑已移除并恢复生活房间；黄球球仍为球形，位于门槛内。',
 'CG126':'仅作最后告别的回忆CG；人形眼贴、项圈、外套保留，杯子包好交还；不把当前电台声变成再次见面。',
 'CG127':'师匠拨钟，文文旁观，人物身份正确；不是回声那只停钟。',
 'CG128':'三张点卡与拍照手机，毛狼不在场；手机反射中的三卡不是额外实物。',
 'CG129':'文文扶板、师匠拆螺丝，墙上猫图案被遮住；未加毛狼或真猫。文文一手扶板一手搭肩，属于画面演绎，最终采用时复核。',
}
resources=[];plans=[];cards=[];summary=[]
for p in prompts:
 cid=p['cgId'];n=nodes[p['anchor']['nodeId']]
 assert n['op']=='text' and n['nodeId'] not in old_nodes
 assert p['anchor']['condition']==n['condition'] and p['anchor']['source']==n['source']
 assert p['anchor']['routeIds']==n['routeIds'] and p['anchor']['entryGate']==n['entryGate']
 assert p['text']==n['page']['text']
 candidate=ROOT/n['source']['candidateFile']
 assert p['text'] in candidate.read_text(),cid+'正文锚点失效'
 version='v002' if cid in ['CG124','CG125'] else 'v001'
 source=SRC/cid/(cid.lower()+'-'+version+'.png')
 runtime=source.with_suffix('.webp')
 with Image.open(source) as im:
  im.load();assert im.format=='PNG' and im.width>im.height
  assert abs(im.width/im.height-16/9)<0.005
  assert im.getexif().get(274) in (None,1)
  rgb=im.convert('RGB');size=im.size;srcmode=im.mode
  rgb.save(runtime,'WEBP',lossless=True,method=6,exact=True)
 with Image.open(runtime) as im:
  im.load();assert im.format=='WEBP' and im.size==size
  assert im.convert('RGB').tobytes()==rgb.tobytes(),cid+'无损像素不一致'
 scale=1280/size[0]
 full=Image.new('RGBA',(1280,720),'#171c1d')
 full.alpha_composite(rgb.convert('RGBA').resize((1280,round(size[1]*scale)),Image.Resampling.LANCZOS),(0,0))
 overlay=full.copy();overlay.alpha_composite(msg,(int(config['msgbox.x']),int(config['msgbox.y'])))
 d=ImageDraw.Draw(overlay)
 if n['textMeta']['displayName']:
  overlay.alpha_composite(namebox,(int(config['namebox.x']),int(config['namebox.y'])))
  d.text((92,450),n['textMeta']['displayName'],font=small,fill='#a9d0c3')
 lines=[];line=''
 for ch in p['text']:
  if ch=='\n' or d.textlength(line+ch,font=font)>msg.width-72:
   lines.append(line);line='' if ch=='\n' else ch
  else:line+=ch
 if line:lines.append(line)
 assert len(lines)<=3,(cid,lines)
 for i,line in enumerate(lines):d.text((84,514+i*44),line,font=font,fill='#eeeae0')
 d.rounded_rectangle((52,24,350,76),radius=12,fill='#172b29')
 d.text((68,35),'查看全图 · V / 点击',font=small,fill='#d2e8df')
 fullpath=QA/'previews'/f'{cid}-full.webp';overpath=QA/'previews'/f'{cid}-overlay.webp'
 fullpath.parent.mkdir(exist_ok=True)
 full.convert('RGB').save(fullpath,'WEBP',lossless=True,method=4)
 overlay.convert('RGB').save(overpath,'WEBP',lossless=True,method=4)
 record={'cgId':cid,'assetId':p['assetId'],'title':p['title'],'packageId':p['packageId'],
  'status':'produced-planned-binding','version':version,'source':fp(source),'runtimeCandidate':fp(runtime),
  'plannedRuntimePath':f'assets/current/CG-expansion-20/{p["assetId"]}.webp',
  'width':size[0],'height':size[1],'sourceMode':srcmode,'runtimeFormat':'WEBP','alpha':False,
  'encoding':{'lossless':True,'method':6,'exact':True,'libwebp':features.version('webp')},
  'decodedPixelsEqual':True,'generationTool':'built-in image_gen','promptRecord':rel(SRC/'prompts.json'),
  'references':[fp(Path(x)) for x in p['references']],
  'review':{'fullImage':'reviewed-in-generation-session','note':notes[cid],'P4-05':'pending','runtime':'not-tested'},
  'previews':{'full':fp(fullpath),'overlay':fp(overpath)}}
 resources.append(record)
 basebinding=next(x['binding'] for x in read(DOC.parent/p['packageId']/'bindings.candidate.json')['bindings'] if x['nodeId']==n['nodeId'])
 assert not basebinding['cgId'] and basebinding['enter']['cg'] is None
 mode='received-photo' if cid=='CG122' else 'recollection' if cid=='CG126' else 'scene'
 restrictions=[notes[cid],'仅本节点一拍显示；不跨页延续，不改正文、选择或结局。','进入、读档、回退均重验本节点条件和路线入口，先清除旧CG。','下一目标由控制流决定，清除CG和全图状态后重建目标页完整画面。']
 plan={'cgId':cid,'assetId':p['assetId'],'title':p['title'],'packageId':p['packageId'],
  'status':'planned-not-applied','readyForBinding':False,'proposedNodeIds':[n['nodeId']],
  'anchor':p['anchor'],'text':p['text'],'depictionMode':mode,
  'plannedEnter':{'cg':{'assetId':p['assetId'],'layer':'cg','x':0,'y':0,'scale':scale},'fullView':True},
  'plannedExit':{'at':'next-node','clearCg':True,'fullView':False,'destination':'recompute-actual-target','lexicalNextNodeId':n['lexicalNextNodeId']},
  'unlock':'on-actual-first-visible-frame','baseBinding':basebinding,
  'restrictions':restrictions,
  'dependencies':['P4-02接受锚点及进入退出底层','P4-05独立资源复验','P4-06图鉴扩至81项及提示/解锁/存档检查','P4-07统一正式采用','P5运行验收']}
 plans.append(plan)
 cards.append(f'<article data-pack="{p["packageId"]}"><h2>{cid} · {html.escape(p["title"])}</h2><p>{html.escape(p["packageId"])} · 计划绑定 · {html.escape(n["nodeId"])}</p><a href="{href(runtime)}"><img loading="lazy" src="previews/{cid}-full.webp" alt="{html.escape(p["title"])}完整图"></a><details><summary>文字框遮挡预览</summary><img loading="lazy" src="previews/{cid}-overlay.webp" alt="文字框预览"></details><p>{html.escape(notes[cid])}</p><blockquote>{html.escape(p["text"])}</blockquote><details><summary>条件及来源</summary><p>{html.escape(n["condition"])}</p><p>{html.escape(n["source"]["candidateFile"])}</p></details></article>')
 summary.append(f'| {cid} | {p["title"]} | {p["packageId"].replace("P4-02-","")} | `{n["nodeId"]}` | `{n["condition"]}` |')

assert Counter(p['packageId'] for p in plans)==Counter({'P4-02-COMMON':2,**{'P4-02-'+p:3 for p in ['XM','ZZ','MY','PI','HQ','FR']}})
byid={p['cgId']:p for p in plans}
assert byid['CG120']['anchor']['condition']=='MY07-01=B'
assert byid['CG122']['anchor']['condition']=='PIAO_RELATION=HIGH&PI06-01=A&PI08-01=A'
assert byid['CG123']['anchor']['condition']=='PIAO_RELATION=LOW&PI-L06-01=B'
assert byid['CG126']['anchor']['condition']=='HQ07-01=B|HQ08-01=B'
assert all(p['anchor']['entryGate']==nodes[p['anchor']['nodeId']]['entryGate'] for p in plans)
env={'schemaVersion':'cg-expansion-plan-v1','batch':'CG-expansion-20-20261103','completedOn':'2026-11-04',
 'inputFingerprint':read(BASE/'resources.baseline.json')['inputFingerprint'],
 'contentBuildId':read(BASE/'input-manifest.json')['contentBuildId'],'status':'produced-planned-binding','runtimeAdoptedCount':0}
write(SRC/'resource-records.json',{**env,'records':resources})
write(DOC/'binding-plans.json',{**env,'records':plans})
write(DOC/'cg-registration.json',{**env,'previousFormalCount':60,'previousP4CandidateCount':61,'newCount':20,'candidateTotal':81,
 'newRegistrations':[{'cgId':p['cgId'],'assetId':p['assetId'],'title':p['title'],'packageId':p['packageId']} for p in plans],
 'nextUnallocatedId':'CG130','retiredIds':selection['retiredRouteIds'],'rule':'CG110～129为本批新增，不复用退役编号；合并采用后图鉴为81项，当前正式仍60项。'})
write(QA/'index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>新增20张CG</title><style>body{margin:0;background:#182321;color:#eeeae0;font:16px/1.65 system-ui,sans-serif}header,main{max-width:1500px;margin:auto;padding:28px}h1{font-size:30px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(430px,1fr));gap:24px}article{padding:20px;background:#243430;border:1px solid #496158;border-radius:12px}h2{font-size:20px}img{display:block;width:100%;height:auto;border-radius:6px}p,blockquote{overflow-wrap:anywhere}blockquote{border-left:3px solid #90b5a5;padding-left:16px;margin-left:0;color:#ccdbd2}summary{cursor:pointer;color:#bad6c8}a{color:#c0dfd3}@media(max-width:500px){main{grid-template-columns:1fr;padding:12px}header{padding:20px}}</style><header><h1>新增20张CG · CG110—CG129</h1><p>共通2张；罗小满、周栀、孟遥、飘、黄球球、朋友与职业各3张。图片完成，均为计划绑定，尚未进入正式运行包。</p><p>点击完整图查看原尺寸WebP；展开查看文字框遮挡。深色全图提示底板仅为预览示意，须P4-06实现并验收。</p></header><main>'+''.join(cards)+'</main></html>')
for group in range(4):
 sheet=Image.new('RGB',(1280,950),'#182321');draw=ImageDraw.Draw(sheet)
 for i,p in enumerate(prompts[group*5:group*5+5]):
  im=Image.open(QA/'previews'/f'{p["cgId"]}-overlay.webp').convert('RGB').resize((640,360),Image.Resampling.LANCZOS)
  # 三行，每格缩为640×300；保持图像16:9，实际显示480×270。
  im.thumbnail((600,270));x=(i%2)*640;y=(i//2)*310
  sheet.paste(im,(x+(640-im.width)//2,y+35));draw.text((x+20,y+3),p['cgId']+' '+p['title'],font=small,fill='#eeeae0')
 sheet.save(QA/f'overlay-sheet-{group+1}.jpg',quality=92)
sheet=Image.new('RGB',(1600,5*255),'#182321');draw=ImageDraw.Draw(sheet)
for i,p in enumerate(prompts):
 im=Image.open(QA/'previews'/f'{p["cgId"]}-full.webp').convert('RGB');im.thumbnail((396,223))
 x=(i%4)*400;y=(i//4)*255;sheet.paste(im,(x,y+30));draw.text((x+8,y+1),p['cgId']+' '+p['title'],font=ImageFont.truetype(str(fontpath),16),fill='#eeeae0')
sheet.save(QA/'总览.jpg',quality=94)
write(DOC/'镜头清单.md','# 新增20张CG与绑定计划\n\n2026-11-04收尾，沿用20261103批次目录。用户要求约20张；本次实际新增20张。\n\n[完整图与文字框预览](../../../../qa/cg-expansion-20-20261103/index.html) · [机器绑定计划](binding-plans.json) · [编号登记](cg-registration.json) · [图片/指纹/来源](../../../../assets/sources/20261103/CG-expansion-20/resource-records.json) · [完整提示集](../../../../assets/sources/20261103/CG-expansion-20/prompts.json)\n\n| 编号 | 镜头 | 包 | P4冻结节点 | 条件（仍须路线入口） |\n| --- | --- | --- | --- | --- |\n'+'\n'.join(summary)+'\n\n以上20项均为计划绑定。来源是P4-01冻结的P3候选节点，未将候选混入正式scenario。每项含原文、条件、路线、entryGate、进入/退出与读档重建约定，保留当前底层候选供P4-02复核；不是已执行的binding。ALL只表示本段无额外分支条件，不解除所在路线入口。\n\nCG122是收到的照片；CG126是回忆。CG120仅MY07=B；CG123仅飘LOW朋友结局。CG124/125仅球形时段，CG126保持人形。CG116依据营业结束后正文采用夜景，旧02底图的时段需随接入修正。CG129文文一手扶板一手搭肩是本镜演绎，最终采用时复核。\n\nP4-02接受锚点并核底层 → P4-05独立复验 → P4-06图鉴81项与可见帧解锁/全图入口 → P4-07采用 → P5运行。已有61项候选加本批20项为81项，当前正式60项未变。下一未分配编号CG130。\n')
write(QA/'verification.json',{**env,'status':'passed-offline','checks':{'newCgCount':20,'originalPngCount':22,'selectedPngCount':20,'losslessWebPCount':20,'pixelEqualPairs':20,'fullPreviews':20,'overlayPreviews':20,'uniqueNodeAnchors':20,'existingCgConflicts':0,'retiredIdReuse':0,'sourceTextMatches':20,'conditionRouteGateMatches':20,'protectedFilesUnchanged':len({x['path'] for x in protected})},
 'visualReviewRecord':'visual-review.json','scope':'资源解码、无损像素、节点/条件/入口/文字和冻结输入；目视另记，未做引擎、游戏浏览器、手机、桌面、发布验收。'})
print('20张无损WebP、40张预览、20项计划完成；受保护输入全部保持。')
