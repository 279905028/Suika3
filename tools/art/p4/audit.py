"""P4-05 本批资源测量和目视用图。只写本包，不把自动测量当目视通过。"""
import argparse
import collections
import hashlib
import json
import math
import shutil
import struct
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, features

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/修订协作/P4-演出与美术'
QA = ROOT / 'qa/dialogue-p4-P4-05-20261103'
DOC = BASE / 'P4-05'
OUT = ROOT / 'assets/sources/20261103/P4-05'


def read(p):
    return json.loads(p.read_text())


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def rel(p):
    return str(p.relative_to(ROOT))


def fp(p):
    return {'path': rel(p), 'sha256': sha(p)}


def write(p, value):
    assert any(p.is_relative_to(x) for x in [QA, DOC, OUT])
    p.parent.mkdir(parents=True, exist_ok=True)
    assert not p.exists(), '不覆盖既有证据: ' + str(p)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def chunks(p):
    b = p.read_bytes()
    if b[:4] != b'RIFF' or b[8:12] != b'WEBP':
        return None
    result = []
    offset = 12
    assert int.from_bytes(b[4:8], 'little') + 8 == len(b), 'RIFF长度不符'
    while offset + 8 <= len(b):
        tag = b[offset:offset + 4].decode('ascii')
        n = int.from_bytes(b[offset + 4:offset + 8], 'little')
        assert offset + 8 + n <= len(b)
        result.append({'tag': tag, 'bytes': n})
        offset += 8 + n + n % 2
    assert offset == len(b)
    return result


def measure(p):
    with Image.open(p) as verify:
        verify.verify()
    with Image.open(p) as im:
        im.load()
        rgba = im.convert('RGBA')
        alpha = rgba.getchannel('A')
        hist = alpha.histogram()
        icc = im.info.get('icc_profile', b'')
        riff = chunks(p) if im.format == 'WEBP' else None
        return dict(fp(p), bytes=p.stat().st_size, format=im.format,
                    mode=im.mode, width=im.width, height=im.height,
                    direction='landscape' if im.width > im.height else 'portrait' if im.width < im.height else 'square',
                    exifOrientation=im.getexif().get(274), normalizedOrientation=im.getexif().get(274, 1),
                    frames=getattr(im, 'n_frames', 1), alphaChannel='A' in im.getbands(),
                    alpha={'extrema': list(alpha.getextrema()), 'transparentPixels': hist[0],
                           'partialPixels': sum(hist[1:255]), 'opaquePixels': hist[255],
                           'bboxAlpha1': alpha.getbbox(), 'bboxAlpha8': alpha.point(lambda x: 255 if x >= 8 else 0).getbbox()},
                    iccSha256=hashlib.sha256(icc).hexdigest() if icc else None,
                    iccBytes=len(icc), rgbaSha256=hashlib.sha256(rgba.tobytes()).hexdigest(),
                    alphaSha256=hashlib.sha256(alpha.tobytes()).hexdigest(),
                    webpChunks=riff, losslessWebP=any(x['tag'] == 'VP8L' for x in riff) if riff else None,
                    decode='passed')


def gather():
    baseline = read(BASE / 'P4-01/resources.baseline.json')
    manifest = {a['assetId']: a for a in read(ROOT / 'assets/current/manifest.json')['assets']}
    fresh = read(BASE / 'P4-03/resource-records.json')['assets']
    produced = read(ROOT / 'assets/sources/20261103/P4-04/production-assets.json')['records']
    replaced = {a['assetId'] for a in produced if a['assetId'] in manifest}
    uses = collections.defaultdict(set)
    for f in sorted(BASE.glob('P4-02-*/bindings.candidate.json')):
        for b in read(f)['bindings']:
            if not b['binding']:
                continue
            for state in [b['binding']['enter'], b['binding']['exit']['restore']]:
                for a in [state['background'], *state['characters'], *state['props'], state['cg']]:
                    if a:
                        uses[a['assetId']].add(b['nodeId'])
    decisions = read(BASE / 'P4-03/decisions.json')['decisions']
    cg = {a['assetId']: a for a in read(BASE / 'P4-04/cg-review.json')['records']}
    provenance_cache = {}
    records = []
    for a in baseline['assets']:
        m = manifest[a['assetId']]
        p = ROOT / m['a11']['path']
        if str(p) not in provenance_cache:
            provenance_cache[str(p)] = read(p)
        d = provenance_cache[str(p)]
        rs = d if isinstance(d, list) else d.get('records', d.get('assets', d.get('checks', [])))
        old = next((x for x in rs if isinstance(x, dict) and x.get('assetId') == a['assetId']), None)
        origin = [fp(ROOT / 'assets/current/manifest.json'), fp(p)]
        upstream = None
        if old and old.get('upstreamRecord'):
            upstream = old['upstreamRecord']
            origin.append(fp(ROOT / upstream))
        records.append(dict(a, recordId=a['assetId'] + '@baseline', origin='baseline',
                            selected=a['assetId'] not in replaced, encoding=m['encoding'],
                            provenance=origin, upstreamRecord=upstream,
                            restrictions=m['restrictions'],
                            approvedScope=m['approval']['scope'],
                            usedNodeIds=sorted(uses[a['assetId']]),
                            candidateUseEvidence=[fp(BASE / 'P4-03/decisions.json')] if any(a['assetId'] in d['assetIds'] for d in decisions) else []))
    for a in fresh:
        records.append({'recordId': a['assetId'] + '@P4-03', 'assetId': a['assetId'], 'type': a['type'],
                        'origin': 'P4-03', 'selected': True, 'source': {k: a['source'][k] for k in ['path', 'sha256']},
                        'runtime': {k: a['archiveWebP'][k] for k in ['path', 'sha256']}, 'approvalEvidence': None,
                        'encoding': a['encoding'], 'provenance': [fp(BASE / 'P4-03/resource-records.json'), a['productionEvidence'], *a['references']],
                        'restrictions': [d for d in decisions if a['assetId'] in d['assetIds']], 'approvedScope': None,
                        'usedNodeIds': [], 'proposedNodeIds': sorted({n for d in decisions for n in d.get('assetNodeScopes', {}).get(a['assetId'], [])}),
                        'candidateUseEvidence': [fp(BASE / 'P4-03/decisions.json')]})
    for a in produced:
        records.append({'recordId': a['assetId'] + '@P4-04', 'assetId': a['assetId'], 'type': 'cg',
                        'origin': 'P4-04', 'selected': True, 'source': {k: a['source'][k] for k in ['path', 'sha256']},
                        'runtime': {k: a['runtime'][k] for k in ['path', 'sha256']}, 'approvalEvidence': None,
                        'encoding': a['encoding'], 'provenance': [fp(ROOT / 'assets/sources/20261103/P4-04/production-assets.json'),
                        fp(ROOT / 'assets/sources/20261103/P4-04/prompts.json'), fp(ROOT / 'assets/sources/20261103/P4-04/final-prompts.json')],
                        'restrictions': cg[a['assetId']]['basis'], 'approvedScope': None, 'usedNodeIds': [],
                        'proposedNodeIds': cg[a['assetId']]['proposedNodeIds'], 'candidateUseEvidence': [fp(BASE / 'P4-04/cg-review.json')]})
    return records, baseline


def prepare():
    assert not (QA / 'measurements.json').exists(), '请用新批次复验，勿重写历史'
    records, baseline = gather()
    protected = {}
    for f in ['input-manifest.json', 'freeze.json']:
        for x in read(BASE / 'P4-01' / f)['files']:
            assert sha(ROOT / x['path']) == x['sha256'], '冻结输入变化: ' + x['path']
            protected[x['path']] = fp(ROOT / x['path'])
    for folder in [ROOT / 'scenario', ROOT / 'assets/current', ROOT / 'system',
                   BASE / 'P4-02', *BASE.glob('P4-02-*'), BASE / 'P4-03', BASE / 'P4-04',
                   ROOT / 'assets/sources/20261103/P4-03', ROOT / 'assets/sources/20261103/P4-04']:
        for p in folder.rglob('*'):
            if p.is_file():
                protected[rel(p)] = fp(p)
    for r in records:
        for x in [r['source'], r['runtime'], r['approvalEvidence'], *r['provenance'], *r['candidateUseEvidence']]:
            if x:
                assert sha(ROOT / x['path']) == x['sha256'], x['path']
                protected[x['path']] = x
    for p in [ROOT / 'AGENTS.md', ROOT / 'main.ray', ROOT / 'start.novel', ROOT / 'config.ini']:
        protected[rel(p)] = fp(p)
    write(QA / 'input-manifest.json', {'inputFingerprint': baseline['inputFingerprint'],
          'contentBuildId': read(BASE / 'P4-01/input-manifest.json')['contentBuildId'],
          'scope': 'P4冻结依赖、当前正文/资源/系统/入口、02/03/04交付和制作原件；不含本次要更新的TODO/计划',
          'files': list(protected.values())})
    for name in ['TODO-v1.1.md', 'docs/P4演出与美术子任务.md']:
        p = QA / 'before' / name
        p.parent.mkdir(parents=True, exist_ok=True)
        assert not p.exists()
        shutil.copyfile(ROOT / name, p)
    files = sorted({r[k]['path'] for r in records for k in ['source', 'runtime']})
    with ThreadPoolExecutor(max_workers=4) as pool:
        metadata = dict(zip(files, pool.map(lambda p: measure(ROOT / p), files)))
    for r in records:
        s, w = (metadata[r[k]['path']] for k in ['source', 'runtime'])
        r['technical'] = {'source': s, 'runtime': w}
        r['checks'] = {'sourceFingerprint': s['sha256'] == r['source']['sha256'],
                       'runtimeFingerprint': w['sha256'] == r['runtime']['sha256'],
                       'format': s['format'] == 'PNG' and w['format'] == 'WEBP',
                       'staticImage': s['frames'] == w['frames'] == 1,
                       'size': (s['width'], s['height']) == (w['width'], w['height']),
                       'orientation': s['normalizedOrientation'] == w['normalizedOrientation'] == 1,
                       'losslessBitstream': w['losslessWebP'],
                       'rgbaPixelsEqual': s['rgbaSha256'] == w['rgbaSha256'],
                       'alphaPixelsEqual': s['alphaSha256'] == w['alphaSha256']}
        r['formatStatus'] = 'passed' if all(r['checks'].values()) else 'rework'
        r['colorNote'] = '保留已有像素与ICC；未标记图按既有sRGB解释，不声称色域校准。'
        if s['iccSha256'] != w['iccSha256']:
            r['colorNote'] = '源/运行ICC不同；记录上游解释，RGBA未转换。本批不改ICC，不把像素一致冒充色彩管理实测。'
        r['visualStatus'] = 'not-tested'
    write(QA / 'measurements.json', {'date': '2026-11-03', 'taskId': 'P4-05', 'inputFingerprint': baseline['inputFingerprint'],
          'tools': {'Pillow': Image.__version__, 'libwebp': features.version('webp')}, 'records': records})
    print(json.dumps({'versions': len(records), 'selected': sum(r['selected'] for r in records), 'uniqueBitmaps': len(files),
                      'transparent': sum(r['technical']['runtime']['alpha']['extrema'][0] < 255 for r in records),
                      'format': dict(collections.Counter(r['formatStatus'] for r in records)),
                      'protected': len(protected)}, ensure_ascii=False), flush=True)


def previews():
    records = read(QA / 'measurements.json')['records']
    target = QA / 'previews'
    assert not target.exists()
    target.mkdir()
    font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
    smfont = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 12)
    day_path = ROOT / next(r for r in records if r['assetId'] == 'bg-noodle-shop-day')['runtime']['path']
    night_path = ROOT / next(r for r in records if r['assetId'] == 'bg-old-netcafe-backroom-night')['runtime']['path']
    day, night = (Image.open(p).convert('RGBA') for p in [day_path, night_path])
    index = {'scope': 'P4-05独立重建离线复验图，非引擎截图；透明边缘小窗按原像素1:1。',
             'backgrounds': [fp(day_path), fp(night_path)], 'sheets': [], 'details': []}
    transparent = [r for r in records if r['technical']['runtime']['alpha']['extrema'][0] < 255]
    opaque = [r for r in records if r not in transparent]
    for start in range(0, len(transparent), 4):
        group = transparent[start:start + 4]
        sheet = Image.new('RGB', (1152, 328 * len(group)), '#e4e8e7')
        draw = ImageDraw.Draw(sheet)
        items = []
        for row, r in enumerate(group):
            y = row * 328
            draw.text((8, y + 3), r['recordId'], fill='#182626', font=font)
            with Image.open(ROOT / r['runtime']['path']) as opened:
                im = opened.convert('RGBA')
            thumb = im.copy()
            thumb.thumbnail((180, 276), Image.Resampling.LANCZOS)
            for j, color in enumerate(['white', '#070b11', day, night]):
                panel = Image.new('RGBA', (184, 282), color) if isinstance(color, str) else color.resize((184, 282), Image.Resampling.LANCZOS)
                panel.alpha_composite(thumb, ((184 - thumb.width) // 2, (282 - thumb.height) // 2))
                sheet.paste(panel.convert('RGB'), (j * 188 + 4, y + 26))
                draw.text((j * 188 + 8, y + 310), ['white', 'black', 'day', 'night'][j], fill='#182626', font=smfont)
            alpha = im.getchannel('A')
            bbox = alpha.point(lambda x: 255 if x >= 8 else 0).getbbox()
            left, top, right, bottom = bbox
            xs = [x for x in range(im.width) if alpha.getpixel((x, top)) >= 8]
            ys_left = [yy for yy in range(top, bottom) if alpha.getpixel((left, yy)) >= 8]
            ys_right = [yy for yy in range(top, bottom) if alpha.getpixel((right - 1, yy)) >= 8]
            bx = [x for x in range(im.width) if alpha.getpixel((x, bottom - 1)) >= 8]
            centers = [(xs[len(xs)//2], top), (left, ys_left[len(ys_left)//2]),
                       (right - 1, ys_right[len(ys_right)//2]), (bx[len(bx)//2], bottom - 1)]
            crops = []
            for j, (cx, cy) in enumerate(centers):
                x0, y0 = max(0, min(im.width - 144, cx - 72)), max(0, min(im.height - 144, cy - 72))
                crop = im.crop((x0, y0, x0 + 144, y0 + 144))
                bg = Image.new('RGBA', crop.size, 'white' if j % 2 == 0 else '#070b11')
                bg.alpha_composite(crop)
                px, py = 760 + (j % 2) * 192, y + 26 + (j // 2) * 148
                sheet.paste(bg.convert('RGB'), (px, py))
                draw.text((px + 146, py + 10), ['T', 'L', 'R', 'B'][j], fill='#182626', font=font)
                crops.append({'region': ['top', 'left', 'right', 'bottom'][j], 'rect': [x0, y0, 144, 144], 'scale': 1})
            items.append({'recordId': r['recordId'], 'runtime': r['runtime'], 'row': row, 'nativeCrops': crops})
        p = target / f'alpha-{start//4+1:02d}.png'
        sheet.save(p)
        index['sheets'].append({'kind': 'alpha-four-background-and-native-crops', **fp(p), 'items': items})
    for start in range(0, len(opaque), 9):
        group = opaque[start:start + 9]
        sheet = Image.new('RGB', (1440, math.ceil(len(group)/3)*300), '#e4e8e7')
        draw = ImageDraw.Draw(sheet)
        items = []
        for j, r in enumerate(group):
            x, y = (j % 3)*480, (j // 3)*300
            with Image.open(ROOT / r['runtime']['path']) as im:
                im = im.convert('RGB')
                im.thumbnail((476, 268), Image.Resampling.LANCZOS)
                sheet.paste(im, (x+(480-im.width)//2, y+25+(270-im.height)//2))
            draw.text((x+5, y+4), r['recordId'].replace('@baseline', ''), fill='#182626', font=smfont)
            items.append({'recordId': r['recordId'], 'runtime': r['runtime'], 'cell': j})
        p = target / f'opaque-{start//9+1:02d}.png'
        sheet.save(p)
        index['sheets'].append({'kind': 'opaque-full-image-contact', **fp(p), 'items': items})
    write(QA / 'preview-index.json', index)
    print(json.dumps({'alphaSheets': math.ceil(len(transparent)/4), 'opaqueSheets': math.ceil(len(opaque)/9), 'records': len(records)}))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('phase', choices=['prepare', 'previews'])
    args = p.parse_args()
    {'prepare': prepare, 'previews': previews}[args.phase]()
