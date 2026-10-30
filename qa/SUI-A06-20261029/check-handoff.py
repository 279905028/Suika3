# -*- coding: utf-8 -*-
"""核对本批交接链接、文件指纹和正文锚点；不运行游戏或修改素材。"""
from pathlib import Path
from urllib.parse import unquote
import hashlib, json, re

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent
REPORT = QA / 'handoff-check.json'

def read(path):
    return json.loads(path.read_text())

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def save(value):
    REPORT.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

save({'status': 'checking'})
try:
    record = read(ROOT / 'assets/sources/20261029/SUI-A06/resource-records.json')
    manifest = read(QA / 'output-manifest.json')
    jobs = read(QA / 'generation-log.json')['jobs']
    before = read(QA / 'input-before.json')
    usage = read(QA / 'story-usage.json')
    checks = read(QA / 'asset-check.json')
    approval = read(QA / 'approval.json')
    candidates = read(QA / 'package-candidates.json')

    assert len(record['records']) == len(manifest['files']) == 22
    assert len({r['assetId'] for r in record['records']}) == 22
    paths = set()
    for row in record['records']:
        for field in ['sourceFile', 'derivativeFile', 'promptOrProcessRecord']:
            assert (ROOT / row[field]).is_file(), (row['assetId'], field)
        assert sha(ROOT / row['sourceFile']) == row['sha256Source']
        assert sha(ROOT / row['derivativeFile']) == row['sha256Derivative']
        assert row['approval']['currentProjectAdopted'] is False
        paths.add(row['derivativeFile'])
    assert len(paths) == 22
    for row in manifest['files']:
        path = ROOT / row['path']
        assert row['path'] in paths and sha(path) == row['sha256']
    for job in jobs:
        assert sha(Path(job['outputPath'])) == sha(ROOT / 'assets/sources/20261029/SUI-A06' / job['file'])
    for row in before['files']:
        assert sha(Path(row['path'])) == row['sha256'], row['path']
    for row in before['selectedCopies']:
        assert sha(ROOT / row['copy']) == row['copySha256'], row['copy']

    anchors = [row['anchor'] for row in usage['items']]
    anchors += [row for row in usage['formRules'].values() if isinstance(row, dict)]
    assert len(anchors) == 16
    for row in anchors:
        path = ROOT / row['path']
        assert sha(path) == row['sha256'], row['path']
        assert row['quote'] in path.read_text().splitlines()[row['line'] - 1], row

    todo = ROOT / 'TODO-v1.1.md'
    taskline = [line for line in todo.read_text().splitlines() if line.startswith('- [x] SUI-A06 ')]
    assert len(taskline) == 1
    docs = [ROOT / 'docs/美术/SUI-A06.md', QA / '交接.md', QA / 'visual-review.md']
    texts = [(path, path.read_text()) for path in docs] + [(todo, taskline[0])]
    links = []
    for path, body in texts:
        for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', body):
            if re.match(r'^[a-z]+://', target) or target.startswith('#'):
                continue
            target = unquote(target.split('#', 1)[0].strip('<>'))
            resolved = (path.parent / target).resolve()
            assert resolved.exists(), (path, target)
            links.append({'document': str(path.relative_to(ROOT)), 'target': target})

    assert checks['summary']['pngWebpPairsEqual'] == 11
    assert checks['summary']['allCriticalRectsClear'] is True
    assert approval['verbatim'] == '球形 A＋人形 B'
    assert approval['adoptedInRuntime'] is False
    assert candidates['adoptedInRuntime'] is False and len(candidates['files']) == 11
    result = {
        'date': '2026-10-29', 'status': 'passed', 'scope': '离线交接核对',
        'summary': {'resourceRecords': 22, 'outputFiles': 22, 'generatedOriginalsUnchanged': len(jobs),
                    'protectedInputsUnchanged': len(before['files']), 'selectedCopiesUnchanged': len(before['selectedCopies']),
                    'storyAnchorsVerified': len(anchors), 'markdownLinksVerified': len(links),
                    'pngWebpPairsEqual': 11, 'candidateImages': 11, 'todoUpdated': True, 'adoptedCount': 0},
        'commandsExecuted': ['python3 qa/SUI-A06-20261029/check-assets.py', 'python3 qa/SUI-A06-20261029/check-handoff.py'],
        'links': links,
        'evidence': ['asset-check.json', 'geometry-check.json', 'source-preservation.json', 'visual-review.md'],
        'notExecuted': ['A11独立复核', 'SUI-I导入', 'E/I演出绑定', '引擎运行', '网页验收', '手机真机', '桌面运行', '发布']
    }
    save(result)
    print(json.dumps(result['summary'], ensure_ascii=False))
except Exception as error:
    save({'date': '2026-10-29', 'status': 'failed', 'error': str(error)})
    raise
