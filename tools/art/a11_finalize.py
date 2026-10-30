#!/usr/bin/env python3
"""Assemble A11 handoff using current measurements and explicitly recorded human/agent visual evidence.
Run after a11_audit.py. Refuses stale or incomplete visual evidence. Does not run the game.
"""
import argparse,csv,hashlib,html,json,pathlib
from collections import Counter
P=argparse.ArgumentParser();P.add_argument('--project',required=True);P.add_argument('--output',required=True);a=P.parse_args()
R=pathlib.Path(a.project).resolve();O=pathlib.Path(a.output).resolve();Q=O/'qa/SUI-A11-20261029';D=O/'assets/sources/20261029/SUI-A11'
def load(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
m=load(Q/'pending-adoption.json');rs=m['records'];s=load(Q/'summary.json')
visual=load(Q/'visual-review-main.json')+load(Q/'visual-review-independent.json');vm={x['assetId']:x for x in visual}
assert len(vm)==87 and len(visual)==87
for r in rs:
 upstream=load(R/r['upstreamRecord']);raw=(upstream if isinstance(upstream,list) else upstream['records'])[r['upstreamRecordIndex']]
 r['upstreamSnapshot']={'recordFile':r['upstreamRecord'],'recordFileSha256':sha(R/r['upstreamRecord']),'recordIndex':r['upstreamRecordIndex'],'record':raw}
 r['requirementKeys']=raw.get('requirementKeys',raw.get('requirements',raw.get('requirementIds',[])))
 r['productionShots']=raw.get('shots',[])
 r['promptOrProcessRecord']=raw.get('promptOrProcessRecord',raw.get('generationRecord',raw.get('prompt')))
 r['exitRule']=raw.get('exitRule',raw.get('binding',{}).get('exitAndRestore'))
 r['criticalSourceRegions']=raw.get('criticalRects',{'face':raw.get('face')})
 r['offlineUIEvidence']=raw.get('offlineUI',raw.get('uiReadingPreview'))
 r['fitPreview']=raw.get('preview')
 r['wardrobeAndForm']=raw.get('wardrobeAndForm',raw.get('wardrobe'))
 r['propState']=raw.get('propState')
 r['runtimeEncodingDecision']=raw.get('runtimeEncodingDecision','PNG兼容候选已备；正式运行未测')
 sm=r['sourceMetadata'];wm=r['webpMetadata']
 if sm['alpha']['range'][0]<255:
  v=vm[r['assetId']];assert v['sourceSha256']==sm['sha256'];assert sha(O/v['sheet'])==v['sheetSha256'];r['checks']['fourBackgroundVisual']=v['result'];r['visualEvidence']=v
  r['offlineStatus']='返修' if v['result']=='返修' else r['formatStatus']
 else:r['offlineStatus']=r['formatStatus']
 r['colorProfileDecision']={'sourceICC':sm['iccSha256'],'webpICC':wm['iccSha256'],'pngCompatibilityICC':r.get('pngCompatibilityMetadata',{}).get('iccSha256'),'action':'A02源PNG无ICC；上游WebP已按sRGB解释嵌入ICC，新PNG复用同一ICC且RGBA不变。无色域测量/像素转换。' if r['package']=='SUI-A02' else '保留原颜色数值和已有ICC；无ICC如实标untagged，未声称完成色域转换/校准。','runtimeColor':'未测'}
 r['importAllowed']=False;r['approvalGate']='reference_only' if r['role']=='reference_only' else 'awaiting_explicit_asset_adoption_approval'
 if r['role']=='reference_only':r['adoptionNote']='仅制作参考；不得据A11格式通过自动进入运行采用队列。'
 else:r['adoptionNote']='格式检查和PNG兼容衍生已备；选型/制作授权不替代逐文件采用批准。I01另记批准后才导入。'
 r['integrationNotes']=[]
 if r['package']=='SUI-A07' and r['assetId']=='wenwen-base':r['integrationNotes'].append('仅CG人物/衣袖参考；默认无第一人称主角常驻立绘。')
 if r['package']=='SUI-A05':r['integrationNotes'].append('人物站姿只供动作/道具参考，尤其第36天正文坐姿不能直接套用；湿绳、包带、衣角结、布袋不可互换。')
 if r['package']=='SUI-A08':
  r['integrationNotes']+=['精确读钟、水印、猫画和文字层限制见qa/SUI-A08-20261029/视觉复核.md。道具参考不等于独立可用透明层。','原尺寸保留；横图用等比contain，完整16:9舞台常为1279×720＋1像素余边，不能拉伸。']
  if 'chengdu' in r['assetId']:r['integrationNotes'].append('成都理发学习图仅远程照片/屏幕参考，不能用作主角亲临背景。')
 if r['package'].startswith('SUI-A10-'):r['integrationNotes']+=['在A09同一段内支持隐藏正文/姓名/菜单查看全图；不得增加剧情页或延长出镜段。CG031读钟须藏菜单。','lifecycle/conditions仍由I/E执行并另验；源图1672×941，1280×720等比contain常为1279×720＋1像素余边。']
 if r['package']=='SUI-A04':r['integrationNotes'].append('第44/56/75天亲密依当时MY07=A；不可倒推只限最终AA。AB之前真实发生，BA不重启。保留上游binding限制。')
dump(Q/'pending-adoption.json',m);dump(Q/'visual-review.json',{'scope':'2026-10-29 A11新生成四底缩览目视，人工/代理判断不由脚本自动生成','records':visual})
# Every original/history file remains isolated; unselected files do not appear as candidates.
inventory=load(Q/'all-source-image-inventory.json');active=set()
for r in rs:active.update([r['sourceFile'],r['existingWebP']])
for x in inventory:x['selectionClass']='current' if x['path'] in active else 'history_comparison_or_upstream_reference_not_adoption_candidate'
dump(Q/'all-source-image-inventory.json',inventory)
anchors={}
for r in rs:
 for x in r['currentAnchors']:
  if x.get('fingerprintDrift'):anchors[(x['path'],str(x.get('upstreamLine')),str(x.get('currentLineMatches')))]=x
s.update({'stage':'A11离线格式、四底检查与交接完成；采用审批/运行未完成','offlineStatuses':dict(Counter(r['offlineStatus'] for r in rs)),'visualStatuses':dict(Counter(x['result'] for x in visual)),'protectedInputCount':len(load(Q/'input-before.json')),'candidatePngBytes':sum(r.get('pngCompatibilityMetadata',{}).get('bytes',0) for r in rs),'anchorDriftUnique':len(anchors),'anchorQuotesMissing':sum(x.get('quotePresent') is False for r in rs for x in r['currentAnchors']),'historicalOrReferenceBitmapFiles':sum(x['selectionClass']!='current' for x in inventory)})
dump(Q/'summary.json',s);dump(Q/'anchor-drift.json',list(anchors.values()))
with (Q/'逐项结果.csv').open('w',newline='',encoding='utf-8-sig') as f:
 w=csv.writer(f);w.writerow(['assetId','包','类别','格式','四底目视','运行','采用审批','源PNG','交付WebP','PNG兼容衍生','限制'])
 for r in rs:w.writerow([r['assetId'],r['package'],r['role'],r['formatStatus'],r['checks']['fourBackgroundVisual'],'未测','待批准/仅参考',r['sourceFile'],r['existingWebP'],r.get('pngCompatibilityMetadata',{}).get('path',''),str(r['usage'])+'；'+'；'.join(r['integrationNotes'])])
# Static review page (no browser execution claimed) links directly to actual source files and new evidence.
def href(path):return '../../'+path
def link(path,label):return '<a href="'+html.escape(href(path),quote=True)+'">'+html.escape(label)+'</a>'
rows=[]
for r in rs:
 files=link(r['sourceFile'],'PNG原件')+' · '+link(r['existingWebP'],'WebP')
 if r.get('pngCompatibilityMetadata'):files+=' · '+link(r['pngCompatibilityMetadata']['path'],'PNG兼容衍生')
 if r.get('fourBackgroundSheet'):files+=' · '+link(r['fourBackgroundSheet'],'本轮四底')
 cells=[html.escape(r['assetId']),html.escape(r['package']), '仅参考' if r['role']=='reference_only' else '待采用审议',r['formatStatus'],r['checks']['fourBackgroundVisual'],'待批准 / 未运行',files]
 rows.append('<tr>'+''.join('<td>'+x+'</td>' for x in cells)+'</tr>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A11资源交接</title><style>body{font:15px system-ui;max-width:1500px;margin:36px auto;padding:0 20px;color:#182c30;background:#f2f5f2}h1{font-size:30px}table{border-collapse:collapse;width:100%;background:white}td,th{padding:10px;border-bottom:1px solid #d4ddd8;text-align:left}th{position:sticky;top:0;background:#d9e6de}input{padding:12px;width:70%;margin:15px 0}a{color:#075b62}td:first-child{font-family:monospace;font-size:12px}small{color:#526667}</style><h1>SUI-A11 格式检查与资源交接</h1><p>242项现行资产：212项待采用审议＋30项仅制作参考。正式采用批准0项；运行采用0项。</p><p>242组无损WebP通过；212份PNG兼容衍生；87项透明图完成本轮四底缩览检查。没有执行游戏/真机/桌面验收。</p><input id="q" placeholder="按编号、包、参考/待采用搜索"><table><thead><tr><th>资源</th><th>包</th><th>用途</th><th>格式</th><th>透明四底</th><th>审批/运行</th><th>文件</th></tr></thead><tbody>'''+''.join(rows)+'''</tbody></table><script>document.querySelector('#q').addEventListener('input',e=>{for(const r of document.querySelectorAll('tbody tr'))r.hidden=!r.textContent.toLowerCase().includes(e.target.value.toLowerCase())})</script></html>'''
(Q/'资源审阅.html').write_text(page)
(D/'README.md').write_text('''# SUI-A11 兼容衍生交付

本目录包含212份PNG兼容候选，保持源尺寸及解码RGBA，不裁透明边、不改alpha、不补偿引擎红蓝通道。A02的11份PNG沿上游WebP已记录的sRGB解释嵌入同一ICC；其他源无ICC时如实保留untagged。

242份现有无损WebP全部实查通过，直接按清单引用原制作目录，不为凑交付重复转码或整包复制。30份制作参考排除在PNG运行衍生范围之外。全部原图、WebP、历史版本仍在原位置。

本目录不是采用库，212份PNG也尚未获运行采用批准。I01须取得逐文件采用批准后，按A11清单与上游条件导入；I02/E/Q另验实际加载、保色、演出、读档和分端呈现。

- [逐项清单](../../../../qa/SUI-A11-20261029/pending-adoption.json)
- [交接](../../../../qa/SUI-A11-20261029/交接.md)
''')
print(json.dumps(s,ensure_ascii=False))
