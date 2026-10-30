#!/usr/bin/env python3
"""SUI-A04 离线资源检查；不写运行入口、其他任务或玩家存档。"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, features

QA = Path(__file__).resolve().parent
ROOT = QA.parent.parent
SOURCE = ROOT / "assets/sources/20261028/SUI-A04"
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
COLORS = {
    "white": (248, 248, 246, 255),
    "black": (0, 0, 0, 255),
    "day": (219, 229, 224, 255),
    "night": (23, 35, 44, 255),
}


def load(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rel(path):
    return str(Path(path).relative_to(ROOT))


def rect(box):
    return [box[0], box[1], box[2] - box[0], box[3] - box[1]] if box else None


def metadata(path):
    with Image.open(path) as original:
        original.load()
        rgba = original.convert("RGBA")
        a = rgba.getchannel("A")
        h = a.histogram()
        return {
            "path": rel(path), "sha256": digest(path), "bytes": path.stat().st_size,
            "format": original.format, "mode": original.mode,
            "width": original.width, "height": original.height,
            "orientation": original.getexif().get(274),
            "iccProfilePresent": bool(original.info.get("icc_profile")),
            "colorSpace": "8-bit RGB/RGBA；原图无ICC时记录为untagged，未隐式转换颜色",
            "alpha": {
                "present": "A" in original.getbands(), "range": list(a.getextrema()),
                "bbox": rect(a.getbbox()),
                "coordinateBasis": "本文件像素；左上原点；[x,y,width,height]",
                "transparentPixels": h[0], "partialPixels": sum(h[1:255]),
                "opaquePixels": h[255],
            },
            "decodedRGBABytes": original.width * original.height * 4,
        }


def nonzero(im):
    return sum(im.histogram()[1:])


def compare(source, webp):
    with Image.open(source) as a, Image.open(webp) as b:
        a, b = a.convert("RGBA"), b.convert("RGBA")
        if a.size != b.size:
            return {"dimensionsEqual": False, "passed": False}
        r, g, blue, alpha = ImageChops.difference(a, b).split()
        rgb = ImageChops.lighter(ImageChops.lighter(r, g), blue)
        changed = rgb.point(lambda v: 255 if v else 0)
        visible = a.getchannel("A").point(lambda v: 255 if v else 0)
        visible_diff = nonzero(ImageChops.multiply(changed, visible))
        hidden_diff = nonzero(ImageChops.multiply(changed, ImageChops.invert(visible)))
        alpha_diff = nonzero(alpha)
        return {
            "dimensionsEqual": True, "visibleRGBDifferentPixels": visible_diff,
            "alphaDifferentPixels": alpha_diff, "hiddenRGBDifferentPixels": hidden_diff,
            "exactRGBAEqual": visible_diff == alpha_diff == hidden_diff == 0,
            "passed": visible_diff == 0 and alpha_diff == 0,
        }


def composite(im, color):
    base = Image.new("RGBA", im.size, color)
    base.alpha_composite(im)
    return base


def ui_preview(im, filename, label):
    # 等比缩放与离线合成仅用于QA，不回写源图，不冻结NovelML坐标。
    canvas = Image.open(ROOT / "system/sui-u/png/reading-backdrop.png").convert("RGBA")
    sprite = im.copy()
    sprite.thumbnail((448, 608), Image.Resampling.LANCZOS)
    xy = ((1280 - sprite.width) // 2, 24)
    canvas.alpha_composite(sprite, xy)
    before = canvas.copy()
    for file, xy_gui in [("message", (48, 490)), ("name", (76, 442)), ("menu-idle", (1104, 24))]:
        with Image.open(ROOT / f"system/sui-u/png/{file}.png") as gui:
            canvas.alpha_composite(gui.convert("RGBA"), xy_gui)
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT, 26)
    small = ImageFont.truetype(FONT, 23)
    draw.text((100, 452), "孟遥", font=font, fill="#efece5")
    draw.text((84, 516), "离线构图检查：脸部、双手与道具；非引擎运行截图。", font=small, fill="#efece5")
    draw.text((84, 562), label, font=small, fill="#a7c9bd")
    canvas.convert("RGB").save(filename)
    return {"scale": sprite.height / im.height, "spriteRect": [xy[0], xy[1], sprite.width, sprite.height],
            "screenBasis": "1280x720离线QA画布；不是运行定位参数", "preview": rel(filename)}


def sheet(items, destination, cols, cell=(320, 520)):
    rows = (len(items) + cols - 1) // cols
    board = Image.new("RGB", (cols * cell[0], rows * cell[1]), "#e7eae5")
    draw = ImageDraw.Draw(board)
    font = ImageFont.truetype(FONT, 19)
    for i, (path, label) in enumerate(items):
        x, y = (i % cols) * cell[0], (i // cols) * cell[1]
        im = Image.open(path).convert("RGBA")
        im.thumbnail((cell[0] - 20, cell[1] - 52), Image.Resampling.LANCZOS)
        tile = composite(im, COLORS["white"]).convert("RGB")
        board.paste(tile, (x + (cell[0] - im.width) // 2, y + 8))
        draw.text((x + 14, y + cell[1] - 34), label, font=font, fill="#263a3a")
    board.save(destination)


def build():
    asset_specs = load(QA / "asset-specs.json")
    previews = QA / "previews"
    previews.mkdir(exist_ok=True)
    records = []
    comparisons = []
    for spec in asset_specs:
        path = ROOT / spec["file"]
        with Image.open(path) as original:
            im = original.convert("RGBA")
            target = path.with_suffix(".webp")
            im.save(target, format="WEBP", lossless=True, method=6, exact=True)
            equality = compare(path, target)
            comparisons.append({"assetId": spec["assetId"], **equality})
            source_meta, derivative_meta = metadata(path), metadata(target)
            names = []
            for name, color in COLORS.items():
                preview = composite(im, color)
                preview.thumbnail((512, 768), Image.Resampling.LANCZOS)
                out = previews / f"{spec['assetId']}-{name}.png"
                preview.convert("RGB").save(out)
                names.append(rel(out))
            placement = None
            if spec["kind"] == "character":
                out = previews / f"{spec['assetId']}-ui.png"
                placement = ui_preview(im, out, spec["label"])
            record = {
                "schemaVersion": "SUI-A04-production-1", **spec,
                "ownerTask": "SUI-A04", "characterOrSceneKey": "mengyao", "form": "human" if spec["kind"] == "character" else None,
                "sourceFile": rel(path), "derivativeFile": rel(target),
                "sha256Source": source_meta["sha256"], "sha256Derivative": derivative_meta["sha256"],
                "promptMetadata": {"path": spec["promptOrProcessRecord"], "sha256": digest(ROOT / spec["promptOrProcessRecord"])},
                "sources": ["qa/SUI-A04-20261028/generation-jobs.json", "qa/SUI-A04-20261028/approval.json"],
                "sourceMetadata": source_meta, **derivative_meta,
                "metadataFileRole": "顶层元数据描述WebP交接衍生；PNG生成原件保持不变",
                "encoding": {"tool": "Pillow", "version": Image.__version__, "codec": "libwebp",
                             "codecVersion": features.version("webp"), "lossless": True,
                             "method": 6, "exact": True, "colorConversion": "none"},
                "placement": {"coordinateBasis": "源图像素；左上原点", "cropRect": [0, 0, im.width, im.height],
                              "pivot": [im.width / 2, im.height],
                              "pivotMeaning": "截幅图下边中心；不是脚底锚点，非NovelML坐标",
                              "criticalRects": spec.get("criticalRects", {}), "offlineUI": placement},
                "binding": {"runtimeBound": False, "sceneNodeIds": [], "routeIds": ["mengyao"],
                            "condition": spec["usage"],
                            "enter": "由E/I按正文锚点接入；本包不写演出绑定",
                            "exitAndRestore": "换衣/持物切换需完整换图；读档/回退按剧情状态恢复，A11/I/E/Q另验"},
                "approval": {"baseSelection": "qa/SUI-A04-20261028/approval.json",
                             "imageApproval": "基础A获批；差分为批准基础后的制作交付，非逐文件采用批准" if spec.get("option") != "B" else "未选；保留独立比较",
                             "currentProjectAdopted": False, "adoptionEvidence": None},
                "checks": {"metadata": "通过", "losslessPixels": equality,
                           "fourBackgroundPreviews": names, "visual": "见visual-review.md逐项记录",
                           "engine": "未测", "browser": "未测", "physicalPhone": "未测",
                           "desktop": "未测", "deployment": "未执行"},
            }
            records.append(record)
    write(QA / "resource-records.json", records)
    write(QA / "pixel-comparison.json", comparisons)
    chosen = [(ROOT / x["file"], x["label"]) for x in asset_specs if x["kind"] == "character" and x.get("option") != "B"]
    props = [(ROOT / x["file"], x["label"]) for x in asset_specs if x["kind"] == "personal-prop"]
    sheet(chosen, previews / "mengyao-selected-a-sheet.png", 3)
    sheet(props, previews / "mengyao-props-sheet.png", 2, (512, 560))
    sheet([(ROOT / x["file"], x["label"]) for x in asset_specs if x.get("option") in ["A", "B"]],
          previews / "mengyao-options-a-b.png", 2, (512, 820))
    for color in COLORS:
        sheet([(previews / f"{x['assetId']}-{color}.png", x["label"]) for x in asset_specs],
              previews / f"edge-audit-{color}.png", 4, (256, 420))
    expressions = sorted([x for x in asset_specs if x["assetId"] == "char-mengyao-human-base-neutral" or "base-expression" in x["assetId"]],
                         key=lambda x: ["neutral", "smile", "serious", "hesitant", "downcast", "tired"].index(x["assetId"].split("-")[-1]))
    board = Image.new("RGB", (990, 780), "#e7eae5")
    d = ImageDraw.Draw(board)
    for i, x in enumerate(expressions):
        with Image.open(ROOT / x["file"]) as original:
            # 固定矩形裁切只供脸部对照，不写回立绘。
            face = original.convert("RGBA").crop((270, 130, 690, 520))
            face.thumbnail((310, 320), Image.Resampling.LANCZOS)
            xx, yy = (i % 3) * 330, (i // 3) * 390
            board.paste(composite(face, COLORS["white"]).convert("RGB"), (xx + 10, yy + 10))
            d.text((xx + 16, yy + 350), x["label"], font=ImageFont.truetype(FONT, 23), fill="#263a3a")
    board.save(previews / "mengyao-expression-faces.png")
    print(json.dumps({"records": len(records), "pixelComparisonsPassed": sum(x["passed"] for x in comparisons)}, ensure_ascii=False))


def verify():
    records = load(QA / "resource-records.json")
    before = load(QA / "input-before.json")
    approval = load(QA / "approval.json")
    checks = []

    def check(name, passed, detail=None):
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    check("批准基础与源图指纹", digest(ROOT / approval["approvedBase"]) == approval["approvedBaseSHA256"])
    check("资源键唯一", len({r["assetId"] for r in records}) == len(records))
    check("A与B独立原件均保留", all(any(r.get("option") == n for r in records) for n in ["A", "B"]))
    check("批准A角色9张及道具4张", sum(r["kind"] == "character" and r.get("option") != "B" for r in records) == 9 and sum(r["kind"] == "personal-prop" for r in records) == 4)
    for record in records:
        p, q = ROOT / record["sourceFile"], ROOT / record["derivativeFile"]
        m, n = metadata(p), metadata(q)
        check(record["assetId"] + "真实格式/尺寸/透明", m["format"] == "PNG" and n["format"] == "WEBP" and
              m["width"] == n["width"] and m["height"] == n["height"] and m["alpha"]["present"] and
              n["alpha"]["transparentPixels"] > 0 and n["alpha"]["range"][1] > 0 and n["orientation"] in [None, 1])
        check(record["assetId"] + "无损像素", compare(p, q)["passed"])
        check(record["assetId"] + "记录指纹", m["sha256"] == record["sourceMetadata"]["sha256"] and n["sha256"] == record["sha256"])
        check(record["assetId"] + "四底预览", all((ROOT / path).is_file() for path in record["checks"]["fourBackgroundPreviews"]))
        check(record["assetId"] + "未擅自采用", not record["approval"]["currentProjectAdopted"] and not record["binding"]["runtimeBound"])
        if record["kind"] == "character":
            with Image.open(p) as image:
                a = image.getchannel("A")
                maxima = [a.crop(box).getextrema()[1] for box in [(0, 0, 220, 160), (840, 0, 1024, 160)]]
            check(record["assetId"] + "轮廓外取样", max(maxima) <= 2,
                  {"sourcePixelRects": [[0, 0, 220, 160], [840, 0, 184, 160]], "maxAlpha": maxima,
                   "scope": "无人物的两个外角取样；完整边缘仍依赖四底视觉检查"})
    retained = load(QA / "retained-revisions.json")
    check("返修前原件与WebP保留", all(digest(ROOT / x["sourceFile"]) == x["sourceSHA256"] and digest(ROOT / x["webp"]) == x["webpSHA256"] for x in retained))
    anchor_errors = []
    for r in records:
        for a in r["storyAnchors"]:
            p = ROOT / a["path"]
            lines = p.read_text().splitlines()
            if digest(p) != a["sha256"] or lines[a["line"] - 1] != a["quote"]:
                anchor_errors.append([a["path"], a["line"]])
    check("正文锚点与指纹逐项吻合", not anchor_errors, anchor_errors)
    changes = []
    for item in before["historicalReferences"] + before["protected"]:
        p = Path(item["path"])
        if not p.exists() or digest(p) != item["sha256"]:
            changes.append(item["path"])
    strict_changes = [p for p in changes if p.startswith(str(ROOT / "scenario")) or p.startswith(str(ROOT / "docs/人物")) or p.startswith(str(ROOT / "docs/分支")) or not p.startswith(str(ROOT))]
    write(QA / "source-preservation.json", {"strictSourceChanges": strict_changes,
          "allObservedOtherTaskChanges": changes, "historicalReferenceCount": len(before["historicalReferences"]),
          "protectedSnapshotCount": len(before["protected"]), "note": "SDK/运行/UI/工具其他任务并行变化单列，不计作本任务实现"})
    check("正文、人物、路线资料与8份旧图保护", not strict_changes, strict_changes)
    requirements = {r["id"] for r in load(ROOT / "qa/SUI-A01-20261028/requirements.json")["requirements"] if r["owner"] == "SUI-A04"}
    mapped = {k for r in records for k in r["requirementKeys"]}
    check("A01六个需求族均有资源关联", requirements == mapped, {"expected": sorted(requirements), "actual": sorted(mapped)})
    total = sum((ROOT / r["derivativeFile"]).stat().st_size for r in records)
    report = {"scope": "离线格式/像素/四底预览存在性/来源保护；视觉结论另见visual-review.md，非引擎验收",
              "passed": all(x["passed"] for x in checks), "checks": checks, "checksPassed": sum(x["passed"] for x in checks),
              "checksTotal": len(checks), "webpBytesIncludingUnselectedB": total,
              "decodedRGBABytesIfAllSimultaneouslyDecoded": sum(r["sourceMetadata"]["decodedRGBABytes"] for r in records),
              "loadNote": "字节量为文件统计/理论像素量，不是运行驻留、峰值内存或手机性能实测"}
    write(QA / "verification.json", report)
    print(json.dumps({k: report[k] for k in ["passed", "checksPassed", "checksTotal", "webpBytesIncludingUnselectedB"]}, ensure_ascii=False))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["build", "verify"])
    args = parser.parse_args()
    build() if args.mode == "build" else verify()
