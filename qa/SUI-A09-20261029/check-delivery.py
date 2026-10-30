"""本批交接检查：文件/链接、最终来源、全局选择保护；不检查游戏运行。"""
import json,re,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
def load(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before=load(OUT/'input-before.json')
review=load(OUT/'review.json')
verification=load(OUT/'verification.json')
assert verification['status']=='pass'
paths={x['path'] for x in before['files']}
paths|={v['sourceFile'] for v in review['references'].values()}
paths|={v['recordPath'] for v in review['references'].values()}
current=[{'path':p,'sha256':sha(ROOT/p),'bytes':(ROOT/p).stat().st_size} for p in sorted(paths) if (ROOT/p).is_file()]
by_path={x['path']:x for x in current}
changed=[{'path':x['path'],'beforeSha256':x['sha256'],'reviewedSha256':by_path[x['path']]['sha256'],
          'handling':'A09根待办合并，含其他窗口既有更新' if x['path']=='TODO-v1.1.md' else '只读发现并行变化；采用现行输入，不回退'}
         for x in before['files'] if x['path'] in by_path and x['sha256']!=by_path[x['path']]['sha256']]
(OUT/'input-reviewed.json').write_text(json.dumps({'task':'SUI-A09','date':'2026-10-29','scope':'复核时文件快照；不承诺上游以后保持不变','files':current,'changesSinceStart':changed},ensure_ascii=False,indent=2)+'\n')
checks=[]
for row in review['shots']:
    p=ROOT/row['source']['path']
    assert sha(p)==row['source']['sourceSha256'],row['id']+'当前来源已变化，须重核'
    assert row['source']['quote']==p.read_text().splitlines()[row['source']['line']-1].strip()
checks.append({'name':'60镜最终来源未过期','status':'pass','count':60})
owners={}
for row in review['shots']:
    for dep in row['pendingDependencies']:
        k=dep['requirementId'];owners.setdefault(k,dep['owner']);assert owners[k]==dep['owner'],k+'多责任人'
checks.append({'name':'逐镜前置需求归属一致','status':'pass','uniqueRequirementKeys':len(owners)})
stable=['docs/CG当前选择.json','docs/CG调整清单.md','qa/route-merge-20261028/cg-selection-original.json']
for p in stable: assert by_path[p]['sha256']==next(x['sha256'] for x in before['files'] if x['path']==p)
checks.append({'name':'原选择/调整记录/原始快照保持不变','status':'pass','paths':stable})
md_files=[ROOT/'docs/美术/SUI-A09.md',OUT/'交接.md']
links=0
for p in md_files:
    text=p.read_text()
    for target in re.findall(r'\]\(([^)]+)\)',text):
        target=target.strip('<>')
        if target.startswith('#'):
            assert ('### '+target[1:].upper()) in text,target
            links+=1;continue
        if target.startswith(('https:','http:')): continue
        base=target.split('#',1)[0]
        m=re.match(r'^(.*):(\d+)$',base)
        if m:base=m[1]
        f=Path(base) if base.startswith('/') else (p.parent/base).resolve()
        # 本检查文件将在下方写出，允许自己的生成报告作为链接目标。
        assert f.is_file() or f==OUT/'delivery-check.json',(p,target)
        if m: assert 1<=int(m[2])<=len(f.read_text().splitlines()),target
        links+=1
checks.append({'name':'任务/交接文档本地链接和行号','status':'pass','links':links})
text=(ROOT/'docs/美术/SUI-A09.md').read_text()
for row in review['shots'][:52]:assert text.count('#### '+row['id']+'｜')==1
for row in review['shots'][52:]:assert text.count('### '+row['id']+'\n')==1
table=[l for l in text.splitlines() if l.startswith('| A09-C')]
assert len(table)==8
assert all(l.count('|')==5 for l in table),'候选表中条件竖线未转义'
todo=(ROOT/'TODO-v1.1.md').read_text()
assert '- [x] SUI-A09 CG复核与补选候选' in todo
assert '- [ ] SUI-A09接续' in todo
checks.append({'name':'52条正文卡/8条候选卡与根待办同步','status':'pass'})
outputs=[ROOT/'docs/美术/SUI-A09.md']+[p for p in OUT.iterdir() if p.is_file() and p.name!='delivery-check.json']
report={'task':'SUI-A09','date':'2026-10-29','status':'pass','checks':checks,'changesSinceStart':changed,
        'writtenScope':['docs/美术/SUI-A09.md','qa/SUI-A09-20261029/','TODO-v1.1.md:仅SUI-A09两项'],
        'sourceRule':'scenario/唯一正文；snapshot仅为本次审核证据，不是新的正文入口',
        'outputs':[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(outputs)],
        'runtimeAdopted':0,'productionReleased':0,'imagesGenerated':0}
(OUT/'delivery-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':'pass','checks':len(checks),'links':links,'inputsChangedDuringWork':[x['path'] for x in changed]},ensure_ascii=False))
