#!/usr/bin/env python3
"""生成 P1 中文试写的逐段来源映射；不写正式登记表。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).parent
BASE = ROOT / "docs/修订协作/P1-中文小样-20261102"

CANDIDATES = {
    "网吧多人": BASE / "共通/01-网吧多人-待采用.md",
    "飘LOW": BASE / "飘/02-飘LOW关系确认与收束-待采用.md",
    "孟遥": BASE / "孟遥/03-MY07-MY09条件段-待采用.md",
}

# 只列退役原段；保留原ID的段落由脚本从候选稿自动登记。
SPLITS = {
    "网吧多人": {
        2: range(243, 247), 3: range(247, 250), 7: range(250, 252),
        10: range(252, 254), 21: range(254, 256), 22: range(256, 258),
        23: range(258, 260), 32: range(260, 263), 35: range(263, 265),
        37: range(265, 267), 40: range(267, 269), 43: range(271, 273),
        44: range(273, 276),
    },
    "飘LOW": {
        464: [507, 508], 465: range(509, 514), 466: range(515, 518),
        468: range(518, 522), 469: range(522, 526), 470: range(526, 530),
        472: range(532, 535), 473: range(535, 540), 474: range(540, 545),
        475: [545, 546], 477: range(547, 550), 478: range(550, 553),
        479: range(553, 556), 481: range(556, 561), 482: range(561, 565),
        483: range(565, 569), 484: range(569, 573), 485: range(573, 576),
        486: range(576, 581), 487: range(581, 586), 488: [586, 587],
        489: range(588, 592), 491: range(592, 598), 492: range(598, 601),
        495: range(601, 605), 496: range(605, 608), 497: range(608, 613),
        498: range(613, 619), 499: range(619, 623),
        503: range(623, 627), 504: range(627, 635),
        505: [645, 635, 636, 637, 638], 506: range(639, 645),
    },
    "孟遥": {
        190: [373, 374], 195: range(375, 378), 198: range(378, 381),
        201: range(381, 384), 203: range(384, 387), 207: range(387, 390),
        209: range(390, 393), 212: range(393, 396), 216: range(396, 399),
        222: range(399, 402), 223: [402, 403], 226: [404, 405],
        230: range(406, 409), 234: range(409, 412), 235: [412, 413],
        242: [415, 416], 243: range(417, 420), 245: range(420, 423),
        248: range(423, 427), 249: range(427, 431), 252: range(431, 437),
        254: range(437, 441), 255: range(441, 444), 256: range(444, 448),
        257: range(448, 453), 262: range(453, 456), 263: range(456, 461),
        267: range(461, 465), 268: [465, 466], 270: range(467, 470),
        272: range(470, 473), 273: [473, 474], 274: range(475, 479),
        275: range(479, 483), 279: range(485, 488), 280: [488, 490, 491],
        281: range(492, 496), 283: [496, 497], 291: range(498, 501),
        294: range(501, 505), 295: range(505, 508), 297: range(508, 511),
        298: range(511, 514), 300: [514, 515], 301: range(516, 521),
        302: range(521, 525), 305: range(525, 528), 306: range(528, 531),
        308: [531], 310: [532, 533], 313: range(534, 539),
        315: [539, 540], 317: [541, 542], 319: range(544, 547),
        321: [547, 548], 323: [549, 550], 325: range(553, 556),
    },
}

BRANCHES = {
    "网吧多人": ["C01-01=A", "C01-01=B", "共同段"],
    "飘LOW": ["PIAO_RELATION=LOW", "PI-L06-01=A", "PI-L06-01=B", "PI-LE1", "PI-LE2"],
    "孟遥": ["MY07=A/MY09=A", "MY07=A/MY09=B", "MY07=B/MY09=A", "MY07=B/MY09=B"],
}


def ids(code: str, values) -> list[str]:
    return [f"T-{code}-{value:06d}" for value in values]


def candidate_ids(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    return re.findall(r'^<!-- TEXT \{"id":"(T-[A-Z0-9]+-[0-9]{6})"', text, re.M)


def reason(sample: str, old_serial: int) -> str:
    if sample == "飘LOW" and old_serial == 483:
        return "拆开双方回应与动作；删去地点和缘由不明的‘最后一箱’，不补新去向"
    if sample == "飘LOW" and old_serial in {503, 504, 505, 506}:
        return "把关系决定、对方回应与生活落点改为完整对白和可见动作，保留原结局"
    return "拆分原有动作、转述、消息与单人发言；不改变场景事实或分支作用"


def main() -> None:
    sources = json.loads((QA / "source-paragraphs.json").read_text(encoding="utf-8"))
    output = {
        "baselineFingerprint": sources["baselineFingerprint"],
        "sourceBuildId": sources["sourceBuildId"],
        "status": "P1中文试写待采用；未写正式段落登记",
        "samples": [],
        "unresolved": [],
    }
    for source in sources["samples"]:
        name = source["sample"]
        code = source["code"]
        old_ids = [p["id"] for p in source["paragraphs"]]
        current_ids = candidate_ids(CANDIDATES[name])
        changes = []
        mapped_new = []
        for old_serial, new_serials in SPLITS[name].items():
            new_ids = ids(code, new_serials)
            mapped_new.extend(new_ids)
            changes.append({
                "operation": "split",
                "oldIds": ids(code, [old_serial]),
                "newIds": new_ids,
                "reason": reason(name, old_serial),
                "conditionChanged": False,
                "bindingReview": "pending",
            })
        retained = [old for old in old_ids if old in current_ids]
        unmapped_new = [new for new in current_ids if new not in old_ids and new not in mapped_new]
        output["samples"].append({
            "sample": name,
            "sourceFile": source["file"],
            "sourceSha256": source["sourceSha256"],
            "candidateFile": str(CANDIDATES[name].relative_to(ROOT)),
            "affectedBranches": BRANCHES[name],
            "newInformation": [],
            "retainedIds": retained,
            "changes": changes,
            "candidateParagraphCount": len(current_ids),
            "nextSerialAfterCandidate": max(int(x.rsplit("-", 1)[1]) for x in current_ids) + 1,
            "unmappedNewIds": unmapped_new,
            "missingSourceIds": [old for old in old_ids if old not in retained and old not in {c["oldIds"][0] for c in changes}],
        })
    path = QA / "source-map.json"
    path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(path.relative_to(ROOT))
    for sample in output["samples"]:
        print(
            f"{sample['sample']}: 保留{len(sample['retainedIds'])}，"
            f"拆分{len(sample['changes'])}，候选{sample['candidateParagraphCount']}段，"
            f"未映射新ID={len(sample['unmappedNewIds'])}，遗漏原ID={len(sample['missingSourceIds'])}"
        )


if __name__ == "__main__":
    main()
