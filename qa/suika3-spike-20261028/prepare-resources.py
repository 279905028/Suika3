#!/usr/bin/env python3
"""仅复制固定白名单的历史图到技术样板；不改变原件或正式采用清单。"""
from pathlib import Path
import hashlib
import json
import shutil
import struct
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SOURCE = Path('/Users/yipin/Desktop/cjb-v1.1-suika')
OUT = ROOT / 'resources'
ALLOWLIST = [
    ('bg-day', '庭院·昼', 'background', 'assets/current/backgrounds/tc-bg-courtyard-day.webp'),
    ('bg-night', '庭院·夜', 'background', 'assets/current/backgrounds/tc-bg-courtyard-night.webp'),
    ('char-xiaoman', '罗小满·人形', 'character', 'assets/current/characters/xiaoman/tc-char-xiaoman-human-base.webp'),
    ('char-zhouzhi', '周栀·人形', 'character', 'assets/current/characters/zhouzhi/tc-char-zhouzhi-human-base.webp'),
    ('char-mengyao', '孟遥·人形', 'character', 'assets/current/characters/mengyao/tc-char-mengyao-human-base.webp'),
    ('char-piao', '飘·人形', 'character', 'assets/current/characters/piao/tc-char-piao-human-base.webp'),
    ('char-huangqiuqiu', '黄球球·人形', 'character', 'assets/current/characters/huangqiuqiu/tc-char-huangqiuqiu-human-base.webp'),
    ('char-huangqiuqiu-orb', '黄球球·球形', 'character', 'assets/current/characters/huangqiuqiu/tc-char-huangqiuqiu-orb-base.webp'),
    ('char-wenwen', '文文·人形', 'character', 'assets/current/characters/wenwen/tc-char-wenwen-human-base.webp'),
    ('cg-repair', '文文·维修交接', 'cg', 'assets/current/cg/wenwen-cg-09-repair-handoff.webp'),
]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def chunks(path):
    data = path.read_bytes()
    assert data[:4] == b'RIFF' and data[8:12] == b'WEBP', path
    out = []
    p = 12
    while p + 8 <= len(data):
        tag, n = data[p:p+4].decode('ascii'), struct.unpack('<I', data[p+4:p+8])[0]
        out.append(tag)
        p += 8 + n + (n % 2)
    return out

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    for asset_id, label, role, rel in ALLOWLIST:
        src = SOURCE / rel
        dest = OUT / (asset_id + '.webp')
        before = sha(src)
        shutil.copyfile(src, dest)
        assert before == sha(src) == sha(dest)
        with Image.open(src) as source_im, Image.open(dest) as im:
            assert im.format == 'WEBP'
            rgba = im.convert('RGBA')
            assert source_im.convert('RGBA').tobytes() == rgba.tobytes()
            hist = rgba.getchannel('A').histogram()
            ck = chunks(dest)
            if role == 'character':
                assert hist[0] > 0 and sum(hist[1:255]) > 0
                assert 'VP8L' in ck, (asset_id, ck)
            records.append({
                'id': asset_id, 'label': label, 'role': role,
                'path': f'resources/{dest.name}', 'source': str(src),
                'sha256': sha(dest), 'sourceSha256Before': before,
                'sourceSha256After': sha(src), 'bytes': dest.stat().st_size,
                'format': im.format, 'width': im.width, 'height': im.height,
                'mode': im.mode, 'hasAlpha': 'A' in im.getbands(),
                'alphaExtrema': list(rgba.getchannel('A').getextrema()),
                'transparentPixels': hist[0], 'partialAlphaPixels': sum(hist[1:255]),
                'opaquePixels': hist[255], 'webpChunks': ck,
                'encoding': 'lossless' if 'VP8L' in ck else 'lossy',
                'operation': 'byte-identical copy', 'decodedPixelsIdentical': True,
                'decodedRGBABytes': im.width * im.height * 4,
                'adoption': 'technical-fixture-only; not approved production art',
            })
    # 仅作为验收图：不输出新的正式美术，不改变各源图。
    chars = [r for r in records if r['role'] == 'character']
    cw, ch, gap = 210, 315, 22
    sheet = Image.new('RGB', (cw * len(chars), (ch + gap) * 4), '#999999')
    draw = ImageDraw.Draw(sheet)
    backgrounds = ['white', 'black', 'bg-day', 'bg-night']
    for y, bg in enumerate(backgrounds):
        for x, r in enumerate(chars):
            if bg in ('white', 'black'):
                tile = Image.new('RGBA', (cw, ch), bg)
            else:
                with Image.open(OUT / f'{bg}.webp') as im:
                    tile = im.convert('RGBA').resize((cw, ch))
            with Image.open(ROOT / r['path']) as im:
                char = im.convert('RGBA')
                char.thumbnail((cw, ch), Image.Resampling.LANCZOS)
                tile.alpha_composite(char, ((cw-char.width)//2, ch-char.height))
            sheet.paste(tile.convert('RGB'), (x*cw, y*(ch+gap)))
            draw.text((x*cw+4, y*(ch+gap)+ch+3), f'{r["id"][5:]} / {bg}', fill='black')
    sheet.save(OUT / 'alpha-contact-sheet.jpg', quality=92)
    manifest = {
        'schemaVersion': 1, 'batch': 'suika3-spike-20261028',
        'purpose': 'SUI-T representative graphics load; no production adoption',
        'scope': '2 day/night backgrounds, 5 heroines, Wenwen, Huangqiuqiu orb, 1 non-intimate CG',
        'sourceManifest': str(SOURCE / 'assets/manifests/current-art.json'),
        'sourceManifestSha256': sha(SOURCE / 'assets/manifests/current-art.json'),
        'resourceCount': len(records), 'totalBytes': sum(r['bytes'] for r in records),
        'decodedRGBABytes': sum(r['decodedRGBABytes'] for r in records),
        'decodedMemoryNote': 'Sum of width*height*4; excludes engine copies, GPU textures, mipmaps, audio, font and runtime.',
        'visualAudit': 'resources/alpha-contact-sheet.jpg (white / black / day / night diagnostics only)',
        'assets': records,
    }
    (ROOT / 'resource-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:manifest[k] for k in ['resourceCount','totalBytes','decodedRGBABytes']},ensure_ascii=False))

if __name__ == '__main__':
    main()
