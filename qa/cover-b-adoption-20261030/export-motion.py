from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageDraw, ImageStat, ImageFont
import sys, json, hashlib
sys.path.insert(0, '/tmp/suika3-media-runtime')
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/sources/20261030-cover-b-motion'
QA = Path(__file__).resolve().parent / 'motion'
QA.mkdir(parents=True, exist_ok=True)
job = sys.argv[1]
assert job in ['b1', 'b2']
source = OUT / (job + '-original.mp4')
reader = imageio_ffmpeg.read_frames(str(source), output_params=['-vf', 'fps=24', '-t', '8'])
meta = next(reader)
frames = [Image.frombytes('RGB', meta['size'], b) for b in reader][:192]
assert len(frames) == 192, (len(frames), meta)
first = frames[0].copy()

# Keep the existing warm-white title strokes steady while faces and bodies move.
roi = Image.new('L', first.size)
ImageDraw.Draw(roi).rectangle((45, 10, 495, 245), fill=255)
r, g, b = first.split()
bright = ImageChops.multiply(r.point(lambda v: 255 if v > 165 else 0), g.point(lambda v: 255 if v > 150 else 0))
bright = ImageChops.multiply(bright, b.point(lambda v: 255 if v > 110 else 0))
mask = ImageChops.multiply(roi, bright).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(1.2))
mask.save(QA / (job + '-title-lock-mask.png'))
for i, image in enumerate(frames):
    image.paste(first, (0, 0), mask)
    if i >= 184:
        frames[i] = Image.blend(image, first, (i - 184) / 7)
assert ImageChops.difference(frames[0], frames[-1]).getbbox() is None

writer = imageio_ffmpeg.write_frames(str(OUT / (job + '-loop.mp4')), (1280, 720), fps=24, codec='libx264', quality=8, macro_block_size=1, output_params=['-an', '-movflags', '+faststart'])
writer.send(None)
for image in frames:
    writer.send(image.tobytes())
writer.close()

webframes = [frames[round(i * 191 / 119)].resize((768, 432), Image.Resampling.LANCZOS) for i in range(120)]
webtimes = [round(i * 8000 / 120) for i in range(121)]
webframes[0].save(OUT / (job + '-loop.webp'), save_all=True, append_images=webframes[1:], duration=[webtimes[i+1]-webtimes[i] for i in range(120)], loop=0, quality=86, method=4, lossless=False)

gifrgb = [frames[round(i * 191 / 79)].resize((640, 360), Image.Resampling.LANCZOS) for i in range(80)]
strip = Image.new('RGB', (640, 360 * 8))
for i, index in enumerate([0, 11, 22, 33, 44, 55, 66, 79]):
    strip.paste(gifrgb[index], (0, i * 360))
palette = strip.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
gifs = [image.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG) for image in gifrgb]
gifs[0].save(OUT / (job + '-loop.gif'), save_all=True, append_images=gifs[1:], duration=100, loop=0, disposal=2, optimize=False)

board = Image.new('RGB', (1920, 820), '#edf2f1')
draw = ImageDraw.Draw(board)
font = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 22)
for i, sec in enumerate([0, 1.5, 3, 4.5, 6, 7.9]):
    frame = frames[min(round(sec * 24), 191)].resize((640, 360), Image.Resampling.LANCZOS)
    x, y = (i % 3) * 640, (i // 3) * 410
    board.paste(frame, (x, y + 35))
    draw.text((x + 10, y + 5), str(sec) + ' 秒', font=font, fill='#173b43')
board.save(QA / (job + '-contact-sheet.jpg'), quality=94)

outputs = []
for suffix in ['original.mp4', 'loop.mp4', 'loop.webp', 'loop.gif']:
    p = OUT / (job + '-' + suffix)
    record = {'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
    if p.suffix in ['.webp', '.gif']:
        with Image.open(p) as im:
            record.update(format=im.format, size=im.size, frames=im.n_frames, loop=im.info.get('loop'))
            a = im.convert('RGB').copy()
            duration = 0
            for i in range(im.n_frames):
                im.seek(i)
                im.load()
                duration += im.info.get('duration', 0)
            record['durationMs'] = duration
            record['decodedFirstLastMAE'] = sum(ImageStat.Stat(ImageChops.difference(a, im.convert('RGB'))).mean) / 3
            assert record['loop'] == 0 and record['frames'] > 1 and duration == 8000
    outputs.append(record)
report = {'id': job, 'source': '即梦CLI正常视频', 'model': 'seedance_2.0_fast_vip', 'durationSeconds': 8, 'videoFPS': 24, 'originalMetadata': meta, 'loopFramesBeforeEncodingIdentical': True, 'processing': ['原片保留', '衍生去除音轨', '固定原有标题字形区域', '末0.33秒平滑回到首帧'], 'outputs': outputs}
(QA / (job + '-exports.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
(OUT / (job + '-exports.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'id': job, 'outputs': outputs}, ensure_ascii=False), flush=True)
