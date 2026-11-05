"""只读复核P4-04交付；不把待制作或待05项目认作已通过。"""
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import unquote
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
DOC = ROOT/'docs/修订协作/P4-演出与美术/P4-04'
QA = ROOT/'qa/dialogue-p4-P4-04-20261103'
BASE = DOC.parent/'P4-01'
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
parser = argparse.ArgumentParser()
parser.add_argument('--out', required=True)
args = parser.parse_args()
out = (ROOT/args.out).resolve()
assert out.is_relative_to(ROOT/'qa') and not out.exists(), '报告须写入尚不存在的QA路径'
checks = []

frozen = {}
for file in ['input-manifest.json','freeze.json']:
    for item in read(BASE/file)['files']:
        assert sha(ROOT/item['path']) == item['sha256'], item['path']
        frozen[item['path']] = item
checks.append({'name':'冻结输入及接口保护','files':len(frozen),'status':'passed'})
d = read(DOC/'cg-review.json')
records = d['records']
baseline = read(BASE/'resources.baseline.json')
assert d['inputFingerprint'] == baseline['inputFingerprint']
assert d['contentBuildId'] == read(BASE/'input-manifest.json')['contentBuildId']
assert d['interfaceFingerprint'] == read(BASE/'freeze.json')['interfaceFingerprint']
cgset = {r['cgId']:r['assetId'] for r in records}
assert len(records) == len(cgset) == 61
assert cgset == {r['cgId']:r['assetId'] for r in baseline['cg']} | {'CG109':'cg-hq-cg109'}
assert not set(read(DOC/'cg-registration.json')['retiredIds']) & set(cgset)
reg = read(DOC/'cg-registration.json')['newRegistrations']
assert len(reg)==1 and reg[0]['cgId']=='CG109'
assert sha(ROOT/reg[0]['registrationEvidence']['path'])==reg[0]['registrationEvidence']['sha256']
checks.append({'name':'60个编号保持、新增CG109、无退役号复用','status':'passed'})
nm = {n['nodeId']:n for n in read(BASE/'node-map.json')['nodes']}
pm = {p['paragraphId']:p for p in read(BASE/'paragraph-map.json')['paragraphs']}
allnodes=[]
for r in records:
    n = nm[r['anchor']['nodeId']]
    assert n['op'] == 'text' and r['text'] == n['page']['text']
    assert all(r['anchor'][k] == n[k] for k in r['anchor'])
    assert r['packageId'] == n['packageId']
    assert r['proposedNodeIds'] == [n['nodeId']]
    allnodes.extend(r['proposedNodeIds'])
    assert r['exit']['at'] == 'next-node' and r['exit']['clearCg'] is True
    assert r['exit']['destination'] == 'clear-before-target / recompute-destination'
    assert r['exit']['lexicalNextNodeId'] == n['lexicalNextNodeId']
    assert r['review']['overlayVisual'] in ['reviewed-contact-sheet','reviewed-full-image-and-overlay']
    assert r['review']['P4-05'] == 'pending' and not r['readyForBinding']
    for role in ['source','runtime']:
        a=r['technical'][role]
        assert sha(ROOT/a['path']) == a['sha256']
    for role in ['full','overlay']:
        a=r['previews'][role];p=ROOT/a['path']
        assert sha(p) == a['sha256']
        with Image.open(p) as im:
            im.load()
            assert im.size == (1280,720) and im.format == 'WEBP'
assert len(set(allnodes)) == 61
checks.append({'name':'锚点、条件、门禁、媒介、退出与122份预览','status':'passed'})

counts=Counter(r['packageId'] for r in records)
assert [counts['P4-02-'+k] for k in ['COMMON','XM','ZZ','MY','PI','HQ','FR']] == [15,8,9,7,9,8,5]
for key in counts:
    assert read(DOC/'packages'/f'{key.removeprefix("P4-02-")}.json')['records'] == [r for r in records if r['packageId']==key]
checks.append({'name':'七包分配与副本一致','status':'passed','counts':dict(counts)})

ends=read(DOC/'endings.json')['endings']
routes=read(ROOT/'scenario/routes.json')['routes']
expected={e for r in routes for e in r['endings']+r.get('lowPathEndings',[])}
assert {e['endingId'] for e in ends} == expected and len(ends)==14
for e in ends:
    ps=[p for p in pm.values() if p['source']['context']==e['endingId']]
    assert e['paragraphIds']==[p['paragraphId'] for p in ps]
    assert e['conditions']==sorted({p['condition'] for p in ps})
    assert set(e['relatedCgs']) <= set(cgset)
checks.append({'name':'14结局完整审读段落与复用理由登记','status':'passed','paragraphs':sum(len(e['paragraphIds']) for e in ends)})

for cid in ['CG066','CG025','CG101']:
    assert next(r for r in records if r['cgId']==cid)['decision']=='repair-complete'
assert next(r for r in records if r['cgId']=='CG068')['proposedNodeIds']==['T-PI-000630_1']
assert next(r for r in records if r['cgId']=='CG070')['proposedNodeIds']==['T-PI-000635_1']
assert next(r for r in records if r['cgId']=='CG105')['anchor']['condition']=='MY07-01=B|MY09-01=B'
assert next(r for r in records if r['cgId']=='CG104')['anchor']['condition']=='MY07-01=A&MY09-01=A'
assert next(r for r in records if r['cgId']=='CG101')['anchor']['entryGate']['type']=='sharedEvent'
assert d['status']=='production-complete-awaiting-P4-05'
checks.append({'name':'返修已交候选但未伪称05通过、关键分支约束','status':'passed'})

page=(QA/'index.html').read_text()
assert page.count('<article ')==61
for target in re.findall(r'(?:href|src)="([^"]+)"',page):
    assert (QA/unquote(target)).resolve().exists(), target
for f in DOC.rglob('*.md'):
    for target in re.findall(r'\]\(([^)]+)\)',f.read_text()):
        assert (f.parent/unquote(target)).resolve().exists(),(f,target)
checks.append({'name':'预览与文档本地链接','status':'passed'})

needs=[]
for pack in counts:
    p=DOC.parent/pack/'needs.json'
    needs.append({'packageId':pack,'path':str(p.relative_to(ROOT)),'exists':p.exists(),
                  'cgNeeds':len([x for x in read(p)['needs'] if x['kind']=='cg']) if p.exists() else None})
produced=read(ROOT/'assets/sources/20261103/P4-04/production-assets.json')['records']
assert {p['cgId'] for p in produced}=={'CG025','CG066','CG101','CG109'}
for a in produced:
    record=next(r for r in records if r['cgId']==a['cgId'])
    assert record['production']==a
    for role in ['source','runtime']:
        assert all(record['technical'][role][k]==v for k,v in a[role].items())
    assert sha(ROOT/a['source']['path'])==a['source']['sha256']
    assert sha(ROOT/a['runtime']['path'])==a['runtime']['sha256']
    with Image.open(ROOT/a['source']['path']) as s, Image.open(ROOT/a['runtime']['path']) as r:
        assert s.size==r.size and s.convert('RGB').tobytes()==r.convert('RGB').tobytes()
checks.append({'name':'4项制作候选PNG/WebP无损像素及指纹','status':'passed'})
receipt_file=read(DOC/'need-responses.json')
receipts=receipt_file['responses']
assert receipt_file['inputs']==read(QA/'upstream-manifest.json')['files']
for item in receipt_file['inputs']:
    original=Path(item['path'])
    snapshot=QA/'upstream'/original.parent.name/original.name
    assert sha(snapshot)==item['sha256']
for receipt in receipts:
    for evidence in receipt['evidence']:
        assert sha(ROOT/evidence['path'])==evidence['sha256']
actual={n['needId'] for row in needs if row['exists'] for n in read(ROOT/row['path'])['needs'] if n['kind']=='cg'}
assert {r['needId'] for r in receipts}==actual and len(receipts)==20
assert all(r['productionStatus']=='complete' for r in receipts)
checks.append({'name':'20项上游CG需求全部有制作/复核回执','status':'passed'})
report={'taskStatus':d['status'],'verificationStatus':'passed','checks':checks,
        'upstreamSnapshot':needs,'decisionCounts':dict(Counter(r['decision'] for r in records)),
        'notTested':['引擎','浏览器','手机真机','电脑原生','P4-05资源终审','发布'],
        'unfinished':['02回填需求与最终绑定','05独立检查','06提示改善与61项容量','07采用','P5运行验收']}
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
