#!/usr/bin/env python3
"""从已验收的 Suika3 网页包生成独立部署包，不重建或修改历史输入。"""
import argparse
import gzip
import hashlib
import json
import shutil
import tarfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[3]


def digest(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def json_write(file, value):
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def inside_root(value):
    result = (ROOT / value).resolve()
    if ROOT not in result.parents:
        raise ValueError('路径必须在本工程内')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-build', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--verification', required=True)
    args = parser.parse_args()
    source = inside_root(args.source_build)
    out = inside_root(args.out)
    verification_path = inside_root(args.verification)
    if out.exists() or out.parts[len(ROOT.parts)] != 'dist':
        raise ValueError('必须指定 dist 下不存在的新目录')
    build = json.loads((source / 'build-result.json').read_text())
    runtime = json.loads((source / 'runtime/build-manifest.json').read_text())
    verification = json.loads(verification_path.read_text())
    assert verification['status'] == 'pass', '先执行同版本完整核验'
    assert build['runtimeBuildId'] == runtime['runtimeBuildId'] == verification['runtimeBuildId']
    assert build['contentBuildId'] == runtime['contentBuildId'] == verification['contentBuildId']
    assert build['platform'] == 'web'
    web_source = source / 'runtime/web'
    expected = {}
    for item in runtime['outputs']:
        relative = Path(item['path'])
        assert relative.parts[0] == 'web' and '..' not in relative.parts
        expected[relative.relative_to('web').as_posix()] = item['sha256']
    actual = sorted(p.relative_to(web_source).as_posix() for p in web_source.rglob('*') if p.is_file())
    assert actual == sorted(expected), '网页目录存在未登记或缺少的文件'
    records = []
    for name in actual:
        file = web_source / name
        assert not file.is_symlink() and web_source.resolve() in file.resolve().parents
        assert digest(file) == expected[name], '网页文件指纹不符：' + name
    out.mkdir(parents=True)
    web = out / 'web'
    web.mkdir()
    for name in actual:
        original = web_source / name
        target = web / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, target)
        assert digest(target) == expected[name], '复制不一致：' + name
        records.append({'path': 'web/' + name, 'bytes': target.stat().st_size, 'sha256': expected[name]})

    # 只新增传输副本；运行原文件逐字节保持。压缩后收益不足 5% 的副本不保留。
    compressed = []
    for name in actual:
        original = web / name
        if original.suffix not in ('.html', '.js', '.css', '.wasm', '.arc', '.json'):
            continue
        target = Path(str(original) + '.gz')
        with original.open('rb') as src, target.open('wb') as dst:
            with gzip.GzipFile(fileobj=dst, mode='wb', filename='', compresslevel=6, mtime=0) as gz:
                shutil.copyfileobj(src, gz, 1024 * 1024)
        size = target.stat().st_size
        if size >= original.stat().st_size * 0.95:
            target.unlink()
            continue
        decoded = hashlib.sha256()
        with gzip.open(target, 'rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                decoded.update(chunk)
        assert decoded.hexdigest() == expected[name], '压缩副本不能完整还原：' + name
        shutil.copystat(original, target)
        compressed.append({'path': 'web/' + name + '.gz', 'original': 'web/' + name,
                           'bytes': size, 'sha256': digest(target),
                           'savedBytes': original.stat().st_size - size})
    manifest = {
        'createdAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
        'status': 'prepared-not-deployed',
        'version': build['version'],
        'runtimeBuildId': build['runtimeBuildId'],
        'contentBuildId': build['contentBuildId'],
        'sourceBuild': source.relative_to(ROOT).as_posix(),
        'verification': verification_path.relative_to(ROOT).as_posix(),
        'verificationSha256': digest(verification_path),
        'runtimeManifestSha256': digest(source / 'runtime/build-manifest.json'),
        'databasePrefix': build['databasePrefix'],
        'files': records, 'compressedFiles': compressed,
        'originalBytes': sum(x['bytes'] for x in records),
        'deployment': {'provider': 'aliyun', 'targetIp': '106.14.32.114',
                       'remoteChanges': False, 'publicUrl': None},
        'notes': ['仅发布 web/，不发布源码、QA、账号配置或历史素材',
                  '复用已验收网页包，正文与运行构建身份保持',
                  '不同访问来源的浏览器存档各自独立；玩家旧档不迁移、不删除']
    }
    json_write(out / 'release-manifest.json', manifest)
    checksums = records + compressed
    (out / 'SHA256SUMS').write_text(''.join(x['sha256'] + '  ' + x['path'] + '\n' for x in checksums))
    archive = out / 'suika3-web.tar.gz'
    with tarfile.open(archive, 'w:gz', compresslevel=6) as tar:
        for name in ['web', 'release-manifest.json', 'SHA256SUMS']:
            tar.add(out / name, arcname=name)
    with tarfile.open(archive, 'r:gz') as tar:
        file_members = {m.name: m for m in tar.getmembers() if m.isfile()}
        assert set(file_members) == {x['path'] for x in checksums} | {'release-manifest.json', 'SHA256SUMS'}
        for item in checksums:
            h = hashlib.sha256()
            with tar.extractfile(file_members[item['path']]) as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    h.update(chunk)
            assert h.hexdigest() == item['sha256'], '归档不一致：' + item['path']
    summary = {'status': 'pass', 'scope': '部署包复制、压缩还原与归档逐文件指纹；未上传',
               'runtimeBuildId': build['runtimeBuildId'], 'output': out.relative_to(ROOT).as_posix(),
               'fileCount': len(records), 'originalBytes': manifest['originalBytes'],
               'compressedFiles': compressed, 'archiveBytes': archive.stat().st_size,
               'archiveSha256': digest(archive)}
    json_write(out / 'package-report.json', summary)
    (out / 'suika3-web.tar.gz.sha256').write_text(summary['archiveSha256'] + '  suika3-web.tar.gz\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
