#!/usr/bin/env python3
"""核对A05交付、来源和链接；不修改正文、运行入口或历史来源。"""
import difflib
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

QA = Path(__file__).resolve().parent
ROOT = QA.parent.parent
SOURCE = ROOT / 'assets/sources/20261028/SUI-A05'
DOC = ROOT / 'docs/美术/SUI-A05.md'


def read(p):
    return json.loads(Path(p).read_text())


def write(p, obj):
    Path(p).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def main():
    checks = []

    def check(name, passed, detail=None):
        checks.append({'id': name, 'passed': bool(passed), 'detail': detail})

    snapshots = {}
    for name in ('input-before.json', 'resume-before.json'):
        rows = []
        for f in read(QA/name)['files']:
            p = Path(f['path'])
            current = sha(p) if p.exists() else None
            rows.append({'path': str(p), 'before': f['sha256'], 'after': current,
                         'unchanged': current == f['sha256'],
                         'permittedA05Update': p == ROOT/'TODO-v1.1.md'})
        snapshots[name] = rows
        unexpected = [r for r in rows if not r['unchanged'] and not r['permittedA05Update']]
        check(name + ':protected-inputs', not unexpected,
              {'total': len(rows), 'unchanged': sum(r['unchanged'] for r in rows),
               'unexpectedChanges': unexpected})
    todo_before = (QA/'todo-before-final-update.txt').read_text()
    todo_after = (ROOT/'TODO-v1.1.md').read_text()
    delta = ''.join(difflib.unified_diff(todo_before.splitlines(True), todo_after.splitlines(True),
                                       fromfile='TODO-before-A05', tofile='TODO-after-A05'))
    (QA/'todo-update.diff').write_text(delta)
    stripped = re.sub(r'### SUI-A05 本次完成记录\n.*?(?=\[正文入口\])', '', todo_after, flags=re.S)
    stripped = re.sub(r'^- \[x\] SUI-A05 飘（基础制作包）：.*$',
                      '- [ ] SUI-A05 飘：保留既有选型，独立A/B呈现、基础定稿与差分；相关规则已由SUI-S冻结，按内容契约核对分支。',
                      stripped, flags=re.M)
    previous_date = next(line for line in todo_before.splitlines() if line.startswith('更新：'))
    stripped = re.sub(r'^更新：.*$', lambda _: previous_date, stripped, count=1, flags=re.M)
    check('todo-only-A05-and-update-date', stripped == todo_before)
    write(QA/'source-preservation.json', {
        'task': 'SUI-A05', 'date': '2026-10-29', 'snapshots': snapshots,
        'note': '开工到续作前根TODO有其他任务更新；本批从续作后的完整现状做A05最小更新。',
        'todoDelta': 'qa/SUI-A05-20261028/todo-update.diff',
        'todoBeforeSHA256': sha(QA/'todo-before-final-update.txt'),
        'todoAfterSHA256': sha(ROOT/'TODO-v1.1.md')})

    copied = []
    for f in read(QA/'input-before.json')['files']:
        if 'copy' in f:
            copied.append(sha(ROOT/f['copy']) == f['sha256'])
    check('historical-input-copies', len(copied) == 12 and all(copied), {'count': len(copied)})
    selected = []
    for p in (SOURCE/'references/approved-b').glob('char-piao-*.png'):
        target = SOURCE/'selected-b'/p.name.replace('char-piao-', 'char-piao-human-').replace('.png', '-v001.png')
        selected.append(sha(p) == sha(target))
    check('inherited-B-byte-identical', len(selected) == 10 and all(selected))
    jobs = read(QA/'generation-jobs.json')
    check('generation-originals-byte-identical', len(jobs) == 10 and all(
        sha(ROOT/j['savedOriginal']) == j['sha256'] == sha(Path(j['generatedOriginal']))
        and (ROOT/j['prompt']).is_file() for j in jobs))

    records = read(QA/'resource-records.json')
    ids = {r['id'] for r in records}
    check('19-final-records-unique', len(records) == len(ids) == 19)
    check('final-files-match-checked-hashes', all(
        sha(ROOT/r[k]['path']) == r[k]['sha256'] for r in records
        for k in ('sourceMetadata', 'derivativeMetadata')))
    verification = read(QA/'verification.json')
    check('132-package-checks-pass', verification['checkCount'] == verification['passCount'] == 132
          and verification['passed'] and all(c['passed'] for c in verification['checks']))
    check('19-exact-lossless-records', all(r['pixelComparison']['exactRGBAEqual'] for r in records))
    candidates = read(QA/'package-candidates.json')
    expected = {r['id'] for r in records if r['group'] != 'option-a'}
    check('18-candidates-no-adoption', len(candidates['items']) == len(expected) == 18
          and {r['id'] for r in candidates['items']} == expected
          and not candidates['finalAdoptionList'] and all(
              not r['runtimeBound'] and not r['adoptedInSuika3'] for r in candidates['items']))
    retired = read(QA/'retained-revisions.json')
    check('retired-manual-excluded', len(retired) == 1 and all(
        (ROOT/r['file']).exists() and r['file'] not in {a['file'] for a in records}
        and r['replacement'] in {a['file'] for a in records} for r in retired))
    check('76-four-tone-and-14-ui-previews', sum(len(r['previews']) for r in records) == 76
          and all((ROOT/p).is_file() for r in records for p in r['previews'].values())
          and sum(bool(r.get('offlineUI')) for r in records) == 14
          and all((ROOT/r['offlineUI']['preview']).is_file() for r in records if r.get('offlineUI')))

    branch = read(QA/'branch-usage.json')
    contract = read(ROOT/branch['contractSource']['path'])
    check('current-contract-snapshot', sha(ROOT/branch['contractSource']['path']) == branch['contractSource']['sha256']
          and all(contract[k] == v for k, v in branch['contractSnapshot'].items())
          and branch['piaoRoute'] == next(r for r in contract['routes'] if r['id'] == 'piao'))
    reqs = {r['id'] for r in read(ROOT/'qa/SUI-A01-20261028/requirements.json')['requirements']
            if r['owner'] == 'SUI-A05'}
    check('five-requirement-families-registered', len(branch['coverage']) == len(reqs) == 5
          and {r['requirementId'] for r in branch['coverage']} == reqs)
    check('15-scene-asset-references-valid', len(branch['sceneRules']) == 15
          and all(set(s['availableReferences']) <= ids for s in branch['sceneRules']))
    anchors = [a for r in records for a in r['anchors']]
    anchors += [a for r in branch['coverage'] for a in r['a01Sources']]
    anchors += [r['source'] for r in branch['sceneRules']]
    check('current-source-lines-and-hashes', all(
        sha(ROOT/a['path']) == a['sha256']
        and a['quote'] in (ROOT/a['path']).read_text().splitlines()[a['line']-1] for a in anchors),
        {'referencesChecked': len(anchors)})

    # 报告输出也属于可点击链接目标；先占位，随后写完整检查结果。
    for p in (QA/'final-verification.json', QA/'package-manifest.json'):
        if not p.exists():
            write(p, {})

    class Links(HTMLParser):
        def __init__(self):
            super().__init__()
            self.links = []

        def handle_starttag(self, tag, attrs):
            self.links.extend(v for k, v in attrs if k in ('href', 'src') and v)

    bad_links = []
    link_count = 0
    for doc in (DOC, QA/'交接.md', QA/'visual-review.md', QA/'gallery.html'):
        content = doc.read_text()
        if doc.suffix == '.html':
            parser = Links()
            parser.feed(content)
            links = parser.links
        else:
            links = re.findall(r'\[[^\]]*\]\(([^)]+)\)', content)
        for link in links:
            url = urlsplit(link.strip('<>'))
            if url.scheme or not url.path:
                continue
            path = Path(unquote(url.path))
            path = path if path.is_absolute() else doc.parent/path
            link_count += 1
            if not path.exists():
                bad_links.append({'document': str(doc.relative_to(ROOT)), 'link': link})
    check('handoff-local-links-exist', not bad_links, {'linksChecked': link_count, 'broken': bad_links})

    exclude = {'package-manifest.json', 'final-verification.json'}
    files = sorted(set([p for base in (SOURCE, QA) for p in base.rglob('*')
                        if p.is_file() and p.name not in exclude and '__pycache__' not in p.parts]
                       + [DOC]))
    write(QA/'package-manifest.json', {
        'task': 'SUI-A05', 'date': '2026-10-29',
        'scope': '本包原件、衍生、资料和QA；不作为最终运行采用清单。自身与收尾报告不递归记录。',
        'files': [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in files]})
    result = {'task': 'SUI-A05', 'date': '2026-10-29', 'passed': all(c['passed'] for c in checks),
              'checkCount': len(checks), 'passCount': sum(c['passed'] for c in checks),
              'packageChecksSeparate': {'passed': 132, 'total': 132}, 'checks': checks,
              'evidenceLayer': '文件、元数据、来源及链接；目视记录另列，未运行游戏',
              'runtimeAdoptedCount': 0, 'photoAssetsProduced': 0, 'manifestFileCount': len(files)}
    write(QA/'final-verification.json', result)
    print(json.dumps({k: v for k, v in result.items() if k != 'checks'}, ensure_ascii=False))
    if not result['passed']:
        print(json.dumps([c for c in checks if not c['passed']], ensure_ascii=False, indent=2))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
