#!/usr/bin/env python3
"""截图与 WebP 源的颜色回归。只读素材、截图，仅写 color-audit.json。

默认审计 05-selected-transparent.png 与 07-cg.png。固定样板为原生 720×1280，
char-xiaoman 位置 (160,110)、缩放 0.4；截图画布 (420,34,440,783)。
夜景与 CG 位置 (-284,0)、缩放 0.77。
如果浏览器布局改变，必须从实测 canvas box 更新 --canvas。
退出码 0=保色通过，1=失败。历史观测按截图 SHA-256 保留。
"""
from pathlib import Path
from PIL import Image, ImageStat
from datetime import datetime, timezone
import argparse
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parent

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def mean(image, box):
    return [round(x, 4) for x in ImageStat.Stat(image.crop(box)).mean]

def mae(a, b):
    return sum(abs(x-y) for x, y in zip(a, b)) / 3

def audit(kind, asset, shot_path, canvas, transform, radius, probes):
    source = ROOT / 'resources' / (asset+'.webp')
    screenshot = ROOT / shot_path
    cx, cy, cw, ch = canvas
    tx, ty, scale = transform
    with Image.open(source) as src, Image.open(screenshot) as shot:
        src, shot = src.convert('RGBA'), shot.convert('RGB')
        rows = []
        for name, x, y in probes:
            box = [x-radius, y-radius, x+radius, y+radius]
            target = [round(cx+(tx+box[0]*scale)*cw/720), round(cy+(ty+box[1]*scale)*ch/1280),
                      round(cx+(tx+box[2]*scale)*cw/720), round(cy+(ty+box[3]*scale)*ch/1280)]
            if not (0 <= target[0] < target[2] <= shot.width and 0 <= target[1] < target[3] <= shot.height):
                raise ValueError(f'Probe outside screenshot: {kind} {name} {target}')
            expected = mean(src, box)
            actual = mean(shot, target)
            normal_error = mae(expected[:3], actual)
            swapped_error = mae([expected[2], expected[1], expected[0]], actual)
            rows.append({
                'name': name, 'sourceBox': box, 'screenshotBox': target,
                'sourceAlphaExtrema': list(src.crop(box).getchannel('A').getextrema()),
                'sourceMeanRGBA': expected, 'screenshotMeanRGB': actual,
                'rgbMeanAbsoluteError': round(normal_error,4),
                'rbSwappedMeanAbsoluteError': round(swapped_error,4),
                'passesColorPreservation': normal_error <= 6 and normal_error < swapped_error,
                'rbSwapDetected': swapped_error <= 6 and normal_error-swapped_error >= 20,
            })
        observation = {
            'kind': kind,
            'checkedAtUTC': datetime.now(timezone.utc).isoformat(),
            'screenshot': str(screenshot.relative_to(ROOT)), 'screenshotSha256': sha(screenshot),
            'screenshotDimensions': list(shot.size), 'source': str(source.relative_to(ROOT)),
            'sourceSha256': sha(source), 'nativeCanvas': [720,1280],
            'canvasBoxInScreenshot': canvas,
            'layerTransform': {'x':tx,'y':ty,'scaleX':scale,'scaleY':scale},
            'probes': rows,
            'meanRGBError': round(sum(r['rgbMeanAbsoluteError'] for r in rows)/len(rows),4),
            'meanRBSwappedError': round(sum(r['rbSwappedMeanAbsoluteError'] for r in rows)/len(rows),4),
            'allProbesPass': all(r['passesColorPreservation'] for r in rows),
            'allProbesDetectRBSwap': all(r['rbSwapDetected'] for r in rows),
        }
    return observation

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--screenshot', default='05-selected-transparent.png')
    p.add_argument('--cg-screenshot', default='07-cg.png')
    p.add_argument('--canvas', nargs=4, type=float, default=[420, 34, 440, 783], metavar=('X', 'Y', 'W', 'H'))
    args = p.parse_args()
    current = [
        audit('character','char-xiaoman',args.screenshot,args.canvas,(160,110,.4),20,
              [('left-coat-upper',250,650),('left-coat-middle',250,850),
               ('left-coat-lower',270,1050),('right-coat-upper',750,650),
               ('right-coat-lower',800,950),('face',500,300)]),
        # 左右边缘可见地面，避开人物与原生文字框；全部不透明。
        audit('background','bg-night',args.screenshot,args.canvas,(-284,0,.77),10,
              [('ground-left',450,750),('ground-right-low',1250,800),
               ('ground-right-middle',1270,740),('ground-right-upper',1250,720),
               ('ground-left-low',470,780)]),
        # CG 中左脸/下颌、左臂、右脸、前景手、窗户，各 ROI 先由源图选定。
        audit('cg','cg-repair',args.cg_screenshot,args.canvas,(-284,0,.77),15,
              [('left-face',550,300),('left-jaw',600,350),('left-arm',700,600),
               ('right-face',1000,350),('foreground-hand',1000,800),('window',1200,100)]),
    ]
    out = ROOT / 'color-audit.json'
    history = json.loads(out.read_text())['observations'] if out.exists() else []
    for observation in current:
        history = [r for r in history if not (r.get('kind','character') == observation['kind'] and r['screenshotSha256'] == observation['screenshotSha256'])]
        history.append(observation)
    result = {
        'schemaVersion': 2,
        'method': '17 region means (6 character, 5 opaque background, 6 opaque CG) matched by native-to-browser affine coordinate projection; compare source RGB and source BGR against screenshot RGB.',
        'threshold': 'Each probe RGB MAE <= 6/255 and below its R/B-swapped error; tolerates scaling and alpha 253/255, rejects channel swap.',
        'scope': 'Color regression for actual native WebP character, night background and CG. Does not alone certify every asset or platform.',
        'sourceModification': False,
        'recommendations': [
            'Run after every engine / WebP / graphics upload change and after page reload or save restoration.',
            'Add independent red/blue/green chart and every adopted asset family before production release.',
            'Keep original assets byte-identical; correct the decoder / pixel-upload channel convention rather than recoloring the source art.',
            'Use live canvas boundingBox for changed viewport / device-scale screenshots; do not reuse desktop coordinates blindly.',
        ],
        'observations': history,
        'latestPass': all(r['allProbesPass'] for r in current),
        'latestRBSwapDetected': all(r['allProbesDetectRBSwap'] for r in current),
        'latestByKind': {r['kind']:{'pass':r['allProbesPass'],'rbSwapDetected':r['allProbesDetectRBSwap'],'meanRGBError':r['meanRGBError'],'meanRBSwappedError':r['meanRBSwappedError']} for r in current},
    }
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:result[k] for k in ['latestPass','latestRBSwapDetected']}))
    print(json.dumps(result['latestByKind']))
    return 0 if result['latestPass'] else 1

if __name__ == '__main__':
    sys.exit(main())
