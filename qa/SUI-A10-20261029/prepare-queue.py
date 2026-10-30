"""冻结A10开工前队列。只写本QA目录；不生成图片，不修改上游或运行包。"""
from pathlib import Path
from collections import Counter
from PIL import Image
import hashlib
import json

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
def read(path):
    return json.loads((ROOT / path).read_text())
def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
def save(name, value):
    target = OUT / name
    if target.exists():
        raise RuntimeError(f"已有快照不可覆盖：{target}")
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")

review_path = "qa/SUI-A09-selection-20261029/review-approved.json"
review = read(review_path)
selection = read("docs/CG当前选择.json")
decision = read("qa/SUI-A10-20261029/decisions.json")
choices = {x["requirementId"]: x for x in decision["wardrobe"]["choices"]}
assert len(review["shots"]) == 60
assert {s["id"] for s in review["shots"]} == set(selection["activeSelectedIds"])
assert not set(selection["retiredRouteIds"]) & set(selection["activeSelectedIds"])

deps = {}
queue = []
for shot in review["shots"]:
    for item in shot["pendingDependencies"]:
        key = item["requirementId"]
        if key not in deps:
            own = item["owner"].startswith("SUI-A10-")
            deps[key] = {
                "requirementId": key, "name": item["name"], "owner": item["owner"],
                "shots": [], "isUpstream": not own,
                "status": "a10-internal-work-after-global-gate" if own else
                          "wardrobe-choice-confirmed-awaiting-upstream-release" if key in choices else
                          "upstream-version-mapping-and-release-pending",
                "note": "待核不等于无文件；不能把任务完成或草图存在当作逐镜定稿依据。",
                "userDecision": choices.get(key),
            }
        assert deps[key]["owner"] == item["owner"]
        deps[key]["shots"].append(shot["id"])
    queue.append({
        "id": shot["id"], "title": shot["title"], "package": shot["production"]["package"],
        "state": "waiting-for-all-upstream", "productionReady": False,
        "source": shot["source"], "contextSources": shot["contextSources"],
        "conditions": shot["conditions"], "cast": shot["cast"],
        "wardrobeAndFormFromA09": shot["wardrobeAndForm"],
        "confirmedWardrobeOverride": next((v for v in choices.values() if v["shot"] == shot["id"]), None),
        "propState": shot["propState"], "composition": shot["composition"],
        "referenceKeys": shot["referenceKeys"],
        "dependencyKeys": [x["requirementId"] for x in shot["pendingDependencies"]],
        "lifecycleFromA09": shot["lifecycle"], "reviewNotes": shot["reviewNotes"],
        "originalFiles": [], "generatedCount": 0, "runtimeAdopted": False,
    })

reference_checks = []
for key, ref in review["references"].items():
    p = ROOT / ref["sourceFile"]
    source_matches = sha(ref["sourceFile"]) == ref["sourceSha256"]
    record_matches = sha(ref["recordPath"]) == ref["recordSha256"]
    assert source_matches and record_matches, key
    with Image.open(p) as im:
        im.load()
        details = {"format": im.format, "mode": im.mode, "size": list(im.size)}
    reference_checks.append({"key": key, "sourceFile": ref["sourceFile"],
                             "sourceHashMatchesA09": source_matches, "recordHashMatchesA09": record_matches,
                             "decode": "pass", **details})

protected = {"AGENTS.md", "docs/CG当前选择.json", "docs/CG调整清单.md", "docs/美术/SUI-A09.md",
             "docs/美术资源规范.md", "docs/SUI-A美术子任务.md", "docs/开发计划.md", review_path,
             "main.ray", "start.novel", "config.ini"}
for folder in ["scenario", "tools/compiler", "tools/runtime", "system/sui-u"]:
    protected.update(str(p.relative_to(ROOT)) for p in (ROOT / folder).rglob("*") if p.is_file())
for ref in review["references"].values():
    protected.update([ref["sourceFile"], ref["recordPath"]])

packages = {p: [s["id"] for s in queue if s["package"] == p] for p in sorted({s["package"] for s in queue})}
save("input-fingerprints.json", {"scope": "本批受保护输入；不把并行制作中的A08文件冻结为不可修改", "files": [
    {"path": p, "sha256": sha(p)} for p in sorted(protected)]})
save("dependency-index.json", {"source": review_path, "sourceSha256": sha(review_path),
     "distinctRequirements": len(deps), "upstreamRequirements": sum(v["isUpstream"] for v in deps.values()),
     "confirmedWardrobeChoices": len(choices),
     "requirements": [deps[k] for k in sorted(deps)]})
save("shot-queue.json", {"task": "SUI-A10", "date": "2026-10-29", "scope": "制作等待队列；不是放行清单",
     "source": review_path, "sourceSha256": sha(review_path), "productionGate": decision["productionGate"],
     "references": review["references"], "shots": queue})
save("package-index.json", {"packages": packages, "counts": {k: len(v) for k,v in packages.items()},
     "total": 60, "productionReady": 0, "generated": 0})
save("reference-check.json", {"status": "pass", "checked": len(reference_checks),
     "scope": "实际解码、尺寸和文件/资源记录指纹；未进行本批视觉终审或CG制作", "references": reference_checks})
print(json.dumps({"shots": len(queue), "packages": {k:len(v) for k,v in packages.items()},
                  "requirements":len(deps), "upstreamRequirements":sum(v["isUpstream"] for v in deps.values()),
                  "decodedReferences":len(reference_checks), "protectedInputs":len(protected)},ensure_ascii=False))
