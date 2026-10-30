"""按用户本轮委托补选8镜；旧QA与原选择快照保持只读。"""
from pathlib import Path
import json,hashlib,copy
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
REL='qa/SUI-A09-selection-20261029'
def load(p): return json.loads((ROOT/p).read_text())
def write(p,d): (ROOT/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
before=load(REL+'/selection-before.json')
review=load('qa/SUI-A09-20261029/review.json')
candidates=[r for r in review['shots'] if r['kind']=='replacement-candidate']
assert len(candidates)==8
mapping={r['id']:f'CG{101+i:03d}' for i,r in enumerate(candidates)}
assert not set(mapping.values())&{r['id'] for r in before['items']}
for row in review['shots']:
    assert sha(row['source']['path'])==row['source']['sourceSha256'],row['id']+'正文变化，须先复核'
decision={'task':'SUI-A09补选集成','date':'2026-10-29',
 'authorization':{'type':'user-delegated-selection','userMessage':'补充你觉的需要加入的CG',
  'interpretation':'用户授权助手判断并补充；本次采纳此前已交付的8项候选，恢复原60项选择目标，不代表用户逐图审批了尚未制作的画面。'},
 'scope':'确认选择和正式编号，合并制作归属及图鉴空槽；不生成图片、不绑定演出、不发布',
 'choices':[{'candidateId':r['id'],'id':mapping[r['id']],'title':r['title'],'reason':r['rationale'],
             'package':r['production']['package']} for r in candidates],
 'selectionCountBefore':52,'selectionCountAfter':60,'retiredIdsUnchanged':before['retiredRouteIds'],
 'productionApproved':False,'runtimeArtAdopted':False}
write(REL+'/selection-decision.json',decision)
current=copy.deepcopy(before)
current.update({'schemaVersion':2,'revision':'suika3-cg-selection-60-20261029',
 'retainedOriginalCount':52,'approvedAdditionalIds':list(mapping.values()),
 'activeSelectedIds':before['activeSelectedIds']+list(mapping.values()),'activeCount':60,
 'replacementCountToDecide':0,'productionReady':False,
 'currentReview':REL+'/review-approved.json',
 'selectionDecision':{'path':REL+'/selection-decision.json','sha256':sha(REL+'/selection-decision.json')},
 'previousSelection':{'path':REL+'/selection-before.json','sha256':sha(REL+'/selection-before.json')},
 'sourceSemantics':'original*字段及原60项的originalSources保留历史事实；当前60镜锚点、条件和制作前置以currentReview为准。选中不等于制作放行。'})
route_names={'COMMON':'共通/跨路线','XM':'罗小满','ZZ':'周栀','MY':'孟遥','PI':'飘','HQ':'黄球球','FR':'朋友与职业'}
for row in candidates:
    current['items'].append({'id':mapping[row['id']],'title':row['title'],'route':route_names[row['routeGroup']],
      'routeKey':row['routeGroup'],'selectionOrigin':'SUI-A09-delegated-addition',
      'candidateId':row['id'],'status':'用户委托助手补选已落实；待镜头制作前置复核','productionReady':False,
      'currentSources':[{'path':row['source']['path'],'line':row['source']['line'],
          'anchor':row['source']['matchText'],'sha256':row['source']['sourceSha256'],'paragraphId':row['source']['paragraph']}],
      'conditions':row['conditions'],'productionPackage':row['production']['package'],
      'decisionRecord':REL+'/selection-decision.json'})
write('docs/CG当前选择.json',current)
approved=copy.deepcopy(review)
approved.update({'schemaVersion':2,'revision':'sui-a09-selected-60-20261029',
 'scope':'52项保留选择＋8项用户委托助手补选；60镜内容已审，制作前置仍待核，非最终美术采用或运行绑定',
 'inputSelection':{'path':'docs/CG当前选择.json','sha256':sha('docs/CG当前选择.json'),'activeCount':60},
 'replacementIdsAreProvisional':False,'selectionDecision':REL+'/selection-decision.json',
 'priorReview':{'path':'qa/SUI-A09-20261029/review.json','sha256':sha('qa/SUI-A09-20261029/review.json')},
 'candidateToSelectedId':mapping})
for row in approved['shots']:
    if row['id'] not in mapping: continue
    old=row['id'];row.update({'id':mapping[old],'previousCandidateId':old,'kind':'approved-addition'})
    row['production'].update({'state':'待核','userSelectionConfirmed':True,'selectionMethod':'用户委托助手选择',
                             'approvalRecord':REL+'/selection-decision.json'})
    row['production']['blockingReasons']=[s for s in row['production']['blockingReasons'] if s!='补选未获用户确认']
    for d in row['pendingDependencies']:
        if d.get('templateKey')=='prop-message-screen':
            d['previousRequirementId']=d['requirementId']
            d['requirementId']='prop-message-screen-'+row['id'].lower()
write(REL+'/review-approved.json',approved)
packages={}
for pkg in sorted({r['production']['package'] for r in approved['shots']}):
    rows=[r for r in approved['shots'] if r['production']['package']==pkg]
    packages[pkg]={'selectedIds':[r['id'] for r in rows],
       'retained':[r['id'] for r in rows if r['kind']=='retained-selection'],
       'approvedAdditions':[r['id'] for r in rows if r['kind']=='approved-addition'],
       'candidatesUnconfirmed':[],'releasedForProduction':[]}
write(REL+'/package-index.json',{'scope':'正式选集归属；制作放行另审','activeCount':60,'packages':packages})

# 同一个任务文档就地更新；原版已在本批保存，历史复核QA不覆盖。
text=(OUT/'task-document-before.md').read_text()
text=text.replace('# SUI-A09 CG复核与补选候选','# SUI-A09 CG复核与补选确认',1)
old='2026-10-29｜**52项保留选择逐镜审读完成，提出8项补选候选；用户尚未补选。** 原选择和8项取消记录保持不变。当前A08场景/共用物件尚在制作，另有当拍道具与衣装待核，因此本批正式放行制作 **0镜**。这不影响本任务的复核交付完成。'
new='2026-10-29｜**用户已委托助手补充所需CG，8项候选正式纳入为CG101～CG108，当前选集共60项（52保留＋8新增）。** 8个叶岚退役编号保持取消；原60项历史选择和来源快照完整保留。选择确认已完成，逐镜场景/衣装/道具前置仍待核，制作放行仍为 **0镜**。'
assert old in text;text=text.replace(old,new,1)
text=text.replace('../../qa/SUI-A09-20261029/review.json','../../'+REL+'/review-approved.json')
text=text.replace('../../qa/SUI-A09-20261029/verification.json','../../'+REL+'/verification.json')
text=text.replace('../../qa/SUI-A09-20261029/交接.md','../../'+REL+'/交接.md')
text=text.replace('候选使用A09-C01～C08临时号，不占用旧编号。','本次由A09-C01～C08映射到CG101～CG108，不占用或复活旧编号。')
text=text.replace('“待用户确认”用于8个候选；','本轮8项补选已获委托选择授权；')
text=text.replace('标题变更与最终编号由集成者在用户确认后合并。','本轮保留其原编号，新增8镜使用CG101～CG108。')
text=text.replace('[review.json的references]','[逐镜记录的references]')
text=text.replace('## 8项补选提案','## 已纳入的8项补选')
text=text.replace('每项填补当前选集的不同空缺，数量合计8。选择范围、保留原60张目标与最终编号均由用户决定；这张表不构成自动补选。',
 '用户原话：“补充你觉的需要加入的CG”。依据这项委托，助手选入下列8镜，将原60项目标补齐；不是用户逐张批准尚未制作的图像。[决定与编号映射](../../'+REL+'/selection-decision.json)及[当前选择](../CG当前选择.json)可追溯。')
text=text.replace('| 临时号 | 候选镜头 |','| 正式编号 | 新增镜头 |')
text=text.replace('## 候选详细约束','## 8项新增镜头详细约束')
text=text.replace('｜待用户确认｜','｜已选，待核制作前置｜')
text=text.replace('- [x] 提出8项有正文依据的候选，不修改原选择，不复活取消编号。',
 '- [x] 用户委托助手选择后，将8项候选纳入CG101～CG108；原52项、8项取消记录及历史QA保留。')
text=text.replace('- [ ] 用户决定候选及最终数量；集成者更新全局选择与图鉴编号，本任务保持原文件只读。',
 '- [x] 补选确认完成，集成当前60项选择及图鉴编号；图鉴仍无图片绑定，未重建或验证正式运行包。')
text=text.replace('候选获选（仅候选）→所需参考完成→A09放行', '所需参考完成→A09放行')
for old_id,new_id in mapping.items():
    text=text.replace('#'+old_id.lower(),'#'+new_id.lower())
    text=text.replace(old_id,new_id)
text=text.replace('本次由CG101～C08映射到CG101～CG108', '本次由原候选 A09-C01～A09-C08 映射到 CG101～CG108')
text+='\n## 本轮补选记录\n\n本轮将候选确认与资源制作分开记录：60项正式选集已同步，未生成新图，未绑定演出或解锁图片。原[52＋8候选复核批次](../../qa/SUI-A09-20261029/交接.md)作为历史证据保留；其生成脚本只适用于当时版本，不得重跑覆盖本页或当前选择。当前复核与重核入口见[补选交接](../../'+REL+'/交接.md)。\n'
(ROOT/'docs/美术/SUI-A09.md').write_text(text)
print(json.dumps({'added':list(mapping.values()),'activeCount':60,'packages':{k:len(v['selectedIds']) for k,v in packages.items()}},ensure_ascii=False))
