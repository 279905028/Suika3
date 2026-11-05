#!/usr/bin/env python3
"""Join verified candidate media to its authored binding and build a review page."""

import hashlib
import json
import os
from html import escape
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[3]
QA = ROOT / "qa/kiss-motion-20261104"
DOC = ROOT / "docs/美术/亲吻动态CG-20261104"


def read(path):
    return json.loads(path.read_text())


def local_url(path):
    return quote(os.path.relpath(ROOT / path, QA))


def verified(record):
    asset = ROOT / record["path"]
    assert asset.stat().st_size == record["bytes"]
    assert hashlib.sha256(asset.read_bytes()).hexdigest() == record["sha256"]
    return record


plan = read(DOC / "绑定计划.json")
selection = read(QA / "visual-selection.json")
revision_drafts = read(QA / "revision-draft-state.json")["items"]
source_drafts = read(QA / "draft-state.json")["items"]
downloads = read(QA / "downloads.json")
revision_downloads = read(QA / "revision-downloads.json") if (QA / "revision-downloads.json").exists() else {}
formal = read(ROOT / "docs/整合/bindings.json")
assert plan["buildId"] == formal["contentBuildId"]
bindings = {row["anchor"]["nodeId"]: row for row in formal["bindings"]}
result = []
cards = []

for item in plan["items"]:
    key = item["key"]
    anchor = item["anchor"]
    binding = bindings[anchor["nodeId"]]
    assert binding["condition"] == item["condition"] and binding["routeIds"] == [item["route"]]
    assert all(binding["anchor"][field] == anchor[field] for field in binding["anchor"])
    assert hashlib.sha256((ROOT / anchor["file"]).read_bytes()).hexdigest() == formal["sourceHashes"][anchor["file"]]
    note = selection.get(key)
    entry = {k: item[k] for k in ("key", "title", "route", "anchor", "condition", "entryEvents", "binding")}
    if note and note.get("version"):
        version = note["version"]
        if version == "v002":
            report = read(QA / key / version / "media-check.json")
            original = verified(revision_downloads[key])
            job = revision_drafts[key]
        else:
            report = read(QA / key / ("cut-media-check.json" if version == "v001-cut" else "media-check.json"))
            original = verified(downloads[key])
            job = source_drafts[key]
        entry.update(status="planned-with-reviewed-media", version=version,
                     visualReview=note["note"], original=original,
                     playback=verified(report["runtime"]), poster=verified(report["first"]),
                     lastFrame=verified(report["last"]),
                     dreamina={k: job[k] for k in ("nodeId", "submitId")})
    else:
        entry.update(status="planned-awaiting-visual-pass",
                     visualReview=note["note"] if note else "等待返修成片核对")
    result.append(entry)
    heading = escape(f"{key} · {item['title']}")
    desc = escape(entry["visualReview"])
    gate = "本线共同" if item["condition"] == "ALL" else item["condition"].replace("&", "、")
    if item["entryEvents"]:
        gate += " · 隐藏路线入场门禁"
    if "playback" in entry:
        url = local_url(entry["playback"]["path"])
        poster = local_url(entry["poster"]["path"])
        player = f'<video controls muted playsinline preload="none" poster="{poster}" src="{url}"></video>'
        link = f'<a href="{url}">打开 MP4</a>'
    else:
        player = '<div class="pending">等待可用于绑定的成片</div>'
        link = ""
    cards.append(f'<article><h2>{heading}</h2>{player}<p>{escape(gate)}</p><p>{desc}</p>{link}</article>')

ready = sum(row["status"] == "planned-with-reviewed-media" for row in result)
selection_manifest = {"schemaVersion": 1, "status": "binding-plan", "buildId": plan["buildId"],
                      "sceneCount": len(result), "reviewedMediaCount": ready, "runtimeBindingCount": 0,
                      "items": result}
(DOC / "成片与绑定.json").write_text(json.dumps(selection_manifest, ensure_ascii=False, indent=2) + "\n")
style = """
*{box-sizing:border-box}body{margin:0;background:#151b23;color:#f1f5f9;font:16px/1.55 system-ui,sans-serif}
main{max-width:1400px;margin:auto;padding:2rem}h1{font-size:2rem;margin:0}
header p,article p{color:#c4cfdc}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:1rem}
article{min-width:0;background:#202936;border-radius:12px;padding:1rem}h2{font-size:1rem;margin:0 0 .6rem}
video,.pending{width:100%;aspect-ratio:16/9;background:#0b0f15;border-radius:6px}
.pending{display:grid;place-items:center;color:#abb8c8}a{color:#a1d8ff}
"""
markup = (f'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" '
          f'content="width=device-width,initial-scale=1"><title>Suika3 · 亲吻动态 CG</title><style>{style}</style>'
          f'<main><header><h1>Suika3 · 亲吻动态 CG</h1><p>{ready} / {len(result)} 段已核对成片。'
          f'下方为计划绑定的静音候选。点击逐段播放。</p></header><section>'
          + "".join(cards) + "</section></main></html>")
(QA / "index.html").write_text(markup, encoding="utf-8")
print(f"{ready}/{len(result)} 段成片已登记到绑定计划")
