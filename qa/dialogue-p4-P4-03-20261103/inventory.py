"""P4-03 只读盘点；输出仅限本批 QA，不生成或采用美术资源。"""
import collections
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, features

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
P4 = ROOT / "docs/修订协作/P4-演出与美术/P4-01"


def read(path):
    return json.loads(path.read_text())


def fingerprint(path):
    b = path.read_bytes()
    return {"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b)}


def write(name, data):
    p = OUT / name
    if p.exists():
        raise FileExistsError(f"保留本批原证据，不覆盖 {p}")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def image_info(path):
    with Image.open(path) as img:
        img.load()
        alpha = img.convert("RGBA").getchannel("A")
        return {
            **fingerprint(path), "format": img.format, "width": img.width, "height": img.height,
            "mode": img.mode, "orientation": img.getexif().get(274, 1),
            "alphaChannel": "A" in img.getbands(), "alphaExtrema": list(alpha.getextrema()),
            "nontransparentBBox": list(alpha.getbbox()) if alpha.getbbox() else None,
            "iccProfileBytes": len(img.info.get("icc_profile", b"")),
        }


def group(asset):
    aid = asset["assetId"]
    if asset["type"] != "character":
        return asset["type"]
    for name in ("xiaoman", "zhouzhi", "mengyao", "piao"):
        if name in aid:
            return name
    if "sui-a06" in aid:
        return "huangqiuqiu-orb" if "orb" in aid else "huangqiuqiu-human"
    return "npc" if aid.startswith("npc-") else "supporting"


def sheets(assets):
    grouped = collections.defaultdict(list)
    for a in assets:
        grouped[group(a)].append(a)
    results = []
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
    small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 12)
    for key, rows in grouped.items():
        for page, start in enumerate(range(0, len(rows), 12), 1):
            subset = rows[start:start + 12]
            portrait = rows[0]["type"] == "character"
            cw, ch, cols = (250, 388, 4) if portrait else (330, 242, 3)
            canvas = Image.new("RGB", (cw * cols, 44 + ch * ((len(subset) + cols - 1) // cols)), "#e7e9e9")
            draw = ImageDraw.Draw(canvas)
            draw.text((12, 12), f"P4-03 INVENTORY | {key} | {page} | preliminary only", fill="#1a2226", font=font)
            for i, a in enumerate(subset):
                x, y = i % cols * cw, 44 + i // cols * ch
                with Image.open(ROOT / a["runtimePath"]) as image:
                    im = image.convert("RGBA")
                    im.thumbnail((cw - 16, ch - 60))
                    canvas.paste(im, (x + (cw - im.width) // 2, y + (ch - 60 - im.height) // 2), im)
                label = a["assetId"]
                split = 34 if portrait else 47
                for n, off in enumerate(range(0, len(label), split)):
                    draw.text((x + 8, y + ch - 52 + n * 15), label[off:off + split], fill="#17282f", font=small)
            p = OUT / "previews" / f"{key}-{page:02}.jpg"
            p.parent.mkdir(parents=True, exist_ok=True)
            if p.exists():
                raise FileExistsError(p)
            canvas.save(p, quality=90)
            results.append({**fingerprint(p), "assetIds": [a["assetId"] for a in subset]})
    return results


def main():
    manifest = read(ROOT / "assets/current/manifest.json")
    frozen = read(P4 / "input-manifest.json")
    seal = read(P4 / "freeze.json")
    inputs = frozen["files"] + seal["files"]
    mismatches = [p["path"] for p in inputs if fingerprint(ROOT / p["path"])["sha256"] != p["sha256"]]
    if mismatches:
        raise ValueError(f"冻结输入漂移：{mismatches}")
    all_assets = manifest["assets"]
    assets = [a for a in all_assets if a["type"] != "cg"]
    items = []
    for a in assets:
        source, runtime = image_info(ROOT / a["sourcePath"]), image_info(ROOT / a["runtimePath"])
        assert source["sha256"] == a["sourceSha256"]
        assert runtime["sha256"] == a["runtimeSha256"]
        assert (runtime["width"], runtime["height"], runtime["format"]) == (a["width"], a["height"], a["format"])
        items.append({
            "assetId": a["assetId"], "type": a["type"], "resourceGroup": group(a),
            "source": source, "runtime": runtime, "encoding": a.get("encoding"),
            "approvalEvidence": a["approval"]["evidence"], "approvedScope": a["approval"]["scope"],
            "restrictions": a.get("restrictions", []),
            "fileCheck": "decoded-and-fingerprint-matched",
            "p4VisualReview": "pending", "p4Release": "pending-P4-02-and-P4-05",
        })
    packages = ["P4-02-" + k for k in ["COMMON", "XM", "ZZ", "MY", "PI", "HQ", "FR"]]
    intake = []
    for package in packages:
        p = P4.parent / package / "needs.json"
        intake.append({"packageId": package, "needsFile": str(p.relative_to(ROOT)),
                       "state": "present-needs-review" if p.exists() else "not-delivered",
                       "evidence": fingerprint(p) if p.exists() else None})
    base = {"taskId": "P4-03", "date": "2026-11-03", "contentBuildId": frozen["contentBuildId"],
            "inputFingerprint": frozen["inputFingerprint"], "interfaceFingerprint": seal["interfaceFingerprint"]}
    write("input-snapshot.json", {**base, "files": inputs, "checked": len(inputs), "mismatches": mismatches,
                                  "additionalInputs": [fingerprint(Path(__file__)), fingerprint(ROOT / "qa/scene-background-audit-20261102/report.json")]})
    write("inventory.json", {**base, "schemaVersion": "p4-03-inventory-v1", "adoptionVersion": manifest["version"],
                            "scope": "非CG现行资源盘点；不是P4-05通过目录", "counts": dict(collections.Counter(a["type"] for a in assets)),
                            "tool": {"Pillow": Image.__version__, "libwebp": features.version("webp")}, "assets": items})
    write("intake-initial.json", {**base, "packages": intake})
    write("preview-index.json", {**base, "previews": sheets(assets)})
    legacy = read(P4 / "legacy-index.json")
    paragraphs = {p["paragraphId"]: p for p in read(P4 / "paragraph-map.json")["paragraphs"]}
    old = read(ROOT / "qa/scene-background-audit-20261102/report.json")
    scene_map = {s["sceneId"]: s for s in legacy["scenes"]}
    mapped = []
    for old_scene in old["scenes"]:
        s = scene_map[old_scene["sceneId"]]
        pp = [paragraphs[p] for p in s["paragraphIds"]]
        mapped.append({"sceneId": s["sceneId"], "packageIds": sorted({p["packageId"] for p in pp}),
                       "legacyReason": old_scene["reason"], "legacyVersion": old["version"],
                       "candidateParagraphs": [{k: p[k] for k in ["paragraphId", "source", "textMeta", "condition", "nodeIds", "text"]} for p in pp],
                       "status": "screening-only-not-production-request"})
    write("legacy-gap-map.json", {**base, "scenes": mapped})
    print(json.dumps({"nonCGAssets": len(items), "inputFilesChecked": len(inputs), "legacyScenesMapped": len(mapped),
                      "counts": dict(collections.Counter(a["type"] for a in assets)), "needs": intake}, ensure_ascii=False))


if __name__ == "__main__":
    main()
