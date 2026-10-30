# -*- coding: utf-8 -*-
"""将本轮人工视觉复核结论附到离线资源记录；不表示运行采用。"""
from pathlib import Path
import hashlib, html, json, re

ROOT=Path(__file__).resolve().parents[2]
QA=Path(__file__).resolve().parent
SOURCE=ROOT/'assets/sources/20261029/SUI-A08'
def read(p):return json.loads(p.read_text())
def save(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
plan=read(QA/'production-plan.json')
package=read(SOURCE/'resource-records.json')
records=package['records']
routes=read(ROOT/'scenario/routes.json')['routes']
route_files={'scenario/'+r['file']:r['id'] for r in routes}
limits={
 'bg-huisheng-306':'全景仅辨认普通指针停钟；小钟的分钟刻度不得作为精确读时画面。11:47语句使用已校对的独立停钟近景。右上菜单与钟面重叠，读钟时隐藏菜单；清空水印位于正文框后，观察该细节时须暂隐正文框。',
 'prop-huisheng-stopped-clock':'采用v002普通指针钟；v001电子钟排除。近景需在上方安全区独立等比摆放，不能沿用本包满高QA试摆。',
 'prop-netcafe-fast-clock':'外形参考与回声停钟不同。当前针位不是全路线固定时刻；快十分钟须按对应正文实际时刻表现，不从本参考推断日期或时间。',
 'prop-netcafe-cat-drawing':'本项为不透明场景内参考。最终原图与冲印照统一取自FR转手全露猫画源图；裁切指引另见component-usage.json，不重新生成另一只猫。',
 'bg-chengdu-salon-study':'仅远程学习照片内画面；不表示文文到成都；个人剪刀、练习本归A02。',
 'bg-huangqiuqiu-room':'桌上普通小球是道具，不是黄球球角色。两种形态共用房间；不得将背景小球当作角色在场状态。',
 'bg-old-netcafe-yard':'只引用HQ已获准短出院分支；无公开人群。透明角色另层进入退出，不增加公开通行。',
 'bg-mengyao-guiyang-home':'孟遥独租住处，不是文文贵阳旧房；不表示离婚。秘密关系仅MY07-01=A且MY09-01=A继续；BA不重启亲密。',
 'bg-zhouzhi-bijie-home':'夜间/清晨室内只用于ZZ06-01=A；B留在门外。',
 'bg-zhouzhi-guiyang-home':'留宿相关画面只用于ZZ06-01=A且ZZ08-01=A。',
 'bg-old-netcafe-milk-tea':'旧网吧变奶茶店仅朋友线第91天；不可套到其他路线。',
 'bg-old-netcafe-counter':'FR清理及转手仅朋友线相应日序；其他路线不自动换店。',
 'prop-transport-packing':'按搬运镜头取用；不表示孟遥与文文同居搬家。',
 'prop-huisheng-sales':'单据保持空白，金额/付款状态用文本演出；不从背景虚构已付款。',
 'prop-salon-fixed':'价目表留空，正确价格由文本层提供；个人工具归A02。',
 'prop-shared-food-boxes':'餐具与纸箱随镜头取用，不替代人物专属杯与资料箱；外卖温度、剩余食物与时序由E核对。',
}
review=[]
for i,r in enumerate(records):
 req=r['characterOrSceneKey'];j=next(j for j in plan['generation'] if j['assetId']==r['assetId']+'-v001')
 r['binding']['routeIds']=sorted({route_files[a['path']] for a in r['storyAnchors'] if a['path'] in route_files})
 r['binding']['sceneNodeIds']=sorted({re.sub(r'^<!-- NODE | -->$','',a['nearestNode']) for a in r['storyAnchors'] if a.get('nearestNode')})
 note=limits.get(req,'背景仅提供场所；人物、手持道具、可读文字与具体动作由独立层逐拍绑定。')
 if r['kind']=='shared-prop':note+=' 本项为道具参考，需按实际镜头等比缩放/摆放；QA满画布试摆不是最终落点。'
 r['binding']['condition']+='；'+note
 r['checks']['visual']='制作视觉检查完成：原件生成回看、8张全量联系表及关键返修原图；逐镜限制见binding与视觉复核'
 r['checks']['compositeWhiteBlackDayNight']='通过：四底缩放合成已实际目视，无明显白边、黑底残留或断裂' if r['alpha']['present'] and r['alpha']['range'][0]<255 else '不透明图，不适用透明四底检查'
 r['checks']['staticUI']='已目视8张全量UI联系表；原GUI正文框叠加，姓名与菜单矩形作保守遮挡；逐镜演出未验'
 r['approval']['appearanceEvidence']=['用户本轮请求完成SUI-A08；授权制作，不视为最终采用批准']
 r['approval']['imageEvidence']=['qa/SUI-A08-20261029/visual-review.json']
 r['usageNotes']=[note]
 r['pending']=[x for x in r['pending'] if '首张' not in x]
 if req=='bg-old-netcafe-counter' and j['state']=='day':r['usageNotes'].append('首张母图基础提示词已补录，补充措辞未完整持久化；生成器原始PNG与项目副本SHA-256相同。')
 r['referenceOnly']=r['kind']=='shared-prop'
 if r['referenceOnly'] and r['alpha']['bbox']:r['placement']['criticalRect']=r['alpha']['bbox']
 review.append({'assetId':r['assetId'],'version':r['version'],'sourceFile':r['sourceFile'],'sha256':r['sha256Source'],'visual':'制作层通过；采用前核对逐镜限制','contactSheet':f'sheets/selected-{i//12+1:02d}.jpg','uiSheet':f'sheets/ui-{i//12+1:02d}.jpg','alphaReview':r['checks']['compositeWhiteBlackDayNight'],'usageNotes':r['usageNotes']})
 j['status']='制作完成；离线检查完成；待复核采用'
save(SOURCE/'resource-records.json',package)
for c in plan['coverage']:
 c['status']='制作完成；包内检查完成；待A11/I'
 c['deliveredFiles']=[r['derivativeFile'] for r in records if c['requirementId'] in r['requirementKeys']]
 if not c['deliveredFiles']:
  c['deliveredFiles']=[r['derivativeFile'] for r in records if r['characterOrSceneKey'] in c['embeddedIn']]
 c['usageNotes']=[limits[c['requirementId']]] if c['requirementId'] in limits else []
 assert c['deliveredFiles'],c['requirementId']
plan['status']='SUI-A08制作与包内离线检查完成；待A11复核及SUI-I采用'
plan['notTested']=['A11独立最终复核','SUI-I正式采用与逐镜演出绑定','引擎加载/回退/存档恢复','浏览器/手机真机/桌面','发布']
plan['summary']['selectedOutputs']=len(records)
plan['summary']['preservedPNGIncludingRevisions']=len(list(SOURCE.rglob('*.png')))
plan['summary']['historicalCandidatesAudited']=55
plan['summary']['historicalCopied']=0
save(QA/'production-plan.json',plan)
save(QA/'visual-review.json',{'date':'2026-10-29','scope':'制作层审阅，不是用户采用批准；没有引擎运行','method':['生成结果回看与关键返修原件','selected-01至08全量联系表','ui-01至08全量静态GUI遮挡联系表','8张透明道具四底合成','关键物件原尺寸目视'], 'count':len(review),'records':review,'remainingProductionRepairs':[],'runtimeUnverified':True,'uiLimitations':'回声钟面需近景及菜单隐藏；水印观察须暂隐正文框；透明参考的满高试摆不可直接运行。'})
save(QA/'selection-review-notes.json',{'excluded':[{'file':'bg-huisheng-306-operating-night-v002.png','reason':'电子钟不符原文秒针'},{'file':'prop-huisheng-stopped-clock-1147-reference-v001.png','reason':'电子钟不符原文秒针'}],'selectedRevisions':[{'assetId':r['assetId'],'version':r['version']} for r in records if r['version']>1],'repairRequired':[],'notAnAdoptionApproval':True})
cat=next(r for r in records if r['assetId']=='bg-old-netcafe-counter-fr-handover-day')
save(QA/'component-usage.json',{'catPhoto':{'masterSource':cat['sourceFile'],'masterSHA256':cat['sha256Source'],'sourceRect':[1148,144,245,290],'coordinateBasis':'原图1672×941像素，左上原点，[x,y,width,height]','use':'FR60拍照及FR91冲印照使用同一来源矩形；矩形含完整耳朵、身体及裂墙。可以等比显示或印在空白照片框内，不重新生成猫。','notStandaloneCutout':True},'stoppedClock':{'canonical':'prop-huisheng-stopped-clock-1147-reference-v002.png','readTime':'11:47；普通指针，红秒针静止','roomWideShot':'远景针位只作外形参考，读时必须使用该独立近景'},'runtimeEncoding':'当前SDK WebP问题仍未解决；本包无损WebP是交接衍生，原PNG保留，实际运行兼容图由A11/I按SUI-T复核。'})
before=read(QA/'input-before.json');after=[]
for item in before:
 f=ROOT/item['path'];digest=sha(f) if f.exists() else None
 after.append({**item,'sha256After':digest,'unchanged':digest==item['sha256'],'changeExpectedByThisTask':item['path']=='TODO-v1.1.md'})
historical=read(QA/'historical-audit.json')
old_checks=[{'path':r['path'],'unchanged':sha(Path(r['path']))==r['sha256']} for r in historical]
save(QA/'input-preservation.json',{'checks':after,'scenarioUnchanged':all(r['unchanged'] for r in after if r['path'].startswith('scenario/')),'historicalOriginals':old_checks,'historicalUnchanged':all(r['unchanged'] for r in old_checks),'observedOtherChanges':[r['path'] for r in after if not r['unchanged'] and not r['changeExpectedByThisTask']],'review':'本任务没有编辑正文；制作期间4份正文及2份项目计划更新。根TODO文字修正记录列明4份正文改动。收尾按当前内容重查129条原句全部仍匹配，22处行号迁移；本包更新锚点及指纹，保留初始证据，不回退其他修改。'})
states={'day':'白天','night':'夜间','day-rain':'白天·雨','day-overcast':'阴天','dusk':'黄昏','morning':'清晨','afternoon':'午后','evening':'傍晚','cleared-day':'停业清空','operating-night':'营业夜景','operating-day':'营业日景','locked-day':'锁门停业','fr-clearing-day':'朋友线·清理','fr-handover-day':'朋友线·转手','door-ajar-night':'夜间·门留缝','door-open-afternoon':'午后·门开','door-closed-morning':'清晨·门关','table-close-day':'矮桌近景','day91-mirror':'第91天·镜前','inside-day':'白天·车内','stop-day':'白天·站台','setup-day':'白天·备摊','service-night':'夜间·出摊','closing-night':'夜间·收摊'}
cards=[]
for r in records:
 c=next(c for c in plan['coverage'] if c['requirementId']==r['characterOrSceneKey'])
 j=next(j for j in plan['generation'] if j['assetId']==r['assetId']+'-v001')
 title=c['name']+' · '+states.get(j['state'],'道具参考' if r['kind']=='shared-prop' else '场景参考')
 cards.append(f'<article><a href="../../{html.escape(r["derivativeFile"])}"><img loading="lazy" src="../../{html.escape(r["derivativeFile"])}" alt="{html.escape(title)}"></a><h2>{html.escape(title)}</h2><p>第{r["version"]}版 · '+('道具参考' if r['referenceOnly'] else '背景')+f'</p><a href="../../{html.escape(r["sourceFile"])}">PNG原稿</a> · <a href="ui-composites/{r["assetId"]}-v001.jpg">界面遮挡对照</a><details><summary>使用说明</summary><p>{html.escape(r["binding"]["condition"])}</p><small>{html.escape(r["assetId"])}</small></details></article>')
(QA/'index.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SUI-A08 场景与道具预览</title><style>body{margin:32px;background:#19262b;color:#e4eee9;font:15px system-ui;line-height:1.6}h1{font-size:26px}h2{font-size:17px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}article{background:#24363b;padding:14px;border-radius:12px}img{width:100%;aspect-ratio:16/9;object-fit:contain;background:#b5bdb8}p,small{overflow-wrap:anywhere}small{color:#bbd0cb}a{color:#a9d8ca}details{margin-top:12px}summary{cursor:pointer}@media(max-width:900px){body{margin:16px}main{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><h1>SUI-A08 场景与道具</h1><p>76张背景与10项道具参考，覆盖58项需求。内置生图制作，制作层检查完成，尚未接入游戏。点击图片查看原尺寸。</p><p><a href="交接.md">交接说明</a> · <a href="视觉复核.md">检查与展示限制</a></p><main>'+''.join(cards)+'</main></html>')
print(json.dumps({'selected':len(records),'coverage':len(plan['coverage']),'preservedPNG':len(list(SOURCE.rglob('*.png'))),'scenarioUnchanged':all(r['unchanged'] for r in after if r['path'].startswith('scenario/')),'unexpectedChanges':[r['path'] for r in after if not r['unchanged'] and not r['changeExpectedByThisTask']]},ensure_ascii=False))
