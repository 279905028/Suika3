#!/usr/bin/env python3
"""Inspect downloaded originals and create reviewable, silent 24 fps candidates."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
FFMPEG = Path('/private/tmp/suika3-p4v-media/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1')
BASE = ROOT / 'assets/sources/20261104/P4-V'
QA = ROOT / 'qa/ending-motion-P4-V-Q-20261104'
args = sys.argv[1:]
VERSION = 'v001'
if args[:1] == ['--version']:
    VERSION = args[1]
    args = args[2:]
if VERSION not in ('v001', 'v002'):
    raise SystemExit('仅处理已登记的v001/v002')

def run(args):
    p = subprocess.run([str(FFMPEG), '-nostdin', '-hide_banner', *args], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr[-3000:])
    return p.stderr

def record(p):
    return {'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size,
            'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}

def inspect(p, log):
    stderr = run(['-i', str(p), '-map', '0:v:0', '-f', 'null', '-'])
    log.write_text(stderr)
    before_output = stderr.split('Stream mapping:')[0]
    duration = re.search(r'Duration: (\d+):(\d+):([\d.]+)', before_output)
    video = re.search(r'Video: (\w+).*?, (\w+)(?:\([^)]*\))?, (\d+)x(\d+).*?, ([\d.]+) fps', before_output)
    assert duration and video, '无法读取视频参数'
    d = int(duration[1])*3600 + int(duration[2])*60 + float(duration[3])
    frames = re.findall(r'frame=\s*(\d+)', stderr)
    return dict(durationSeconds=d, codec=video[1], pixelFormat=video[2],
                width=int(video[3]), height=int(video[4]), fps=float(video[5]),
                audioPresent='Audio:' in before_output, decodedFrames=int(frames[-1]),
                completeDecode=True, decodeExitCode=0)

def process(key):
    folder = BASE / key
    raw = folder / ('raw-'+VERSION+'.mp4')
    if not raw.exists():
        print(key + ' 原片尚未下载', flush=True)
        return
    state_name = 'generation-state.json' if VERSION == 'v001' else 'revision-state.json'
    job = json.loads((ROOT/'qa/ending-motion-P4-V00-20261104'/state_name).read_text())['items'][key]
    assert job.get('download'), key + ' 尚未确认下载完成'
    assert hashlib.sha256(raw.read_bytes()).hexdigest() == job['download']['sha256'], key + ' 原片指纹不符'
    review = QA / key if VERSION == 'v001' else QA / key / VERSION
    report_path = review / 'media-check.json'
    if report_path.exists():
        print(key + ' 已有媒体检查，保留证据', flush=True)
        return
    review.mkdir(parents=True, exist_ok=True)
    original = inspect(raw, review / 'raw-decode.log')
    assert 4.5 <= original['durationSeconds'] <= 5.5
    assert original['width'] >= 1280 and original['height'] >= 720
    runtime = folder / ('runtime-'+VERSION+'.mp4')
    assert not runtime.exists(), '不覆盖已有运行衍生'
    filters = 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24'
    conversion = ['-i', str(raw), '-map', '0:v:0', '-vf', filters, '-c:v', 'libx264',
                  '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-an',
                  '-movflags', '+faststart', '-map_metadata', '-1', str(runtime)]
    run(conversion)
    runtime_info = inspect(runtime, review / 'runtime-decode.log')
    assert runtime_info['codec'] == 'h264' and runtime_info['pixelFormat'] == 'yuv420p'
    assert (runtime_info['width'], runtime_info['height'], runtime_info['fps']) == (1280, 720, 24)
    assert not runtime_info['audioPresent'] and 4.5 <= runtime_info['durationSeconds'] <= 5.5
    for name, vf in [('first', 'select=eq(n\\,0)'), ('last', 'reverse')]:
        png = review / (name + '.png')
        run(['-i', str(raw), '-vf', vf, '-frames:v', '1', str(png)])
        Image.open(png).save(folder / (name + '-'+VERSION+'.webp'), 'WEBP', lossless=True)
    frames_dir = review / 'frames-4fps'
    frames_dir.mkdir(exist_ok=True)
    run(['-i', str(raw), '-vf', 'fps=4', '-fps_mode', 'passthrough', str(frames_dir / '%03d.png')])
    frame_files = sorted(frames_dir.glob('*.png'))
    width, height, columns = 480, 270, 4
    rows = (len(frame_files) + columns - 1)//columns
    sheet = Image.new('RGB', (width*columns, (height+28)*rows+50), '#111923')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)
    draw.text((15, 14), key+' | raw '+VERSION+' | 4 fps sampling | production review', fill='white', font=font)
    for i, f in enumerate(frame_files):
        x, y = i % columns*width, i//columns*(height+28)+50
        im = Image.open(f).convert('RGB'); im.thumbnail((width,height))
        sheet.paste(im, (x+(width-im.width)//2,y))
        draw.text((x+10,y+height+3), f'{i/4:.2f}s', fill='white', font=font)
    sheet.save(review / 'contact-sheet.jpg', quality=95, subsampling=0)
    report = {'ending':key, 'version':VERSION, 'status':'media-format-pass; visual-review-pending',
              'original':{**record(raw),**original}, 'runtime':{**record(runtime),**runtime_info},
              'first':record(folder/('first-'+VERSION+'.webp')), 'last':record(folder/('last-'+VERSION+'.webp')),
              'derivation':{'ffmpeg':'7.1', 'filter':filters,'codec':'libx264','crf':18,'preset':'slow',
                            'audio':'removed','timing':'24 fps sampling; no speed change, no cut, no reverse in runtime'},
              'review':{'contactSheet':record(review/'contact-sheet.jpg'), 'sampleFrames':len(frame_files),
                        'sampleRate':4, 'visualApproval':False,'independentReviewer':False},
              'adopted':False}
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    candidate_path = folder / 'candidate.json'
    candidate = json.loads(candidate_path.read_text())
    if VERSION != 'v001':
        prior_fields = ['status','originalVideo','runtimeCandidate','firstGeneratedFrame','lastGeneratedFrame','mediaCheck','productionReview','dreamina','prompt']
        candidate.setdefault('versionHistory', {})['v001'] = {k:candidate[k] for k in prior_fields if k in candidate}
        candidate['prompt'] = job['prompt']
        candidate['dreamina'] = {k:job[k] for k in ('imageNodeId','videoNodeId','submitId')}
        candidate['dreamina'].update(model='seedance_2.5',resolution='720p',duration=5,resourceId=job['download']['resourceId'],downloadSha256=job['download']['sha256'])
        candidate['productionReview'] = {'status':'pending','version':VERSION}
    candidate.update(status='generated-downloaded-media-format-pass; visual-review-pending',
                     candidateVersion=VERSION,
                     originalVideo=report['original'], runtimeCandidate=report['runtime'],
                     firstGeneratedFrame=report['first'], lastGeneratedFrame=report['last'],
                     mediaCheck=str(report_path.relative_to(ROOT)))
    candidate_path.write_text(json.dumps(candidate,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'ending':key,'status':report['status'],'original':original,'runtime':runtime_info},ensure_ascii=False),flush=True)

if __name__ == '__main__':
    for ending in args or ['XM-E1','ZZ-E1','MY-E1','PI-E1','PI-LE1','HQ-E1']:
        process(ending)
