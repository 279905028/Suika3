#!/usr/bin/env python3
"""P1 中文试写静态校验；不冒充编译器、姓名运行或存档验收。"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).parent
CONTRACT_PATH = ROOT / "docs/修订协作/P0-基线与规则-20261102/format-contract.json"
SPEAKERS_PATH = ROOT / "docs/修订协作/P0-基线与规则-20261102/speakers.json"
REGISTRY_PATH = ROOT / "qa/dialogue-p0-20261102/paragraph-registry.json"

TEXT_RE = re.compile(r'^<!-- TEXT (\{.*\}) -->$')
ID_RE = re.compile(r'^T-([A-Z0-9]+)-([0-9]{6})$')
CONTROL_RE = re.compile(r'^<!-- (?!TEXT )(.+) -->$')


def strict_json(raw: str):
    def no_duplicates(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"重复字段 {key}")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=no_duplicates)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compact_count(text: str) -> int:
    return len(re.sub(r"[\s，。！？；：、“”‘’（）—…·,.!?;:\-]", "", text))


def parse_candidate(path: Path):
    lines = path.read_text(encoding="utf-8").splitlines()
    paragraphs = []
    errors = []
    for index, line in enumerate(lines):
        match = TEXT_RE.match(line)
        if not match:
            continue
        try:
            metadata = strict_json(match.group(1))
        except (json.JSONDecodeError, ValueError) as exc:
            errors.append(f"{path.name}:{index + 1} JSON无效：{exc}")
            continue
        body_index = index + 1
        if body_index >= len(lines) or not lines[body_index].strip():
            errors.append(f"{path.name}:{index + 1} TEXT后缺一行正文")
            continue
        if body_index + 1 < len(lines) and lines[body_index + 1].strip():
            errors.append(f"{path.name}:{index + 1} 一个TEXT覆盖了多行正文")
        paragraphs.append({
            "line": index + 1,
            "metadata": metadata,
            "text": lines[body_index],
        })
    return paragraphs, errors


def controls(lines: list[str]) -> list[str]:
    return [
        line for line in lines
        if CONTROL_RE.match(line) or line.startswith("**选择 ") or line.startswith("#### 结局 ")
    ]


def check_if_balance(lines: list[str], name: str) -> list[str]:
    stack = []
    errors = []
    for number, line in enumerate(lines, 1):
        match = CONTROL_RE.match(line)
        if not match:
            continue
        marker = match.group(1)
        if marker.startswith("IF "):
            stack.append((marker, number))
        elif marker == "ENDIF":
            if not stack:
                errors.append(f"{name}:{number} 多余ENDIF")
            else:
                stack.pop()
    errors.extend(f"{name}:{number} {marker}未闭合" for marker, number in stack)
    return errors


def main() -> None:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    speakers = json.loads(SPEAKERS_PATH.read_text(encoding="utf-8"))["speakers"]
    speaker_map = {s["id"]: s for s in speakers}
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    sources = json.loads((QA / "source-paragraphs.json").read_text(encoding="utf-8"))
    source_map = json.loads((QA / "source-map.json").read_text(encoding="utf-8"))
    errors = []
    warnings = []
    stats = []
    all_candidate_ids = []

    if source_map["baselineFingerprint"] != registry["baselineFingerprint"]:
        errors.append("来源映射的baselineFingerprint与P0登记不一致")
    if source_map["sourceBuildId"] != registry["contentBuildId"]:
        errors.append("来源映射的sourceBuildId与P0登记不一致")

    for source, mapped in zip(sources["samples"], source_map["samples"], strict=True):
        name = source["sample"]
        source_path = ROOT / source["file"]
        candidate_path = ROOT / mapped["candidateFile"]
        if sha256(source_path) != source["sourceSha256"]:
            errors.append(f"{name}：当前scenario源指纹变化")
        if mapped["unmappedNewIds"] or mapped["missingSourceIds"]:
            errors.append(f"{name}：来源映射未闭合")
        paragraphs, parse_errors = parse_candidate(candidate_path)
        errors.extend(parse_errors)
        lines = candidate_path.read_text(encoding="utf-8").splitlines()
        candidate_controls = controls(lines)
        expected_controls = [c["text"] for c in source["controls"]]
        if candidate_controls != expected_controls:
            errors.append(f"{name}：控制/选择/结局标记与冻结来源不一致")
        errors.extend(check_if_balance(lines, name))
        ids = [p["metadata"].get("id", "") for p in paragraphs]
        all_candidate_ids.extend(ids)
        if len(ids) != len(set(ids)):
            errors.append(f"{name}：候选内存在重复ID")
        if len(paragraphs) != mapped["candidateParagraphCount"]:
            errors.append(f"{name}：来源映射中的候选段数不一致")

        kind_counts = Counter()
        candidate_chars = 0
        spoken_chars = 0
        for p in paragraphs:
            meta = p["metadata"]
            text = p["text"]
            line = p["line"]
            if set(meta) != set(contract["requiredFields"]):
                errors.append(f"{name}:{line} 字段集合不符：{sorted(meta)}")
                continue
            pid = meta["id"]
            match = ID_RE.match(pid)
            if not match or not re.match(contract["idPattern"], pid):
                errors.append(f"{name}:{line} ID格式无效 {pid}")
                continue
            if match.group(1) != source["code"]:
                errors.append(f"{name}:{line} ID文件码错误 {pid}")
            serial = int(match.group(2))
            old_serials = {int(x.rsplit("-", 1)[1]) for x in (q["id"] for q in source["paragraphs"])}
            if pid not in {q["id"] for q in source["paragraphs"]} and not (
                source["nextSerialAtExtraction"] <= serial < mapped["nextSerialAfterCandidate"]
            ):
                errors.append(f"{name}:{line} 新ID不在本批候选领取范围 {pid}")
            kind = meta["kind"]
            kind_counts[kind] += 1
            if kind not in contract["channelsByKind"]:
                errors.append(f"{name}:{line} 未知kind {kind}")
                continue
            if meta["channel"] not in contract["channelsByKind"][kind]:
                errors.append(f"{name}:{line} kind/channel组合无效")
            if meta["group"] is not None:
                errors.append(f"{name}:{line} 未审定group必须为空")
            if kind in contract["silentKinds"]:
                if meta["speaker"] is not None or meta["name"] != "":
                    errors.append(f"{name}:{line} 旁白/动作未清空speaker和name")
            else:
                speaker = speaker_map.get(meta["speaker"])
                if not speaker:
                    errors.append(f"{name}:{line} 未登记speaker {meta['speaker']}")
                elif meta["name"] not in speaker["allowedNames"]:
                    errors.append(f"{name}:{line} 称呼越界 {meta['name']}")
                if kind == "thought" and meta["speaker"] not in contract["thoughtSpeakers"]:
                    errors.append(f"{name}:{line} 非文文心声")
            if kind in {"dialogue", "message"}:
                spoken_chars += compact_count(text)
                if text.startswith("“") and text.endswith("”"):
                    errors.append(f"{name}:{line} 对白仍有外层引号")
                if re.match(r"^(文文|毛狼|师匠|孟遥|飘|周栀|陈晟|陈孃)[：:]", text):
                    errors.append(f"{name}:{line} 正文重复姓名前缀")
            candidate_chars += compact_count(text)

        source_chars = sum(compact_count(p["text"]) for p in source["paragraphs"])
        stats.append({
            "sample": name,
            "sourceParagraphs": len(source["paragraphs"]),
            "candidateParagraphs": len(paragraphs),
            "retainedSourceIds": len(mapped["retainedIds"]),
            "splitSourceIds": len(mapped["changes"]),
            "sourceCompactCharacters": source_chars,
            "candidateCompactCharacters": candidate_chars,
            "characterRatio": round(candidate_chars / source_chars, 3),
            "candidateKinds": dict(sorted(kind_counts.items())),
            "candidateSpokenCharacterShare": round(spoken_chars / candidate_chars, 3),
            "controlsPreserved": len(expected_controls),
            "nextSerialAfterCandidate": mapped["nextSerialAfterCandidate"],
        })

    if len(all_candidate_ids) != len(set(all_candidate_ids)):
        errors.append("三个候选之间存在重复ID")

    # 关键内容的机器可定位断言；语义仍由人工审读记录补充。
    piao = (ROOT / source_map["samples"][1]["candidateFile"]).read_text(encoding="utf-8")
    if "<!-- IF PIAO_RELATION=LOW -->" not in piao or "PIAO_RELATION=HIGH" in piao:
        errors.append("飘LOW：外层关系条件错误或混入HIGH")
    if piao.index("<!-- EVENT PIAO-PREGNANCY-READ -->") < piao.index("**选择 PI-L06-01"):
        errors.append("飘LOW：事件已读点早于选择")
    if "回去帮周栀收最后一箱" in piao:
        errors.append("飘LOW：仍有最后一箱歧义")
    for required in ["愿意和你试着交往", "我们没有再开始恋爱", "孩子的事，我和毛狼继续商量"]:
        if required not in piao:
            errors.append(f"飘LOW：缺少关键收束句 {required}")

    my = (ROOT / source_map["samples"][2]["candidateFile"]).read_text(encoding="utf-8")
    for choice in ["MY07-01", "MY08-01", "MY09-01"]:
        if my.count(f"**选择 {choice}｜") != 1:
            errors.append(f"孟遥：{choice}数量不为1")
    for required in [
        "现在还是原来的条件，我不继续",
        "第38天说停下，不是要你多追一次",
        "愿意现在继续。我也得承认这是我自己的决定",
        "婚姻也没有结束",
    ]:
        if required not in my:
            errors.append(f"孟遥：缺少分支边界句 {required}")

    report = {
        "status": "pass" if not errors else "fail",
        "scope": "仅P1中文候选稿静态结构、来源映射和文本尺度；不含TEXT编译、分页、姓名运行、回顾、自动/快进、存读档或浏览器验收",
        "baselineFingerprint": registry["baselineFingerprint"],
        "sourceBuildId": registry["contentBuildId"],
        "errors": errors,
        "warnings": warnings,
        "stats": stats,
        "totalSourceParagraphs": sum(s["sourceParagraphs"] for s in stats),
        "totalCandidateParagraphs": sum(s["candidateParagraphs"] for s in stats),
    }
    out = QA / "verification.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if not errors else 1)


if __name__ == "__main__":
    main()
