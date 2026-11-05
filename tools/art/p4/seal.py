"""封存P4-05交付指纹、链接及协调文档差异；不重写既有验收报告。"""
import difflib
import json
import re
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

from audit import ROOT, QA, DOC, OUT, read, fp, rel, sha, write


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []

    def handle_starttag(self, tag, attrs):
        self.targets.extend(v for k, v in attrs if k in ['href', 'src'] and v)


assert not (QA / 'output-manifest.json').exists()
assert not (QA / 'delivery-audit.json').exists()
folders = [DOC, QA, OUT, ROOT / 'tools/art/p4']
files = sorted({p for folder in folders for p in folder.rglob('*')
                if p.is_file() and '__pycache__' not in p.parts and p.name != '.DS_Store'})
json_files = [p for p in files if p.suffix == '.json']
for p in json_files:
    read(p)
links = []
for p in files:
    if any(part in ['before', 'before-final-update'] for part in p.parts):
        continue  # 输入快照保留原文，相对链接不在快照目录内解析。
    if p.suffix == '.md':
        links += [(p, x) for x in re.findall(r'\[[^\]]*\]\(([^)]+)\)', p.read_text())]
    elif p.suffix == '.html':
        parser = Links()
        parser.feed(p.read_text())
        links += [(p, x) for x in parser.targets]
coordinator = []
diff = []
for name in ['TODO-v1.1.md', 'docs/P4演出与美术子任务.md']:
    p = ROOT / name
    old = (QA / 'before-final-update' / name).read_text()
    new = p.read_text()
    old_links = set(re.findall(r'\[[^\]]*\]\(([^)]+)\)', old))
    links += [(p, x) for x in re.findall(r'\[[^\]]*\]\(([^)]+)\)', new) if x not in old_links]
    coordinator.append(fp(p))
    diff += list(difflib.unified_diff(old.splitlines(True), new.splitlines(True),
                                    fromfile='before-final-update/' + name, tofile=name))
checked_links = []
resolved_links = []
pending_reports = {QA / 'output-manifest.json', QA / 'delivery-audit.json'}
for owner, target in links:
    target = target.strip('<>')
    parts = urlsplit(target)
    if parts.scheme or parts.netloc or not parts.path:
        continue
    target = re.sub(r':\d+(?:-\d+)?$', '', unquote(parts.path))
    resolved = (owner.parent / target).resolve()
    assert resolved.exists() or resolved in pending_reports, f'失效链接: {rel(owner)} -> {target}'
    resolved_links.append(resolved)
    checked_links.append({'from': rel(owner), 'target': target})
protected = {}
for p in [QA / 'input-manifest.json', QA / 'cg110-129/input-manifest.json']:
    for f in read(p)['files']:
        assert sha(ROOT / f['path']) == f['sha256'], f['path']
        protected[f['path']] = f
assert len(protected) == 1796
for p in [QA / 'provenance-check.json', QA / 'cg110-129/provenance-check.json']:
    for f in read(p)['files']:
        assert sha(ROOT / f['path']) == f['sha256'], f['path']
diff_path = QA / 'coordinator-changes.diff'
assert not diff_path.exists()
diff_path.write_text(''.join(diff))
files.append(diff_path)
verification = read(QA / 'verification-final.json')
assert verification['counts']['candidateAssets'] == 262
assert verification['counts']['cg'] == 81
assert verification['counts']['runtimeCandidates'] == 39
manifest = {'date': '2026-11-04', 'taskId': 'P4-05',
            'scope': '05独占文档、QA、运行衍生与工具；输入快照保留。排除本清单与delivery-audit避免自指。',
            'files': [fp(p) for p in sorted(files)],
            'coordinationFilesAtHandoff': coordinator,
            'coordinationNote': '根TODO/计划为可继续更新的共享进度，记录交接时指纹，不加入冻结输入。'}
write(QA / 'output-manifest.json', manifest)
for f in manifest['files']:
    assert sha(ROOT / f['path']) == f['sha256']
write(QA / 'delivery-audit.json', {
    'date': '2026-11-04', 'status': 'PASS_P4_05_DELIVERY',
    'outputManifest': fp(QA / 'output-manifest.json'),
    'counts': {'sealedOutputFiles': len(files), 'existingJsonParsed': len(json_files),
               'localLinksChecked': len(checked_links), 'protectedInputsUnchanged': len(protected)},
    'verification': fp(QA / 'verification-final.json'),
    'coordinatorDiff': fp(diff_path),
    'links': checked_links,
    'notClaimed': ['HTML浏览器交互实测', '游戏运行', '正式采用', '存档', '发布']})
assert all(p.exists() for p in resolved_links), '报告写入后再次确认所有本地链接存在'
print(json.dumps({'status': 'PASS_P4_05_DELIVERY', 'outputs': len(files), 'json': len(json_files),
                  'links': len(checked_links), 'protected': len(protected)}, ensure_ascii=False))
