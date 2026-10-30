#!/usr/bin/env python3
"""A01只读盘点与交付检查；不构建、不改源图、不访问存档。"""
from pathlib import Path
from collections import Counter
import hashlib
import json
import re
import sys
from urllib.parse import unquote
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dump(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def sample_inventory():
    rows = []
    totals = {}
    for folder in ("SDK", "images", "system", "sound", "suika-beat"):
        files = sorted(p for p in (ROOT / folder).rglob("*") if p.is_file()
                       and not (folder == "system" and p.relative_to(ROOT / folder).parts[0] == "sui-u"))
        totals[folder] = {"files": len(files), "bytes": sum(p.stat().st_size for p in files),
                          "extensions": dict(Counter(p.suffix.lower() for p in files))}
        for p in files:
            if p.suffix.lower() not in (".png", ".webp", ".jpg", ".jpeg"):
                continue
            with Image.open(p) as im:
                im.load()
                rows.append({"path": str(p.relative_to(ROOT)), "format": im.format,
                             "width": im.width, "height": im.height,
                             "mode": im.mode, "bytes": p.stat().st_size,
                             "sha256": sha(p), "status": "SDK或现有演示材料；禁止自动采用"})
    dump("local-sample-inventory.json", {"scope": "仅根示例及SDK；不含其他任务QA复制件", "totals": totals,
                                        "images": rows, "imageCount": len(rows), "adoptedCount": 0})
    print(json.dumps({"sampleImages": len(rows), "adoptedCount": 0}, ensure_ascii=False))


def requirements_markdown():
    req = json.loads((OUT / "requirements.json").read_text())["requirements"]
    titles = {"SUI-A02": "罗小满", "SUI-A03": "周栀", "SUI-A04": "孟遥",
              "SUI-A05": "飘", "SUI-A06": "黄球球", "SUI-A07": "主角与配角",
              "SUI-A08": "场景与共用道具", "SUI-A09": "镜头复核与仅提及资料"}
    lines = ["# SUI-A01 正文资源需求", "",
             "2026-10-28｜由 [requirements.json](requirements.json) 生成；需求定位表，不是采用清单或逐镜制作放行单。", "",
             f"共 {len(req)} 个需求键、{sum(len(r['sources']) for r in req)} 个来源锚点，覆盖12份实际正文。分类为人物需求族24、背景41、个人道具26、共用道具17、参考项6、CG复核1。群众组合不是独立人物数量，需求族也不等于图片张数。", "",
             "## 使用方法", "",
             "- 下表列出每项首个定位依据；JSON保留全部原句、行号、文件指纹、章节和最近NODE。",
             "- `nearestNode`仅表示原文上下文，不能直接作为CG绑定点。例如人形来源的最近NODE可能仍是第36天返回点，不能据此提前变形；A09/E另定进出场与条件。",
             "- 同一键只有一个责任包；群众/多地点组合在实际制作前由该包细分子键并保留父键，不默认共用同一人物或地址。手持专属道具归人物包，共用/固定道具归A08，其他包引用同版。",
             "- 资源现状见[来源盘点](来源盘点.md)，画布、编码及命名见[统一规格](../../docs/美术/SUI-A01.md)。表中全部项目均为“需求已定位；本工程采用未登记”。", "",
             "## 关键限制", "",
             "- 孟遥MY07-01与MY09-01均A才秘密继续；其余彻底断开，婚姻仍在，MY07选B后不绑定私会或亲吻。",
             "- 黄球球第55天17:00自主呈现人形，两结局均保持；无手机、不公开出现、不赴婚宴，照片未显示的下装不补画。",
             "- 飘关系依规则契约冻结HIGH/LOW，未知值不能默认LOW；FR-E2两篇后日谈均为消息与简短回复。",
             "- 叶岚只有普通队友用途。52项保留CG等待A09逐镜复核，8项取消、8项补选缺口等待用户决定，本批放行0项。", ""]
    def cell(value):
        return str(value).replace("|", "\\|").replace("\n", " ")
    for owner, title in titles.items():
        group = [r for r in req if r["owner"] == owner]
        lines += [f"## {owner} {title}（{len(group)}项）", "",
                  "| 需求键 | 对象与交付形式 | 约束／缺口 | 首个定位依据 |",
                  "| --- | --- | --- | --- |"]
        for r in group:
            s = r["sources"][0]
            source = f"[{Path(s['path']).stem} 第{s['line']}行](../../{s['path']})"
            lines.append(f"| `{r['id']}` | {cell(r['name'])}；{cell(r['deliverableMode'])} | {cell(r['constraints'])} | {source} |")
        lines.append("")
    lines += ["## 后续交接", "",
              "A02～A08可按各自需求包并行，保留已有外形确认；同一人物先基础定稿再扩差分。A09先复核镜头并取得所需定稿，A10按就绪镜头制作，A11滚动检查，SUI-I唯一导入。", "",
              "外形未设的配角、更大截幅和8个补选镜头仍需对应任务提交具体问题；本表不代为补设。原文件变化后须重新核对锚点和指纹，再更新索引及本表。", ""]
    return "\n".join(lines)


def verify():
    checks = []

    def check(name, issues, detail=None):
        checks.append({"name": name, "status": "fail" if issues else "pass",
                       "issues": issues, "detail": detail})

    def read(name):
        return json.loads((OUT / name).read_text())

    req = read("requirements.json")["requirements"]
    ids = [r["id"] for r in req]
    check("需求键与唯一责任包", [r["id"] for r in req if r["owner"] not in
          {f"SUI-A{i:02}" for i in range(2, 10)}] + ([] if len(ids) == len(set(ids)) else ["重复需求键"]), len(req))
    anchor_issues, seen_paths, source_rows = [], set(), 0
    for r in req:
        if not r["sources"]:
            anchor_issues.append(r["id"] + ":无来源")
        for s in r["sources"]:
            source_rows += 1
            p = ROOT / s["path"]
            seen_paths.add(s["path"])
            if not p.is_file():
                anchor_issues.append(s["path"] + ":缺文件")
                continue
            lines = p.read_text().splitlines()
            line = s["line"]
            if sha(p) != s["sha256"]:
                anchor_issues.append(s["path"] + ":指纹已变")
            if not (0 < line <= len(lines)) or s["quote"] not in lines[line - 1]:
                anchor_issues.append(r["id"] + ":原文行锚点不匹配")
    check("逐项来源指纹及原文锚点", anchor_issues, source_rows)
    stories = {"scenario/" + x for x in ["第一章-回到毕节.md", "第二章-十四天.md", "第三章-选一条路.md",
               "罗小满-练习本.md", "周栀-十一点四十七分.md", "孟遥-旧题.md", "飘-空白页.md",
               "黄球球-门后.md", "朋友与职业-夜班.md", "跨路线-第36天的消息.md", "后日谈-他们的日子.md", "后日谈-未写完的安排.md"]}
    check("12份实际正文覆盖", sorted(stories - seen_paths), sorted(stories & seen_paths))
    inv = read("source-inventory.json")
    source_issues = []
    for f in inv["files"]:
        p = Path(f["path"])
        if not p.is_file() or sha(p) != f["sha256"]:
            source_issues.append(f["path"] + ":缺失或变化")
        if f["copyToCurrentAllowed"] or f["adoptedInSuika3"]:
            source_issues.append(f["path"] + ":错误自动采用")
    check("精确白名单与未自动采用", source_issues, len(inv["files"]))
    samples = read("local-sample-inventory.json")
    check("既有示例位图保护", [s["path"] for s in samples["images"] if sha(ROOT / s["path"]) != s["sha256"]], len(samples["images"]))
    before = read("input-before.json")["files"]
    completion_before = read("completion-before.json")["files"]
    # 根入口属于并行SUI-E；仅记录变化，不将它作为A01不变验收或恢复旧文件。
    runtime_observations = [{"path": f["path"], "beforeSha256": f["sha256"],
                             "currentSha256": sha(ROOT / f["path"]),
                             "changed": sha(ROOT / f["path"]) != f["sha256"],
                             "owner": "SUI-E", "writtenByA01": False}
                            for f in completion_before if f["path"] in ["main.ray", "config.ini", "start.novel"]]
    protected = [f for f in completion_before if f["path"].startswith(("scenario/", "docs/人物/"))]
    protected += [f for f in before if f["path"] == "docs/CG当前选择.json"]
    check("本次收尾正文人物与原CG选择保护", [f["path"] for f in protected if sha(ROOT / f["path"]) != f["sha256"]], len(protected))
    cg = read("cg-status-index.json")
    selection = json.loads((ROOT / cg["source"]).read_text())
    expected_retired = set(selection["retiredRouteIds"])
    actual_retired = {r["id"] for r in cg["items"] if r["selectionStatus"] == "取消生产"}
    check("CG选择保全与无制作放行", [] if expected_retired == actual_retired and len(cg["items"]) == 60 and
          all(not r["productionReady"] for r in cg["items"]) and sha(ROOT / cg["source"]) == cg["sha256"] else ["CG索引不一致"], cg["counts"])
    ui = json.loads((ROOT / "system/sui-u/integration.json").read_text())
    main_doc = ROOT / "docs/美术/SUI-A01.md"
    check("SUI-U横屏接口对齐", [] if ui["canvas"] == {"width":1280,"height":720,"orientation":"landscape"} and
          ui["criticalArtRectRecommendation"] == [64,96,1152,322] and
          ui["message"]["rect"] == [48,490,1184,206] and ui["name"]["rect"] == [76,442,240,48] and
          ui["menuRect"] == [1104,24,128,56] and
          ui["choice"] == {"x":120,"firstY":104,"stepY":96,"width":1040,"height":88,"fontSize":28} and
          "[64,96,1152,322]" in main_doc.read_text() and "v0.2" in main_doc.read_text() else ["画布或安全区未同步"])
    req_doc = OUT / "正文资源需求.md"
    check("人读需求表与JSON一致", [] if req_doc.is_file() and req_doc.read_text() == requirements_markdown() else ["需求表缺失或未同步"])
    own_docs = [main_doc, OUT / "来源盘点.md", OUT / "正文资源需求.md", OUT / "技术对齐.md", OUT / "交接.md"]
    bad_links = []
    for p in own_docs:
        if not p.exists():
            bad_links.append(str(p) + ":交付缺失")
            continue
        for url in re.findall(r"\]\(([^)]+)\)", p.read_text()):
            url = unquote(url.strip("<>"))
            if "://" in url or url.startswith("#"):
                continue
            target = url.split("#")[0]
            if target and not (p.parent / target).exists():
                bad_links.append(str(p.relative_to(ROOT)) + ":" + url)
    check("A01交付本地链接", bad_links)
    inputs = set(seen_paths) | {f["path"] for f in before} | {
        "scenario/规则契约.md", "system/sui-u/integration.json", "system/sui-u/config.patch.json",
        "system/sui-u/asset-manifest.json", "qa/sui-u-20261028/交接.md", "qa/suika3-spike-20261028/交接.md",
        "qa/suika3-spike-20261028/build-manifest.json", "qa/sui-c-20261028/交接.md",
        "tools/runtime/build.cjs", "qa/sui-e-20261028/build-manifest.json"}
    snapshot = [{"path": str(p), "sha256": sha(ROOT / p), "bytes": (ROOT / p).stat().st_size}
                for p in sorted(inputs) if (ROOT / p).is_file()]
    current = {r["path"]: r for r in snapshot}
    changed = [f["path"] for f in before if f["path"] in current and current[f["path"]]["sha256"] != f["sha256"]]
    dump("input-final.json", {"date": "2026-10-28", "files": snapshot, "changedSinceInitialSnapshot": changed,
          "note": "其他任务已更新SUI-S/T/C/U，SUI-E已更新根入口且仍在并行实现；TODO含A01最终登记。初始快照保留；根入口按completion-before核对，不把其他任务变更记为A01修改。"})
    report = {"task": "SUI-A01", "status": "pass" if all(c["status"] == "pass" for c in checks) else "fail",
              "checks": checks, "parallelRuntimeObservations": runtime_observations,
              "scope": "资源索引、元数据、来源保护、文档与接口一致性；SUI-E根入口只记并行快照，不验不变或运行；未重新运行引擎或浏览器"}
    dump("verification.json", report)
    print(json.dumps({"status": report["status"], "checks": len(checks), "failures": [c for c in checks if c["status"] == "fail"]}, ensure_ascii=False))
    if report["status"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    if sys.argv[1:] == ["samples"]:
        sample_inventory()
    elif sys.argv[1:] == ["verify"]:
        verify()
    elif sys.argv[1:] == ["render"]:
        (OUT / "正文资源需求.md").write_text(requirements_markdown())
        print("已从requirements.json生成正文资源需求.md")
    else:
        raise SystemExit("用法：python3 qa/SUI-A01-20261028/check-a01.py samples|render|verify")
