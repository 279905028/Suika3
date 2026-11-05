#!/usr/bin/env python3
"""为冻结网页包创建独立分发副本，保留正文、引擎与存档兼容标识。"""
import argparse
import concurrent.futures
import gzip
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image, ImageChops, ImageStat, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[3]


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def optimize_image(job):
    source, target, label = job
    image = Image.open(source)
    image.load()
    if 'A' in image.getbands():
        assert image.getchannel('A').getextrema() == (255, 255), '只压缩不透明背景和CG'
    image = image.convert('RGB')
    before = source.stat().st_size
    quality = 90
    for quality in (90, 94):
        image.save(target, format='WEBP', lossless=False, quality=quality, method=6)
        encoded = Image.open(target)
        encoded.load()
        assert encoded.format == 'WEBP' and encoded.size == image.size
        diff = ImageChops.difference(image, encoded.convert('RGB'))
        stats = ImageStat.Stat(diff)
        mse = sum(a * a + b * b for a, b in zip(stats.mean, stats.stddev)) / 3
        psnr = 99 if mse == 0 else 10 * math.log10(255 * 255 / mse)
        mae = sum(stats.mean) / 3
        if psnr >= 34 and mae <= 3:
            break
    accepted = psnr >= 34 and mae <= 3 and target.stat().st_size < before
    if not accepted:
        shutil.copy2(source, target)
    return {'path': label, 'sourceSHA256': sha(source), 'sha256': sha(target),
            'beforeBytes': before, 'afterBytes': target.stat().st_size,
            'size': list(image.size), 'quality': quality if accepted else 'original',
            'meanAbsoluteError': mae, 'psnr': psnr, 'compressed': accepted}


def subset_font(stage, inputs, dependency_dir):
    sys.path.insert(0, str(dependency_dir))
    import fontTools
    from fontTools import subset
    from fontTools.ttLib import TTCollection
    codepoints = set(range(32, 127))
    for item in inputs:
        path = stage / item['path']
        if path.suffix in {'.ray', '.novel', '.gui', '.anime', '.ini'}:
            codepoints.update(map(ord, path.read_text()))
    fonts = [item for item in inputs if item['path'].endswith('.ttc')]
    assert len(fonts) == 1
    path = stage / fonts[0]['path']
    before_sha, before_bytes = sha(path), path.stat().st_size
    collection = TTCollection(str(path))
    coverage = []
    for font in collection.fonts:
        expected = codepoints & set(font.getBestCmap())
        options = subset.Options()
        options.hinting = True
        options.layout_features = ['*']
        options.name_IDs = ['*']
        options.name_legacy = True
        options.name_languages = ['*']
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=codepoints)
        sub.subset(font)
        assert expected <= set(font.getBestCmap()), '字体裁剪丢失原有字形'
        coverage.append(len(expected))
        font.recalcTimestamp = False
    tmp = path.with_suffix('.subset.ttc')
    collection.save(str(tmp))
    reread = TTCollection(str(tmp))
    assert len(reread.fonts) == len(collection.fonts)
    for font, expected in zip(reread.fonts, coverage):
        assert len(codepoints & set(font.getBestCmap())) == expected
    assert tmp.stat().st_size < before_bytes
    tmp.replace(path)
    return {'path': fonts[0]['path'], 'sourceSHA256': before_sha, 'sha256': sha(path),
            'beforeBytes': before_bytes, 'afterBytes': path.stat().st_size,
            'facesPreserved': len(collection.fonts), 'coveredCodepointsByFace': coverage,
            'requestedCodepoints': len(codepoints), 'fontTools': fontTools.__version__}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-build', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--work', required=True)
    parser.add_argument('--font-tools-dir', required=True)
    args = parser.parse_args()
    source = (ROOT / args.source_build).resolve()
    out, work = (ROOT / args.out).resolve(), (ROOT / args.work).resolve()
    assert out.is_relative_to(ROOT / 'dist') and work.is_relative_to(ROOT / 'qa')
    assert not out.exists() and not work.exists(), '必须使用新目录'
    runtime = source / 'runtime'
    manifest = json.loads((runtime / 'build-manifest.json').read_text())
    assets = json.loads((ROOT / 'assets/current/manifest.json').read_text())
    assert assets['contentBuildId'] == manifest['contentBuildId']
    for item in manifest['inputs']:
        assert sha(runtime / 'stage' / item['path']) == item['sha256'], item['path']
    for item in manifest['outputs']:
        assert sha(runtime / item['path']) == item['sha256'], item['path']
    stage, web = work / 'stage', out / 'web'
    stage.mkdir(parents=True)
    shutil.copytree(runtime / 'web', web)
    for item in manifest['inputs']:
        target = stage / item['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(runtime / 'stage' / item['path'], target)
    jobs = []
    for asset in assets['assets']:
        if asset['type'] in {'background', 'cg'}:
            relative = asset['runtimePath']
            jobs.append((runtime / 'stage' / relative, stage / relative, relative))
    for path in sorted((runtime / 'web/motion').glob('*.webp')):
        jobs.append((path, web / 'motion' / path.name, 'web/motion/' + path.name))
    print('开始生成 {} 个网页图片副本'.format(len(jobs)), flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        images = []
        for index, row in enumerate(pool.map(optimize_image, jobs)):
            images.append(row)
            if index % 20 == 19:
                print('图片副本 {}/{}'.format(index + 1, len(jobs)), flush=True)
    font = subset_font(stage, manifest['inputs'], Path(args.font_tools_dir))
    changed = {item['path'] for item in images if not item['path'].startswith('web/')} | {font['path']}
    for item in manifest['inputs']:
        if item['path'] not in changed:
            assert sha(stage / item['path']) == item['sha256'], '非目标文件变化：' + item['path']
    pack = work / 'suika3-pack'
    shutil.copy2(ROOT / 'SDK/macos/suika3-pack', pack)
    pack.chmod(0o755)
    subprocess.run(['xattr', '-d', 'com.apple.quarantine', str(pack)], capture_output=True)
    result = subprocess.run([str(pack), *sorted(item['path'] for item in manifest['inputs'])], cwd=stage, capture_output=True, text=True, timeout=180)
    (work / 'pack.log').write_text(result.stdout + result.stderr)
    assert result.returncode == 0, '资源打包失败'
    shutil.copy2(stage / 'assets.arc', web / 'assets.arc')
    loader = ROOT / 'tools/deploy/aliyun/core-loader.js'
    shutil.copy2(loader, web / 'core-loader.js')
    motion_path = web / 'title-motion.js'
    motion = motion_path.read_text()
    assert motion.count("v.preload='auto'") == 1
    assert motion.count('v.src=config.src;this.sync();this.apply();') == 1
    assert motion.count('if(v.readyState<2)return;') == 1
    motion = motion.replace("v.preload='auto'", "v.preload='none'")
    motion = motion.replace('v.src=config.src;this.sync();this.apply();', 'this.sync();this.apply();')
    motion = motion.replace('if(v.readyState<2)return;', "if(!v.getAttribute('src')){v.src=config.src;v.load();}if(v.readyState<2)return;")
    motion_path.write_text(motion)
    core = {'bytes': (web / 'assets.arc').stat().st_size, 'sha256': sha(web / 'assets.arc')}
    distribution_id = hashlib.sha256(json.dumps({'sourceRuntimeBuildId': manifest['runtimeBuildId'], 'core': core,
        'images': images, 'font': font, 'loader': sha(loader), 'adapter': sha(Path(__file__)), 'titleMotion': sha(motion_path)}, sort_keys=True).encode()).hexdigest()[:16]
    base_path = '/r/' + distribution_id + '/'
    html = (web / 'index.html').read_text()
    old = 'Module.preRun=function(){FS.createPreloadedFile("/","assets.arc","assets.arc",!0,!1)}'
    assert html.count(old) == 1 and '<base ' not in html
    new = 'Module.preRun=function(){var dependency="suika3-core";addRunDependency(dependency);window.suiLoadCoreArchive(new URL("assets.arc",document.baseURI).href,' + json.dumps(core, separators=(',', ':')) + ').then(function(bytes){FS.createDataFile("/","assets.arc",bytes,true,false,true);removeRunDependency(dependency)}).catch(function(error){window.suiLoadCoreError(error);abort(error)})}'
    html = html.replace(old, new)
    html = html.replace('<head>', '<head><base href="' + base_path + '">', 1)
    assert html.count('<base href=') == 1
    html = html.replace('</head>', '<script src="core-loader.js"></script></head>', 1)
    (web / 'index.html').write_text(html)
    outputs = []
    for path in sorted(web.rglob('*')):
        if path.is_file():
            outputs.append({'path': 'web/' + path.relative_to(web).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path)})
    compressed = []
    for item in outputs:
        path = out / item['path']
        if path.suffix in {'.html', '.js', '.css'}:
            target = Path(str(path) + '.gz')
            with path.open('rb') as src, target.open('wb') as dst:
                with gzip.GzipFile(filename='', fileobj=dst, mode='wb', compresslevel=6, mtime=0) as gz:
                    shutil.copyfileobj(src, gz)
            assert hashlib.sha256(gzip.decompress(target.read_bytes())).hexdigest() == item['sha256']
            compressed.append({'path': item['path'] + '.gz', 'bytes': target.stat().st_size, 'sha256': sha(target)})
    final = {'status': 'prepared-not-deployed', 'distributionId': distribution_id, 'assetBasePath': base_path,
        'sourceBuild': args.source_build, 'runtimeBuildId': manifest['runtimeBuildId'],
        'contentBuildId': manifest['contentBuildId'], 'databasePrefix': manifest['databasePrefix'],
        'compatibility': '运行兼容标识、正文、GUI脚本、透明立绘、道具、视频和存档空间保持；分发身份独立记录',
        'pillowVersion': pillow_version, 'images': images, 'font': font,
        'originalArchiveBytes': (runtime / 'web/assets.arc').stat().st_size, 'core': core,
        'files': outputs, 'compressedFiles': compressed,
        'totalWebBytes': sum(item['bytes'] for item in outputs)}
    write_json(out / 'release-manifest.json', final)
    write_json(work / 'optimization-report.json', final)
    print(json.dumps({k: final[k] for k in ['distributionId', 'assetBasePath', 'originalArchiveBytes', 'core', 'totalWebBytes']}, indent=2), flush=True)


if __name__ == '__main__':
    main()
