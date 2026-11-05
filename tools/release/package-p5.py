#!/usr/bin/env python3
"""从已验收的 P5 冻结构建制作发布附件，不改写历史包与玩家存档。"""
import argparse
import hashlib
import json
import shutil
import stat
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def sha(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read(file):
    return json.loads(file.read_text())


def write(file, data):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def record(file, relative):
    return {'path': relative, 'bytes': file.stat().st_size, 'sha256': sha(file),
            'mode': file.stat().st_mode & 0o777}


def verify(file, item):
    assert file.is_file() and not file.is_symlink(), str(file)
    assert file.stat().st_size == item['bytes'] and sha(file) == item['sha256'], str(file)


def checked_path(base, relative):
    p = Path(relative)
    assert not p.is_absolute() and '..' not in p.parts, relative
    return base / p


def package(args):
    version = args.version
    assert version == 'v1.1.0-beta.2', '本入口仅用于本批冻结发布'
    web = checked_path(ROOT, args.web_build)
    native = checked_path(ROOT, args.native_build)
    out = ROOT / 'dist' / (version + '-release')
    work = ROOT / 'build' / version
    assert not out.exists() and not work.exists(), '禁止覆盖已有发布目录'
    b = read(web / 'build-result.json')
    wm = read(web / 'runtime/build-manifest.json')
    nm = read(native / 'runtime/build-manifest.json')
    assert b['runtimeBuildId'] == wm['runtimeBuildId']
    assert wm['contentBuildId'] == nm['contentBuildId']
    assert b['counts']['motionCG'] == 29 and len(wm['outputs']) == 67
    for x in b['inputs']:
        verify(checked_path(web / 'input', x['path']), x)
    for manifest, build in [(wm, web), (nm, native)]:
        for x in manifest['inputs']:
            verify(checked_path(build / 'runtime/stage', x['path']), x)
        for x in manifest['outputs']:
            verify(checked_path(build / 'runtime', x['path']), x)
    media = read(ROOT / 'assets/current/motion/manifest.json')
    assert len(media['items']) == 29
    for item in media['items']:
        for field, ext in [('src', 'mp4'), ('fallback', 'webp')]:
            assert sha(web / 'runtime/web/motion' / (item['key'] + '.' + ext)) == item[field + 'Sha256']
    work.mkdir(parents=True)
    out.mkdir()
    common = [
        (ROOT / 'docs/releases' / (version + '.md'), '开始阅读.md', 0o644),
        (ROOT / 'docs/releases/licenses/说明.md', 'licenses/说明.md', 0o644),
        (ROOT / 'docs/releases/licenses/Suika3-LICENSE.txt', 'licenses/Suika3-LICENSE.txt', 0o644),
        (ROOT / 'docs/releases/licenses/Suika3-NOTICE.txt', 'licenses/Suika3-NOTICE.txt', 0o644),
        (ROOT / 'system/font/OFL.txt', 'licenses/Noto-OFL.txt', 0o644),
    ]
    for p, _, _ in common:
        assert p.is_file(), str(p)
    identity = {
        'schemaVersion': 1, 'version': version, 'date': '2026-11-05',
        'contentBuildId': wm['contentBuildId'],
        'runtimeBuildIds': {'web': wm['runtimeBuildId'], 'native': nm['runtimeBuildId']},
        'sources': {'web': args.web_build, 'native': args.native_build},
        'webInputFingerprint': b['inputFingerprint'],
        'counts': b['counts'], 'nativeMotionCG': 0,
        'nativeSaveCards': '文字卡片；提示与选项纹理在绘制前准备',
        'webDistribution': '原冻结网页文件，未合并阿里云专用加载优化',
        'playerSavesIncluded': False,
    }
    identity_file = work / 'package-identity.json'
    write(identity_file, identity)
    common.append((identity_file, 'package-identity.json', 0o644))
    archives = []

    def archive(label, entries):
        target = out / (version + '-' + label + '.zip')
        expected = {}
        with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for file, relative, mode in entries:
                assert file.is_file() and not file.is_symlink(), str(file)
                name = version + '/' + relative
                assert name not in expected and '..' not in Path(name).parts
                expected[name] = record(file, name)
                expected[name]['mode'] = mode
                info = zipfile.ZipInfo.from_file(file, name)
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | mode) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                with file.open('rb') as src, z.open(info, 'w', force_zip64=True) as dst:
                    shutil.copyfileobj(src, dst, 8 * 1024 * 1024)
        with zipfile.ZipFile(target) as z:
            assert set(z.namelist()) == set(expected)
            for name, x in expected.items():
                h = hashlib.sha256()
                with z.open(name) as stream:
                    for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
                        h.update(chunk)
                assert h.hexdigest() == x['sha256'] and z.getinfo(name).file_size == x['bytes'], name
                assert (z.getinfo(name).external_attr >> 16) & 0o777 == x['mode'], name
        assert target.stat().st_size < 2 * 1024 ** 3, '附件超过2GiB'
        x = {**record(target, target.name), 'platform': label, 'filesVerified': len(expected)}
        archives.append(x)
        write(work / (label + '-entries.json'), list(expected.values()))
        print(json.dumps(x, ensure_ascii=False), flush=True)

    entries = common + [(web / 'runtime' / x['path'], x['path'], 0o644) for x in wm['outputs']]
    entries += [(ROOT / 'tools/release' / p, p, mode) for p, mode in
                [('serve.cjs', 0o644), ('启动网页.command', 0o755), ('启动网页.bat', 0o644)]]
    archive('web', entries)
    engines = []
    for platform, exe in [('macos', 'SDK/macos/root/bin/suika3'),
                          ('windows-x64', 'SDK/windows/suika3-win64.exe'),
                          ('windows-arm64', 'SDK/windows/suika3-arm64.exe')]:
        launch = work / platform / ('启动.command' if platform == 'macos' else '启动.bat')
        launch.parent.mkdir(parents=True)
        launch.write_bytes(b'#!/bin/sh\ncd "$(dirname "$0")" || exit 1\nexec ./suika3\n' if platform == 'macos'
                           else b'@echo off\r\ncd /d "%~dp0"\r\nsuika3.exe\r\n')
        engines.append((ROOT / exe, 'input/' + exe, 0o755))
        archive(platform, common + [
            (native / 'runtime/stage/assets.arc', platform + '/assets.arc', 0o644),
            (ROOT / exe, platform + ('/suika3' if platform == 'macos' else '/suika3.exe'), 0o755),
            (launch, platform + '/' + launch.name, 0o755 if platform == 'macos' else 0o644),
        ])
    # 原始输入保留原路径；阶段文件复用相同字节，仅另存实际差异。
    # native 与 web 的693项阶段输入仅 main.ray 不同，避免重复归档大图片。
    entries = common + [(web / 'input' / x['path'], 'input/' + x['path'],
                         (web / 'input' / x['path']).stat().st_mode & 0o777) for x in b['inputs']]
    entries += engines
    stored = {sha(p): rel for p, rel, _ in entries}
    stages = {}
    for platform, manifest, build in [('web', wm, web), ('native', nm, native)]:
        stage = []
        for x in manifest['inputs']:
            file = build / 'runtime/stage' / x['path']
            if x['sha256'] not in stored:
                relative = 'stage-overrides/' + platform + '/' + x['path']
                entries.append((file, relative, file.stat().st_mode & 0o777))
                stored[x['sha256']] = relative
            stage.append({**record(file, x['path']), 'source': stored[x['sha256']]})
        stages[platform] = {'inputs': stage, 'archiveSha256': sha(build / 'runtime/stage/assets.arc')}
    for x in wm['outputs']:
        if x['path'] != 'web/assets.arc':
            entries.append((web / 'runtime' / x['path'], 'web-files/' + x['path'][4:], 0o644))
    frozen = work / 'frozen-inputs.json'
    write(frozen, {'identity': identity, 'sourceInputs': b['inputs'], 'stages': stages,
                   'engines': [record(p, rel) for p, rel, _ in engines],
                   'webFiles': [x for x in wm['outputs'] if x['path'] != 'web/assets.arc']})
    entries += [(frozen, 'frozen-inputs.json', 0o644),
                (ROOT / 'tools/release/restore-p5.py', 'restore-p5.py', 0o644),
                (web / 'build-result.json', 'manifests/web-build.json', 0o644),
                (web / 'runtime/build-manifest.json', 'manifests/web-runtime.json', 0o644),
                (native / 'runtime/build-manifest.json', 'manifests/native-runtime.json', 0o644)]
    archive('build-inputs', entries)
    checksums = {'version': version, 'archiveEntriesVerified': True, 'identity': identity, 'packages': archives}
    write(out / 'checksums.json', checksums)
    (out / 'SHA256SUMS.txt').write_text(''.join(x['sha256'] + '  ' + x['path'] + '\n' for x in archives))
    write(work / 'packaging-result.json', checksums)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--version', required=True)
    p.add_argument('--web-build', required=True)
    p.add_argument('--native-build', required=True)
    package(p.parse_args())
