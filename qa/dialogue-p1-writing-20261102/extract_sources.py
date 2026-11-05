#!/usr/bin/env python3
"""提取 P1 中文试写的冻结来源段落，供逐段映射与复核。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "qa/dialogue-p0-20261102/paragraph-registry.json"
OUT = Path(__file__).with_name("source-paragraphs.json")

SCOPES = [
    {
        "sample": "网吧多人",
        "file": "scenario/第一章-回到毕节.md",
        "code": "C01",
        "firstLine": 15,
        "lastLine": 113,
        "controlFirstLine": 15,
        "controlLastLine": 113,
    },
    {
        "sample": "飘LOW",
        "file": "scenario/飘-空白页.md",
        "code": "PI",
        "firstLine": 1160,
        "lastLine": 1346,
        "controlFirstLine": 1147,
        "controlLastLine": 1356,
    },
    {
        "sample": "孟遥",
        "file": "scenario/孟遥-旧题.md",
        "code": "MY",
        "firstLine": 463,
        "lastLine": 825,
        "controlFirstLine": 455,
        "controlLastLine": 825,
    },
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    result = {
        "baselineFingerprint": registry["baselineFingerprint"],
        "sourceBuildId": registry["contentBuildId"],
        "samples": [],
    }
    for scope in SCOPES:
        path = ROOT / scope["file"]
        lines = path.read_text(encoding="utf-8").splitlines()
        paragraphs = [
            {
                "id": p["id"],
                "line": p["line"],
                "sha256": p["sha256"],
                "condition": p["condition"],
                "text": lines[p["line"] - 1],
            }
            for p in registry["paragraphs"]
            if p["file"] == scope["file"]
            and scope["firstLine"] <= p["line"] <= scope["lastLine"]
        ]
        controls = [
            {"line": number, "text": lines[number - 1]}
            for number in range(scope["controlFirstLine"], scope["controlLastLine"] + 1)
            if lines[number - 1].startswith("<!-- ")
            or lines[number - 1].startswith("**选择 ")
            or lines[number - 1].startswith("#### 结局 ")
        ]
        result["samples"].append({
            **scope,
            "sourceSha256": sha256(path),
            "nextSerialAtExtraction": registry["nextSerial"][scope["file"]],
            "paragraphs": paragraphs,
            "controls": controls,
        })
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    compact = ["# P1 中文试写冻结来源（紧凑校读稿）", ""]
    for sample in result["samples"]:
        compact.extend([
            f"## {sample['sample']}",
            "",
            f"来源：`{sample['file']}`；SHA-256：`{sample['sourceSha256']}`。",
            "",
        ])
        compact.extend(
            f"- `{p['id']}`（原行 {p['line']}）：{p['text']}"
            for p in sample["paragraphs"]
        )
        compact.extend(["", "### 控制与选择标记", "", "```text"])
        compact.extend(f"{c['line']}: {c['text']}" for c in sample["controls"])
        compact.extend(["```", ""])
    OUT.with_suffix(".md").write_text("\n".join(compact), encoding="utf-8")
    for sample in result["samples"]:
        print(
            f"{sample['sample']}: {len(sample['paragraphs'])} 段，"
            f"{len(sample['controls'])} 条控制/选择/结局标记，"
            f"nextSerial={sample['nextSerialAtExtraction']:06d}"
        )
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
