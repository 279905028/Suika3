#!/usr/bin/env python3
"""Save the 18 scene drafts and request a quote without starting generation."""

import hashlib
import json
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PLAN = ROOT / "docs/美术/亲吻动态CG-20261104/绑定计划.json"
QA = ROOT / "qa/kiss-motion-20261104"
STATE = QA / "draft-state.json"
plan = json.loads(PLAN.read_text())
project = plan["projectId"]
state = json.loads(STATE.read_text()) if STATE.exists() else {
    "projectId": project, "references": {}, "items": {}
}
assert state["projectId"] == project


def save_state():
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(STATE)


def call(*args):
    result = subprocess.run(
        ["dreamina-canvas", *args, "--project-id", project],
        cwd=ROOT, capture_output=True, text=True, timeout=60, check=False,
    )
    envelope = json.loads(result.stdout)
    request = envelope.get("meta", {}).get("requestId")
    if not envelope.get("ok"):
        error = envelope.get("error", {})
        raise RuntimeError((args[:3], error.get("code"), error.get("reason"), request))
    return envelope["data"], request


def add_reference(ref):
    key = ref["assetId"]
    entry = state["references"].setdefault(key, {
        "resourceId": str(uuid.uuid4()), "updateId": str(uuid.uuid4()),
        "importId": str(uuid.uuid4()), "sha256": ref["sha256"],
    })
    assert entry["sha256"] == ref["sha256"]
    save_state()
    if not entry.get("uploaded"):
        _, request = call("resource", "upload", "--resource-id", entry["resourceId"],
                          "--file", ref["path"], "--type", "image", "--name", key,
                          "--import-kind", "local_upload")
        entry.update(uploaded=True, uploadRequestId=request)
        save_state()
    if not entry.get("nodeId"):
        data, request = call("node", "create", "image", "--title", key,
                             "--resource-id", entry["resourceId"], "--import-kind",
                             "local_upload", "--submit-id", entry["importId"],
                             "--update-id", entry["updateId"])
        entry.update(nodeId=data["node"]["nodeId"], importRequestId=request)
        save_state()
    return entry["nodeId"]


for item in plan["items"]:
    for ref in item["visual"]["references"]:
        source = ROOT / ref["path"]
        if hashlib.sha256(source.read_bytes()).hexdigest() != ref["sha256"]:
            raise ValueError(f"Reference changed since review: {ref['path']}")

for item in plan["items"]:
    key = item["key"]
    entry = state["items"].setdefault(key, {
        "updateId": str(uuid.uuid4()), "submitId": str(uuid.uuid4())
    })
    if entry.get("nodeId"):
        continue
    visual = item["visual"]
    args = []
    reference_text = []
    for ref in visual["references"]:
        node_id = add_reference(ref)
        args += ["--ref", f"node:{node_id}"]
        reference_text.append(ref["role"] + " {{node:" + node_id + "}}")
    prompt = "。".join(reference_text) + "。" + visual["prompt"]
    data, request = call(
        "node", "create", "video", "--title", f'{key} {item["title"]}',
        "--mode", visual["mode"], "--model", plan["model"], "--ratio", plan["ratio"],
        "--duration", str(plan["duration"]), "--resolution", plan["resolution"],
        "--count", "1", "--prompt", prompt, "--update-id", entry["updateId"], *args,
    )
    entry.update(nodeId=data["node"]["nodeId"], draftRequestId=request)
    save_state()
    print(f"{key} 草稿已保存", flush=True)

quote_args = [value for entry in state["items"].values()
              for value in ("--node-id", entry["nodeId"])]
data, request = call("node", "quote", *quote_args)
quote = {
    "requestId": request,
    "summary": {key: value for key, value in data.items()
                if key not in ("consumptionSubject", "items")},
    "items": [{key: value for key, value in item.items()
               if key in ("nodeId", "maxCredits", "state", "error")}
              for item in data.get("items", [])],
}
(QA / "quote.json").write_text(json.dumps(quote, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(quote, ensure_ascii=False), flush=True)
