"""核对A02交接引用与已验收文件指纹，不运行游戏或改写素材。"""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent
PKG = ROOT/'assets/sources/20261028/SUI-A02'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text())


def main():
    result_path=QA/'delivery-check.json'
    result_path.write_text('{"status":"checking"}\n')
    data=read(PKG/'resource-records.json')
    rows=data['records']
    verification=read(QA/'verification.json')
    mappings=read(QA/'需求映射.json')['assets']
    checks=[]

    def add(name, passed, detail=None):
        checks.append({'name':name,'passed':bool(passed),'detail':detail})

    add('交付11项且逻辑键唯一',len(rows)==11 and len({r['assetId'] for r in rows})==11)
    current_requirements=read(ROOT/'qa/SUI-A01-20261028/requirements.json')['requirements']
    expected={x['id'] for x in current_requirements if x['owner']=='SUI-A02'}
    actual={x for r in rows for x in r['requirementKeys']}
    add('覆盖A01的4个A02需求族',expected==actual and len(actual)==4, sorted(actual))
    add('已完成的像素/格式与静态布局结果均通过',all(verification[k] for k in
        ['allMetadataAndPixelsPass','allFaceRectsAboveDialogue','allPropRectsAboveDialogue']))
    files=[];missing=[];drift=[]
    for r in rows:
        for field,fingerprint in [('sourceFile','sha256Source'),('derivativeFile','sha256Derivative')]:
            p=ROOT/r[field]
            if not p.is_file():missing.append(str(p));continue
            files.append(p)
            if sha(p)!=r[fingerprint]:drift.append(str(p))
        for source in r['sources']:
            p=Path(source['path']) if source['path'].startswith('/') else ROOT/source['path']
            if not p.is_file():missing.append(str(p))
            elif sha(p)!=source['sha256']:drift.append(str(p))
    add('22个源/衍生文件及引用指纹吻合',not missing and not drift,{'missing':missing,'drift':drift})
    anchor_errors=[];anchor_count=0
    for mapping in mappings:
        for a in mapping['storyAnchors']:
            p=ROOT/a['path'];lines=p.read_text().splitlines();anchor_count+=1
            if sha(p)!=a['sha256'] or lines[a['line']-1]!=a['quote']:anchor_errors.append(a)
    add('当前正文锚点与指纹吻合',not anchor_errors,{'anchorCount':anchor_count,'errors':anchor_errors})
    jobs=read(QA/'generation-requests.json')
    add('基础选择A且与本工程图一致',jobs['baseApproval']['selectedOption']=='A' and
        jobs['baseApproval']['sha256']==sha(ROOT/jobs['baseApproval']['selectedFile']))
    add('旧卫衣与裙型保留用户选择','深灰' in jobs['wardrobeApproval']['old-sweatshirt'] and
        '及膝A字裙' in jobs['wardrobeApproval']['skirt'])
    excluded=[r['relativeFile'] for r in read(QA/'generation-results.json')
              if r.get('status') in ['rejected-skirt-length','superseded-expression']]
    excluded += [r['path'] for r in read(QA/'base-generation-records.json') if r['option']=='b']
    add('4份未选/旧版图不混入当前11项',len(excluded)==4 and not
        ({r['sourceFile'] for r in rows}&set(excluded)),excluded)
    add('本批未宣称运行采用',data['currentProjectAdopted'] is False and all(
        r['approval']['currentProjectAdopted'] is False for r in rows) and all(m['runtimeBinding'] is None for m in mappings))
    preservation=read(QA/'source-preservation.json')
    core=[x for x in preservation['protectedRows'] if '/scenario/' in x['path'] or
          '/docs/人物/' in x['path'] or '/docs/分支/' in x['path'] or '/cjb-v1.1-suika/' in x['path']]
    add('正文/人物/路线和历史来源指纹不变',all(x['unchanged'] and sha(Path(x['path']))==x['before'] for x in core),len(core))
    add('3个白名单参考副本保持原字节',all(x['sha256Unchanged'] for x in preservation['referenceCopies']) and
        preservation['additionalReadOnlyAudit']['matchesA01'])
    ui_manifest=read(ROOT/'system/sui-u/asset-manifest.json')['assets']
    lookup={f['path']:f for a in ui_manifest for f in a['files']}
    ui_inputs=read(QA/'ui-inputs.json')
    add('4个UI合成输入与U资源清单相符',all(
        sha(Path(x['path']))==lookup[str(Path(x['path']).relative_to(ROOT))]['sha256']==x['sha256'] for x in ui_inputs))
    visual=read(QA/'visual-review.json')
    add('44个四底及11个UI证据齐备',all((QA/'composites'/f'{r["variant"]}-{bg}.png').is_file()
        for r in rows for bg in ['white','black','day','night']) and
        all((QA/'ui'/f'{r["variant"]}.png').is_file() for r in rows) and len(visual['assets'])==11)
    docs=[ROOT/'docs/美术/SUI-A02.md',QA/'交接.md',QA/'prompts.md']
    broken=[]
    for p in docs:
        for dest in re.findall(r'\]\(([^)]+)\)',p.read_text()):
            if dest.startswith(('http:','https:','codex:')):continue
            dest=dest.strip('<>').split('#')[0]
            if not dest:continue
            target=Path(dest) if dest.startswith('/') else (p.parent/dest).resolve()
            if not target.exists():broken.append({'document':str(p),'target':dest})
    add('本任务文档链接可解析',not broken,broken)
    todo=(ROOT/'TODO-v1.1.md').read_text()
    add('TODO记录A02制作完成并保留其他任务','- [x] SUI-A02 罗小满' in todo and
        '### SUI-A02 本次完成记录' in todo and all(f'SUI-A0{x}' in todo for x in [1,3,4,5,6,7,8,9]))
    variants=read(QA/'generation-results.json')+read(QA/'base-generation-records.json')
    copy_errors=[]
    for r in variants:
        dest=ROOT/(r.get('relativeFile') or r['path']);source=Path(r['generatedSource'])
        if not source.is_file() or sha(source)!=sha(dest):copy_errors.append(str(dest))
    add('15份生成原件在本工程有等字节副本',len(variants)==15 and not copy_errors,copy_errors)
    report={'task':'SUI-A02','completionDate':'2026-10-29','layer':'本批交付与离线证据核对',
            'passed':all(x['passed'] for x in checks),'checks':checks,
            'passedCount':sum(x['passed'] for x in checks),'totalChecks':len(checks),
            'outsidePackageParallelChanges':preservation['changed'],
            'gameEngine':'未测','browserGame':'未测','physicalPhone':'未测','desktopGame':'未测','deployment':'未执行'}
    result_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':report['passed'],'checks':f'{report["passedCount"]}/{len(checks)}',
          'storyAnchors':anchor_count,'failed':[x for x in checks if not x['passed']]},ensure_ascii=False))
    if not report['passed']:raise SystemExit(1)


if __name__=='__main__':
    main()
