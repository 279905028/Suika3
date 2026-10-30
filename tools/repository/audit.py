#!/usr/bin/env python3
"""使用临时Git元数据检查三类文件；不初始化工程、不暂存、不搬运文件。"""
import argparse
import collections
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
QA_GENERATED = {
    'input', 'stage', 'web', 'native', 'wasm', 'desktop', 'packages',
    'bin', 'generated', 'audit-oracle', 'package-test-work',
}


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def ignored_kind(rel):
    p = Path(rel)
    if p.name in {'.DS_Store'} or p.name.startswith('._') or any(
        x in {'__pycache__', 'node_modules', '.vscode'} for x in p.parts
    ) or p.suffix in {'.pyc', '.pyo', '.log', '.tmp', '.swp'}:
        return 'ignore', '本地设置、系统杂项或临时记录'
    if p.name == '.env' or p.name.startswith('.env.') or p.suffix in {'.pem', '.key', '.p12', '.pfx'}:
        return 'review', '本地机密配置；不进入共享归档，须单独处理'
    if p.parts[0] in {'build', 'dist'}:
        return 'ignore', '构建或分发产物；原位保留，历史候选不保证可用当前源码重建'
    if p.parts[0] == 'qa' and any(
        x in QA_GENERATED or fnmatch.fnmatchcase(x, '*-generated') for x in p.parts[1:-1]
    ):
        return 'ignore', 'QA中的构建副本或生成中间件；原位保留'
    if p.parts[0] in {'assets', 'SDK', 'images', 'suika-beat'} or rel == 'suika3-win64.exe' or rel.startswith('system/font/'):
        return 'archive', '美术、SDK、示例或字体；按原路径单独保存'
    if p.parts[0] == 'qa':
        return 'archive', 'QA截图或其他未入Git的原始证据'
    return 'review', '未登记文件；先决定归属，禁止静默遗漏'


def inventory(out):
    if out.exists():
        raise SystemExit('报告目录已存在，请使用新批次，禁止覆盖历史证据')
    all_paths = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d != '.git')
        for name in sorted(files):
            p = Path(base) / name
            if p.is_symlink():
                raise SystemExit('存在符号链接，须先复核：' + str(p))
            all_paths.append(p.relative_to(ROOT).as_posix())
    all_paths.sort()
    # 排除用户全局ignore影响，仅检验项目规则。临时Git位于系统临时目录。
    with tempfile.TemporaryDirectory(prefix='suika-git-audit-') as tmp:
        subprocess.run(['git', 'init', '--bare', '--quiet', tmp], check=True)
        git = ['git', '--git-dir=' + tmp, '--work-tree=' + str(ROOT),
               '-c', 'core.excludesFile=/dev/null', '-c', 'core.quotePath=false']
        result = subprocess.run(git + ['ls-files', '--others', '--exclude-standard', '-z'],
                                cwd=ROOT, check=True, capture_output=True)
        tracked = set(result.stdout.decode().rstrip('\0').split('\0')) - {''}
        attr = subprocess.run(git + ['check-attr', '-z', '--stdin', 'text'],
                              input=b'\0'.join(p.encode() for p in sorted(tracked)) + b'\0',
                              cwd=ROOT, check=True, capture_output=True)
        fields = attr.stdout.decode().rstrip('\0').split('\0')
        assert all(fields[i + 2] == 'unset' for i in range(0, len(fields), 3)), '换行转换未完全关闭'
    rows = {k: [] for k in ['git', 'archive', 'ignore', 'review']}
    hashes = {}
    for rel in all_paths:
        full = ROOT / rel
        category, reason = ('git', '由项目Git规则保留') if rel in tracked else ignored_kind(rel)
        record = {'path': rel, 'bytes': full.stat().st_size, 'reason': reason}
        if category == 'archive':
            record['sha256'] = hashes[rel] = digest(full)
            record['mode'] = oct(full.stat().st_mode & 0o777)
        rows[category].append(record)
    classification = {r['path']: k for k, records in rows.items() for r in records}
    snapshot_path = 'qa/sui-i01-closeout-20261030/snapshot.json'
    snapshot = json.loads((ROOT / snapshot_path).read_text())
    required = {snapshot_path} | {x['path'] for x in snapshot['files']}
    manifests = sorted((ROOT / 'build').glob('*/input-manifest.json'))
    for path in manifests:
        required.update(x['path'] for x in json.loads(path.read_text())['inputs'])
    dependencies = [{'path': p, 'category': classification.get(p, 'missing')} for p in sorted(required)]
    bad = [r for r in dependencies if r['category'] not in {'git', 'archive'}]
    mismatch = []
    for entry in snapshot['files']:
        p = entry['path']
        actual = hashes.get(p) or digest(ROOT / p)
        if actual != entry['sha256']:
            mismatch.append(p)
    # 只检查这次范围内已保留原字节的文件；历史候选的不同源码版本不混作当前指纹。
    stats = {k: {'files': len(v), 'bytes': sum(x['bytes'] for x in v)} for k, v in rows.items()}
    summary = {
        'scope': '生成报告前的工作树；报告自身不计入本轮盘点',
        'stats': stats,
        'rootRepositoryInitialized': (ROOT / '.git').exists(),
        'projectGitAttributesPreserveBytes': True,
        'inputManifests': [p.relative_to(ROOT).as_posix() for p in manifests],
        'inputCoverage': dict(collections.Counter(r['category'] for r in dependencies)),
        'uncoveredInputs': bad,
        'snapshotEntriesChecked': len(snapshot['files']),
        'snapshotHashMismatches': mismatch,
        'separateBackupCreated': False,
        'unclassifiedFiles': rows['review'],
    }
    out.mkdir(parents=True)
    for name, data in [('summary', summary), ('archive-manifest', {
        'schemaVersion': 1, 'status': 'inventory-only-not-backed-up',
        'restoreRoot': '工程根目录；保持相对路径和可执行权限', 'files': rows['archive'],
    }), ('build-input-coverage', dependencies)]:
        (out / (name + '.json')).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    for category in ['git', 'ignore', 'review']:
        (out / (category + '-files.tsv')).write_text('path\tbytes\treason\n' + ''.join(
            f"{r['path']}\t{r['bytes']}\t{r['reason']}\n" for r in rows[category]))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if bad or mismatch or rows['review']:
        raise SystemExit('分类/冻结输入检查未通过，详见报告')


def verify_archive(manifest, restore_root):
    data = json.loads(manifest.read_text())
    failures = []
    for record in data['files']:
        rel = Path(record['path'])
        if rel.is_absolute() or '..' in rel.parts:
            raise SystemExit('非法清单路径')
        p = restore_root / rel
        if not p.is_file() or p.is_symlink():
            failures.append({'path': str(rel), 'error': '文件缺失或为链接'})
        elif p.stat().st_size != record['bytes'] or digest(p) != record['sha256']:
            failures.append({'path': str(rel), 'error': '大小或SHA-256不符'})
        elif p.stat().st_mode & 0o111 != int(record['mode'], 8) & 0o111:
            failures.append({'path': str(rel), 'error': '可执行权限不符'})
    print(json.dumps({'checked': len(data['files']), 'failures': failures}, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    scan = sub.add_parser('inventory')
    scan.add_argument('--out', required=True)
    verify = sub.add_parser('verify-archive')
    verify.add_argument('--manifest', required=True, type=Path)
    verify.add_argument('--root', required=True, type=Path)
    args = parser.parse_args()
    if args.command == 'inventory':
        out = (ROOT / args.out).resolve()
        if not out.is_relative_to(ROOT / 'qa'):
            raise SystemExit('新报告须放入qa/<新批次>')
        inventory(out)
    else:
        verify_archive(args.manifest, args.root.resolve())
