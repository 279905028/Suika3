#!/usr/bin/env python3
"""Make silent playback candidates and review sheets from verified originals."""

import hashlib
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
QA = ROOT / "qa/kiss-motion-20261104"
FFMPEG = next((ROOT / "qa/ending-motion-P4-V00-20261104/media-runtime").glob(
    "imageio_ffmpeg/binaries/ffmpeg-macos-*"))


def ffmpeg(*args):
    process = subprocess.run([str(FFMPEG), "-hide_banner", "-nostdin", "-loglevel", "info",
                              *args], capture_output=True, text=True, check=False)
    if process.returncode:
        raise RuntimeError(process.stderr[-2400:])
    return process.stderr


def metadata(path):
    return {"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def inspect(path):
    stderr = ffmpeg("-i", str(path), "-map", "0:v:0", "-f", "null", "-")
    header = stderr.split("Stream mapping:")[0]
    duration = re.search(r"Duration: (\d+):(\d+):([\d.]+)", header)
    video = re.search(r"Video: (\w+).*?, (\w+)(?:\([^)]*\))?, (\d+)x(\d+).*?, ([\d.]+) fps", header)
    assert duration and video, path.name
    frames = re.findall(r"frame=\s*(\d+)", stderr)
    return {"durationSeconds": int(duration[1])*3600 + int(duration[2])*60 + float(duration[3]),
            "codec": video[1], "pixelFormat": video[2], "width": int(video[3]),
            "height": int(video[4]), "fps": float(video[5]), "audio": "Audio:" in header,
            "decodedFrames": int(frames[-1])}


def process(pair):
    key, source = pair
    raw = ROOT / source["path"]
    version = raw.stem.removeprefix("raw-")
    review = QA / key if version == "v001" else QA / key / version
    report_path = review / "media-check.json"
    if report_path.exists():
        return
    review.mkdir(parents=True, exist_ok=True)
    assert metadata(raw)["sha256"] == source["sha256"], key
    original = inspect(raw)
    assert 4.5 <= original["durationSeconds"] <= 5.5 and original["width"] >= 1280, key
    runtime = raw.with_name(f"runtime-{version}.mp4")
    with TemporaryDirectory(dir=review) as folder:
        work = Path(folder)
        conversion = ("scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,"
                      "pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24")
        if not runtime.exists():
            candidate = work / runtime.name
            ffmpeg("-i", str(raw), "-map", "0:v:0", "-vf", conversion, "-c:v", "libx264",
                   "-threads", "3", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
                   "-an", "-movflags", "+faststart", "-map_metadata", "-1", str(candidate))
            candidate.replace(runtime)
        info = inspect(runtime)
        assert (info["width"], info["height"], info["codec"], info["pixelFormat"],
                info["fps"], info["audio"]) == (1280, 720, "h264", "yuv420p", 24, False), key
        assert 4.5 <= info["durationSeconds"] <= 5.5
        ffmpeg("-i", str(runtime), "-vf", "fps=2,scale=320:180", str(work / "sample-%02d.jpg"))
        frames = sorted(work.glob("sample-*.jpg"))
        sheet = Image.new("RGB", (1600, ((len(frames) + 4)//5)*201 + 26), "#171c22")
        draw = ImageDraw.Draw(sheet)
        draw.text((10, 7), key, fill="white")
        for i, frame in enumerate(frames):
            x, y = (i % 5)*320, (i//5)*201 + 26
            with Image.open(frame) as sample:
                sheet.paste(sample, (x, y))
            draw.text((x + 7, y + 183), f"{i/2:.1f} s", fill="white")
        sheet.save(review / "contact-sheet.jpg", quality=91)
        for name, select in (("first", "select=eq(n\\,0)"), ("last", "reverse")):
            png = work / f"{name}.png"
            ffmpeg("-i", str(runtime), "-vf", select, "-frames:v", "1", str(png))
            with Image.open(png) as image:
                image.save(raw.with_name(f"{name}-{version}.webp"), "WEBP", lossless=True)
    report = {"key": key, "original": {**metadata(raw), **original},
              "runtime": {**metadata(runtime), **info},
              "first": metadata(raw.with_name(f"first-{version}.webp")),
              "last": metadata(raw.with_name(f"last-{version}.webp")),
              "contactSheet": metadata(review / "contact-sheet.jpg")}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(f"{key} 原片与静音候选完整解码", flush=True)


if __name__ == "__main__":
    import sys
    inputs = "revision-downloads.json" if "--revision" in sys.argv else "downloads.json"
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(process, json.loads((QA / inputs).read_text()).items()))
