"""P4-03 素材归档与检查预览；不改正式资源、上游需求或冻结正文。"""
import hashlib
import html
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, features, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / "qa/dialogue-p4-P4-03-20261103"
DOC = ROOT / "docs/修订协作/P4-演出与美术/P4-03"
SRC = ROOT / "assets/sources/20261103/P4-03"


def read(p):
    return json.loads(p.read_text())


def write(p, data):
    assert not p.exists(), f"不覆盖已交记录：{p}"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def rel(p):
    return str(p.relative_to(ROOT))


def fp(p):
    return {"path": rel(p), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}


def image_info(p):
    with Image.open(p) as im:
        im.load()
        a = im.getchannel("A") if "A" in im.getbands() else None
        return dict(fp(p), bytes=p.stat().st_size, format=im.format, width=im.width,
                    height=im.height, mode=im.mode, orientation=im.getexif().get(274, 1),
                    alphaExtrema=list(a.getextrema()) if a else None,
                    nontransparentBBox=list(a.getbbox()) if a else None,
                    visibleBBoxAlpha8=list(a.point(lambda x: 255 if x > 8 else 0).getbbox()) if a else None,
                    iccProfileBytes=len(im.info.get("icc_profile", b"")))


intake = read(QA / "intake-final.json")
groups = {g["resourceKey"]: g for g in intake["groups"]}
nodes = {n["nodeId"]: n for n in read(ROOT / "docs/修订协作/P4-演出与美术/P4-01/node-map.json")["nodes"]}
inventory = {a["assetId"]: a for a in read(QA / "inventory.json")["assets"]}

# 只归档选定版本，首稿及工具原输出均保留。
records = []
for gen in sorted(SRC.glob("*/generation.json")):
    key = gen.parent.name
    if key == "xiaoman-day40-packing-interior":
        gen = gen.with_name("generation-v002.json")
    spec = read(gen)
    asset = spec.get("assetId", "bg-my-restaurant-eaves-rain")
    version = spec.get("version", "v001")
    source = gen.parent / f"{asset}-{version}.png"
    refs = spec.get("refs", spec.get("referencedImagePaths", []))
    records.append({"resourceKey": key, "assetId": asset,
                    "type": spec.get("type", "background"), "origin": "generated-this-batch",
                    "version": version, "source": image_info(source), "productionEvidence": fp(gen),
                    "references": [fp(ROOT / p) for p in refs]})

river = SRC / "my-riverside-day/bg-my-riverside-afternoon-v001.png"
original = ROOT / "assets/sources/20261029-cg-preflight/SUI-A08/bg-my-riverside-afternoon-v001.png"
assert fp(river)["sha256"] == fp(original)["sha256"]
origin = {"resourceKey": "my-riverside-day", "assetId": "bg-my-riverside-afternoon",
          "source": fp(original), "copy": fp(river), "method": "byte-identical-copy",
          "originalGeneration": fp(original.with_suffix(".generation.json")),
          "originalRecord": fp(ROOT / "assets/sources/20261029-cg-preflight/resource-records.json"),
          "reason": "复用CG044制作前冻结的无人河岸参考，空间与CG044一致；历史参考批准不替代本批运行采用。"}
write(river.parent / "origin.json", origin)
records.append({"resourceKey": "my-riverside-day", "assetId": "bg-my-riverside-afternoon",
                "type": "background", "origin": "reused-source-copy", "version": "v001",
                "source": image_info(river), "productionEvidence": fp(river.parent / "origin.json"),
                "references": [fp(original)]})
assert len(records) == 14

for r in records:
    source = ROOT / r["source"]["path"]
    webp = source.with_suffix(".lossless.webp")
    assert not webp.exists()
    with Image.open(source) as im:
        im.load()
        params = {"lossless": True, "method": 6, "exact": True}
        if im.info.get("icc_profile"):
            params["icc_profile"] = im.info["icc_profile"]
        im.save(webp, "WEBP", **params)
        with Image.open(webp) as encoded:
            encoded.load()
            assert im.size == encoded.size
            assert im.convert("RGBA").tobytes() == encoded.convert("RGBA").tobytes(), str(source)
    r["archiveWebP"] = image_info(webp)
    r["encoding"] = {"tool": "Pillow/libwebp", "Pillow": pillow_version,
                     "libwebp": features.version("webp"), "lossless": True, "method": 6, "exact": True,
                     "resized": False, "profile": "保留源ICC；未标记源不作像素转换", "rgbaPixelEqual": True}
    r["needIds"] = groups[r["resourceKey"]]["needIds"]
    r["reviewStatus"] = "pending"
    r["producerStatus"] = "selected-candidate-awaiting-P4-05"
    r["authorizationBasis"] = "用户在本聊天要求完成P4-03；仅授权制作与交付候选，未记为逐图视觉批准或运行采用。"
    r["adoption"] = "P4-05独立复验与运行衍生、P4-02逐节点闭合、P4-07正式采用均另行进行。"
    r["candidateUse"] = "docs/修订协作/P4-演出与美术/P4-03/decisions.json#" + r["resourceKey"]

write(DOC / "resource-records.json", {"schemaVersion": "p4-03-source-delivery-v1", "taskId": "P4-03",
      "inputFingerprint": intake["inputFingerprint"], "contentBuildId": intake["contentBuildId"],
      "counts": {"selected": 14, "newOrRepaired": 13, "sourceReuse": 1, "background": 12, "character": 2},
      "assets": records})

baseline = read(ROOT / "docs/修订协作/P4-演出与美术/P4-01/resources.baseline.json")
for r in records:
    assert r["assetId"] not in {a["assetId"] for a in baseline["assets"]}
    baseline["assets"].append({"assetId": r["assetId"], "type": r["type"],
        "source": {k: r["source"][k] for k in ["path", "sha256"]},
        "runtime": {k: r["archiveWebP"][k] for k in ["path", "sha256"]},
        "reviewStatus": "pending", "approvalEvidence": None, "checkEvidence": None})
write(DOC / "resources.candidate.json", baseline)

font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 12)
previews = QA / "delivery-previews"
previews.mkdir(exist_ok=True)


def fitted(im, size, bg="#dfe5e6"):
    out = Image.new("RGB", size, bg)
    fg = im.convert("RGBA")
    fg.thumbnail(size, Image.Resampling.LANCZOS)
    out.paste(fg, ((size[0]-fg.width)//2, (size[1]-fg.height)//2), fg)
    return out


index = []
for r in records:
    source = ROOT / r["source"]["path"]
    with Image.open(source) as im:
        thumb = fitted(im, (640, 380))
        thumb_path = previews / (r["assetId"] + ".jpg")
        thumb.save(thumb_path, quality=92)
        item = {"assetId": r["assetId"], "preview": rel(thumb_path)}
        if r["type"] == "character":
            # 检查用四底合成，不是新立绘或运行截图。
            sheet = Image.new("RGB", (1400, 1140), "#e8ecee")
            sprite = im.convert("RGBA")
            sprite.thumbnail((350, 1010), Image.Resampling.LANCZOS)
            bases = [Image.new("RGB", (350, 1050), "white"), Image.new("RGB", (350, 1050), "black")]
            for bg in ["bg-noodle-shop-day.webp", "bg-old-netcafe-yard-door-ajar-night.webp"]:
                plate = Image.open(ROOT / "assets/current/SUI-A08" / bg).convert("RGB")
                plate = plate.resize((1866, 1050), Image.Resampling.LANCZOS)
                bases.append(plate.crop((700, 0, 1050, 1050)))
            for i, (base, label) in enumerate(zip(bases, ["WHITE", "BLACK", "DAY", "NIGHT"])):
                base.paste(sprite, ((350-sprite.width)//2, 20), sprite)
                sheet.paste(base, (i*350, 55))
                ImageDraw.Draw(sheet).text((i*350+12, 20), label, font=font, fill="#24323c")
            ImageDraw.Draw(sheet).text((12, 1113), r["assetId"] + " | OFFLINE ALPHA INSPECTION ONLY", font=font, fill="#24323c")
            p = previews / (r["assetId"] + "-four-bases.jpg")
            sheet.save(p, quality=96)
            item["alphaPreview"] = rel(p)
        index.append(item)

for start in range(0, len(records), 6):
    sheet = Image.new("RGB", (1280, 1320), "#f3f5f5")
    draw = ImageDraw.Draw(sheet)
    for j, r in enumerate(records[start:start+6]):
        x, y = (j % 2) * 640, (j // 2) * 440
        thumb = Image.open(previews / (r["assetId"] + ".jpg"))
        sheet.paste(thumb, (x, y))
        draw.text((x+10, y+386), r["assetId"], fill="#20353d", font=font)
        draw.text((x+10, y+412), "SOURCE CANDIDATE | P4-05 PENDING", fill="#5c6366", font=small)
    sheet.save(previews / f"selected-{start//6+1:02d}.jpg", quality=94)

# 两张新立绘仅提供比例与文字框避让示意；不是对演出包自动提交的坐标。
layout = []
for asset, bg, height, x, y in [
    ("char-xiaoman-work-apron-empty-hands", "assets/current/SUI-A08/bg-noodle-shop-day.webp", 780, 320, 75),
    ("piao-seated-base", "assets/current/SUI-A08/bg-noodle-shop-day.webp", 600, 80, 105),
]:
    r = next(r for r in records if r["assetId"] == asset)
    stage = fitted(Image.open(ROOT / bg), (1280,720), "black").convert("RGBA")
    sprite = Image.open(ROOT / r["source"]["path"]).convert("RGBA")
    size = (round(sprite.width*height/sprite.height), height)
    sprite = sprite.resize(size, Image.Resampling.LANCZOS)
    stage.alpha_composite(sprite, (x,y))
    overlay = Image.new("RGBA", stage.size)
    d = ImageDraw.Draw(overlay)
    d.rectangle((48,490,1232,696), fill=(16,24,32,200), outline=(240,211,145,255), width=2)
    d.rectangle((76,442,316,490), fill=(16,24,32,200), outline=(240,211,145,255), width=2)
    d.text((80,520), "OFFLINE GEOMETRY PREVIEW / NOT AN ENGINE SCREENSHOT", fill="white", font=font)
    stage = Image.alpha_composite(stage,overlay).convert("RGB")
    p = previews / (asset + "-ui-guide.jpg")
    stage.save(p, quality=96)
    layout.append({"assetId":asset, "preview":rel(p), "canvas":[1280,720], "spriteRect":[x,y,*size],
                   "note":"仅离线检查脸和上身可见区；站位、遮挡及凳子接触关系须P4-02/P4-05确认，不能直接当运行参数。"})
write(QA / "delivery-preview-index.json", {"previews":index,"layoutGuides":layout,
    "contactSheets":[rel(p) for p in sorted(previews.glob('selected-*.jpg'))]})

print(json.dumps({"selected":len(records),"new":13,"reusedSource":1,"losslessPixelEqual":14,
                  "catalog":len(baseline['assets']),"alphaSheets":2,"uiGuides":2},ensure_ascii=False))
