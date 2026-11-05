#!/usr/bin/env python3
"""核对GitHub服务器附件指纹、标签与发布说明，并确认旧版本未改写。"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent
REPO = '279905028/Suika3'
VERSION = 'v1.1.0-beta.2'
EXPECT_DRAFT = '--draft' in sys.argv


def api(path):
    return json.loads(subprocess.check_output(['gh', 'api', 'repos/' + REPO + '/' + path]))


def sha(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


if EXPECT_DRAFT:
    candidates = [x for x in api('releases?per_page=100') if x['tag_name'] == VERSION]
    assert len(candidates) == 1, '未找到唯一的beta.2草稿'
    release = candidates[0]
else:
    release = api('releases/tags/' + VERSION)
assert release['prerelease'] and release['draft'] == EXPECT_DRAFT
local = ROOT / 'dist' / (VERSION + '-release')
files = {p.name: p for p in local.iterdir() if p.is_file()}
assets = {x['name']: x for x in release['assets']}
assert set(files) == set(assets), {'missing': sorted(set(files) - set(assets)), 'extra': sorted(set(assets) - set(files))}
checks = []
for name, file in sorted(files.items()):
    item = assets[name]
    digest = sha(file)
    assert item['state'] == 'uploaded' and item['size'] == file.stat().st_size, name
    assert item['digest'] == 'sha256:' + digest, name
    checks.append({'name': name, 'bytes': item['size'], 'sha256': digest,
                   'remoteDigest': item['digest'], 'url': item['browser_download_url'], 'pass': True})
manifest = json.loads((local / 'release-manifest.json').read_text())
tag = api('git/ref/tags/' + VERSION)['object']
assert tag['type'] == 'tag'
target = api('git/tags/' + tag['sha'])['object']
assert target['type'] == 'commit' and target['sha'] == manifest['sourceCommit']
assert release['target_commitish'] == manifest['sourceCommit']
assert release['body'].rstrip() == (QA / 'github-release-notes.md').read_text().rstrip()
old = api('releases/tags/v1.1.0-beta.1')
old_expected = json.loads((ROOT / 'qa/github-release-20261030/release-verification.json').read_text())
old_assets = {x['name']: x for x in old['assets']}
assert old['target_commitish'] == old_expected['sourceCommit'] and not old['draft'] and old['prerelease']
assert set(old_assets) == {x['name'] for x in old_expected['assets']}
for x in old_expected['assets']:
    actual = old_assets[x['name']]
    assert actual['digest'] == 'sha256:' + x['sha256'] and actual['size'] == x['bytes']
report = {'pass': True, 'releaseId': release['id'], 'url': release['html_url'],
          'tag': VERSION, 'draft': release['draft'], 'prerelease': release['prerelease'],
          'publishedAt': release['published_at'], 'sourceCommit': target['sha'], 'tagObject': tag['sha'],
          'remoteMain': api('git/ref/heads/main')['object']['sha'],
          'remoteReleaseBranch': api('git/ref/heads/codex/release-v1.1.0-beta.2')['object']['sha'],
          'oldBeta1Preserved': True, 'assets': checks,
          'validation': '8个附件服务器SHA-256、字节数、状态与本机一致；注释标签指向发布源码；beta.1附件和目标提交保持。'}
(QA / ('upload-verification.json' if EXPECT_DRAFT else 'release-verification.json')).write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'pass': True, 'url': report['url'], 'draft': report['draft'],
                  'assetsVerified': len(checks), 'oldBeta1Preserved': True,
                  'sourceCommit': target['sha'], 'remoteMain': report['remoteMain']}, ensure_ascii=False))
