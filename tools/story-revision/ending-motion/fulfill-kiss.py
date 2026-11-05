#!/usr/bin/env python3
"""Submit approved kiss drafts once, recover by submit ID, and download originals."""

import hashlib
import json
import subprocess
import sys
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
QA = ROOT / "qa/kiss-motion-20261104"
PLAN = ROOT / "docs/美术/亲吻动态CG-20261104/绑定计划.json"
DRAFT = QA / "draft-state.json"
RUN = QA / "run-result.json"
STATUS = QA / "operation-status.json"
DOWNLOADS = QA / "downloads.json"
plan = json.loads(PLAN.read_text())
draft = json.loads(DRAFT.read_text())
project = draft["projectId"]
jobs = draft["items"]
VERSION = "v001"
if "--revision" in sys.argv:
    VERSION = "v002"
    PLAN = QA / "revision-plan.json"
    DRAFT = QA / "revision-draft-state.json"
    RUN = QA / "revision-run-result.json"
    STATUS = QA / "revision-operation-status.json"
    DOWNLOADS = QA / "revision-downloads.json"
    plan = json.loads(PLAN.read_text())
    draft = json.loads(DRAFT.read_text()) if DRAFT.exists() else {
        **draft, "items": {},
    }
    jobs = draft["items"]


def save(path, data):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)


def call(*args):
    process = subprocess.run(
        ["dreamina-canvas", *args, "--project-id", project],
        cwd=ROOT, capture_output=True, text=True, timeout=120, check=False,
    )
    try:
        return json.loads(process.stdout)
    except ValueError:
        raise RuntimeError(f"即梦未返回结构化结果：{args[:2]}, exit={process.returncode}") from None


def pick(obj, keys):
    return {key: obj[key] for key in keys if key in obj}


def safe(response):
    return {"ok": response.get("ok"), "requestId": response.get("meta", {}).get("requestId"),
            "error": pick(response.get("error") or {}, ("code", "reason", "requiredAction", "retryable"))}


def require(response):
    if not response.get("ok"):
        raise RuntimeError(safe(response))
    return response["data"]


def media(data):
    return [pick(r, ("resourceId", "state", "serviceCode", "retryable", "requiredAction"))
            for r in data.get("resources", [])]


def expected_prompt(item):
    refs = [(r["role"], draft["references"][r["assetId"]]["nodeId"])
            for r in item["visual"]["references"]]
    prompt = "。".join(role + " {{node:" + node_id + "}}" for role, node_id in refs)
    return refs, prompt + "。" + item["visual"]["prompt"]


def prepare_revision():
    assert VERSION == "v002"
    for item in plan["items"]:
        key = item["key"]
        job = jobs.setdefault(key, {"updateId": str(uuid.uuid4()), "submitId": str(uuid.uuid4())})
        if job.get("nodeId"):
            continue
        save(DRAFT, draft)
        refs, prompt = expected_prompt(item)
        node_args = [v for _, node in refs for v in ("--ref", f"node:{node}")]
        result = call("node", "create", "video", "--title", f'{key} {item["title"]} v002',
                      "--mode", item["visual"]["mode"], "--model", plan["model"], "--ratio", plan["ratio"],
                      "--duration", str(plan["duration"]), "--resolution", plan["resolution"],
                      "--count", "1", "--prompt", prompt, "--update-id", job["updateId"], *node_args)
        job.update(nodeId=require(result)["node"]["nodeId"],
                   draftRequestId=result.get("meta", {}).get("requestId"))
        save(DRAFT, draft)
        print(f"{key} 返修草稿已保存", flush=True)


def submit():
    if RUN.exists():
        raise SystemExit("已有提交记录，只用原提交编号查状态")
    node_args = [v for job in jobs.values() for v in ("--node-id", job["nodeId"])]
    shown = require(call("node", "show", *node_args))
    nodes = {i["node"]["nodeId"]: i["node"] for i in shown["nodes"] if i["result"] == "FOUND"}
    assert len(nodes) == len(jobs) == len(plan["items"])
    for item in plan["items"]:
        node = nodes[jobs[item["key"]]["nodeId"]]
        refs, prompt = expected_prompt(item)
        generation = node["generation"]
        expected = {"model": plan["model"], "mode": item["visual"]["mode"], "resolution": plan["resolution"],
                    "ratio": plan["ratio"], "durationSeconds": plan["duration"], "outputCount": 1}
        assert node["status"] == "empty" and not node.get("resources"), item["key"]
        assert pick(generation, expected) == expected, item["key"]
        assert generation["prompt"] == prompt, item["key"]
        assert [(r["kind"], r["id"]) for r in generation["references"]] == [
            ("node", node_id) for _, node_id in refs], item["key"]
    quote = require(call("node", "quote", *node_args))
    ceiling = quote["totalMaxCredits"]
    assert {i["nodeId"] for i in quote["items"]} == set(nodes)
    assert sum(i["maxCredits"] for i in quote["items"]) == ceiling
    if VERSION == "v002":
        approved_quote = json.loads((QA / "revision-quote.json").read_text())
        if ceiling > approved_quote["totalMaxCredits"]:
            raise SystemExit("返修的即时报价超过已批准上限")
    confirmed = call("node", "confirm", *node_args, "--credit-ceiling", str(ceiling))
    details = require(confirmed)
    assert details["creditCeiling"] == ceiling
    record = {"phase": "submission-in-progress", "ceiling": ceiling, "confirmation": safe(confirmed),
              "jobs": {k: pick(v, ("nodeId", "submitId")) for k, v in jobs.items()}}
    save(RUN, record)
    submit_ids = [v for job in jobs.values() for v in ("--submit-id", job["submitId"])]
    response = call("node", "run", *node_args, *submit_ids,
                    "--credit-token", details["creditConfirmationToken"])
    data = response.get("data") or response.get("partialData") or {}
    entries = [pick(i, ("nodeId", "submitId", "state")) | {"resources": media(i),
               "error": pick(i.get("error") or {}, ("code", "serviceCode", "reason"))}
               for i in data.get("items", [])]
    record.update(safe(response), phase="submission-returned", items=entries)
    save(RUN, record)
    print(json.dumps({"ceiling": ceiling, "requestId": record["requestId"],
                      "states": Counter(i.get("state", "unknown") for i in entries),
                      "error": record["error"]}, ensure_ascii=False))


def status():
    assert RUN.exists()

    def inspect(pair):
        key, job = pair
        response = call("operation", "status", job["submitId"])
        data = response.get("data") or response.get("partialData") or {}
        submission = data.get("submission") or {}
        return {"key": key, **safe(response), **pick(data, ("state", "operationRef")),
                "submission": pick(submission, ("state", "resubmittable", "adviceCode")),
                "submissionError": pick(data.get("submissionError") or {},
                                        ("serviceCode", "reason", "retryable", "requiredAction")),
                "resources": media(data)}

    with ThreadPoolExecutor(max_workers=6) as pool:
        records = list(pool.map(inspect, jobs.items()))
    save(STATUS, records)
    print(json.dumps(Counter(r.get("state", "unknown") for r in records), ensure_ascii=False))


def download():
    states = json.loads(STATUS.read_text())
    records = json.loads(DOWNLOADS.read_text()) if DOWNLOADS.exists() else {}
    for result in states:
        key = result["key"]
        if result.get("state") != "succeeded" or key in records:
            continue
        ready = [r for r in result["resources"] if r.get("state") == "succeeded"]
        assert len(ready) == 1, key
        rid = ready[0]["resourceId"]
        path = ROOT / "assets/sources/20261104/亲吻动态CG" / key / f"raw-{VERSION}.mp4"
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(f"download-{VERSION}.part.mp4")
        if path.exists() or partial.exists():
            raise RuntimeError(f"发现未登记下载文件，先核对：{key}")
        response = call("resource", "download", rid, "--output", str(partial))
        data = require(response)
        sha = hashlib.sha256(partial.read_bytes()).hexdigest()
        assert sha == data["sha256"] and partial.stat().st_size == data["size"] > 0, key
        partial.replace(path)
        records[key] = {"resourceId": rid, "path": str(path.relative_to(ROOT)), "sha256": sha,
                        "bytes": data["size"], "requestId": response.get("meta", {}).get("requestId")}
        save(DOWNLOADS, records)
        print(f"{key} 已下载并核对指纹", flush=True)


if __name__ == "__main__":
    {"prepare-revision": prepare_revision, "submit": submit, "status": status,
     "download": download}[sys.argv[1]]()
