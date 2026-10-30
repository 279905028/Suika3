"""核对本包链接、指纹与来源保全，记录并行变动；不改其他任务文件。"""
from pathlib import Path
import hashlib
import json
import re

QA = Path(__file__).resolve().parent
ROOT = QA.parents[1]
SOURCE = ROOT/'assets/sources/20261028/SUI-A03'

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def write(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n')

inputs=json.loads((QA/'input-before.json').read_text())['files']
unchanged=[]
changed=[]
for item in inputs:
    p=Path(item['path'])
    current=sha(p)
    if current==item['sha256']:
        unchanged.append(item['path'])
    else:
        changed.append({**item,'afterSha256':current,'classification':
            '本任务只改A03汇总行；保留E/A04等并行进度' if p==ROOT/'TODO-v1.1.md'
            else '观察到的并行变更；本任务未操作或回滚'})

protected=[x for x in inputs if '/scenario/' in x['path'] or '/cjb-v1.1-suika/' in x['path']]
assert all(sha(Path(x['path']))==x['sha256'] for x in protected)
records=json.loads((SOURCE/'resource-records.json').read_text())['records']
assert len(records)==10 and sum(x['packageKey']!='option-a' for x in records)==9
for record in records:
    for f,h in [('sourceFile','sha256Source'),('derivativeFile','sha256Derivative')]:
        assert sha(ROOT/record[f])==record[h], record[f]
    assert not record['approval']['currentProjectAdopted']
    for a in record['storyAnchors']:
        p=ROOT/a['path']
        assert sha(p)==a['sha256']
        assert a['quote'] in p.read_text().splitlines()[a['line']-1]

report={
    'task':'SUI-A03','inputCount':len(inputs),'unchangedCount':len(unchanged),
    'unchangedPaths':unchanged,'changedInputs':changed,
    'sourceCopies':[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in sorted((SOURCE/'references').iterdir())],
    'protectedStoryAndHistoricalSourcesUnchanged':True,
    'sourceAndDerivativeFingerprintsPass':20,'storyAnchorsPass':10,
    'scope':'A03专属文件与根TODO的A03行；未操作运行入口、scenario、SDK、system和历史来源',
    'runtimeImportedByThisTask':0,'engineRunByThisTask':False,
    'browserRunByThisTask':False,'physicalPhoneTested':False,'published':False,
}
# 先写报告，使链接检查也能核验当前输出文件。
write(QA/'preservation-check.json',report)
checks=[]
for rel in ['docs/美术/SUI-A03.md','qa/SUI-A03-20261028/交接.md','qa/SUI-A03-20261028/visual-review.md']:
    p=ROOT/rel
    for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)',p.read_text()):
        if re.match(r'^[a-z]+://',link) or link.startswith('#'):
            continue
        name=re.sub(r':\d+$','',link.split('#')[0].strip('<>'))
        q=Path(name) if Path(name).is_absolute() else p.parent/name
        checks.append({'from':rel,'link':link,'exists':q.exists()})
bad=[x for x in checks if not x['exists']]
assert not bad,bad
report.update({'markdownLinksPass':len(checks),'brokenLinks':bad})
write(QA/'preservation-check.json',report)
files=[ROOT/'docs/美术/SUI-A03.md']
files+=sorted(p for p in SOURCE.rglob('*') if p.is_file())
files+=sorted(p for p in QA.rglob('*') if p.is_file() and p.name!='output-manifest.json')
write(QA/'output-manifest.json',{'task':'SUI-A03','manifestSelfExcluded':True,
    'files':[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in files]})
print(json.dumps({'task':'SUI-A03','status':'制作完成；A11/I/Q接续','linksPass':len(checks),
    'verifiedResourceFiles':20,'storyAnchorsPass':10,'inputUnchanged':len(unchanged),
    'inputCount':len(inputs),'observedChangedFiles':[x['path'] for x in changed]},ensure_ascii=False))
