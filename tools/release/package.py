#!/usr/bin/env python3
"""为完整候选生成独立 Release 附件；不改写候选或历史压缩包。"""
import hashlib
import json
import re
import stat
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def package(version):
    assert re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,79}', version)
    source = ROOT / 'dist' / version
    build = ROOT / 'build' / version
    output = ROOT / 'dist' / (version + '-release')
    assert not output.exists(), '禁止覆盖已有 Release 附件目录'
    subprocess.run(['node', str(ROOT / 'tools/integration/runtime/verify-package.cjs'), str(source)], check=True)
    manifest = json.loads((source / 'candidate-manifest.json').read_text())
    assert manifest['mode'] == 'candidate' and manifest['complete'] and manifest['producerHandoff']
    notes = ROOT / 'docs/releases' / (version + '.md')
    assert notes.is_file()
    common = [
        (notes, '开始阅读.md'),
        (ROOT / 'docs/releases/licenses/说明.md', 'licenses/说明.md'),
        (ROOT / 'docs/releases/licenses/Suika3-LICENSE.txt', 'licenses/Suika3-LICENSE.txt'),
        (ROOT / 'docs/releases/licenses/Suika3-NOTICE.txt', 'licenses/Suika3-NOTICE.txt'),
        (ROOT / 'system/font/OFL.txt', 'licenses/Noto-OFL.txt'),
    ]
    output.mkdir()
    archives = []

    def write_archive(label, entries):
        target = output / (version + '-' + label + '.zip')
        expected = {}
        with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for file, name, mode in entries:
                name = version + '/' + name
                assert name not in expected and '..' not in Path(name).parts
                expected[name] = {'sha256': digest(file), 'bytes': file.stat().st_size, 'mode': mode}
                info = zipfile.ZipInfo.from_file(file, name)
                info.external_attr = (stat.S_IFREG | mode) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                with file.open('rb') as src, z.open(info, 'w', force_zip64=True) as dst:
                    while chunk := src.read(8 * 1024 * 1024):
                        dst.write(chunk)
        with zipfile.ZipFile(target) as z:
            assert set(z.namelist()) == set(expected)
            for name, record in expected.items():
                h = hashlib.sha256()
                with z.open(name) as stream:
                    while chunk := stream.read(8 * 1024 * 1024):
                        h.update(chunk)
                assert h.hexdigest() == record['sha256'], name
                assert z.getinfo(name).file_size == record['bytes'], name
                assert (z.getinfo(name).external_attr >> 16) & 0o777 == record['mode'], name
        assert target.stat().st_size < 2 * 1024 ** 3, '附件超过2GiB'
        record = {'platform': label, 'path': target.name, 'bytes': target.stat().st_size,
                  'sha256': digest(target), 'filesVerified': len(expected)}
        archives.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)

    for platform in ['web', 'macos', 'windows-x64', 'windows-arm64']:
        entries = [(source / 'candidate-manifest.json', 'candidate-manifest.json', 0o644)]
        entries += [(p, n, 0o644) for p, n in common]
        entries += [(p, p.relative_to(source).as_posix(), p.stat().st_mode & 0o777)
                    for p in sorted((source / platform).rglob('*')) if p.is_file()]
        if platform == 'web':
            entries += [(ROOT / 'tools/release/serve.cjs', 'serve.cjs', 0o644),
                        (ROOT / 'tools/release/启动网页.command', '启动网页.command', 0o755),
                        (ROOT / 'tools/release/启动网页.bat', '启动网页.bat', 0o644)]
        write_archive(platform, entries)

    # 只归档本版实际冻结输入，避免复制所有历史QA、SDK示例和未采用素材。
    entries = [(p, n, 0o644) for p, n in common]
    entries += [(source / 'candidate-manifest.json', 'candidate-manifest.json', 0o644),
                (build / 'input-manifest.json', 'input-manifest.json', 0o644)]
    for record in manifest['inputs']:
        relative = record['path']
        frozen = build / 'input' / relative
        assert digest(frozen) == record['sha256'], relative
        assert digest(ROOT / relative) == record['sha256'], '当前输入变化：' + relative
        entries.append((frozen, 'input/' + relative, (ROOT / relative).stat().st_mode & 0o777))
    write_archive('build-inputs', entries)
    checksums = {'version': version, 'inputFingerprint': manifest['inputFingerprint'],
                 'runtimeBuildIds': manifest['runtimeBuildIds'], 'archiveEntriesVerified': True,
                 'packages': archives}
    (output / 'checksums.json').write_text(json.dumps(checksums, ensure_ascii=False, indent=2) + '\n')
    (output / 'SHA256SUMS.txt').write_text(''.join(r['sha256'] + '  ' + r['path'] + '\n' for r in archives))
    return checksums


if __name__ == '__main__':
    assert len(sys.argv) == 2, '用法：python3 tools/release/package.py <候选版本>'
    package(sys.argv[1])
