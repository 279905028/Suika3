"""最终交接完整性检查，含链接、文件指纹与仅本包输出快照。"""
from pathlib import Path
import json,hashlib,re
ROOT=Path(__file__).resolve().parents[2];QA=Path(__file__).resolve().parent
SOURCE=ROOT/'assets/sources/20261029/SUI-A07'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def snapshot():
    paths=[ROOT/'docs/美术/SUI-A07.md',*sorted(SOURCE.rglob('*')),*sorted(QA.rglob('*'))]
    items=[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in paths if p.is_file() and p.name!='output-manifest.json' and '__pycache__' not in p.parts]
    save(QA/'output-manifest.json',{'task':'SUI-A07','date':'2026-10-29','scope':'本包最终输出快照；不含本清单自身、缓存或共享根TODO','fileCount':len(items),'files':items})
    return len(items)

snapshot()  # 清单是文档链接的实际目标，先建立，再核对全部链接。
links=[];broken=[]
for p in [ROOT/'docs/美术/SUI-A07.md',*sorted(QA.glob('*.md'))]:
    for url in re.findall(r'\]\(([^)]+)\)',p.read_text()):
        if re.match(r'^[a-z]+://',url):continue
        q=(p.parent/url.split('#')[0]).resolve();links.append({'from':str(p.relative_to(ROOT)),'target':url,'exists':q.exists()})
        if not q.exists():broken.append(str(q))
assert not broken,broken
records=json.loads((SOURCE/'resource-records.json').read_text())['records']
for a in records:
    for ext in ['png','webp']:
        m=a[ext];assert sha(ROOT/m['path'])==m['sha256']
jobs=json.loads((QA/'generation-jobs.json').read_text())
for j in jobs:assert sha(SOURCE/j['file'])==sha(Path(j['generatedPath']))
protected=json.loads((QA/'source-preservation.json').read_text())
reviews={r['path']:r for r in json.loads((QA/'concurrent-input-review.json').read_text())['changes']}
for p in protected['protected']:
    assert sha(Path(p['path']))==p['after']
    if not p['unchanged']:
        assert p['concurrentChangeReviewed'] and reviews[p['path']]['reviewedSha256']==p['after']
for p in protected['sharedObserved']:
    p['currentSha256']=sha(Path(p['path']));p['note']='共享TODO保留其他窗口最新状态，仅定点合并SUI-A07完成记录'
save(QA/'source-preservation.json',protected)
candidates=json.loads((QA/'package-candidates.json').read_text())['assets']
assert len(candidates)==15 and len({a['key'] for a in candidates})==15
assert not any(a['key'] in ['yelan-a','chensheng-a','shijiang-calculator-rejected-v001'] for a in candidates)
assert len(list((SOURCE/'yelan').glob('references/*')))==0
assert '- [x] SUI-A07' in (ROOT/'TODO-v1.1.md').read_text()
save(QA/'handoff-check.json',{'task':'SUI-A07','localLinksChecked':len(links),'brokenLinks':broken,'assetFingerprintChecks':len(records)*2,
     'generationOriginalsPreserved':len(jobs),'candidateCount':len(candidates),
     'protectedInputsUnchanged':sum(p['unchanged'] for p in protected['protected']),
     'concurrentInputsRevalidated':sum(not p['unchanged'] and p['concurrentChangeReviewed'] for p in protected['protected']),
     'rootTodoA07Complete':True,'oldYelanImageCopied':False,'links':links})
count=snapshot()
print(json.dumps({'links':len(links),'broken':broken,'assetFingerprints':len(records)*2,'generatedOriginals':len(jobs),
      'selected':len(candidates),'protectedInputs':len(protected['protected']),'outputFiles':count},ensure_ascii=False))
