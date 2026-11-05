#!/usr/bin/env python3
"""恢复发布包的冻结输入与预编译阶段；可用已获系统允许运行的SDK工具重新打包。"""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


def sha(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def safe(base, relative):
    p = Path(relative)
    assert not p.is_absolute() and '..' not in p.parts
    return base / p


def restore(args):
    root = args.archive_root.resolve()
    out = args.out.resolve()
    assert not out.exists(), '使用新输出目录，不覆盖工作树或存档'
    m = json.loads((root / 'frozen-inputs.json').read_text())
    checked = 0

    def copy(source, target, x):
        nonlocal checked
        assert source.is_file() and not source.is_symlink()
        assert source.stat().st_size == x['bytes'] and sha(source) == x['sha256'], str(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        if 'mode' in x:
            target.chmod(x['mode'])
        checked += 1

    out.mkdir(parents=True)
    for x in m['sourceInputs']:
        copy(safe(root / 'input', x['path']), safe(out / 'input', x['path']), x)
    for x in m['engines']:
        copy(safe(root, x['path']), safe(out, x['path']), x)
    for platform, stage in m['stages'].items():
        for x in stage['inputs']:
            copy(safe(root, x['source']), safe(out / (platform + '-stage'), x['path']), x)
    for x in m['webFiles']:
        copy(safe(root / 'web-files', x['path'][4:]), safe(out, x['path']), x)
    result = {'status': 'pass', 'filesVerified': checked, 'identity': m['identity'], 'repacked': []}
    if args.packer:
        packer = args.packer.resolve()
        expected = next(x for x in m['sourceInputs'] if x['path'] == 'SDK/macos/suika3-pack')
        assert sha(packer) == expected['sha256'], '打包器与冻结SDK不一致'
        for platform, stage in m['stages'].items():
            target = out / (platform + '-stage')
            subprocess.run([str(packer), *[x['path'] for x in stage['inputs']]], cwd=target, check=True)
            assert sha(target / 'assets.arc') == stage['archiveSha256'], platform + '重打包指纹不同'
            if platform == 'web':
                shutil.copy2(target / 'assets.arc', out / 'web/assets.arc')
            result['repacked'].append(platform)
    (out / 'restore-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'filesVerified': checked, 'repacked': result['repacked']}, ensure_ascii=False))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--archive-root', type=Path, default=Path(__file__).resolve().parent)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--packer', type=Path, help='可选：已获系统允许运行且指纹一致的macOS SDK打包器；不修改隔离属性')
    restore(p.parse_args())
