#!/usr/bin/env python3
"""保留PNG原件；只转码无损WebP并制作离线检查预览，不重绘或修脸。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, features
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / 'qa/portrait-gap-fill-20261030'
SRC = ROOT / 'assets/sources/20261030-portrait-gap-fill'
CURRENT = ROOT / 'assets/current/portrait-gap-20261030'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def save_json(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def run():
    selected = json.loads((SRC / 'selected.json').read_text())['assets']
    assert len(selected) == 14
    CURRENT.mkdir(parents=True, exist_ok=True)
    (QA / 'composites').mkdir(exist_ok=True)
    records = []
    for a in selected:
        source = ROOT / a['sourcePath']
        native = Image.open(source)
        assert native.format == 'PNG' and native.mode == 'RGBA'
        assert native.size == (1024, 1536)
        alpha = native.getchannel('A')
        hist = alpha.histogram()
        assert hist[0] > native.width * native.height * .25
        assert alpha.getextrema()[1] >= 250
        # The subject can meet the bottom crop; the top and outer corners stay clear.
        corners = [alpha.getpixel(p) for p in [(0, 0), (1023, 0), (0, 1535), (1023, 1535)]]
        # 原生李老板左上角为1/255 alpha；保留原像素，在四底合成中核对。
        assert max(corners) <= 1
        dst = ROOT / a['runtimePath']
        assert dst.parent == CURRENT
        if not dst.exists():
            native.save(dst, format='WEBP', lossless=True, method=6, exact=True)
        decoded = Image.open(dst)
        assert decoded.format == 'WEBP'
        assert decoded.convert('RGBA').tobytes() == native.tobytes(), '无损RGBA像素不一致'
        records.append({
            'assetId': a['assetId'], 'name': a['name'],
            'sourceFile': a['sourcePath'], 'expectedSourceSha256': sha(source),
            'offlineStatus': '待目视', 'formatStatus': '通过',
            'role': 'pending_adoption_review',
            'webpMetadata': {'sha256': sha(dst), 'width': 1024, 'height': 1536,
                             'bytes': dst.stat().st_size,
                             'alpha': {'channelPresent': True, 'range': alpha.getextrema(),
                                       'transparentPixels': hist[0], 'cornerAlpha': corners,
                                       'visibleBBoxAlphaAbove32': alpha.point(lambda v: 255 if v > 32 else 0).getbbox()}},
            'rgbaPixelsEqual': True,
        })
    params = {'tool': 'Pillow / libwebp', 'version': Image.__version__ + ' / ' + features.version('webp'),
              'lossless': True, 'method': 6, 'exact': True,
              'profileProcess': '保留源RGBA，不做像素色彩转换；原生PNG不重写'}
    save_json(QA / 'image-checks.json', {'scope': '本批14图无损转码与alpha离线检查；目视结论另记',
                                       'encoding': params, 'records': records})
    font = ImageFont.truetype(str(ROOT / 'system/font/NotoSansCJK-Medium.ttc'), 21)
    bgs = {
        'white': Image.new('RGBA', (256, 384), '#f6f4ef'),
        'black': Image.new('RGBA', (256, 384), '#10151a'),
        'day': Image.open(ROOT / 'assets/current/SUI-A08/bg-old-netcafe-counter-day.webp').convert('RGBA').resize((256, 384)),
        'night': Image.open(ROOT / 'assets/current/SUI-A08/bg-old-netcafe-counter-night.webp').convert('RGBA').resize((256, 384)),
    }
    for label, bg in bgs.items():
        sheet = Image.new('RGB', (1024, 1664), '#eae5dc')
        draw = ImageDraw.Draw(sheet)
        for i, a in enumerate(selected):
            im = Image.open(ROOT / a['runtimePath']).convert('RGBA').resize((256, 384), Image.Resampling.LANCZOS)
            tile = bg.copy()
            tile.alpha_composite(im)
            x, y = (i % 4) * 256, (i // 4) * 416
            sheet.paste(tile.convert('RGB'), (x, y))
            draw.text((x + 8, y + 388), a['name'], fill='#17232a', font=font)
        sheet.save(QA / 'composites' / (label + '.jpg'), quality=94)
    # Clear, labelled face overview, intended for human review rather than as a game asset.
    sheet = Image.new('RGB', (1280, 1120), '#f1ede6')
    draw = ImageDraw.Draw(sheet)
    for i, a in enumerate(selected):
        native = Image.open(ROOT / a['runtimePath']).convert('RGBA')
        preview = Image.new('RGBA', native.size, '#f5f2ec')
        preview.alpha_composite(native)
        preview = preview.crop((180, 0, 880, 700)).resize((256, 256), Image.Resampling.LANCZOS)
        x, y = (i % 5) * 256, (i // 5) * 360
        sheet.paste(preview.convert('RGB'), (x, y))
        draw.text((x + 9, y + 265), a['name'], fill='#17232a', font=font)
    sheet.save(QA / '角色总览.jpg', quality=95)
    print(json.dumps({'images': len(records), 'rgbaExact': True, 'encoding': params}, ensure_ascii=False))


if __name__ == '__main__':
    run()
